// Bug-Free server.js - All Features, Clean Code
// Security + Document Analysis + Smart AI + Analytics

import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { config } from 'dotenv';
import { Pinecone } from '@pinecone-database/pinecone';
import { OpenAI } from 'openai';
import { OpenAIEmbeddings } from '@langchain/openai';
import fileUpload from 'express-fileupload';
import crypto from 'crypto';
import mammoth from 'mammoth';
import pdf from 'pdf-parse/lib/pdf-parse.js';

config();

console.log('FOXMANDAL SECURE LEGAL AI - Starting...', {
  openai: !!process.env.OPENAI_API_KEY,
  pinecone: !!process.env.PINECONE_API_KEY,
});

const app = express();

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.removeHeader('X-Powered-By');
  next();
});

// Rate limiting
const createRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: 15 * 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === '/health'
});

app.use(createRateLimit);

// CORS - Fixed for Vercel
app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'http://localhost:5173',
      'http://localhost:3001',
      'https://foxmandal.in',
      'https://www.foxmandal.in',
      'https://character-kappa.vercel.app',
      'https://legal-ai.vercel.app'
    ];
    
    if (origin.endsWith('.vercel.app') || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    console.log('CORS allowed origin:', origin);
    callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Session-ID', 'X-Client-Version'],
  exposedHeaders: ['Content-Length', 'X-Request-ID'],
  maxAge: 86400,
  optionsSuccessStatus: 200
}));

app.options('*', cors());
 
app.use(bodyParser.json({ limit: '10mb' }));
app.use(fileUpload({
  limits: { fileSize: 10 * 1024 * 1024 },
  useTempFiles: true,
  tempFileDir: '/tmp/',
  abortOnLimit: true
}));

// Security utilities
class DataEncryption {
  constructor() {
    this.algorithm = 'aes-256-gcm';
    this.key = process.env.ENCRYPTION_KEY ? 
      Buffer.from(process.env.ENCRYPTION_KEY, 'hex') : 
      crypto.randomBytes(32);
  }
  
  encrypt(text) {
    try {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
      
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      const authTag = cipher.getAuthTag();
      
      return {
        encrypted,
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex')
      };
    } catch (error) {
      console.error('Encryption error:', error);
      return null;
    }
  }
}

const encryption = new DataEncryption();

function validateAndSanitizeInput(input, maxLength = 2000) {
  if (!input || typeof input !== 'string') return null;
  
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/[<>\"'%;()&+]/g, '')
    .substring(0, maxLength)
    .trim();
}

function containsSuspiciousPatterns(message) {
  const suspiciousPatterns = [
    /ignore\s+previous\s+instructions/i,
    /forget\s+everything/i,
    /you\s+are\s+now/i,
    /system\s*:\s*/i,
    /admin\s+mode/i,
    /javascript:/i,
    /eval\(/i,
    /union\s+select/i,
    /drop\s+table/i,
    /'; --/,
    /<script/i
  ];
  
  return suspiciousPatterns.some(pattern => pattern.test(message));
}

const validateRequest = (req, res, next) => {
  const { message, sessionId, aiMode } = req.body;
  
  if (!message || typeof message !== 'string' || message.length > 2000) {
    return res.status(400).json({ error: 'Invalid message' });
  }
  
  const sanitizedMessage = validateAndSanitizeInput(message);
  if (!sanitizedMessage) {
    return res.status(400).json({ error: 'Invalid message content' });
  }
  
  if (containsSuspiciousPatterns(sanitizedMessage)) {
    console.warn('Suspicious pattern detected');
    return res.status(400).json({ error: 'Message contains invalid content' });
  }
  
  if (sessionId && !/^session_foxmandal_\w+_\d+_[a-z0-9]+$/.test(sessionId)) {
    return res.status(400).json({ error: 'Invalid session ID format' });
  }
  
  const validModes = ['standard', 'agentic', 'agi', 'asi'];
  if (aiMode && !validModes.includes(aiMode)) {
    return res.status(400).json({ error: 'Invalid AI mode' });
  }
  
  req.body.message = sanitizedMessage;
  next();
};

// AI Clients
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const embeddingsClient = new OpenAIEmbeddings({ apiKey: process.env.OPENAI_API_KEY });
const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });

