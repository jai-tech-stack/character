// 🔥 FIXED FoxMandal Legal AI - ALL FEATURES + CORS FIX
// Conversation History + Multi-Language + Analytics + Document Analysis
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { config } from 'dotenv';
import { OpenAI } from 'openai';
import fileUpload from 'express-fileupload';
import fs from 'fs/promises';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';

config();

const app = express();

// ===== 🔥 CRITICAL: FIXED CORS CONFIGURATION =====
const allowedOrigins = [
  'https://character-kappa.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:5174',
  'https://character-kappa-git-main.vercel.app',
  // Add any Vercel preview deployments
  /https:\/\/character-kappa-.*\.vercel\.app$/
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, curl)
    if (!origin) return callback(null, true);
    
    // Check if origin is in allowed list or matches regex
    const isAllowed = allowedOrigins.some(allowed => {
      if (typeof allowed === 'string') {
        return allowed === origin;
      } else if (allowed instanceof RegExp) {
        return allowed.test(origin);
      }
      return false;
    });
    
    if (isAllowed) {
      console.log('✅ CORS allowed:', origin);
      return callback(null, true);
    }
    
    console.warn('⚠️ CORS blocked:', origin);
    const msg = 'CORS policy: This origin is not allowed';
    return callback(new Error(msg), false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Session-ID', 'Accept'],
  exposedHeaders: ['X-Session-ID'],
  maxAge: 86400, // 24 hours
  optionsSuccessStatus: 200
}));

// Handle preflight requests explicitly
app.options('*', cors());

