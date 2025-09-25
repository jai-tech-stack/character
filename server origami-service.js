// server.js - Cleaned and corrected version
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

console.log('✅ ENV CHECK', {
  openai: !!process.env.OPENAI_API_KEY,
  pinecone: !!process.env.PINECONE_API_KEY,
});

// Express app setup
const app = express();
app.use(bodyParser.json());
app.use(fileUpload({
  limits: { fileSize: 50 * 1024 * 1024 },
  useTempFiles: true,
  tempFileDir: '/tmp/'
}));

app.use(cors({
  origin: [
    "http://localhost:5173", 
    "http://localhost:3001",
    "https://character-kappa.vercel.app",
    "https://character-kappa.vercel.app/"
  ],
  methods: ["GET", "POST"],
  credentials: true
}));

// Pinecone setup
const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY,
});

// AI clients
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const embeddingsClient = new OpenAIEmbeddings({ apiKey: process.env.OPENAI_API_KEY });

// Initialize Pinecone index
let index;
async function initializePinecone() {
  try {
    console.log(`Checking if index "${process.env.PINECONE_INDEX}" exists...`);
    
    const indexList = await pinecone.listIndexes();
    const indexExists = indexList.indexes?.some(idx => idx.name === process.env.PINECONE_INDEX);
    
    if (indexExists) {
      index = pinecone.index(process.env.PINECONE_INDEX);
      console.log(`✅ Pinecone index "${process.env.PINECONE_INDEX}" initialized`);
    } else {
      console.log(`⚠️ Index "${process.env.PINECONE_INDEX}" not found. Creating...`);
      
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
      
      console.log(`✅ Index created. Waiting for it to be ready...`);
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      index = pinecone.index(process.env.PINECONE_INDEX);
    }
  } catch (error) {
    console.error('❌ Failed to initialize Pinecone:', error.message);
    console.log('Server will continue without memory functionality');
  }
}

// Analytics collection system
const analyticsCollector = {
  sessions: new Map(),
  dailyStats: new Map(),
  
  trackSession(sessionId, data = {}) {
    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, {
        sessionId,
        startTime: Date.now(),
        interactions: 0,
        messages: [],
        leadScore: 0,
        userProfile: {},
        topics: new Set(),
        outcome: 'active'
      });
    }
    
    const session = this.sessions.get(sessionId);
    Object.assign(session, data);
    return session;
  },
  
  trackInteraction(sessionId, interaction) {
    const session = this.trackSession(sessionId);
    session.interactions++;
    session.messages.push({
      timestamp: Date.now(),
      type: interaction.type,
      content: interaction.content?.substring(0, 100),
      intent: interaction.intent,
      leadTrigger: interaction.leadTrigger || false
    });
    
    if (interaction.intent) {
      session.topics.add(interaction.intent);
    }
    
    this.updateDailyStats(interaction);
  },
  
  updateDailyStats(interaction) {
    const today = new Date().toISOString().split('T')[0];
    
    if (!this.dailyStats.has(today)) {
      this.dailyStats.set(today, {
        date: today,
        totalSessions: new Set(),
        totalMessages: 0,
        leadsGenerated: 0,
        topIntents: {},
        conversionRate: 0
      });
    }
    
    const stats = this.dailyStats.get(today);
    stats.totalMessages++;
    
    if (interaction.sessionId) {
      stats.totalSessions.add(interaction.sessionId);
    }
    
    if (interaction.intent) {
      stats.topIntents[interaction.intent] = (stats.topIntents[interaction.intent] || 0) + 1;
    }
    
    if (interaction.leadTrigger) {
      stats.leadsGenerated++;
    }
  },
  
  getDailyAnalytics(date = null) {
    const targetDate = date || new Date().toISOString().split('T')[0];
    const stats = this.dailyStats.get(targetDate);
    
    if (stats) {
      stats.totalSessions = stats.totalSessions.size;
      if (stats.totalSessions > 0) {
        stats.conversionRate = (stats.leadsGenerated / stats.totalSessions * 100).toFixed(1);
      }
    }
    
    return stats;
  }
};

