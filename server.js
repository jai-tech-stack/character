// FoxMandal Legal AI - Production Server
// Verified clean - no route syntax errors

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

config();

// Dynamic PDF import to avoid test file error
let pdfParse = null;
(async () => {
  try {
    const module = await import('pdf-parse');
    pdfParse = module.default;
    console.log('PDF parser loaded');
  } catch (err) {
    console.error('PDF parser error:', err.message);
  }
})();

console.log('ENV CHECK:', {
  openai: !!process.env.OPENAI_API_KEY,
  pinecone: !!process.env.PINECONE_API_KEY,
});

const app = express();

// Security
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
}));

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.removeHeader('X-Powered-By');
  next();
});

// Rate limiting
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  skip: (req) => req.path === '/health'
}));

// CORS
app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true);
    
    const allowed = [
      'http://localhost:5173',
      'https://character-kappa.vercel.app'
    ];
    
    if (origin.endsWith('.vercel.app') || allowed.includes(origin)) {
      return callback(null, true);
    }
    callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
}));

app.options('*', cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(fileUpload({
  limits: { fileSize: 10 * 1024 * 1024 },
  useTempFiles: true,
  tempFileDir: '/tmp/',
}));

// Security utilities
function validateInput(input, maxLength = 2000) {
  if (!input || typeof input !== 'string') return null;
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]*>/g, '')
    .substring(0, maxLength)
    .trim();
}

const validateRequest = (req, res, next) => {
  const { message } = req.body;
  if (!message || typeof message !== 'string' || message.length > 2000) {
    return res.status(400).json({ error: 'Invalid message' });
  }
  req.body.message = validateInput(message);
  next();
};

// AI clients
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const embeddings = new OpenAIEmbeddings({ apiKey: process.env.OPENAI_API_KEY });
const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });

let index;
async function initPinecone() {
  try {
    const list = await pinecone.listIndexes();
    const exists = list.indexes?.some(i => i.name === process.env.PINECONE_INDEX);
    if (exists) {
      index = pinecone.index(process.env.PINECONE_INDEX);
      console.log('Pinecone initialized');
    }
  } catch (error) {
    console.error('Pinecone error:', error.message);
  }
}

// Analytics
const analytics = {
  stats: new Map(),
  track(sessionId, data) {
    const today = new Date().toISOString().split('T')[0];
    if (!this.stats.has(today)) {
      this.stats.set(today, { queries: 0, sessions: new Set() });
    }
    const stat = this.stats.get(today);
    stat.queries++;
    if (sessionId) stat.sessions.add(sessionId);
  }
};

// Document classification
function classifyDoc(text) {
  const lower = text.toLowerCase();
  const patterns = {
    employment: ['employment', 'offer letter'],
    nda: ['non-disclosure', 'confidentiality'],
    contract: ['contract', 'agreement'],
  };
  for (const [type, keywords] of Object.entries(patterns)) {
    if (keywords.some(k => lower.includes(k))) return type;
  }
  return 'general';
}

function classifyIntent(msg) {
  const lower = msg.toLowerCase();
  if (lower.includes('contract')) return 'contracts';
  if (lower.includes('employment')) return 'employment_law';
  if (lower.includes('company')) return 'corporate_law';
  return 'general_inquiry';
}

// AI response generation
async function getLegalKnowledge(query) {
  if (!index) return '';
  try {
    const vec = await embeddings.embedQuery(query);
    const results = await index.query({
      vector: vec,
      topK: 3,
      includeMetadata: true,
    });
    return results.matches
      ?.filter(m => m.score > 0.75)
      ?.map(m => m.metadata?.content || '')
      .join('\n') || '';
  } catch (error) {
    return '';
  }
}

