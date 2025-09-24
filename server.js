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
// Enhanced backend memory system for server.js

// Add this to your existing server.js - replace the current chat endpoint

app.post('/chat', async (req, res) => {
  const { message, sessionId } = req.body;
  
  console.log('💬 Chat request:', { 
    message: message?.substring(0, 50),
    sessionId,
    hasSession: !!sessionId 
  });

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Invalid or missing message' });
  }

  try {
    // Enhanced memory retrieval with conversation threading
    let conversationContext = '';
    let userProfile = {};
    
    if (index && sessionId) {
      // Get conversation history for this session
      const sessionHistory = await getConversationHistory(sessionId);
      
      // Get user profile/personalization data
      userProfile = await getUserProfile(sessionId);
      
      // Build rich context
      conversationContext = buildConversationContext(sessionHistory, userProfile);
    }

    // Embed incoming message with enhanced context
    const contextualMessage = `
      User Profile: ${JSON.stringify(userProfile)}
      Recent Conversation: ${conversationContext}
      Current Message: ${message}
    `;
    
    const embedding = await embeddingsClient.embedQuery(contextualMessage);
    
    // Enhanced memory search
    let knowledgeContext = '';
    if (index) {
      try {
        const memoryResults = await index.query({
          vector: embedding,
          topK: 8,
          includeMetadata: true,
          filter: {
            // Search both general knowledge and user-specific context
            $or: [
              { type: 'knowledge' },
              { sessionId: sessionId },
              { type: 'personalization' }
            ]
          }
        });
        
        knowledgeContext = memoryResults.matches
          ?.map((m) => m.metadata?.content)
          .join('\n') || '';
        
        console.log(`✅ Retrieved ${memoryResults.matches?.length || 0} contextual memories`);
      } catch (memError) {
        console.error('⚠️ Memory retrieval failed:', memError.message);
      }
    }

    // Enhanced agent orchestration with memory
    const reply = await planAndExecuteWithMemory(message, {
      conversationContext,
      knowledgeContext,
      userProfile,
      sessionId
    });
    
    // Extract user information for personalization
    const extractedInfo = extractUserInformation(message, reply);
    if (Object.keys(extractedInfo).length > 0) {
      await updateUserProfile(sessionId, extractedInfo);
    }
    
    res.json({ reply, userProfile: extractedInfo });

    // Enhanced memory saving
    if (index && sessionId) {
      saveEnhancedMemory(message, reply, sessionId, extractedInfo, embedding);
    }
    
  } catch (err) {
    console.error('❌ Error in enhanced chat:', err);
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'Chat processing failed', 
        details: err.message 
      });
    }
  }
});

