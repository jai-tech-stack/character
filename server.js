// ⚡ ULTRA-FAST FoxMandal Legal AI - Optimized for Speed
// Target: <2 second responses for 90% of queries

import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { config } from 'dotenv';
import { OpenAI } from 'openai';

config();

const app = express();

// ===== SECURITY MIDDLEWARE =====
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100, skip: (req) => req.path === '/health' }));

// CORS - Optimized
app.use(cors({
  origin: (origin, callback) => callback(null, true), // Allow all for speed
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS']
}));

app.use(bodyParser.json({ limit: '5mb' })); // Reduced from 10mb

// ===== OPTIMIZED AI CLIENT =====
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 10000, // 10s timeout
  maxRetries: 1 // Fail fast
});

// ===== FAST VALIDATION =====
const validateRequest = (req, res, next) => {
  const { message } = req.body;
  if (!message || message.length > 500) { // Reduced from 2000
    return res.status(400).json({ error: 'Invalid message' });
  }
  next();
};

// ===== LIGHTWEIGHT ANALYTICS =====
const analytics = new Map();
const trackInteraction = (sessionId, type) => {
  const session = analytics.get(sessionId) || { count: 0, start: Date.now() };
  session.count++;
  analytics.set(sessionId, session);
};

// ===== FAST LEGAL CLASSIFICATION (No API Call) =====
function classifyLegalArea(message) {
  const lower = message.toLowerCase();
  if (lower.includes('contract') || lower.includes('agreement')) return 'contract_law';
  if (lower.includes('employment') || lower.includes('job')) return 'employment_law';
  if (lower.includes('property') || lower.includes('real estate')) return 'property_law';
  if (lower.includes('tax')) return 'tax_law';
  if (lower.includes('company') || lower.includes('business')) return 'corporate_law';
  return 'general_legal';
}

// ===== ⚡ ULTRA-FAST AI RESPONSE (No Pinecone, Short Prompts) =====
async function generateFastResponse(message, legalArea) {
  // SHORTENED PROMPT - Critical for speed
  const systemPrompt = `You are Advocate Arjun, FoxMandal's AI legal assistant specializing in Indian law.

RESPONSE RULES:
- Keep answers under 100 words
- Be direct and conversational
- No legal jargon unless necessary
- Suggest consultation for complex matters

User's area: ${legalArea}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // FASTER MODEL (10x cheaper, 2x faster than gpt-4)
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message }
      ],
      temperature: 0.3, // Lower = faster + more consistent
      max_tokens: 150, // Reduced from 300
      stream: false
    });

    return response.choices[0].message.content;
  } catch (error) {
    console.error('OpenAI error:', error.message);
    return "I'm having trouble right now. Could you rephrase that?";
  }
}

// ===== FAST GREETING (Cached) =====
const greetingCache = new Map();
async function getGreeting(sessionId) {
  if (greetingCache.has(sessionId)) {
    return greetingCache.get(sessionId);
  }

  const greeting = "Hello! I'm Advocate Arjun from FoxMandal. I can help with contracts, employment issues, property matters, and more. What brings you here today?";
  greetingCache.set(sessionId, greeting);
  
  // Clear cache after 30 minutes
  setTimeout(() => greetingCache.delete(sessionId), 30 * 60 * 1000);
  
  return greeting;
}

// ===== ROUTES =====

app.get('/', (req, res) => {
  res.json({ service: 'FoxMandal Fast AI', status: 'online', version: '4.0.0' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', openai: !!process.env.OPENAI_API_KEY });
});

// ⚡ ULTRA-FAST CHAT ENDPOINT
app.post('/chat', validateRequest, async (req, res) => {
  const { message, sessionId } = req.body;
  const startTime = Date.now();
  
  try {
    trackInteraction(sessionId, 'query');
    
    // Fast classification (no API call)
    const legalArea = classifyLegalArea(message);
    
    // Single fast API call
    const reply = await generateFastResponse(message, legalArea);
    
    const responseTime = Date.now() - startTime;
    console.log(`⚡ Response in ${responseTime}ms`);
    
    res.json({ 
      reply,
      aiMode: 'fast',
      legalArea,
      responseTime
    });
    
  } catch (error) {
    console.error('Chat error:', error.message);
    res.status(500).json({ 
      error: 'Processing failed',
      reply: "I'm having difficulty. Please try again."
    });
  }
});

// GREETING ENDPOINT (for initial introduction)
app.post('/greeting', async (req, res) => {
  const { sessionId } = req.body;
  try {
    const greeting = await getGreeting(sessionId);
    res.json({ reply: greeting });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate greeting' });
  }
});

// LEAD CAPTURE (unchanged)
app.post('/capture-lead', async (req, res) => {
  const { name, email, phone, message, sessionId } = req.body;
  
  if (!name || !email) {
    return res.status(400).json({ error: 'Name and email required' });
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email' });
  }
  
  console.log('Lead captured:', { name, email, sessionId });
  res.json({ success: true, message: 'Thank you! We will contact you within 24 hours.' });
});

// ===== START SERVER =====
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log('=================================');
  console.log('⚡ FoxMandal FAST AI');
  console.log(`📡 Port: ${PORT}`);
  console.log(`🚀 Model: gpt-4o-mini (ultra-fast)`);
  console.log(`⏰ Started: ${new Date().toISOString()}`);
  console.log('=================================');
});