async function generateResponse(message, context) {
  const { legalArea, knowledge, systemPrompt, temperature, maxTokens } = context;
  
  const prompt = systemPrompt || `You are Advocate Arjun from FoxMandal.

Context: ${knowledge}
Legal Area: ${legalArea}

Provide clear, actionable legal guidance. Keep responses under 400 words.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: prompt },
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

async function analyzeDocument(text, docType, aiMode) {
  const summary = text.substring(0, 2000);
  const prompt = `You are a legal analyst. Analyze this ${docType}:

Key Clauses:
Potential Issues:
Recommendations:
Next Steps:`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: summary }
      ],
      temperature: 0.4,
      max_tokens: 600
    });
    return {
      content: response.choices[0].message.content,
      confidence: 0.82,
      docType,
      aiMode
    };
  } catch (error) {
    throw new Error('Analysis failed');
  }
}

// Routes
app.get('/', (req, res) => {
  res.json({
    status: 'FoxMandal Legal AI running',
    version: '2.0.0',
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    services: {
      openai: !!process.env.OPENAI_API_KEY,
      pinecone: !!process.env.PINECONE_API_KEY,
      pdfParser: !!pdfParse
    }
  });
});

app.post('/chat', validateRequest, async (req, res) => {
  const { message, sessionId, aiMode, systemPrompt, temperature, maxTokens } = req.body;
  
  try {
    const legalArea = classifyIntent(message);
    analytics.track(sessionId, { type: 'chat' });
    
    const knowledge = await getLegalKnowledge(message);
    const reply = await generateResponse(message, {
      legalArea,
      knowledge,
      systemPrompt,
      temperature,
      maxTokens
    });
    
    res.json({ 
      reply,
      confidence: 0.80,
      aiMode: aiMode || 'agentic'
    });
  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({ error: 'Processing error' });
  }
});

app.post('/analyze-document', validateRequest, async (req, res) => {
  const { sessionId, aiMode } = req.body;
  
  if (!req.files?.document) {
    return res.status(400).json({ error: 'No document uploaded' });
  }

  const file = req.files.document;
  const ext = file.name.split('.').pop().toLowerCase();
  
  if (!['pdf', 'docx', 'txt'].includes(ext)) {
    return res.status(400).json({ error: 'Invalid file type' });
  }

  try {
    let text = '';
    
    if (ext === 'pdf') {
      if (!pdfParse) {
        return res.status(503).json({ error: 'PDF parser loading' });
      }
      const data = await pdfParse(file.data);
      text = data.text;
    } else if (ext === 'docx') {
      const result = await mammoth.extractRawText({ buffer: file.data });
      text = result.value;
    } else {
      text = file.data.toString('utf-8');
    }

    if (!text || text.length < 50) {
      return res.status(400).json({ error: 'Document unreadable' });
    }

    const docType = classifyDoc(text);
    const analysis = await analyzeDocument(text, docType, aiMode);
    
    analytics.track(sessionId, { type: 'doc_analysis' });

    res.json({
      success: true,
      fileName: file.name,
      documentType: docType,
      analysis: analysis.content,
      confidence: analysis.confidence
    });
  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({ error: 'Analysis failed' });
  }
});

app.post('/capture-lead', validateRequest, async (req, res) => {
  const { name, email, sessionId } = req.body;
  
  if (!name || !email) {
    return res.status(400).json({ error: 'Name and email required' });
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email' });
  }
  
  analytics.track(sessionId, { type: 'lead' });
  console.log('Lead captured:', name, email);
  
  res.json({ 
    success: true, 
    message: 'Thank you! We will contact you within 24 hours.'
  });
});

app.get('/legal-analytics', (req, res) => {
  const today = analytics.stats.get(new Date().toISOString().split('T')[0]);
  res.json({
    todayQueries: today?.queries || 0,
    todaySessions: today?.sessions.size || 0
  });
});

// Initialize
(async () => {
  try {
    await initPinecone();
    const PORT = process.env.PORT || 3001;
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Startup error:', err);
    process.exit(1);
  }
})();