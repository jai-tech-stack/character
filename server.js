// server.js
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { config } from 'dotenv';
import { Pinecone } from '@pinecone-database/pinecone';
import { OpenAI } from 'openai';
import { OpenAIEmbeddings } from '@langchain/openai';
// import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js'; // Commented out - not working on free tier
import { v4 as uuidv4 } from 'uuid';

config();

console.log('✅ ENV CHECK', {
  // eleven: !!process.env.ELEVENLABS_API_KEY, // Commented out
  openai: !!process.env.OPENAI_API_KEY,
  pinecone: !!process.env.PINECONE_API_KEY,
});

// --- Express app ---
const app = express();
app.use(bodyParser.json());

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

// --- Pinecone setup ---
const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY,
});

// -------------------------------------------------------
// ✅ Root route (health check for Render)
// -------------------------------------------------------
app.get("/", (req, res) => {
  res.send("✅ Origami Character Backend is running on Render!");
});

// Initialize index with error handling
let index;
async function initializePinecone() {
  try {
    console.log(`🔍 Checking if index "${process.env.PINECONE_INDEX}" exists...`);
    
    // List all indexes to check if ours exists
    const indexList = await pinecone.listIndexes();
    const indexExists = indexList.indexes?.some(idx => idx.name === process.env.PINECONE_INDEX);
    
    if (indexExists) {
      index = pinecone.index(process.env.PINECONE_INDEX);
      console.log(`✅ Pinecone index "${process.env.PINECONE_INDEX}" initialized`);
    } else {
      console.log(`⚠️ Index "${process.env.PINECONE_INDEX}" not found. Available indexes:`, 
        indexList.indexes?.map(idx => idx.name) || 'None');
      console.log('Creating index...');
      
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
      
      console.log(`✅ Index "${process.env.PINECONE_INDEX}" created. Waiting for it to be ready...`);
      
      // Wait a bit for the index to be ready
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      index = pinecone.index(process.env.PINECONE_INDEX);
      console.log(`✅ Index "${process.env.PINECONE_INDEX}" is now ready`);
    }
  } catch (error) {
    console.error('❌ Failed to initialize Pinecone:', error.message);
    console.log('🔧 Server will continue without memory functionality');
  }
}

// Initialize Pinecone on startup
initializePinecone().catch(console.error);

// --- AI clients ---
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const embeddingsClient = new OpenAIEmbeddings({ apiKey: process.env.OPENAI_API_KEY });
// const tts = new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY }); // Commented out

/* -------------------------------------------------------
   🔹 Sub-Agents
------------------------------------------------------- */
const agents = {
  strategist: `
You are the Strategist Agent for ORIGAMI CREATIVE (https://origamicreative.com).
IMPORTANT: You represent Origami Creative - a branding and creative agency, NOT the Japanese paper folding art.
Explain Origami Creative's brand philosophy, positioning, and strategic insights for their clients.
Focus on business strategy, brand development, and creative solutions.
Keep it under 50 words, concise and clear.
`,
  research: `
You are the Research Agent for ORIGAMI CREATIVE (https://origamicreative.com).
IMPORTANT: You represent Origami Creative - a branding and creative agency, NOT the Japanese paper folding art.
Provide relevant case studies, market insights, and references to Origami Creative's services and processes.
Focus on branding, marketing, and creative industry insights.
Keep it under 50 words, fact-based and clear.
`,
  creative: `
You are the Creative Agent for ORIGAMI CREATIVE (https://origamicreative.com).
IMPORTANT: You represent Origami Creative - a branding and creative agency, NOT the Japanese paper folding art.
Provide design ideas, brand voice, campaign suggestions, and creative direction related to Origami Creative's services.
Focus on branding, design, and creative solutions for businesses.
Keep it under 50 words, inspiring and engaging.
`,
  leadcapture: `
You are the Lead-Capture Agent for ORIGAMI CREATIVE (https://origamicreative.com).
IMPORTANT: You represent Origami Creative - a branding and creative agency, NOT the Japanese paper folding art.
Ask clarifying questions about their branding/creative needs and guide them to share contact details.
Focus on understanding their business requirements.
Be polite and professional, under 40 words.
`,
};