// ===== SECURITY =====
app.use(helmet({ 
  contentSecurityPolicy: false, 
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

app.use(rateLimit({ 
  windowMs: 15 * 60 * 1000, 
  max: 200, 
  skip: (req) => req.path === '/health',
  message: 'Too many requests, please try again later'
}));

app.use(bodyParser.json({ limit: '5mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '5mb' }));

app.use(fileUpload({ 
  limits: { fileSize: 10 * 1024 * 1024 }, 
  useTempFiles: true, 
  tempFileDir: '/tmp/',
  abortOnLimit: true,
  responseOnLimit: 'File size exceeds 10MB limit'
}));

// ===== REQUEST LOGGING =====
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path} - Origin: ${req.headers.origin || 'none'}`);
  next();
});

// ===== AI CLIENT =====
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY, 
  timeout: 15000, 
  maxRetries: 2 
});

// ===== CONVERSATION HISTORY (In-Memory) =====
const conversationHistory = new Map();
const MAX_HISTORY = 5;

function getHistory(sessionId) {
  if (!conversationHistory.has(sessionId)) {
    conversationHistory.set(sessionId, []);
  }
  return conversationHistory.get(sessionId);
}

function addToHistory(sessionId, role, content) {
  const history = getHistory(sessionId);
  history.push({ role, content, timestamp: Date.now() });
  if (history.length > MAX_HISTORY * 2) {
    conversationHistory.set(sessionId, history.slice(-MAX_HISTORY * 2));
  }
}

// ===== MULTI-LANGUAGE DETECTION =====
function detectLanguage(text) {
  const hindiPattern = /[\u0900-\u097F]/;
  const tamilPattern = /[\u0B80-\u0BFF]/;
  const teluguPattern = /[\u0C00-\u0C7F]/;
  
  if (hindiPattern.test(text)) return 'hi';
  if (tamilPattern.test(text)) return 'ta';
  if (teluguPattern.test(text)) return 'te';
  return 'en';
}

// ===== ADVANCED ANALYTICS =====
const analytics = {
  sessions: new Map(),
  totalQueries: 0,
  avgResponseTime: [],
  languages: { en: 0, hi: 0, ta: 0, te: 0 },
  legalAreas: {},
  
  track(sessionId, data) {
    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, {
        sessionId,
        startTime: Date.now(),
        queries: 0,
        language: 'en',
        legalAreas: [],
        satisfactionScore: null
      });
    }
    
    const session = this.sessions.get(sessionId);
    session.queries++;
    this.totalQueries++;
    
    if (data.language) {
      session.language = data.language;
      this.languages[data.language]++;
    }
    
    if (data.legalArea) {
      session.legalAreas.push(data.legalArea);
      this.legalAreas[data.legalArea] = (this.legalAreas[data.legalArea] || 0) + 1;
    }
    
    if (data.responseTime) {
      this.avgResponseTime.push(data.responseTime);
      if (this.avgResponseTime.length > 100) {
        this.avgResponseTime.shift();
      }
    }
  },
  
  getStats() {
    const avgTime = this.avgResponseTime.length > 0
      ? this.avgResponseTime.reduce((a, b) => a + b, 0) / this.avgResponseTime.length
      : 0;
    
    return {
      totalSessions: this.sessions.size,
      totalQueries: this.totalQueries,
      avgResponseTime: Math.round(avgTime),
      languages: this.languages,
      topLegalAreas: Object.entries(this.legalAreas)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
    };
  }
};

// ===== LEGAL CLASSIFICATION =====
function classifyLegalArea(message) {
  const lower = message.toLowerCase();
  const areas = {
    'contract_law': ['contract', 'agreement', 'terms', 'अनुबंध', 'ஒப்பந்தம்'],
    'employment_law': ['employment', 'job', 'workplace', 'रोजगार', 'வேலை'],
    'property_law': ['property', 'real estate', 'land', 'संपत्ति', 'சொத்து'],
    'tax_law': ['tax', 'gst', 'income', 'कर', 'வரி'],
    'corporate_law': ['company', 'business', 'corporate', 'कंपनी', 'நிறுவனம்'],
    'family_law': ['divorce', 'marriage', 'custody', 'तलाक', 'திருமணம்'],
    'criminal_law': ['crime', 'police', 'fir', 'अपराध', 'குற்றம்']
  };
  
  for (const [area, keywords] of Object.entries(areas)) {
    if (keywords.some(kw => lower.includes(kw))) return area;
  }
  return 'general_legal';
}

// ===== SENTIMENT ANALYSIS =====
function analyzeSentiment(message) {
  const lower = message.toLowerCase();
  const urgent = ['urgent', 'emergency', 'immediately', 'तुरंत', 'அவசரம்'];
  const concerned = ['worried', 'scared', 'afraid', 'चिंतित', 'கவலை'];
  
  if (urgent.some(word => lower.includes(word))) return 'urgent';
  if (concerned.some(word => lower.includes(word))) return 'concerned';
  return 'neutral';
}

// ===== AI RESPONSE WITH CONTEXT =====
async function generateSmartResponse(message, sessionId, legalArea, language) {
  const history = getHistory(sessionId);
  const sentiment = analyzeSentiment(message);
  
  const languageNames = { en: 'English', hi: 'Hindi', ta: 'Tamil', te: 'Telugu' };
  const langInstruction = language !== 'en' 
    ? `\n\nIMPORTANT: Respond in ${languageNames[language]}. User is communicating in their native language.`
    : '';
  
  const systemPrompt = `You are Advocate Arjun, FoxMandal's expert AI legal assistant for Indian law.

CONVERSATION CONTEXT:
- User has asked ${history.length / 2} questions in this session
- Current topic: ${legalArea.replace(/_/g, ' ')}
- User sentiment: ${sentiment}
${langInstruction}

RESPONSE GUIDELINES:
- Keep under 100 words unless complex topic requires detail
- Be empathetic, especially if user seems concerned
- Reference previous context naturally
- Provide actionable next steps
- Suggest consultation for serious matters
- Use simple language, avoid jargon

LEGAL AREAS EXPERTISE: Contracts, Employment, Property, Tax, Corporate, Family, Criminal Law`;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.slice(-6), // Last 3 exchanges
    { role: 'user', content: message }
  ];

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      temperature: 0.4,
      max_tokens: 300,
    });

    return response.choices[0].message.content;
  } catch (error) {
    console.error('OpenAI error:', error.message);
    const errorMessages = {
      en: "I'm having trouble right now. Could you rephrase that?",
      hi: "मुझे अभी कुछ समस्या हो रही है। क्या आप इसे दोबारा बता सकते हैं?",
      ta: "எனக்கு இப்போது சிக்கல் உள்ளது. இதை மீண்டும் சொல்ல முடியுமா?",
      te: "నాకు ఇప్పుడు ఇబ్బంది ఉంది. మీరు దీన్ని మళ్లీ చెప్పగలరా?"
    };
    return errorMessages[language] || errorMessages.en;
  }
}

// ===== DOCUMENT TEXT EXTRACTION =====
async function extractDocumentText(filePath, mimeType) {
  try {
    if (mimeType === 'application/pdf') {
      const buffer = await fs.readFile(filePath);
      const data = await pdfParse(buffer);
      return data.text;
    } else if (mimeType.includes('wordprocessingml') || mimeType.includes('msword')) {
      const buffer = await fs.readFile(filePath);
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    } else if (mimeType === 'text/plain') {
      return await fs.readFile(filePath, 'utf-8');
    }
    throw new Error('Unsupported file type');
  } catch (error) {
    console.error('Document extraction error:', error);
    throw new Error(`Failed to extract text: ${error.message}`);
  }
}

// ===== ROUTES =====

app.get('/', (req, res) => {
  res.json({ 
    service: 'FoxMandal Ultimate AI', 
    status: 'online', 
    version: '5.1.0',
    features: ['Conversation History', 'Multi-Language', 'Document Analysis', 'Advanced Analytics'],
    cors: 'enabled',
    timestamp: new Date().toISOString()
  });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    openai: !!process.env.OPENAI_API_KEY,
    uptime: Math.round(process.uptime()),
    stats: analytics.getStats(),
    cors: 'enabled',
    timestamp: new Date().toISOString()
  });
});

// ⚡ SMART CHAT WITH CONTEXT
app.post('/chat', async (req, res) => {
  const { message, sessionId } = req.body;
  
  if (!message || !sessionId) {
    return res.status(400).json({ error: 'Message and sessionId required' });
  }
  
  if (message.length > 500) {
    return res.status(400).json({ error: 'Message too long (max 500 characters)' });
  }
  
  const startTime = Date.now();
  
  try {
    const language = detectLanguage(message);
    const legalArea = classifyLegalArea(message);
    
    const reply = await generateSmartResponse(message, sessionId, legalArea, language);
    
    // Save to history
    addToHistory(sessionId, 'user', message);
    addToHistory(sessionId, 'assistant', reply);
    
    const responseTime = Date.now() - startTime;
    
    // Track analytics
    analytics.track(sessionId, { language, legalArea, responseTime });
    
    console.log(`⚡ ${language.toUpperCase()} response in ${responseTime}ms`);
    
    res.json({ 
      reply,
      language,
      legalArea,
      responseTime,
      conversationCount: getHistory(sessionId).length / 2,
      sessionId
    });
    
  } catch (error) {
    console.error('Chat error:', error.message);
    res.status(500).json({ 
      error: 'Processing failed',
      reply: "I'm having difficulty. Please try again.",
      sessionId
    });
  }
});

// 📄 DOCUMENT ANALYSIS
app.post('/analyze-document', async (req, res) => {
  if (!req.files || !req.files.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  
  const file = req.files.file;
  const { sessionId, query } = req.body;
  const startTime = Date.now();
  
  try {
    const text = await extractDocumentText(file.tempFilePath, file.mimetype);
    
    if (!text || text.trim().length < 50) {
      return res.status(400).json({ error: 'Could not extract meaningful text from document' });
    }
    
    const legalArea = classifyLegalArea(text);
    const language = detectLanguage(query || text);
    
    const analysisPrompt = query
      ? `Analyze this legal document and answer: ${query}\n\nDocument (excerpt):\n${text.substring(0, 6000)}`
      : `Provide comprehensive legal analysis:\n1. Document type\n2. Key parties\n3. Main terms\n4. Risks/concerns\n5. Recommendations\n\nDocument:\n${text.substring(0, 6000)}`;
    
    const analysis = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are an expert legal document analyst. Provide clear, structured analysis.' },
        { role: 'user', content: analysisPrompt }
      ],
      temperature: 0.3,
      max_tokens: 800,
    });
    
    const processingTime = Date.now() - startTime;
    
    // Cleanup
    try { await fs.unlink(file.tempFilePath); } catch (e) { console.warn('Temp file cleanup failed:', e.message); }
    
    analytics.track(sessionId, { legalArea, language, responseTime: processingTime });
    
    res.json({
      analysis: analysis.choices[0].message.content,
      fileName: file.name,
      fileSize: file.size,
      legalArea,
      language,
      processingTime,
      textLength: text.length,
      disclaimer: 'This is AI-generated analysis. Always consult a licensed attorney for legal decisions.'
    });
    
  } catch (error) {
    console.error('Document analysis error:', error);
    
    // Cleanup on error
    if (req.files?.file?.tempFilePath) {
      try { await fs.unlink(req.files.file.tempFilePath); } catch (e) {}
    }
    
    res.status(500).json({ error: error.message || 'Failed to analyze document' });
  }
});

// 📧 EMAIL SUMMARY
app.post('/email-summary', async (req, res) => {
  const { sessionId, email, conversationHistory } = req.body;
  
  if (!email || !conversationHistory) {
    return res.status(400).json({ error: 'Email and conversation required' });
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }
  
  try {
    const summary = conversationHistory.map(msg => 
      `${msg.from}: ${msg.text}`
    ).join('\n\n');
    
    // In production, use SendGrid/AWS SES/Nodemailer here
    console.log(`📧 Email summary requested for: ${email}`);
    console.log(`Summary preview: ${summary.substring(0, 100)}...`);
    
    res.json({ 
      success: true, 
      message: `Conversation summary will be sent to ${email}`,
      preview: summary.substring(0, 200) + '...'
    });
    
  } catch (error) {
    console.error('Email error:', error);
    res.status(500).json({ error: 'Failed to send email' });
  }
});

// 📊 ANALYTICS DASHBOARD
app.get('/analytics/dashboard', (req, res) => {
  const stats = analytics.getStats();
  const sessions = Array.from(analytics.sessions.values()).slice(-20);
  
  res.json({
    overview: stats,
    recentSessions: sessions.map(s => ({
      id: s.sessionId.substring(0, 20) + '...',
      queries: s.queries,
      language: s.language,
      duration: Math.round((Date.now() - s.startTime) / 1000 / 60),
      topArea: s.legalAreas[s.legalAreas.length - 1] || 'general'
    })),
    timestamp: new Date().toISOString()
  });
});

// 💾 EXPORT CONVERSATION
app.post('/export-conversation', (req, res) => {
  const { sessionId, format = 'json' } = req.body;
  
  if (!sessionId) {
    return res.status(400).json({ error: 'sessionId required' });
  }
  
  const history = getHistory(sessionId);
  
  if (history.length === 0) {
    return res.status(404).json({ error: 'No conversation found' });
  }
  
  if (format === 'json') {
    res.json({ 
      conversation: history, 
      sessionId, 
      exportedAt: new Date().toISOString() 
    });
  } else {
    // Plain text format
    const text = history.map((msg, i) => 
      `[${new Date(msg.timestamp).toLocaleString()}] ${msg.role}: ${msg.content}`
    ).join('\n\n');
    
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename="conversation-${sessionId}.txt"`);
    res.send(text);
  }
});

// 🎯 LEAD CAPTURE
app.post('/capture-lead', async (req, res) => {
  const { name, email, phone, message, sessionId, source } = req.body;
  
  if (!name || !email) {
    return res.status(400).json({ error: 'Name and email required' });
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }
  
  const leadData = {
    name: name.trim(),
    email: email.trim().toLowerCase(),
    phone: phone?.trim() || '',
    message: message?.trim() || '',
    sessionId,
    source: source || 'chat',
    conversationCount: getHistory(sessionId).length / 2,
    timestamp: new Date().toISOString()
  };
  
  console.log('🎯 Lead captured:', leadData.email);
  
  // In production: Save to database, trigger CRM webhook, send notification
  
  res.json({ 
    success: true, 
    message: 'Thank you! We will contact you within 24 hours.',
    leadId: `lead_${Date.now()}`
  });
});

// ===== ERROR HANDLING =====
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  
  if (err.message.includes('CORS')) {
    return res.status(403).json({ 
      error: 'CORS policy violation',
      message: 'This origin is not allowed to access the API'
    });
  }
  
  res.status(500).json({ 
    error: err.message || 'Internal server error',
    timestamp: new Date().toISOString()
  });
});

// Handle 404
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Not found',
    path: req.path,
    message: 'The requested endpoint does not exist'
  });
});

// ===== START SERVER =====
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log('=================================');
  console.log('🚀 FoxMandal ULTIMATE AI');
  console.log(`📡 Port: ${PORT}`);
  console.log(`⚡ Model: gpt-4o-mini`);
  console.log(`🌐 Languages: English, Hindi, Tamil, Telugu`);
  console.log(`📄 Document Analysis: Enabled`);
  console.log(`📊 Analytics: Active`);
  console.log(`🔒 CORS: Enabled for Vercel`);
  console.log(`⏰ Started: ${new Date().toISOString()}`);
  console.log('=================================');
  console.log('Allowed origins:', allowedOrigins);
  console.log('=================================');
});