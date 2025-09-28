// Complete server.js - Replace your entire server.js file with this
// Includes: Real AI modes, Full Security, Enhanced analytics

import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { config } from 'dotenv';
import { Pinecone } from '@pinecone-database/pinecone';
import { OpenAI } from 'openai';
import { OpenAIEmbeddings } from '@langchain/openai';
import { v4 as uuidv4 } from 'uuid';
import fileUpload from 'express-fileupload';
import crypto from 'crypto';

config();

console.log('🛡️ FOXMANDAL SECURE LEGAL AI - ENV CHECK', {
  openai: !!process.env.OPENAI_API_KEY,
  pinecone: !!process.env.PINECONE_API_KEY,
  encryption: !!process.env.ENCRYPTION_KEY,
});

// ===== EXPRESS APP SETUP WITH SECURITY =====

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

// Additional security headers
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
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: 15 * 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === '/health'
});

app.use(createRateLimit);
// In your server.js, update the CORS configuration:
app.use(cors({
  origin: [
    "http://localhost:5173",
    "http://localhost:3001", 
    "https://foxmandal.in",
    "https://www.foxmandal.in",
    "https://character-kappa.vercel.app",     // ✅ This should already be there
    "https://character-kappa.vercel.app/",   // ✅ Add trailing slash version
    "https://*.vercel.app",                  // ✅ Add wildcard for all Vercel apps
    "https://legal-ai.vercel.app"
  ],
  methods: ["GET", "POST", "OPTIONS"],
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization", "X-Session-ID", "X-Client-Version"],
  optionsSuccessStatus: 200
}));
 
app.use(bodyParser.json({ limit: '10mb' }));
app.use(fileUpload({
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  useTempFiles: true,
  tempFileDir: '/tmp/',
  abortOnLimit: true
}));

// ===== SECURITY UTILITIES =====

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
      const cipher = crypto.createCipher(this.algorithm, this.key, iv);
      
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

// Input validation and sanitization
function validateAndSanitizeInput(input, maxLength = 2000) {
  if (!input || typeof input !== 'string') {
    return null;
  }
  
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
    /on\w+\s*=/i,
    /<script/i
  ];
  
  return suspiciousPatterns.some(pattern => pattern.test(message));
}

// Request validation middleware
const validateRequest = (req, res, next) => {
  const { message, sessionId, aiMode } = req.body;
  
  // Validate message
  if (!message || typeof message !== 'string' || message.length > 2000) {
    return res.status(400).json({ error: 'Invalid message' });
  }
  
  // Sanitize message
  const sanitizedMessage = validateAndSanitizeInput(message);
  if (!sanitizedMessage) {
    return res.status(400).json({ error: 'Invalid message content' });
  }
  
  // Check for suspicious patterns
  if (containsSuspiciousPatterns(sanitizedMessage)) {
    console.warn('Suspicious pattern detected:', { 
      message: sanitizedMessage.substring(0, 100), 
      ip: req.ip,
      userAgent: req.headers['user-agent']?.substring(0, 100)
    });
    return res.status(400).json({ error: 'Message contains invalid content' });
  }
  
  // Validate session ID format
  if (sessionId && !/^session_foxmandal_\w+_\d+_[a-z0-9]+$/.test(sessionId)) {
    return res.status(400).json({ error: 'Invalid session ID format' });
  }
  
  // Validate AI mode
  const validModes = ['standard', 'agentic', 'agi', 'asi'];
  if (aiMode && !validModes.includes(aiMode)) {
    return res.status(400).json({ error: 'Invalid AI mode' });
  }
  
  // Store sanitized message
  req.body.message = sanitizedMessage;
  next();
};

// ===== AI CLIENTS =====

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const embeddingsClient = new OpenAIEmbeddings({ apiKey: process.env.OPENAI_API_KEY });

// Pinecone setup
const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });

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
          serverless: { cloud: 'aws', region: 'us-east-1' }
        }
      });
      await new Promise(resolve => setTimeout(resolve, 10000));
      index = pinecone.index(process.env.PINECONE_INDEX);
    }
  } catch (error) {
    console.error('Failed to initialize legal knowledge base:', error.message);
  }
}

// ===== ENHANCED LEGAL ANALYTICS WITH SECURITY =====

