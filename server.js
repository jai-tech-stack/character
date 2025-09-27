// server.js - Foxmandal Legal AI Assistant with CORS Fix
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { config } from 'dotenv';
import { Pinecone } from '@pinecone-database/pinecone';
import { OpenAI } from 'openai';
import { OpenAIEmbeddings } from '@langchain/openai';
import { v4 as uuidv4 } from 'uuid';
import fileUpload from 'express-fileupload';

config();

console.log('⚖️ FOXMANDAL LEGAL AI - ENV CHECK', {
  openai: !!process.env.OPENAI_API_KEY,
  pinecone: !!process.env.PINECONE_API_KEY,
});

// Express app setup
const app = express();

// Enhanced CORS configuration for live deployment
app.use(cors({
  origin: [
    "http://localhost:5173", 
    "http://localhost:3001",
    "https://foxmandal.in",
    "https://www.foxmandal.in",
    "https://character-kappa.vercel.app",  // Your live frontend URL
    "https://character-kappa.vercel.app/", // With trailing slash
    "https://legal-ai.vercel.app"
  ],
  methods: ["GET", "POST", "OPTIONS"],
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  optionsSuccessStatus: 200
}));

// Preflight handler
app.use((req, res, next) => {
  const allowedOrigins = [
    "http://localhost:5173", 
    "http://localhost:3001",
    "https://foxmandal.in",
    "https://www.foxmandal.in",
    "https://character-kappa.vercel.app",
    "https://legal-ai.vercel.app"
  ];
  
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(bodyParser.json());
app.use(fileUpload({
  limits: { fileSize: 100 * 1024 * 1024 },
  useTempFiles: true,
  tempFileDir: '/tmp/'
}));

// AI clients
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const embeddingsClient = new OpenAIEmbeddings({ apiKey: process.env.OPENAI_API_KEY });

// Pinecone setup for legal knowledge base
const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY,
});

let index;
async function initializePinecone() {
  try {
    console.log(`Checking legal knowledge index "${process.env.PINECONE_INDEX}"...`);
    
    const indexList = await pinecone.listIndexes();
    const indexExists = indexList.indexes?.some(idx => idx.name === process.env.PINECONE_INDEX);
    
    if (indexExists) {
      index = pinecone.index(process.env.PINECONE_INDEX);
      console.log(`⚖️ Legal knowledge base "${process.env.PINECONE_INDEX}" initialized`);
    } else {
      console.log(`Creating legal knowledge index...`);
      
      await pinecone.createIndex({
        name: process.env.PINECONE_INDEX,
        dimension: 1536,
        metric: 'cosine',
        spec: {
          serverless: {
            cloud: 'aws',
            region: 'us-east-1'
          }
        }
      });
      
      await new Promise(resolve => setTimeout(resolve, 10000));
      index = pinecone.index(process.env.PINECONE_INDEX);
    }
  } catch (error) {
    console.error('Failed to initialize legal knowledge base:', error.message);
  }
}

// Legal Analytics System
const legalAnalytics = {
  consultations: new Map(),
  dailyStats: new Map(),
  
  trackConsultation(sessionId, data = {}) {
    if (!this.consultations.has(sessionId)) {
      this.consultations.set(sessionId, {
        sessionId,
        startTime: Date.now(),
        interactions: 0,
        legalArea: null,
        urgency: 'medium',
        clientProfile: {},
        consultationNotes: [],
        outcome: 'ongoing',
        satisfaction: null
      });
    }
    
    const consultation = this.consultations.get(sessionId);
    Object.assign(consultation, data);
    return consultation;
  },
  
  trackLegalInteraction(sessionId, interaction) {
    const consultation = this.trackConsultation(sessionId);
    consultation.interactions++;
    consultation.consultationNotes.push({
      timestamp: Date.now(),
      type: interaction.type,
      content: interaction.content?.substring(0, 200),
      legalArea: interaction.legalArea,
      complexity: interaction.complexity || 'medium'
    });
    
    if (interaction.legalArea && !consultation.legalArea) {
      consultation.legalArea = interaction.legalArea;
    }
    
    this.updateDailyStats(interaction);
  },
  
  updateDailyStats(interaction) {
    const today = new Date().toISOString().split('T')[0];
    
    if (!this.dailyStats.has(today)) {
      this.dailyStats.set(today, {
        date: today,
        totalConsultations: new Set(),
        totalQueries: 0,
        leadsGenerated: 0,
        legalAreas: {},
        avgSatisfaction: 0
      });
    }
    
    const stats = this.dailyStats.get(today);
    stats.totalQueries++;
    
    if (interaction.sessionId) {
      stats.totalConsultations.add(interaction.sessionId);
    }
    
    if (interaction.legalArea) {
      stats.legalAreas[interaction.legalArea] = (stats.legalAreas[interaction.legalArea] || 0) + 1;
    }
    
    if (interaction.leadGenerated) {
      stats.leadsGenerated++;
    }
  }
};

