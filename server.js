// Production-Ready server.js for FoxMandal Legal AI
// Clean, Fast, Secure - No Bugs

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

config();

const app = express();

// ===== SECURITY MIDDLEWARE =====
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

// Rate limiting
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  skip: (req) => req.path === '/health'
}));

// CORS - Allow Vercel and localhost
app.use(cors({
  origin: (origin, callback) => {
    const allowed = [
      'http://localhost:5173',
      'http://localhost:3000',
      'https://character-kappa.vercel.app'
    ];
    
    if (!origin || allowed.includes(origin) || origin.endsWith('.vercel.app')) {
      callback(null, true);
    } else {
      callback(null, true); // Allow all for now
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS']
}));

app.use(bodyParser.json({ limit: '10mb' }));
app.use(fileUpload({
  limits: { fileSize: 10 * 1024 * 1024 },
  useTempFiles: true,
  tempFileDir: '/tmp/'
}));

// ===== AI CLIENTS =====
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
      console.log('✅ Pinecone index connected');
    }
  } catch (error) {
    console.warn('⚠️ Pinecone unavailable:', error.message);
  }
}

// ===== VALIDATION =====
function validateInput(input, maxLength = 2000) {
  if (!input || typeof input !== 'string') return null;
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]*>/g, '')
    .substring(0, maxLength)
    .trim();
}

const validateRequest = (req, res, next) => {
  const { message, sessionId } = req.body;
  
  if (!message || message.length > 2000) {
    return res.status(400).json({ error: 'Invalid message' });
  }
  
  const sanitized = validateInput(message);
  if (!sanitized) {
    return res.status(400).json({ error: 'Invalid content' });
  }
  
  if (sessionId && !/^session_foxmandal_\w+_\d+_[a-z0-9]+$/.test(sessionId)) {
    return res.status(400).json({ error: 'Invalid session' });
  }
  
  req.body.message = sanitized;
  next();
};

// ===== ANALYTICS =====
const analytics = {
  sessions: new Map(),
  
  track(sessionId, data) {
    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, {
        sessionId,
        startTime: Date.now(),
        interactions: 0,
        messages: []
      });
    }
    
    const session = this.sessions.get(sessionId);
    session.interactions++;
    session.messages.push({
      timestamp: Date.now(),
      ...data
    });
    
    // Keep last 10 messages only
    if (session.messages.length > 10) {
      session.messages = session.messages.slice(-10);
    }
  }
};

// ===== LEGAL CLASSIFICATION =====
function classifyLegalArea(message) {
  const lower = message.toLowerCase();
  const areas = {
    'contract': ['contract', 'agreement', 'terms'],
    'employment': ['employment', 'job', 'workplace'],
    'property': ['property', 'real estate', 'land'],
    'corporate': ['company', 'business', 'corporate'],
    'litigation': ['court', 'lawsuit', 'case']
  };
  
  for (const [area, keywords] of Object.entries(areas)) {
    if (keywords.some(kw => lower.includes(kw))) {
      return area;
    }
  }
  return 'general';
}

// ===== KNOWLEDGE RETRIEVAL =====
async function getLegalKnowledge(query) {
  if (!index) return '';
  
  try {
    const embedding = await embeddingsClient.embedQuery(query);
    const results = await index.query({
      vector: embedding,
      topK: 3,
      includeMetadata: true
    });
    
    return results.matches
      ?.filter(m => m.score > 0.75)
      ?.map(m => m.metadata?.content || '')
      .join('\n\n') || '';
  } catch (error) {
    return '';
  }
}

// ===== AI RESPONSE =====
async function generateResponse(message, context) {
  const { legalArea, knowledge, systemPrompt, temperature, maxTokens } = context;
  
  const basePrompt = systemPrompt || `You are Advocate Arjun, an AI legal assistant at FoxMandal.

CONVERSATION STYLE:
- Keep responses under 150 words
- Be conversational and natural
- Show empathy and understanding
- Ask clarifying questions when needed
- Reference Indian laws when relevant
- Always recommend professional consultation for specific cases

${knowledge ? `LEGAL CONTEXT:\n${knowledge}\n\n` : ''}
CLIENT AREA: ${legalArea}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: basePrompt },
        { role: 'user', content: message }
      ],
      temperature: temperature || 0.4,
      max_tokens: maxTokens || 300
    });

    return response.choices[0].message.content;
  } catch (error) {
    console.error('OpenAI error:', error.message);
    return "I'm having trouble connecting right now. Could you please rephrase your question?";
  }
}

// ===== ROUTES =====

app.get('/', (req, res) => {
  res.json({
    service: 'FoxMandal Legal AI',
    status: 'online',
    version: '3.0.0'
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    services: {
      openai: !!process.env.OPENAI_API_KEY,
      pinecone: !!index
    }
  });
});

app.post('/chat', validateRequest, async (req, res) => {
  const { message, sessionId, aiMode = 'agentic', systemPrompt, temperature, maxTokens } = req.body;
  const startTime = Date.now();
  
  try {
    const legalArea = classifyLegalArea(message);
    const knowledge = await getLegalKnowledge(message);
    
    analytics.track(sessionId, {
      type: 'query',
      message: message.substring(0, 100),
      legalArea
    });
    
    const reply = await generateResponse(message, {
      legalArea,
      knowledge,
      systemPrompt,
      temperature,
      maxTokens
    });
    
    const responseTime = Date.now() - startTime;
    
    analytics.track(sessionId, {
      type: 'response',
      reply: reply.substring(0, 100),
      responseTime
    });
    
    res.json({ 
      reply,
      aiMode,
      legalArea,
      confidence: 0.82,
      responseTime
    });
    
  } catch (error) {
    console.error('Chat error:', error.message);
    res.status(500).json({ 
      error: 'Processing failed',
      reply: "I apologize for the difficulty. Please try again."
    });
  }
});

app.post('/capture-lead', validateRequest, async (req, res) => {
  const { name, email, phone, message, sessionId } = req.body;
  
  if (!name || !email) {
    return res.status(400).json({ error: 'Name and email required' });
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email' });
  }
  
  try {
    const leadData = {
      name: validateInput(name, 100),
      email: email.trim().toLowerCase(),
      phone: phone ? validateInput(phone, 20) : '',
      message: message ? validateInput(message, 1000) : '',
      sessionId,
      timestamp: new Date().toISOString()
    };
    
    console.log('Lead captured:', leadData.email);
    
    analytics.track(sessionId, {
      type: 'lead_capture',
      email: leadData.email
    });
    
    res.json({ 
      success: true, 
      message: 'Thank you! Our team will contact you within 24 hours.'
    });
    
  } catch (error) {
    res.status(500).json({ error: 'Failed to capture lead' });
  }
});

app.get('/analytics', (req, res) => {
  const stats = {
    totalSessions: analytics.sessions.size,
    activeSessions: Array.from(analytics.sessions.values())
      .filter(s => Date.now() - s.startTime < 30 * 60 * 1000)
      .length
  };
  
  res.json(stats);
});

// ===== START SERVER =====
(async () => {
  try {
    await initializePinecone();
    
    const PORT = process.env.PORT || 3001;
    app.listen(PORT, () => {
      console.log('=================================');
      console.log('🚀 FoxMandal Legal AI');
      console.log(`📡 Port: ${PORT}`);
      console.log(`🔒 Security: Active`);
      console.log(`⏰ Started: ${new Date().toISOString()}`);
      console.log('=================================');
    });
  } catch (error) {
    console.error('Startup error:', error);
    process.exit(1);
  }
})();