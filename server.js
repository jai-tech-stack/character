import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import bodyParser from 'body-parser';
import rateLimit from 'express-rate-limit';
import { config } from 'dotenv';
import { Pinecone } from '@pinecone-database/pinecone';
import { OpenAI } from 'openai';
import { OpenAIEmbeddings } from '@langchain/openai';
import fileUpload from 'express-fileupload';
import mammoth from 'mammoth';

config();

// Dynamic PDF parser import
let pdfParse = null;
(async () => {
  try {
    const mod = await import('pdf-parse');
    pdfParse = mod.default;
    console.log('PDF parser loaded');
  } catch (e) {
    console.error('PDF parser not loaded:', e.message);
  }
});

const app = express();

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https:"]
    }
  }
}));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.removeHeader('X-Powered-By');
  next();
});

app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  skip: (req) => req.path === '/health'
}));

app.use(cors({
  origin: function(origin, callback) {
    const allowed = [
      'http://localhost:5173',
      'https://character-kappa.vercel.app',
      'https://foxmandal.in',
      'https://www.foxmandal.in',
      'https://legal-ai.vercel.app'
    ];
    if (!origin) return callback(null, true);
    if (origin.endsWith('.vercel.app') || allowed.includes(origin)) return callback(null, true);
    callback(null, true);
  },
  credentials: true,
  methods: ['GET','POST','OPTIONS'],
}));

app.options('*', cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(fileUpload({
  limits: { fileSize: 10 * 1024 * 1024 },
  useTempFiles: true,
  tempFileDir: '/tmp/',
}));

// Simple input validation & sanitization
function validateInput(input, maxLength = 2000) {
  if (!input || typeof input !== 'string') return null;
  return input.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
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

// AI and Vector Index Clients
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const embeddings = new OpenAIEmbeddings({ apiKey: process.env.OPENAI_API_KEY });
const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
let index;
async function initPinecone() {
  try {
    const list = await pinecone.listIndexes();
    if (list.indexes?.some(i => i.name === process.env.PINECONE_INDEX)) {
      index = pinecone.index(process.env.PINECONE_INDEX);
      console.log('Pinecone initialized');
    }
  } catch (e) { console.error('Pinecone error:', e.message); }
}

// Analytics
const analytics = {
  stats: new Map(),
  track(sessionId, data) {
    const today = new Date().toISOString().slice(0,10);
    if (!this.stats.has(today)) this.stats.set(today, { queries: 0, sessions: new Set() });
    const stat = this.stats.get(today);
    stat.queries++;
    if (sessionId) stat.sessions.add(sessionId);
  }
};

// Legal Intent & Doc Classification
function classifyIntent(msg) {
  const l = msg.toLowerCase();
  if (l.includes('contract')) return 'contracts';
  if (l.includes('employment')) return 'employment_law';
  if (l.includes('company')) return 'corporate_law';
  return 'general_inquiry';
}
function classifyDoc(text) {
  const l = text.toLowerCase();
  if (['employment', 'offer letter'].some(s => l.includes(s))) return 'employment';
  if (['non-disclosure','confidentiality'].some(s => l.includes(s))) return 'nda';
  if (['contract','agreement'].some(s => l.includes(s))) return 'contract';
  return 'general';
}

// Legal Knowledge retrieval from Pinecone
async function getLegalKnowledge(query) {
  if (!index) return '';
  try {
    const vec = await embeddings.embedQuery(query);
    const results = await index.query({
      vector: vec,
      topK: 3,
      includeMetadata: true,
    });
    return results.matches?.filter(m => m.score > 0.75).map(m => m.metadata?.content || '').join("\n") || '';
  } catch {
    return '';
  }
}

// Chat endpoint with GPT-4 Turbo Streaming for frontend chatApi.js integration
app.post('/chat', validateRequest, async (req, res) => {
  const { message, sessionId, aiMode, systemPrompt, temperature, maxTokens } = req.body;
  try {
    const legalArea = classifyIntent(message);
    analytics.track(sessionId, {type: 'chat'});

    const knowledge = await getLegalKnowledge(message);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const messages = [
      {role: 'system', content: systemPrompt || `You are Advocate Arjun from FoxMandal.\nContext:\n${knowledge}\nLegal Area: ${legalArea}\nProvide clear, actionable guidance.`},
      {role: 'user', content: message}
    ];

    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo',
      messages,
      temperature: temperature || 0.3,
      max_tokens: maxTokens || 500,
      stream: true
    });

    for await (const part of completion) {
      const text = part.choices?.[0]?.delta?.content || '';
      if (text) res.write(text);
    }
    res.end();
  } catch (e) {
    console.error('Chat error:', e);
    res.write('\n[ERROR]\n');
    res.end();
  }
});

// Document Analysis - accepts file upload & sessionId + aiMode
app.post('/analyze-document', validateRequest, async (req, res) => {
  const { sessionId, aiMode } = req.body;
  if (!req.files?.document) return res.status(400).json({ error: 'No document uploaded' });

  const file = req.files.document;
  const ext = file.name.split('.').pop().toLowerCase();
  if (!['pdf','docx','txt'].includes(ext)) return res.status(400).json({ error: 'Invalid file type' });

  try {
    let text = '';
    if (ext === 'pdf') {
      if (!pdfParse) return res.status(503).json({ error: 'PDF parser loading' });
      const data = await pdfParse(file.data);
      text = data.text;
    } else if (ext === 'docx') {
      const result = await mammoth.extractRawText({ buffer: file.data });
      text = result.value;
    } else {
      text = file.data.toString('utf-8');
    }

    if (!text || text.length < 50) return res.status(400).json({ error: 'Document unreadable' });

    const docType = classifyDoc(text);
    const prompt = `You are a legal analyst. Analyze this ${docType}:\n\nKey Clauses:\nPotential Issues:\nRecommendations:\nNext Steps:`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo',
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: text.substring(0, 2000) }
      ],
      temperature: 0.4,
      max_tokens: 600
    });
    
    analytics.track(sessionId, {type: 'doc_analysis'});

    res.json({
      success: true,
      fileName: file.name,
      documentType: docType,
      analysis: response.choices[0].message.content,
      confidence: 0.82
    });
  } catch (e) {
    console.error('Analysis error:', e);
    res.status(500).json({ error: 'Analysis failed' });
  }
});

// Lead capture
app.post('/capture-lead', validateRequest, (req, res) => {
  const { name, email, sessionId, aiMode } = req.body;
  if (!name || !email) return res.status(400).json({ error: 'Name and email required' });
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) return res.status(400).json({ error: 'Invalid email' });

  analytics.track(sessionId, { type: 'lead' });
  console.log('Lead captured:', { name, email, aiMode });

  return res.json({
    success: true,
    message: 'Thank you! We will contact you within 24 hours.'
  });
});

// Legal Analytics for frontend stats display
app.get('/legal-analytics', (req, res) => {
  const today = analytics.stats.get(new Date().toISOString().slice(0,10));
  res.json({
    todayQueries: today?.queries || 0,
    todaySessions: today?.sessions.size || 0
  });
});

// Basic root and health
app.get('/', (req, res) => {
  res.json({ status: 'FoxMandal Legal AI running', version: '2.1.0', streaming: true });
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

// Startup
(async () => {
  try {
    await initPinecone();
    const PORT = process.env.PORT || 3001;
    app.listen(PORT, () => {
      console.log('Foxmandal Legal AI Server running on port', PORT);
    });
  } catch (err) {
    console.error('Startup error:', err);
    process.exit(1);
  }
})();