// Legal Intent Classification
function classifyLegalIntent(message) {
  const lowerMessage = message.toLowerCase();
  
  const legalIntents = {
    'corporate_law': ['company', 'business', 'corporate', 'merger', 'acquisition', 'compliance', 'governance'],
    'litigation': ['court', 'case', 'lawsuit', 'dispute', 'legal action', 'sue', 'defend'],
    'contracts': ['contract', 'agreement', 'terms', 'breach', 'negotiate', 'draft'],
    'intellectual_property': ['trademark', 'patent', 'copyright', 'ip', 'brand protection'],
    'employment_law': ['employee', 'termination', 'harassment', 'labor', 'workplace'],
    'real_estate': ['property', 'real estate', 'land', 'lease', 'rent', 'purchase'],
    'family_law': ['divorce', 'marriage', 'custody', 'alimony', 'family'],
    'criminal_law': ['criminal', 'arrest', 'bail', 'charges', 'police'],
    'tax_law': ['tax', 'gst', 'income tax', 'assessment', 'refund'],
    'consultation_request': ['lawyer', 'legal advice', 'consultation', 'help', 'guidance']
  };
  
  for (const [area, keywords] of Object.entries(legalIntents)) {
    if (keywords.some(keyword => lowerMessage.includes(keyword))) {
      return area;
    }
  }
  
  return 'general_inquiry';
}

// Legal Urgency Assessment
function assessUrgency(message) {
  const lowerMessage = message.toLowerCase();
  
  const urgencyIndicators = {
    'high': ['urgent', 'emergency', 'asap', 'immediately', 'court date', 'deadline'],
    'medium': ['soon', 'this week', 'important', 'time-sensitive'],
    'low': ['general', 'information', 'curious', 'future']
  };
  
  for (const [level, indicators] of Object.entries(urgencyIndicators)) {
    if (indicators.some(indicator => lowerMessage.includes(indicator))) {
      return level;
    }
  }
  
  return 'medium';
}