// Enhanced conversation history retrieval
async function getConversationHistory(sessionId) {
  if (!index) return [];
  
  try {
    const historyQuery = await index.query({
      vector: new Array(1536).fill(0), // Zero vector for metadata-only search
      topK: 20,
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

// User profile management
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

// Build conversation context
function buildConversationContext(history, profile) {
  let context = '';
  
  // Add user profile context
  if (Object.keys(profile).length > 0) {
    context += `User Information: `;
    Object.entries(profile).forEach(([key, value]) => {
      context += `${key}: ${value}, `;
    });
    context += '\n';
  }
  
  // Add recent conversation history (last 6 exchanges)
  const recentHistory = history.slice(-12); // Last 6 back-and-forth exchanges
  recentHistory.forEach(msg => {
    context += `${msg.role}: ${msg.content}\n`;
  });
  
  return context;
}

// Extract user information from conversation
function extractUserInformation(userMessage, aiReply) {
  const extracted = {};
  const lowerMessage = userMessage.toLowerCase();
  
  // Extract company name
  const companyPatterns = [
    /my company is (.+?)[\.\,\!]/,
    /we are (.+?)[\.\,\!]/,
    /i work at (.+?)[\.\,\!]/,
    /(?:company|business|startup) (?:called|named) (.+?)[\.\,\!]/
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
    'healthcare': ['medical', 'health', 'clinic', 'hospital', 'pharma'],
    'retail': ['store', 'shop', 'ecommerce', 'retail', 'fashion'],
    'finance': ['bank', 'finance', 'fintech', 'insurance', 'investment'],
    'food': ['restaurant', 'food', 'cafe', 'culinary', 'dining']
  };
  
  Object.entries(industryKeywords).forEach(([industry, keywords]) => {
    if (keywords.some(keyword => lowerMessage.includes(keyword))) {
      extracted.industry = industry;
    }
  });
  
  // Extract project type
  if (lowerMessage.includes('rebrand')) {
    extracted.projectType = 'rebranding';
  } else if (lowerMessage.includes('new brand') || lowerMessage.includes('startup')) {
    extracted.projectType = 'new_brand';
  } else if (lowerMessage.includes('website') || lowerMessage.includes('web design')) {
    extracted.projectType = 'web_design';
  }
  
  // Extract budget range
  const budgetPatterns = [
    /budget.*?(\d+k|\d+\,\d{3})/,
    /(\d+k|\d+\,\d{3}).*budget/
  ];
  
  budgetPatterns.forEach(pattern => {
    const match = userMessage.match(pattern);
    if (match && match[1]) {
      extracted.budgetRange = match[1];
    }
  });
  
  return extracted;
}

// Update user profile
async function updateUserProfile(sessionId, newInfo) {
  if (!index || Object.keys(newInfo).length === 0) return;
  
  try {
    const records = [];
    
    Object.entries(newInfo).forEach(([key, value]) => {
      const recordId = `${sessionId}_profile_${key}`;
      records.push({
        id: recordId,
        values: new Array(1536).fill(Math.random() * 0.01), // Small random vector for profile data
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
    console.log(`✅ Updated user profile with:`, newInfo);
    
  } catch (error) {
    console.error('Error updating user profile:', error);
  }
}

// Enhanced agent planning with memory
async function planAndExecuteWithMemory(message, context) {
  const { conversationContext, knowledgeContext, userProfile, sessionId } = context;
  
  // Enhanced planner prompt with memory awareness
  const plannerPrompt = [
    {
      role: 'system',
      content: `
You are the Planner Agent for ORIGAMI CREATIVE (https://origamicreative.com).
CRITICAL: Origami Creative is a branding and creative agency, NOT the Japanese paper folding art.

CONVERSATION CONTEXT:
${conversationContext}

RELEVANT KNOWLEDGE:
${knowledgeContext}

USER PROFILE:
${JSON.stringify(userProfile)}

Based on this context, decide which agents should respond and how to personalize the response.
Available agents: strategist, research, creative, leadcapture.
Return ONLY a JSON array of agent names, no extra text.

PERSONALIZATION RULES:
- If user has a company name, mention it naturally
- If user has an industry, provide industry-relevant examples
- If this is a follow-up question, reference previous conversation
- If user seems qualified (mentioned budget/timeline), be more direct about next steps

Example: ["strategist","creative"]
      `,
    },
    { 
      role: 'user', 
      content: message 
    },
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
    const agentResponse = await executeAgentWithMemory(agent, message, context);
    results.push(agentResponse);
  }

  return results.join(' ');
}

// Execute individual agent with memory context
async function executeAgentWithMemory(agentType, message, context) {
  const { conversationContext, userProfile } = context;
  
  const enhancedAgentPrompts = {
    strategist: `
You are the Strategist Agent for ORIGAMI CREATIVE (https://origamicreative.com).

CONVERSATION HISTORY:
${conversationContext}

USER CONTEXT: ${JSON.stringify(userProfile)}

Provide strategic insights about branding and business positioning. 
${userProfile.company ? `Reference their company "${userProfile.company}" naturally when relevant.` : ''}
${userProfile.industry ? `Tailor examples to the ${userProfile.industry} industry.` : ''}

Keep it under 60 words, personalized and strategic.
`,
    
    research: `
You are the Research Agent for ORIGAMI CREATIVE.

CONTEXT: ${conversationContext}
USER: ${JSON.stringify(userProfile)}

Provide data-driven insights and relevant case studies.
${userProfile.industry ? `Focus on ${userProfile.industry} industry insights and examples.` : ''}
${userProfile.company ? `Consider how this applies to ${userProfile.company}.` : ''}

Keep it under 60 words, fact-based and relevant.
`,
    
    creative: `
You are the Creative Agent for ORIGAMI CREATIVE.

CONVERSATION: ${conversationContext}
USER PROFILE: ${JSON.stringify(userProfile)}

Provide creative direction and design insights.
${userProfile.projectType ? `Focus on ${userProfile.projectType} creative solutions.` : ''}
${userProfile.company ? `Think about creative opportunities for ${userProfile.company}.` : ''}

Keep it under 60 words, inspiring and actionable.
`,
    
    leadcapture: `
You are the Lead-Capture Agent for ORIGAMI CREATIVE.

CONTEXT: ${conversationContext}
USER INFO: ${JSON.stringify(userProfile)}

Guide toward next steps and contact information.
${userProfile.budgetRange ? `They mentioned budget around ${userProfile.budgetRange} - acknowledge this.` : 'Gently explore their investment level.'}
${Object.keys(userProfile).length > 2 ? 'They seem qualified - be more direct about scheduling a call.' : 'Ask qualifying questions about their needs.'}

Keep it under 50 words, consultative and professional.
`
  };

  const prompt = [
    {
      role: 'system',
      content: enhancedAgentPrompts[agentType] || enhancedAgentPrompts['strategist']
    },
    { 
      role: 'user', 
      content: message 
    },
  ];

  const resp = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: prompt,
    temperature: 0.7,
    max_tokens: 100,
  });

  return resp.choices[0].message.content;
}

// Enhanced memory saving
async function saveEnhancedMemory(message, reply, sessionId, userInfo, embedding) {
  if (!index) return;
  
  try {
    const timestamp = Date.now();
    const records = [];
    
    // Save conversation
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
    
    // Save AI response
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
    console.log('✅ Enhanced memory saved');
    
  } catch (error) {
    console.error('❌ Failed to save enhanced memory:', error.message);
  }
}


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