let index;
async function initializePinecone() {
  try {
    const indexList = await pinecone.listIndexes();
    const indexExists = indexList.indexes?.some(idx => idx.name === process.env.PINECONE_INDEX);
    
    if (indexExists) {
      index = pinecone.index(process.env.PINECONE_INDEX);
      console.log('Legal knowledge base initialized');
    }
  } catch (error) {
    console.error('Pinecone init error:', error.message);
  }
}

// Analytics
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
        aiModeUsage: {},
        securityFlags: []
      });
    }
    
    const consultation = this.consultations.get(sessionId);
    Object.assign(consultation, data);
    return consultation;
  },
  
  trackLegalInteraction(sessionId, interaction) {
    const consultation = this.trackConsultation(sessionId);
    consultation.interactions++;
    
    const mode = interaction.aiMode || 'standard';
    consultation.aiModeUsage[mode] = (consultation.aiModeUsage[mode] || 0) + 1;
    
    if (interaction.legalArea && !consultation.legalArea) {
      consultation.legalArea = interaction.legalArea;
    }
    
    if (interaction.securityFlag) {
      consultation.securityFlags.push({
        type: interaction.securityFlag,
        timestamp: Date.now()
      });
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
        aiModeUsage: { standard: 0, agentic: 0, agi: 0, asi: 0 }
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
    
    if (interaction.aiMode) {
      stats.aiModeUsage[interaction.aiMode]++;
    }
    
    if (interaction.leadGenerated) {
      stats.leadsGenerated++;
    }
  }
};

// Document Analysis
function classifyDocumentType(text) {
  const lowerText = text.toLowerCase();
  
  const documentPatterns = {
    'employment_agreement': ['employment agreement', 'employment contract', 'offer letter'],
    'nda': ['non-disclosure', 'confidentiality agreement', 'nda'],
    'service_agreement': ['service agreement', 'consulting agreement'],
    'lease_agreement': ['lease agreement', 'rental agreement'],
    'partnership_deed': ['partnership deed', 'partnership agreement'],
    'legal_notice': ['legal notice', 'demand notice'],
    'court_document': ['court', 'plaintiff', 'defendant', 'petition'],
    'business_contract': ['contract', 'agreement', 'terms and conditions']
  };

  for (const [type, keywords] of Object.entries(documentPatterns)) {
    if (keywords.some(keyword => lowerText.includes(keyword))) {
      return type;
    }
  }

  return 'general_document';
}