// Helper functions
function classifyUserIntent(message) {
  const lowerMessage = message.toLowerCase();
  
  const intentPatterns = {
    'portfolio_request': ['portfolio', 'examples', 'case study', 'work', 'projects', 'show me'],
    'process_inquiry': ['process', 'how do you', 'methodology', 'approach', 'steps'],
    'pricing_inquiry': ['price', 'cost', 'budget', 'investment', 'quote', 'expensive'],
    'service_inquiry': ['services', 'what do you do', 'offerings', 'help with'],
    'contact_request': ['contact', 'reach out', 'call', 'meet', 'consultation']
  };
  
  for (const [intent, patterns] of Object.entries(intentPatterns)) {
    if (patterns.some(pattern => lowerMessage.includes(pattern))) {
      return intent;
    }
  }
  
  return 'general_inquiry';
}

function extractUserInformation(userMessage, aiReply) {
  const extracted = {};
  const lowerMessage = userMessage.toLowerCase();
  
  // Extract company name
  const companyPatterns = [
    /my company is (.+?)[\.\,\!]/,
    /we are (.+?)[\.\,\!]/,
    /i work at (.+?)[\.\,\!]/
  ];
  
  companyPatterns.forEach(pattern => {
    const match = userMessage.match(pattern);
    if (match && match[1]) {
      extracted.company = match[1].trim();
    }
  });
  
  // Extract industry
  const industryKeywords = {
    'tech': ['technology', 'software', 'app', 'platform', 'saas'],
    'healthcare': ['medical', 'health', 'clinic', 'hospital'],
    'retail': ['store', 'shop', 'ecommerce', 'retail'],
    'finance': ['bank', 'finance', 'fintech', 'insurance'],
    'food': ['restaurant', 'food', 'cafe', 'culinary']
  };
  
  Object.entries(industryKeywords).forEach(([industry, keywords]) => {
    if (keywords.some(keyword => lowerMessage.includes(keyword))) {
      extracted.industry = industry;
    }
  });
  
  // Extract project type
  if (lowerMessage.includes('rebrand')) {
    extracted.projectType = 'rebranding';
  } else if (lowerMessage.includes('new brand')) {
    extracted.projectType = 'new_brand';
  } else if (lowerMessage.includes('website')) {
    extracted.projectType = 'web_design';
  }
  
  return extracted;
}