// Indian Legal Knowledge Base
async function seedIndianLegalKnowledge() {
  if (!index) {
    console.log('Legal knowledge base not available');
    return;
  }
  
  console.log('Seeding Indian legal knowledge base...');
  
  const legalKnowledge = [
    {
      content: `Foxmandal is one of India's leading full-service law firms with over 100 lawyers across offices in Mumbai, Delhi, and Bangalore. We provide comprehensive legal services including corporate law, litigation, intellectual property, employment law, real estate, and regulatory compliance. Our expertise spans domestic and international transactions, with a strong focus on Indian commercial law.`,
      area: 'firm_overview',
      jurisdiction: 'india'
    },
    {
      content: `Corporate Law Services: We assist with company incorporation, board governance, mergers and acquisitions, due diligence, securities law compliance, and corporate restructuring. Our team has extensive experience with Companies Act 2013, SEBI regulations, and Foreign Exchange Management Act (FEMA). We handle private equity transactions, joint ventures, and cross-border investments.`,
      area: 'corporate_law',
      jurisdiction: 'india'
    },
    {
      content: `Litigation and Dispute Resolution: Our litigation team represents clients before Supreme Court of India, High Courts, District Courts, and various tribunals including NCLT, NCLAT, and arbitration panels. We handle commercial disputes, corporate litigation, constitutional matters, and white-collar crimes. We also provide alternative dispute resolution services including mediation and arbitration.`,
      area: 'litigation',
      jurisdiction: 'india'
    },
    {
      content: `Intellectual Property Services: We provide trademark registration, patent filing, copyright protection, and brand enforcement across India. Our IP team handles trademark oppositions, patent prosecution, and IP litigation. We assist with technology transfers, licensing agreements, and protection of traditional knowledge under Indian IP laws.`,
      area: 'intellectual_property',
      jurisdiction: 'india'
    },
    {
      content: `Employment and Labor Law: We advise on Indian labor laws including Industrial Disputes Act, Employee State Insurance Act, and Provident Fund regulations. Our services include employment contracts, termination procedures, compliance with labor regulations, and handling labor disputes. We assist with employee stock option plans and HR policy development.`,
      area: 'employment_law',
      jurisdiction: 'india'
    },
    {
      content: `Real Estate and Property Law: We handle property transactions, title verification, real estate investments, and RERA compliance. Our team assists with property due diligence, lease agreements, property disputes, and real estate regulatory matters. We advise on land acquisition, development agreements, and property documentation under Indian property laws.`,
      area: 'real_estate',
      jurisdiction: 'india'
    },
    {
      content: `Tax and Regulatory Compliance: We provide GST compliance, income tax advisory, international taxation, and transfer pricing services. Our tax team handles tax assessments, appeals, and representation before tax authorities. We assist with regulatory compliance across sectors including banking, insurance, pharmaceuticals, and telecommunications.`,
      area: 'tax_law',
      jurisdiction: 'india'
    },
    {
      content: `Contract Law and Commercial Agreements: We draft and review various commercial contracts including supply agreements, distribution contracts, licensing agreements, and service contracts. Our expertise includes contract negotiation, breach remedies, and enforcement under Indian Contract Act 1872. We handle international contracts and cross-border commercial transactions.`,
      area: 'contracts',
      jurisdiction: 'india'
    }
  ];
  
  try {
    const records = [];
    
    for (const [index, knowledge] of legalKnowledge.entries()) {
      const chunks = splitTextIntoChunks(knowledge.content, 800, 100);
      
      for (const [chunkIndex, chunk] of chunks.entries()) {
        const embedding = await embeddingsClient.embedQuery(chunk);
        
        records.push({
          id: `legal_knowledge_${index}_${chunkIndex}_${Date.now()}`,
          values: embedding,
          metadata: {
            content: chunk,
            type: 'legal_knowledge',
            area: knowledge.area,
            jurisdiction: knowledge.jurisdiction,
            timestamp: Date.now()
          }
        });
      }
    }
    
    const batchSize = 50;
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      await index.upsert({ records: batch });
    }
    
    console.log(`Indian legal knowledge seeded: ${records.length} chunks`);
    
  } catch (error) {
    console.error('Failed to seed legal knowledge:', error);
  }
}

// Text chunking utility
function splitTextIntoChunks(text, maxChunkSize = 1000, overlap = 200) {
  const chunks = [];
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  
  let currentChunk = '';
  
  for (const sentence of sentences) {
    if (currentChunk.length + sentence.length > maxChunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      
      const words = currentChunk.split(' ');
      const overlapWords = words.slice(-Math.floor(overlap/10));
      currentChunk = overlapWords.join(' ') + ' ' + sentence + '.';
    } else {
      currentChunk += ' ' + sentence + '.';
    }
  }
  
  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks.filter(chunk => chunk.length > 50);
}

// Legal Knowledge Retrieval
async function getLegalKnowledge(query, legalArea = null) {
  if (!index) return '';
  
  try {
    const queryEmbedding = await embeddingsClient.embedQuery(query);
    
    let filter = { type: 'legal_knowledge', jurisdiction: 'india' };
    
    if (legalArea && legalArea !== 'general_inquiry') {
      filter.area = legalArea;
    }
    
    const results = await index.query({
      vector: queryEmbedding,
      topK: 5,
      includeMetadata: true,
      filter
    });
    
    const legalContext = results.matches
      ?.filter(match => match.score > 0.75)
      ?.map((match) => {
        const content = match.metadata?.content || '';
        const area = match.metadata?.area || 'general';
        return `[${area.toUpperCase()}] ${content}`;
      })
      .join('\n\n') || '';
    
    console.log(`Retrieved ${results.matches?.length || 0} legal knowledge matches for: ${legalArea}`);
    return legalContext;
    
  } catch (error) {
    console.error('Legal knowledge retrieval error:', error);
    return '';
  }
}