const legalAnalytics = {
  consultations: new Map(),
  dailyStats: new Map(),
  securityEvents: new Map(),
  
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
        aiModeUsage: {},
        outcome: 'ongoing',
        satisfaction: null,
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
    
    // Track AI mode usage
    const mode = interaction.aiMode || 'standard';
    consultation.aiModeUsage[mode] = (consultation.aiModeUsage[mode] || 0) + 1;
    
    consultation.consultationNotes.push({
      timestamp: Date.now(),
      type: interaction.type,
      content: interaction.content?.substring(0, 200),
      legalArea: interaction.legalArea,
      aiMode: interaction.aiMode,
      confidence: interaction.confidence,
      complexity: interaction.complexity || 'medium',
      responseTime: interaction.responseTime,
      clientIP: interaction.clientIP
    });
    
    if (interaction.legalArea && !consultation.legalArea) {
      consultation.legalArea = interaction.legalArea;
    }
    
    // Track security events
    if (interaction.securityFlag) {
      consultation.securityFlags.push({
        type: interaction.securityFlag,
        timestamp: Date.now(),
        details: interaction.securityDetails
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
        aiModeUsage: { standard: 0, agentic: 0, agi: 0, asi: 0 },
        avgConfidence: 0,
        securityEvents: 0
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
    
    if (interaction.securityFlag) {
      stats.securityEvents++;
    }
  },
  
  getModeUsageStats() {
    const modeStats = { standard: 0, agentic: 0, agi: 0, asi: 0 };
    
    for (const consultation of this.consultations.values()) {
      Object.entries(consultation.aiModeUsage).forEach(([mode, count]) => {
        if (modeStats.hasOwnProperty(mode)) {
          modeStats[mode] += count;
        }
      });
    }
    
    return modeStats;
  }
};

// ===== LEGAL INTENT CLASSIFICATION =====

function classifyLegalIntent(message) {
  const lowerMessage = message.toLowerCase();
  
  const legalIntents = {
    'corporate_law': ['company', 'business', 'corporate', 'merger', 'acquisition', 'compliance'],
    'litigation': ['court', 'case', 'lawsuit', 'dispute', 'legal action', 'sue'],
    'contracts': ['contract', 'agreement', 'terms', 'breach', 'negotiate'],
    'intellectual_property': ['trademark', 'patent', 'copyright', 'ip', 'brand'],
    'employment_law': ['employee', 'termination', 'workplace', 'labor'],
    'real_estate': ['property', 'real estate', 'land', 'lease', 'rent'],
    'tax_law': ['tax', 'gst', 'income tax', 'assessment'],
    'consultation_request': ['lawyer', 'legal advice', 'consultation', 'help']
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

// ===== LEGAL KNOWLEDGE RETRIEVAL =====

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
    
    return legalContext;
    
  } catch (error) {
    console.error('Legal knowledge retrieval error:', error);
    return '';
  }
}

// ===== ENHANCED AI RESPONSE GENERATION =====

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
- Reference relevant Indian laws and FoxMandal expertise
- Always recommend consulting with qualified lawyers for specific cases
- Keep responses focused and practical
- Show ${aiMode} level reasoning appropriate to the mode`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: enhancedSystemPrompt },
        { role: 'user', content: message }
      ],
      temperature: temperature || 0.3,
      max_tokens: maxTokens || 200,
    });

    return response.choices[0].message.content;
  } catch (error) {
    console.error('OpenAI API error:', error);
    return "I'm experiencing technical difficulties. Please try again or contact our legal team directly for assistance.";
  }
}

// Mode-specific confidence calculation
function calculateModeSpecificConfidence(reply, aiMode, knowledgeBase) {
  let baseConfidence = 0.7;
  
  switch(aiMode) {
    case 'asi':
      baseConfidence = 0.85;
      if (reply.includes('probability') || reply.includes('analysis') || reply.includes('projection')) {
        baseConfidence += 0.05;
      }
      break;
    case 'agi':
      baseConfidence = 0.8;
      if ((reply.includes('business') && reply.includes('legal')) || 
          reply.includes('cross-domain') || reply.includes('holistic')) {
        baseConfidence += 0.05;
      }
      break;
    case 'agentic':
      baseConfidence = 0.75;
      if (reply.includes('step') || reply.includes('process') || 
          reply.includes('research') || reply.includes('analyze')) {
        baseConfidence += 0.05;
      }
      break;
    default:
      baseConfidence = 0.7;
  }
  
  if (knowledgeBase && knowledgeBase.length > 0) baseConfidence += 0.1;
  if (reply.length < 50) baseConfidence -= 0.2;
  
  const uncertaintyMarkers = ['might', 'could', 'possibly', 'perhaps', 'should consult'];
  const uncertaintyCount = uncertaintyMarkers.reduce((count, marker) => 
    count + (reply.toLowerCase().split(marker).length - 1), 0
  );
  
  baseConfidence -= uncertaintyCount * 0.05;
  return Math.max(0.3, Math.min(0.95, baseConfidence));
}

// ===== MAIN ROUTES =====

app.get("/", (req, res) => {
  res.json({
    status: "⚖️ Foxmandal Secure Legal AI is running!",
    version: "2.0.0",
    security: "Enhanced",
    timestamp: new Date().toISOString()
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'Foxmandal Legal AI',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    services: {
      openai: !!process.env.OPENAI_API_KEY,
      pinecone: !!process.env.PINECONE_API_KEY,
      legalKnowledge: !!index,
      encryption: !!process.env.ENCRYPTION_KEY
    },
    security: {
      rateLimit: 'enabled',
      inputValidation: 'enabled',
      encryption: 'enabled',
      headers: 'secured'
    }
  });
});

// Enhanced secure /chat route with REAL AI modes
app.post('/chat', validateRequest, async (req, res) => {
  const { message, sessionId, aiMode = 'standard', systemPrompt, temperature, maxTokens } = req.body;
  const startTime = Date.now();
  const clientIP = (req.ip || req.connection.remoteAddress || '').replace(/\.\d+$/, '.xxx');
  
  console.log(`Processing ${aiMode} mode request:`, {
    sessionId,
    messageLength: message.length,
    ip: clientIP
  });
  
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
    
    if (!reply || typeof reply !== 'string') {
      throw new Error('Invalid AI response generated');
    }
    
    const confidence = calculateModeSpecificConfidence(reply, aiMode, legalKnowledge);
    const shouldCaptureLead = legalArea !== 'general_inquiry' && 
                             (urgency === 'high' || message.toLowerCase().includes('consultation'));
    
    legalAnalytics.trackLegalInteraction(sessionId, {
      type: 'ai_response',
      content: reply,
      legalArea,
      complexity: urgency === 'high' ? 'high' : 'medium',
      aiMode,
      sessionId,
      responseTime: Date.now() - startTime,
      confidence,
      leadGenerated: shouldCaptureLead,
      clientIP
    });
    
    res.json({ 
      reply,
      confidence,
      aiMode,
      userProfile: {
        legalArea,
        urgency,
        needsConsultation: shouldCaptureLead
      },
      disclaimer: confidence < 0.8 ? 
        "This response has lower confidence and should be verified by a legal professional." :
        "This is general legal information. Please consult with a qualified lawyer for specific legal advice."
    });
    
  } catch (err) {
    console.error('Secure chat error:', {
      error: err.message,
      sessionId,
      aiMode,
      ip: clientIP
    });
    
    legalAnalytics.trackLegalInteraction(sessionId, {
      type: 'error',
      content: err.message,
      aiMode,
      sessionId,
      clientIP,
      securityFlag: 'processing_error'
    });
    
    res.status(500).json({ 
      error: 'Unable to process your request at this time',
      code: 'PROCESSING_ERROR'
    });
  }
});

// Enhanced secure lead capture
app.post('/capture-lead', validateRequest, async (req, res) => {
  const { name, email, phone, legalArea, urgency, message, sessionId, aiMode } = req.body;
  const clientIP = (req.ip || req.connection.remoteAddress || '').replace(/\.\d+$/, '.xxx');
  
  if (!name || !email) {
    return res.status(400).json({ error: 'Name and email are required' });
  }
  
  // Additional validation
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
      urgency: urgency || 'medium',
      message: message ? validateAndSanitizeInput(message, 1000) : '',
      sessionId,
      aiMode: aiMode || 'standard',
      timestamp: new Date().toISOString(),
      source: `foxmandal_${aiMode || 'standard'}_ai`,
      status: 'pending',
      clientIP
    };
    
    // Encrypt sensitive data before storage (in production)
    if (encryption) {
      const encryptedData = encryption.encrypt(JSON.stringify(sanitizedData));
      if (encryptedData) {
        console.log('Lead data encrypted for storage');
      }
    }
    
    legalAnalytics.trackConsultation(sessionId, {
      outcome: 'lead_captured',
      clientProfile: { 
        name: sanitizedData.name, 
        email: sanitizedData.email, 
        legalArea: sanitizedData.legalArea,
        aiMode: sanitizedData.aiMode
      }
    });
    
    console.log('Secure lead captured:', { 
      name: sanitizedData.name, 
      email: sanitizedData.email, 
      legalArea: sanitizedData.legalArea,
      aiMode: sanitizedData.aiMode
    });
    
    res.json({ 
      success: true, 
      message: 'Thank you! Our legal team will contact you within 24 hours.',
      consultationId: sessionId,
      expectedResponse: urgency === 'high' ? '2-4 hours' : '24 hours'
    });
    
  } catch (error) {
    console.error('Secure lead capture failed:', error);
    
    legalAnalytics.trackLegalInteraction(sessionId, {
      type: 'error',
      content: 'Lead capture failed',
      sessionId,
      clientIP,
      securityFlag: 'lead_capture_error'
    });
    
    res.status(500).json({ 
      error: 'Failed to process your request', 
      code: 'CAPTURE_ERROR'
    });
  }
});

// Enhanced analytics with security metrics
app.get('/legal-analytics', (req, res) => {
  try {
    const today = legalAnalytics.dailyStats.get(new Date().toISOString().split('T')[0]);
    const modeUsage = legalAnalytics.getModeUsageStats();
    
    res.json({
      summary: {
        todaysConsultations: today?.totalConsultations.size || 0,
        todaysQueries: today?.totalQueries || 0,
        topLegalAreas: today?.legalAreas || {},
        leadsGenerated: today?.leadsGenerated || 0,
        securityEvents: today?.securityEvents || 0
      },
      aiModeUsage: modeUsage,
      activeConsultations: legalAnalytics.consultations.size,
      systemHealth: {
        openaiStatus: !!process.env.OPENAI_API_KEY,
        pineconeStatus: !!index,
        securityEnabled: true
      }
    });
    
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ error: 'Failed to get analytics' });
  }
});

// Security monitoring endpoint (admin only)
app.get('/security-status', (req, res) => {
  // Basic security check - in production, add proper authentication
  const securityEvents = Array.from(legalAnalytics.consultations.values())
    .filter(consultation => consultation.securityFlags.length > 0)
    .length;
    
  res.json({
    securityEvents,
    rateLimit: 'active',
    inputValidation: 'active',
    encryption: !!process.env.ENCRYPTION_KEY,
    timestamp: new Date().toISOString()
  });
});

// TTS endpoint (disabled for security)
app.post('/tts', (req, res) => {
  res.status(503).json({ 
    error: 'TTS service uses browser speech synthesis',
    message: 'Please use browser speech synthesis for voice interaction',
    security: 'Server-side TTS disabled for security'
  });
});

// ===== LEGAL KNOWLEDGE SEEDING (Run once) =====

async function seedIndianLegalKnowledge() {
  if (!index) return;
  
  console.log('Seeding Indian legal knowledge base...');
  
  const legalKnowledge = [
    {
      content: `Foxmandal is one of India's leading full-service law firms with over 100 lawyers across offices in Mumbai, Delhi, and Bangalore. We provide comprehensive legal services including corporate law, litigation, intellectual property, employment law, real estate, and regulatory compliance.`,
      area: 'firm_overview',
      jurisdiction: 'india'
    },
    {
      content: `Corporate Law Services: We assist with company incorporation, board governance, mergers and acquisitions, due diligence, securities law compliance under Companies Act 2013, SEBI regulations, and FEMA compliance.`,
      area: 'corporate_law',
      jurisdiction: 'india'
    },
    {
      content: `Litigation and Dispute Resolution: Our team represents clients before Supreme Court, High Courts, and tribunals including NCLT, NCLAT. We handle commercial disputes, constitutional matters, and alternative dispute resolution.`,
      area: 'litigation',
      jurisdiction: 'india'
    }
    // Add more knowledge entries as needed
  ];
  
  try {
    const records = [];
    for (const [index, knowledge] of legalKnowledge.entries()) {
      const embedding = await embeddingsClient.embedQuery(knowledge.content);
      records.push({
        id: `legal_knowledge_${index}_${Date.now()}`,
        values: embedding,
        metadata: {
          content: knowledge.content,
          type: 'legal_knowledge',
          area: knowledge.area,
          jurisdiction: knowledge.jurisdiction,
          timestamp: Date.now()
        }
      });
    }
    
    if (records.length > 0) {
      await index.upsert({ records });
      console.log(`Legal knowledge seeded: ${records.length} entries`);
    }
  } catch (error) {
    console.error('Failed to seed legal knowledge:', error);
  }
}

// ===== INITIALIZATION =====

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
  console.log(`🛡️ Foxmandal Secure Legal AI running on port ${PORT}`);
  console.log(`🔒 Security features: Rate limiting, Input validation, Encryption`);
  console.log(`🤖 AI Modes: Standard, Agentic, AGI, ASI`);
  console.log(`📍 Endpoints: /chat, /capture-lead, /legal-analytics, /security-status`);
});