// Knowledge base functions
function splitTextIntoChunks(text, maxChunkSize = 1000, overlap = 200) {
  const chunks = [];
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  
  let currentChunk = '';
  
  for (const sentence of sentences) {
    if (currentChunk.length + sentence.length > maxChunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      
      // Add overlap
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

async function getEnhancedKnowledgeContext(query, userIntent = null) {
  if (!index) return '';
  
  try {
    const queryEmbedding = await embeddingsClient.embedQuery(query);
    
    let filter = { type: 'knowledge' };
    
    if (userIntent) {
      switch (userIntent) {
        case 'portfolio_request':
          filter.hasPortfolio = true;
          break;
        case 'process_inquiry':
          filter.hasProcess = true;
          break;
        case 'pricing_inquiry':
          filter.hasPricing = true;
          break;
        case 'service_inquiry':
          filter.hasServices = true;
          break;
      }
    }
    
    const results = await index.query({
      vector: queryEmbedding,
      topK: 5,
      includeMetadata: true,
      filter
    });
    
    const knowledgeContext = results.matches
      ?.filter(match => match.score > 0.7)
      ?.map((match) => {
        const content = match.metadata?.content || '';
        const source = match.metadata?.source || 'unknown';
        return `[${source}] ${content}`;
      })
      .join('\n\n') || '';
    
    console.log(`Retrieved ${results.matches?.length || 0} knowledge matches`);
    return knowledgeContext;
    
  } catch (error) {
    console.error('Knowledge retrieval error:', error);
    return '';
  }
}

async function seedInitialKnowledge() {
  if (!index) {
    console.log('Pinecone not available, skipping knowledge seeding');
    return;
  }
  
  console.log('Seeding initial Origami Creative knowledge...');
  
  const knowledgeTexts = [
    `Origami Creative is a full-service branding and creative agency specializing in brand strategy, visual identity design, and comprehensive brand experiences. We help businesses unfold their potential through strategic creative solutions. Our team combines strategic thinking with creative execution to help startups, scale-ups, and established businesses build memorable brands.`,
    
    `Our services include Brand Strategy (positioning, messaging, competitive analysis), Visual Identity Design (logo creation, color systems, typography), Marketing Materials (business cards, brochures, digital templates), Website Design (brand-aligned experiences), and Packaging Design (retail presence and unboxing experiences).`,
    
    `Our process follows five phases: 1) Discovery & Research - market analysis and competitor research, 2) Strategy Development - positioning and messaging, 3) Creative Execution - logo and visual identity, 4) Brand Guidelines - usage standards and consistency, 5) Implementation - rollout and ongoing support. Projects typically take 8-12 weeks.`,
    
    `Portfolio highlights: TechFlow startup rebrand increased trust scores by 40% and led to Series A funding. MedCare health network rebrand improved patient acquisition by 25%. Our work spans technology, healthcare, retail, finance, and food industries with proven results.`,
    
    `Investment ranges: Startup packages $15,000-$25,000, Professional packages $25,000-$45,000, Enterprise packages $45,000-$75,000. Additional services include website design ($20,000-$50,000) and packaging ($15,000-$35,000). We offer flexible payment terms and detailed proposals.`
  ];
  
  try {
    const allRecords = [];
    
    for (const [textIndex, text] of knowledgeTexts.entries()) {
      const chunks = splitTextIntoChunks(text, 800, 100);
      
      for (const [chunkIndex, chunk] of chunks.entries()) {
        const embedding = await embeddingsClient.embedQuery(chunk);
        
        allRecords.push({
          id: `seed_${textIndex}_${chunkIndex}_${Date.now()}`,
          values: embedding,
          metadata: {
            content: chunk,
            type: 'knowledge',
            source: `seed_knowledge_${textIndex}`,
            hasPortfolio: chunk.toLowerCase().includes('portfolio') || chunk.toLowerCase().includes('case study'),
            hasProcess: chunk.toLowerCase().includes('process') || chunk.toLowerCase().includes('phases'),
            hasPricing: chunk.toLowerCase().includes('investment') || chunk.toLowerCase().includes('$'),
            hasServices: chunk.toLowerCase().includes('services') || chunk.toLowerCase().includes('design'),
            timestamp: Date.now()
          }
        });
      }
    }
    
    // Upload in batches
    const batchSize = 50;
    for (let i = 0; i < allRecords.length; i += batchSize) {
      const batch = allRecords.slice(i, i + batchSize);
      await index.upsert({ records: batch });
    }
    
    console.log(`Initial knowledge seeded: ${allRecords.length} chunks`);
    
  } catch (error) {
    console.error('Failed to seed knowledge:', error);
  }
}

// Memory functions
async function getConversationHistory(sessionId) {
  if (!index) return [];
  
  try {
    const historyQuery = await index.query({
      vector: new Array(1536).fill(0),
      topK: 10,
      includeMetadata: true,
      filter: {
        sessionId: sessionId,
        type: 'conversation'
      }
    });
    
    return historyQuery.matches
      ?.sort((a, b) => (a.metadata.timestamp || 0) - (b.metadata.timestamp || 0))
      .map(m => ({
        role: m.metadata.role,
        content: m.metadata.content,
        timestamp: m.metadata.timestamp
      })) || [];
      
  } catch (error) {
    console.error('Error retrieving conversation history:', error);
    return [];
  }
}

async function getUserProfile(sessionId) {
  if (!index) return {};
  
  try {
    const profileQuery = await index.query({
      vector: new Array(1536).fill(0),
      topK: 5,
      includeMetadata: true,
      filter: {
        sessionId: sessionId,
        type: 'profile'
      }
    });
    
    const profile = {};
    profileQuery.matches?.forEach(match => {
      if (match.metadata.profileKey && match.metadata.profileValue) {
        profile[match.metadata.profileKey] = match.metadata.profileValue;
      }
    });
    
    return profile;
    
  } catch (error) {
    console.error('Error retrieving user profile:', error);
    return {};
  }
}

function buildConversationContext(history, profile) {
  let context = '';
  
  if (Object.keys(profile).length > 0) {
    context += `User Information: `;
    Object.entries(profile).forEach(([key, value]) => {
      context += `${key}: ${value}, `;
    });
    context += '\n';
  }
  
  const recentHistory = history.slice(-6);
  recentHistory.forEach(msg => {
    context += `${msg.role}: ${msg.content}\n`;
  });
  
  return context;
}

async function updateUserProfile(sessionId, newInfo) {
  if (!index || Object.keys(newInfo).length === 0) return;
  
  try {
    const records = [];
    
    Object.entries(newInfo).forEach(([key, value]) => {
      records.push({
        id: `${sessionId}_profile_${key}`,
        values: new Array(1536).fill(Math.random() * 0.01),
        metadata: {
          sessionId: sessionId,
          type: 'profile',
          profileKey: key,
          profileValue: value,
          timestamp: Date.now()
        }
      });
    });
    
    await index.upsert({ records });
    console.log('Updated user profile:', newInfo);
    
  } catch (error) {
    console.error('Error updating user profile:', error);
  }
}

async function saveEnhancedMemory(message, reply, sessionId, userInfo, embedding) {
  if (!index) return;
  
  try {
    const timestamp = Date.now();
    const records = [];
    
    records.push({
      id: `${sessionId}_${timestamp}_user`,
      values: embedding,
      metadata: {
        content: message,
        role: 'user',
        sessionId: sessionId,
        type: 'conversation',
        timestamp: timestamp
      }
    });
    
    const replyEmbedding = await embeddingsClient.embedQuery(reply);
    records.push({
      id: `${sessionId}_${timestamp}_assistant`,
      values: replyEmbedding,
      metadata: {
        content: reply,
        role: 'assistant',
        sessionId: sessionId,
        type: 'conversation',
        timestamp: timestamp
      }
    });
    
    await index.upsert({ records });
    console.log('Enhanced memory saved');
    
  } catch (error) {
    console.error('Failed to save memory:', error.message);
  }
}

// Main chat logic
async function planAndExecuteWithKnowledge(message, context) {
  const { conversationContext, knowledgeContext, userProfile, userIntent } = context;
  
  const enhancedPrompt = [
    {
      role: 'system',
      content: `You are Rakesh, the AI Brand Strategist for ORIGAMI CREATIVE (https://origamicreative.com).
You represent a professional branding and creative agency.

RELEVANT KNOWLEDGE:
${knowledgeContext}

CONVERSATION CONTEXT:
${conversationContext}

USER PROFILE: ${JSON.stringify(userProfile)}
USER INTENT: ${userIntent}

INSTRUCTIONS:
- Use the knowledge to provide specific, accurate information
- Personalize responses based on user profile and conversation history
- Keep responses under 80 words but substantive
- Sound professional and consultative
- Reference their company "${userProfile.company || 'your business'}" naturally when relevant`
    },
    { 
      role: 'user', 
      content: message 
    }
  ];

  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: enhancedPrompt,
    temperature: 0.7,
    max_tokens: 150,
  });

  return response.choices[0].message.content;
}

// Routes
app.get("/", (req, res) => {
  res.send("✅ Origami Character Backend is running on Render!");
});

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      openai: !!process.env.OPENAI_API_KEY,
      pinecone: !!process.env.PINECONE_API_KEY,
      index: !!index
    }
  });
});