// Legal AI Assistant Response Generation
async function generateLegalResponse(message, context) {
  const { legalArea, urgency, clientProfile, legalKnowledge } = context;
  
  const legalPrompt = [
    {
      role: 'system',
      content: `You are Adv. Arjun, a senior AI legal consultant at Foxmandal, one of India's premier law firms (https://foxmandal.in/).

IMPORTANT LEGAL DISCLAIMERS:
- You provide general legal information, not specific legal advice
- Always recommend consulting with a qualified lawyer for specific cases
- Mention that laws vary by jurisdiction and can change
- Never guarantee specific legal outcomes

YOUR EXPERTISE:
${legalKnowledge}

CLIENT CONTEXT:
Legal Area: ${legalArea}
Urgency Level: ${urgency}
Client Profile: ${JSON.stringify(clientProfile)}

COMMUNICATION STYLE:
- Professional yet approachable
- Use clear, jargon-free language
- Provide practical guidance
- Include relevant Indian legal context
- Always emphasize the need for professional consultation
- Keep responses under 100 words but comprehensive
- End with a clear call-to-action when appropriate

REMEMBER: You represent Foxmandal's commitment to accessible, high-quality legal guidance in India.`
    },
    {
      role: 'user',
      content: message
    }
  ];

  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: legalPrompt,
    temperature: 0.3,
    max_tokens: 180,
  });

  return response.choices[0].message.content;
}

// Routes
app.get("/", (req, res) => {
  res.json({
    status: "⚖️ Foxmandal Legal AI Assistant is running!",
    cors: "Enabled for live deployment",
    timestamp: new Date().toISOString()
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'Foxmandal Legal AI',
    timestamp: new Date().toISOString(),
    services: {
      openai: !!process.env.OPENAI_API_KEY,
      pinecone: !!process.env.PINECONE_API_KEY,
      legalKnowledge: !!index
    }
  });
});

// Compatibility endpoint for frontend /chat calls
app.post('/chat', async (req, res) => {
  const { message, sessionId } = req.body;
  const startTime = Date.now();
  
  console.log(`Chat request from ${req.headers.origin}: ${message?.substring(0, 50)}...`);
  
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Invalid or missing message' });
  }

  try {
    const legalArea = classifyLegalIntent(message);
    const urgency = assessUrgency(message);
    
    legalAnalytics.trackLegalInteraction(sessionId, {
      type: 'client_query',
      content: message,
      legalArea: legalArea,
      urgency: urgency,
      sessionId: sessionId
    });
    
    const legalKnowledge = await getLegalKnowledge(message, legalArea);
    
    const reply = await generateLegalResponse(message, {
      legalArea,
      urgency,
      clientProfile: {},
      legalKnowledge
    });
    
    const shouldCaptureLead = legalArea !== 'general_inquiry' && 
                             (urgency === 'high' || message.toLowerCase().includes('consultation'));
    
    legalAnalytics.trackLegalInteraction(sessionId, {
      type: 'ai_response',
      content: reply,
      legalArea: legalArea,
      complexity: urgency === 'high' ? 'high' : 'medium',
      sessionId: sessionId,
      responseTime: Date.now() - startTime,
      leadGenerated: shouldCaptureLead
    });
    
    res.json({ 
      reply, 
      userProfile: {
        legalArea,
        urgency,
        needsConsultation: shouldCaptureLead
      }
    });
    
  } catch (err) {
    console.error('Error in chat:', err);
    
    legalAnalytics.trackLegalInteraction(sessionId, {
      type: 'error',
      content: err.message,
      sessionId: sessionId
    });
    
    res.status(500).json({ 
      error: 'Legal consultation system temporarily unavailable', 
      details: err.message 
    });
  }
});