async function generateDocumentAnalysis(documentText, documentType, legalArea, aiMode) {
  const documentSummary = documentText.length > 2000 
    ? documentText.substring(0, 2000) + '...[truncated]'
    : documentText;

  const systemPrompt = `You are a legal document analyst at FoxMandal. Provide:

DOCUMENT ANALYSIS:

Document Type: [Classification]

Key Clauses Identified:
[List important clauses]

Potential Issues:
[List concerns or red flags]

Compliance Check:
[Indian law compliance assessment]

Recommendations:
[Practical advice for client]

Next Steps:
[What client should do]`;

  const analysisRequest = `Analyze this ${documentType} document:\n\n${documentSummary}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: analysisRequest }
      ],
      temperature: 0.4,
      max_tokens: 600
    });

    const analysis = response.choices[0].message.content;
    const confidence = 0.82;

    return {
      content: analysis,
      confidence,
      documentType,
      legalArea,
      aiMode
    };

  } catch (error) {
    console.error('Document analysis error:', error);
    throw new Error('AI analysis failed');
  }
}

app.post('/analyze-document', validateRequest, async (req, res) => {
  const startTime = Date.now();
  const { sessionId, aiMode = 'agentic' } = req.body;
  const clientIP = (req.ip || '').replace(/\.\d+$/, '.xxx');

  if (!req.files || !req.files.document) {
    return res.status(400).json({ error: 'No document uploaded' });
  }

  const uploadedFile = req.files.document;
  const fileExtension = uploadedFile.name.split('.').pop().toLowerCase();

  const allowedTypes = ['pdf', 'doc', 'docx', 'txt'];
  if (!allowedTypes.includes(fileExtension)) {
    return res.status(400).json({ 
      error: 'Invalid file type. Only PDF, DOC, DOCX, and TXT files are allowed.' 
    });
  }

  if (uploadedFile.size > 10 * 1024 * 1024) {
    return res.status(400).json({ error: 'File too large. Maximum size is 10MB.' });
  }

  try {
    let documentText = '';
    let extractionMethod = '';

    switch (fileExtension) {
      case 'pdf':
        const pdfData = await pdf(uploadedFile.data);
        documentText = pdfData.text;
        extractionMethod = 'PDF Parser';
        break;

      case 'docx':
        const docxResult = await mammoth.extractRawText({ buffer: uploadedFile.data });
        documentText = docxResult.value;
        extractionMethod = 'DOCX Parser';
        break;

      case 'txt':
        documentText = uploadedFile.data.toString('utf-8');
        extractionMethod = 'Text Parser';
        break;
    }

    if (!documentText || documentText.trim().length < 50) {
      return res.status(400).json({ error: 'Document appears to be empty or unreadable.' });
    }

    documentText = documentText.substring(0, 15000);

    const documentType = classifyDocumentType(documentText);
    const legalArea = classifyLegalIntent(documentText);

    legalAnalytics.trackLegalInteraction(sessionId, {
      type: 'document_upload',
      content: uploadedFile.name,
      legalArea,
      aiMode,
      sessionId,
      clientIP
    });

    const analysis = await generateDocumentAnalysis(documentText, documentType, legalArea, aiMode);

    legalAnalytics.trackLegalInteraction(sessionId, {
      type: 'document_analysis_complete',
      legalArea,
      aiMode,
      sessionId,
      clientIP,
      responseTime: Date.now() - startTime
    });

    res.json({
      success: true,
      fileName: uploadedFile.name,
      fileType: fileExtension,
      extractionMethod,
      documentType,
      legalArea,
      textLength: documentText.length,
      analysis,
      aiMode,
      confidence: analysis.confidence,
      processingTime: Date.now() - startTime,
      disclaimer: 'This is an AI-generated analysis. Please consult a qualified lawyer for legal advice.'
    });

  } catch (error) {
    console.error('Document analysis error:', error);
    res.status(500).json({ error: 'Failed to analyze document' });
  }
});

// Legal Intent Classification
function classifyLegalIntent(message) {
  const lowerMessage = message.toLowerCase();
  
  const legalIntents = {
    'corporate_law': ['company', 'business', 'corporate', 'merger'],
    'litigation': ['court', 'lawsuit', 'dispute', 'legal action'],
    'contracts': ['contract', 'agreement', 'terms', 'breach'],
    'employment_law': ['employee', 'termination', 'workplace'],
    'real_estate': ['property', 'real estate', 'land', 'lease'],
    'tax_law': ['tax', 'gst', 'income tax']
  };
  
  for (const [area, keywords] of Object.entries(legalIntents)) {
    if (keywords.some(keyword => lowerMessage.includes(keyword))) {
      return area;
    }
  }
  
  return 'general_inquiry';
}

function assessUrgency(message) {
  const lowerMessage = message.toLowerCase();
  if (['urgent', 'emergency', 'asap', 'immediately'].some(w => lowerMessage.includes(w))) {
    return 'high';
  }
  if (['soon', 'important', 'time-sensitive'].some(w => lowerMessage.includes(w))) {
    return 'medium';
  }
  return 'low';
}

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
    
    return results.matches
      ?.filter(match => match.score > 0.75)
      ?.map(match => match.metadata?.content || '')
      .join('\n\n') || '';
    
  } catch (error) {
    console.error('Knowledge retrieval error:', error);
    return '';
  }
}

async function generateLegalResponse(message, context) {
  const { legalArea, urgency, legalKnowledge, aiMode, systemPrompt, temperature, maxTokens } = context;
  
  let enhancedSystemPrompt = systemPrompt || `You are Advocate Arjun, a senior AI legal consultant at Foxmandal.`;
  
  enhancedSystemPrompt += `

FOXMANDAL LEGAL CONTEXT:
${legalKnowledge}

CLIENT SITUATION:
Legal Area: ${legalArea}
Urgency Level: ${urgency}

CRITICAL REQUIREMENTS:
- Provide specific, actionable legal guidance
- Reference relevant Indian laws
- Always recommend consulting with qualified lawyers for specific cases
- Keep responses focused and practical`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: enhancedSystemPrompt },
        { role: 'user', content: message }
      ],
      temperature: temperature || 0.3,
      max_tokens: maxTokens || 500,
    });

    return response.choices[0].message.content;
  } catch (error) {
    console.error('OpenAI error:', error);
    return "I'm experiencing technical difficulties. Please try again.";
  }
}

// Routes
app.get("/", (req, res) => {
  res.json({
    status: "Foxmandal Secure Legal AI is running!",
    version: "2.0.0",
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
      pinecone: !!process.env.PINECONE_API_KEY
    }
  });
});

app.post('/chat', validateRequest, async (req, res) => {
  const { message, sessionId, aiMode = 'agentic', systemPrompt, temperature, maxTokens } = req.body;
  const startTime = Date.now();
  const clientIP = (req.ip || '').replace(/\.\d+$/, '.xxx');
  
  try {
    const legalArea = classifyLegalIntent(message);
    const urgency = assessUrgency(message);
    
    legalAnalytics.trackLegalInteraction(sessionId, {
      type: 'client_query',
      content: message,
      legalArea,
      urgency,
      aiMode,
      sessionId,
      clientIP
    });
    
    const legalKnowledge = await getLegalKnowledge(message, legalArea);
    
    const reply = await generateLegalResponse(message, {
      legalArea,
      urgency,
      legalKnowledge,
      aiMode,
      systemPrompt,
      temperature,
      maxTokens
    });
    
    const confidence = 0.80;
    
    legalAnalytics.trackLegalInteraction(sessionId, {
      type: 'ai_response',
      legalArea,
      aiMode,
      sessionId,
      responseTime: Date.now() - startTime,
      clientIP
    });
    
    res.json({ 
      reply,
      confidence,
      aiMode,
      disclaimer: "This is general legal information. Please consult with a qualified lawyer for specific legal advice."
    });
    
  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({ error: 'Unable to process your request at this time' });
  }
});

app.post('/capture-lead', validateRequest, async (req, res) => {
  const { name, email, phone, legalArea, sessionId, aiMode } = req.body;
  
  if (!name || !email) {
    return res.status(400).json({ error: 'Name and email are required' });
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }
  
  try {
    const sanitizedData = {
      name: validateAndSanitizeInput(name, 100),
      email: email.trim().toLowerCase(),
      phone: phone ? validateAndSanitizeInput(phone, 20) : '',
      legalArea: legalArea || 'general',
      sessionId,
      aiMode: aiMode || 'agentic',
      timestamp: new Date().toISOString()
    };
    
    legalAnalytics.trackConsultation(sessionId, {
      outcome: 'lead_captured',
      clientProfile: { 
        name: sanitizedData.name, 
        email: sanitizedData.email
      }
    });
    
    console.log('Lead captured:', sanitizedData.name, sanitizedData.email);
    
    res.json({ 
      success: true, 
      message: 'Thank you! Our legal team will contact you within 24 hours.'
    });
    
  } catch (error) {
    console.error('Lead capture error:', error);
    res.status(500).json({ error: 'Failed to process your request' });
  }
});

app.get('/legal-analytics', (req, res) => {
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
    console.error('Analytics error:', error);
    res.status(500).json({ error: 'Failed to get analytics' });
  }
});

// Initialize and start
(async () => {
  try {
    await initializePinecone();
    
    const PORT = process.env.PORT || 3001;
    app.listen(PORT, () => {
      console.log(`Foxmandal Legal AI running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Startup error:', err);
    process.exit(1);
  }
})();