app.post('/chat', async (req, res) => {
  const { message, sessionId } = req.body;
  const startTime = Date.now();
  
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Invalid or missing message' });
  }

  try {
    const userIntent = classifyUserIntent(message);
    
    analyticsCollector.trackInteraction(sessionId, {
      type: 'user_message',
      content: message,
      intent: userIntent,
      sessionId: sessionId
    });
    
    let conversationContext = '';
    let userProfile = {};
    
    if (index && sessionId) {
      const sessionHistory = await getConversationHistory(sessionId);
      userProfile = await getUserProfile(sessionId);
      conversationContext = buildConversationContext(sessionHistory, userProfile);
    }

    const knowledgeContext = await getEnhancedKnowledgeContext(message, userIntent);
    
    const reply = await planAndExecuteWithKnowledge(message, {
      conversationContext,
      knowledgeContext,
      userProfile,
      sessionId,
      userIntent
    });
    
    const leadTrigger = ['contact', 'pricing', 'quote', 'interested'].some(trigger => 
      (message + reply).toLowerCase().includes(trigger)
    );
    
    analyticsCollector.trackInteraction(sessionId, {
      type: 'ai_response',
      content: reply,
      intent: userIntent,
      leadTrigger: leadTrigger,
      sessionId: sessionId,
      responseTime: Date.now() - startTime
    });
    
    const extractedInfo = extractUserInformation(message, reply);
    if (Object.keys(extractedInfo).length > 0) {
      await updateUserProfile(sessionId, extractedInfo);
      analyticsCollector.trackSession(sessionId, {
        userProfile: { ...userProfile, ...extractedInfo }
      });
    }
    
    res.json({ reply, userProfile: extractedInfo });

    if (index && sessionId) {
      const embedding = await embeddingsClient.embedQuery(message);
      await saveEnhancedMemory(message, reply, sessionId, extractedInfo, embedding);
    }
    
  } catch (err) {
    console.error('Error in chat:', err);
    
    analyticsCollector.trackInteraction(sessionId, {
      type: 'error',
      content: err.message,
      sessionId: sessionId
    });
    
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'Chat processing failed', 
        details: err.message 
      });
    }
  }
});