// Lead capture endpoint
app.post('/capture-lead', async (req, res) => {
  const { name, email, phone, legalArea, urgency, sessionId, leadScore, userProfile } = req.body;
  
  console.log(`Lead capture from ${req.headers.origin}: ${name} - ${legalArea}`);
  
  if (!name || !email) {
    return res.status(400).json({ error: 'Name and email are required' });
  }
  
  try {
    const consultationData = {
      name,
      email,
      phone: phone || 'Not provided',
      legalArea: legalArea || 'general',
      urgency: urgency || 'medium',
      leadScore: leadScore || 0,
      sessionId,
      timestamp: new Date().toISOString(),
      source: 'arjun_ai_chat',
      status: 'pending'
    };
    
    legalAnalytics.trackConsultation(sessionId, {
      outcome: 'lead_captured',
      clientProfile: { name, email, legalArea: legalArea || 'general' }
    });
    
    console.log('Legal consultation lead captured:', consultationData);
    
    res.json({ 
      success: true, 
      message: 'Thank you! Our legal team will contact you within 24 hours.',
      consultationId: sessionId
    });
    
  } catch (error) {
    console.error('Lead capture failed:', error);
    res.status(500).json({ 
      error: 'Failed to capture lead', 
      details: error.message 
    });
  }
});

// Main legal consultation endpoint (for backward compatibility)
app.post('/legal-consultation', async (req, res) => {
  const { message, sessionId } = req.body;
  const startTime = Date.now();
  
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Invalid or missing message' });
  }

  try {
    const legalArea = classifyLegalIntent(message);
    const urgency = assessUrgency(message);
    
    legalAnalytics.trackLegalInteraction(sessionId, {
      type: 'client_query',
      content: message,
      legalArea: legalArea,
      urgency: urgency,
      sessionId: sessionId
    });
    
    const legalKnowledge = await getLegalKnowledge(message, legalArea);
    
    const reply = await generateLegalResponse(message, {
      legalArea,
      urgency,
      clientProfile: {},
      legalKnowledge
    });
    
    const shouldCaptureLead = legalArea !== 'general_inquiry' && 
                             (urgency === 'high' || message.toLowerCase().includes('consultation'));
    
    legalAnalytics.trackLegalInteraction(sessionId, {
      type: 'ai_response',
      content: reply,
      legalArea: legalArea,
      complexity: urgency === 'high' ? 'high' : 'medium',
      sessionId: sessionId,
      responseTime: Date.now() - startTime,
      leadGenerated: shouldCaptureLead
    });
    
    res.json({ 
      reply, 
      legalArea,
      urgency,
      recommendConsultation: shouldCaptureLead,
      disclaimer: "This is general legal information. Please consult with a qualified lawyer for specific legal advice."
    });
    
  } catch (err) {
    console.error('Error in legal consultation:', err);
    
    legalAnalytics.trackLegalInteraction(sessionId, {
      type: 'error',
      content: err.message,
      sessionId: sessionId
    });
    
    res.status(500).json({ 
      error: 'Legal consultation system temporarily unavailable', 
      details: err.message 
    });
  }
});

// Legal analytics dashboard
app.get('/legal-analytics', async (req, res) => {
  try {
    const today = legalAnalytics.dailyStats.get(new Date().toISOString().split('T')[0]);
    
    res.json({
      summary: {
        todaysConsultations: today?.totalConsultations.size || 0,
        todaysQueries: today?.totalQueries || 0,
        topLegalAreas: today?.legalAreas || {},
        leadsGenerated: today?.leadsGenerated || 0
      },
      activeConsultations: legalAnalytics.consultations.size
    });
    
  } catch (error) {
    console.error('Legal analytics error:', error);
    res.status(500).json({ error: 'Failed to get legal analytics' });
  }
});

// TTS endpoint (disabled)
app.post('/tts', (req, res) => {
  res.status(503).json({ 
    error: 'TTS service uses browser speech synthesis',
    message: 'Please use browser speech synthesis for voice interaction',
    fallback: true
  });
});

// Initialize legal AI system
async function initializeLegalAI() {
  await initializePinecone();
  
  setTimeout(() => {
    if (index) {
      seedIndianLegalKnowledge();
    }
  }, 2000);
}

initializeLegalAI().catch(console.error);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`⚖️ Foxmandal Legal AI Assistant running on port ${PORT}`);
  console.log(`🌐 CORS enabled for live deployment`);
  console.log(`📍 Endpoints: /chat, /capture-lead, /legal-consultation`);
});