// --- Planner: decides which sub-agent(s) to call ---
async function planAndExecute(message, context) {
  const plannerPrompt = [
    {
      role: 'system',
      content: `
You are the Planner Agent for ORIGAMI CREATIVE (https://origamicreative.com).
CRITICAL: Origami Creative is a branding and creative agency, NOT the Japanese paper folding art.
Decide which agents should respond based on the user's inquiry about branding, creative services, or business needs.
Available agents: strategist, research, creative, leadcapture.
Return ONLY a JSON array of agent names, no extra text.
Example: ["strategist","creative"]
      `,
    },
    { 
      role: 'system', 
      content: `
COMPANY CONTEXT: Origami Creative is a professional branding and creative agency.
When users ask about "origami", they are asking about the COMPANY, not paper folding.
Focus responses on: branding, design, marketing, creative strategy, business solutions.
      `
    },
    { role: 'user', content: message },
  ];

  const planResp = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: plannerPrompt,
    temperature: 0,
    max_tokens: 50,
  });

  let plan;
  try {
    plan = JSON.parse(planResp.choices[0].message.content);
  } catch {
    plan = ['strategist'];
  }

  const results = [];
  for (const agent of plan) {
    const prompt = [
      { 
        role: 'system', 
        content: `${agents[agent]}
        
CRITICAL CONTEXT: 
- You work for ORIGAMI CREATIVE (https://origamicreative.com) - a branding and creative agency
- When users mention "origami" they mean the COMPANY, not Japanese paper folding
- Focus on business branding, creative services, marketing strategy
- Never mention paper folding, Japanese art, or traditional origami

Context from previous conversations:
${context}`
      },
      { role: 'user', content: message },
    ];
    const resp = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: prompt,
      temperature: 0.6,
      max_tokens: 80,
    });
    results.push(resp.choices[0].message.content);
  }

  return results.join(' ');
}

/* -------------------------------------------------------
   🔹 Chat Endpoint
------------------------------------------------------- */
app.post('/chat', async (req, res) => {
  const { message, sessionId } = req.body;
  
  console.log('💬 Chat request received:', { 
    message: message?.substring(0, 50),
    sessionId,
    hasMessage: !!message 
  });

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Invalid or missing message' });
  }

  try {
    // Check if index is available
    if (!index) {
      console.log('⚠️ Pinecone index not available, proceeding without memory');
      const reply = await planAndExecute(message, '');
      return res.json({ reply });
    }

    // Embed incoming message
    const embedding = await embeddingsClient.embedQuery(message);
    
    // The embedding should be an array of numbers
    console.log('Embedding type:', typeof embedding, 'Length:', embedding?.length);

    // Query Pinecone memory with error handling
    let context = '';
    try {
      const mem = await index.query({
        vector: embedding,
        topK: 5,
        includeMetadata: true,
      });
      context = mem.matches?.map((m) => m.metadata?.content).join('\n') || '';
      console.log(`✅ Retrieved ${mem.matches?.length || 0} memory matches`);
    } catch (memError) {
      console.error('⚠️ Memory retrieval failed, proceeding without context:', memError.message);
      context = '';
    }

    // Orchestrate agents
    const reply = await planAndExecute(message, context);
    
    console.log('✅ Chat response generated:', reply?.substring(0, 50));
    res.json({ reply });

    // Save memory asynchronously
    if (index) {
      (async () => {
        try {
          const replyEmbedding = await embeddingsClient.embedQuery(reply);
          await index.upsert({
            records: [
              { id: uuidv4(), values: embedding, metadata: { content: message, role: 'user' } },
              { id: uuidv4(), values: replyEmbedding, metadata: { content: reply, role: 'assistant' } },
            ],
          });
          console.log('✅ Memory saved');
        } catch (e) {
          console.error('❌ Failed to save memory:', e.message);
        }
      })();
    }
  } catch (err) {
    console.error('❌ Error in /chat:', err);
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'Chat processing failed', 
        details: err.message 
      });
    }
  }
});

/* -------------------------------------------------------
   🔹 TTS Endpoint - DISABLED (ElevenLabs free tier issues)
------------------------------------------------------- */
app.post('/tts', (req, res) => {
  console.log('🔊 TTS request received - returning browser fallback message');
  res.status(503).json({ 
    error: 'TTS service temporarily unavailable',
    message: 'Please use browser speech synthesis instead',
    fallback: true
  });
});

/* -------------------------------------------------------
   🔹 Health check endpoint
------------------------------------------------------- */
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      openai: !!process.env.OPENAI_API_KEY,
      pinecone: !!process.env.PINECONE_API_KEY,
      index: !!index,
      tts: 'disabled - using browser fallback'
    }
  });
});

/* -------------------------------------------------------
   🔹 Start Server
------------------------------------------------------- */
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Backend live on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
});