app.post('/tts', (req, res) => {
  res.status(503).json({ 
    error: 'TTS service temporarily unavailable',
    message: 'Please use browser speech synthesis instead',
    fallback: true
  });
});

app.post('/capture-lead', async (req, res) => {
  const { name, email, message, sessionId, userProfile, leadScore } = req.body;
  
  if (!name || !email) {
    return res.status(400).json({ error: 'Name and email are required' });
  }
  
  try {
    const leadData = {
      name,
      email,
      message: message || '',
      sessionId,
      leadScore: leadScore || 0,
      userProfile: userProfile || {},
      timestamp: new Date().toISOString(),
      source: 'rakesh_ai_chat',
      status: 'new'
    };
    
    analyticsCollector.trackSession(sessionId, {
      outcome: 'lead_captured',
      leadData: leadData
    });
    
    analyticsCollector.trackInteraction(sessionId, {
      type: 'lead_capture',
      content: `Lead captured: ${name}`,
      leadTrigger: true,
      sessionId: sessionId
    });
    
    console.log('Lead captured:', { name, email, leadScore });
    
    res.json({ 
      success: true, 
      message: 'Thank you! We\'ll be in touch within 24 hours.',
      leadId: leadData.sessionId
    });
    
  } catch (error) {
    console.error('Lead capture failed:', error);
    res.status(500).json({ 
      error: 'Failed to capture lead', 
      details: error.message 
    });
  }
});

app.get('/analytics/dashboard', async (req, res) => {
  try {
    const today = analyticsCollector.getDailyAnalytics();
    
    res.json({
      summary: {
        todaysSessions: today?.totalSessions || 0,
        todaysMessages: today?.totalMessages || 0,
        todaysLeads: today?.leadsGenerated || 0,
        conversionRate: today?.conversionRate || '0.0'
      }
    });
    
  } catch (error) {
    console.error('Dashboard analytics error:', error);
    res.status(500).json({ error: 'Failed to get dashboard analytics' });
  }
});

// Initialize server
async function initializeServer() {
  await initializePinecone();
  
  setTimeout(() => {
    if (index) {
      seedInitialKnowledge();
    }
  }, 2000);
}

initializeServer().catch(console.error);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Backend live on port ${PORT}`);
});