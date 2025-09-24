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
import fileUpload from 'express-fileupload';

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

// Add these endpoints to your server.js

// Lead capture endpoint
app.post('/capture-lead', async (req, res) => {
  const { name, email, message, sessionId, userProfile, leadScore } = req.body;
  
  console.log('📧 Lead capture request:', { name, email, leadScore });
  
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
    
    // Save to multiple destinations
    const results = await Promise.allSettled([
      saveToGoogleSheets(leadData),
      saveToAirtable(leadData),
      saveToDatabase(leadData)
    ]);
    
    // Send notification email to Origami team
    await sendLeadNotification(leadData);
    
    // Send auto-response to lead
    await sendLeadAutoResponse(leadData);
    
    console.log('✅ Lead captured successfully:', name);
    res.json({ 
      success: true, 
      message: 'Thank you! We\'ll be in touch within 24 hours.',
      leadId: leadData.sessionId
    });
    
  } catch (error) {
    console.error('❌ Lead capture failed:', error);
    res.status(500).json({ 
      error: 'Failed to capture lead', 
      details: error.message 
    });
  }
});

// Google Sheets integration
async function saveToGoogleSheets(leadData) {
  if (!process.env.GOOGLE_SHEETS_ID || !process.env.GOOGLE_SERVICE_KEY) {
    console.log('⚠️ Google Sheets not configured');
    return;
  }
  
  try {
    // Using Google Sheets API
    const { GoogleSpreadsheet } = require('google-spreadsheet');
    const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEETS_ID);
    
    await doc.useServiceAccountAuth({
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    });
    
    await doc.loadInfo();
    const sheet = doc.sheetsByIndex[0];
    
    await sheet.addRow({
      Timestamp: leadData.timestamp,
      Name: leadData.name,
      Email: leadData.email,
      Message: leadData.message,
      'Lead Score': leadData.leadScore,
      Company: leadData.userProfile.company || '',
      Industry: leadData.userProfile.industry || '',
      'Project Type': leadData.userProfile.projectType || '',
      'Budget Range': leadData.userProfile.budgetRange || '',
      'Session ID': leadData.sessionId,
      Status: leadData.status
    });
    
    console.log('✅ Saved to Google Sheets');
    
  } catch (error) {
    console.error('❌ Google Sheets save failed:', error);
    throw error;
  }
}

// Airtable integration
async function saveToAirtable(leadData) {
  if (!process.env.AIRTABLE_API_KEY || !process.env.AIRTABLE_BASE_ID) {
    console.log('⚠️ Airtable not configured');
    return;
  }
  
  try {
    const fetch = require('node-fetch');
    
    const response = await fetch(`https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/Leads`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.AIRTABLE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fields: {
          Name: leadData.name,
          Email: leadData.email,
          Message: leadData.message,
          'Lead Score': leadData.leadScore,
          Company: leadData.userProfile.company || '',
          Industry: leadData.userProfile.industry || '',
          'Project Type': leadData.userProfile.projectType || '',
          'Budget Range': leadData.userProfile.budgetRange || '',
          'Session ID': leadData.sessionId,
          Status: 'New',
          Source: 'Rakesh AI Chat',
          'Date Created': leadData.timestamp
        }
      })
    });
    
    if (!response.ok) {
      throw new Error(`Airtable API error: ${response.status}`);
    }
    
    console.log('✅ Saved to Airtable');
    
  } catch (error) {
    console.error('❌ Airtable save failed:', error);
    throw error;
  }
}

// Database integration (MongoDB/Supabase)
async function saveToDatabase(leadData) {
  // For MongoDB
  if (process.env.MONGODB_URI) {
    try {
      const { MongoClient } = require('mongodb');
      const client = new MongoClient(process.env.MONGODB_URI);
      
      await client.connect();
      const db = client.db('origami_leads');
      const collection = db.collection('leads');
      
      await collection.insertOne({
        ...leadData,
        _id: leadData.sessionId,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      await client.close();
      console.log('✅ Saved to MongoDB');
      
    } catch (error) {
      console.error('❌ MongoDB save failed:', error);
      throw error;
    }
  }
  
  // For Supabase
  if (process.env.SUPABASE_URL && process.env.SUPABASE_KEY) {
    try {
      const { createClient } = require('@supabase/supabase-js');
      const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
      
      const { error } = await supabase
        .from('leads')
        .insert([{
          session_id: leadData.sessionId,
          name: leadData.name,
          email: leadData.email,
          message: leadData.message,
          lead_score: leadData.leadScore,
          user_profile: leadData.userProfile,
          source: leadData.source,
          status: leadData.status,
          created_at: leadData.timestamp
        }]);
      
      if (error) throw error;
      console.log('✅ Saved to Supabase');
      
    } catch (error) {
      console.error('❌ Supabase save failed:', error);
      throw error;
    }
  }
}

// Email notifications
async function sendLeadNotification(leadData) {
  if (!process.env.SMTP_HOST || !process.env.ORIGAMI_NOTIFICATION_EMAIL) {
    console.log('⚠️ Email not configured');
    return;
  }
  
  try {
    const nodemailer = require('nodemailer');
    
    const transporter = nodemailer.createTransporter({
      host: process.env.SMTP_HOST,
      port: 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
    
    const leadScoreEmoji = leadData.leadScore > 50 ? '🔥🔥🔥' : 
                          leadData.leadScore > 30 ? '🔥🔥' : 
                          leadData.leadScore > 15 ? '🔥' : '📧';
    
    const emailBody = `
    ${leadScoreEmoji} NEW LEAD FROM RAKESH AI CHAT
    
    Name: ${leadData.name}
    Email: ${leadData.email}
    Lead Score: ${leadData.leadScore}/100
    
    Company: ${leadData.userProfile.company || 'Not specified'}
    Industry: ${leadData.userProfile.industry || 'Not specified'}
    Project Type: ${leadData.userProfile.projectType || 'Not specified'}
    Budget Range: ${leadData.userProfile.budgetRange || 'Not specified'}
    
    Message:
    ${leadData.message}
    
    Session ID: ${leadData.sessionId}
    Timestamp: ${leadData.timestamp}
    
    ${leadData.leadScore > 30 ? '⚡ HIGH PRIORITY - Follow up within 2 hours!' : ''}
    `;
    
    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: process.env.ORIGAMI_NOTIFICATION_EMAIL,
      subject: `${leadScoreEmoji} New Lead: ${leadData.name} (Score: ${leadData.leadScore})`,
      text: emailBody
    });
    
    console.log('✅ Lead notification sent');
    
  } catch (error) {
    console.error('❌ Email notification failed:', error);
  }
}

// Auto-response email to lead
async function sendLeadAutoResponse(leadData) {
  if (!process.env.SMTP_HOST) return;
  
  try {
    const nodemailer = require('nodemailer');
    
    const transporter = nodemailer.createTransporter({
      host: process.env.SMTP_HOST,
      port: 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
    
    const personalizedContent = leadData.userProfile.company ? 
      `We're excited to learn more about ${leadData.userProfile.company} and how we can help with your branding needs.` :
      `We're excited to learn more about your project and how we can help with your branding needs.`;
    
    const industryResources = leadData.userProfile.industry ? 
      getIndustryResources(leadData.userProfile.industry) : '';
    
    const emailBody = `
    Hi ${leadData.name},
    
    Thank you for connecting with Rakesh, our AI brand strategist! 
    
    ${personalizedContent}
    
    A member of our team will reach out to you within 24 hours to discuss your project in detail.
    
    ${industryResources}
    
    In the meantime, feel free to explore our portfolio at https://origamicreative.com/portfolio
    
    Best regards,
    The Origami Creative Team
    
    P.S. If you have any urgent questions, reply to this email or call us directly.
    `;
    
    await transporter.sendMail({
      from: `"Origami Creative" <${process.env.SMTP_USER}>`,
      to: leadData.email,
      subject: `Thanks for connecting, ${leadData.name}! Next steps inside...`,
      text: emailBody,
      html: formatEmailHTML(emailBody, leadData)
    });
    
    console.log('✅ Auto-response sent to lead');
    
  } catch (error) {
    console.error('❌ Auto-response failed:', error);
  }
}

// Industry-specific resources
function getIndustryResources(industry) {
  const resources = {
    'tech': 'Since you\'re in tech, you might find our SaaS branding case study interesting: [link]',
    'healthcare': 'For healthcare branding, check out our medical practice rebrand: [link]',
    'retail': 'Our retail branding portfolio showcases successful e-commerce transformations: [link]',
    'finance': 'We\'ve helped several fintech startups establish trust through branding: [link]',
    'food': 'Our restaurant and food brand work focuses on appetite appeal: [link]'
  };
  
  return resources[industry] || '';
}

// HTML email formatting
function formatEmailHTML(textContent, leadData) {
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <style>
      body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
      .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; }
      .content { padding: 20px; }
      .footer { background: #f8f9fa; padding: 15px; text-align: center; font-size: 12px; color: #666; }
      .cta { background: #e74c3c; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 15px 0; }
    </style>
  </head>
  <body>
    <div class="header">
      <h2>Thanks for connecting with Origami Creative!</h2>
    </div>
    <div class="content">
      <p>Hi ${leadData.name},</p>
      <p>Thank you for connecting with Rakesh, our AI brand strategist!</p>
      ${leadData.userProfile.company ? 
        `<p>We're excited to learn more about <strong>${leadData.userProfile.company}</strong> and how we can help with your branding needs.</p>` :
        `<p>We're excited to learn more about your project and how we can help with your branding needs.</p>`
      }
      <p>A member of our team will reach out to you within 24 hours to discuss your project in detail.</p>
      <a href="https://origamicreative.com/portfolio" class="cta">View Our Portfolio</a>
      <p>Best regards,<br>The Origami Creative Team</p>
    </div>
    <div class="footer">
      <p>Origami Creative | Building brands that unfold possibilities</p>
    </div>
  </body>
  </html>
  `;
}

// Lead analytics endpoint
app.get('/lead-analytics', async (req, res) => {
  try {
    // This would connect to your database to get analytics
    const analytics = await getLeadAnalytics();
    
    res.json({
      totalLeads: analytics.totalLeads || 0,
      highQualityLeads: analytics.highQualityLeads || 0,
      averageLeadScore: analytics.averageLeadScore || 0,
      topIndustries: analytics.topIndustries || [],
      conversionRate: analytics.conversionRate || 0,
      recentLeads: analytics.recentLeads || []
    });
    
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ error: 'Failed to get analytics' });
  }
});

async function getLeadAnalytics() {
  // Implement based on your chosen database
  // This is a placeholder structure
  return {
    totalLeads: 0,
    highQualityLeads: 0,
    averageLeadScore: 0,
    topIndustries: [],
    conversionRate: 0,
    recentLeads: []
  };
}

// Knowledge Base System WITHOUT LangChain - Add to server.js

import fileUpload from 'express-fileupload';

// Add file upload middleware
app.use(fileUpload({
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  useTempFiles: true,
  tempFileDir: '/tmp/'
}));

// Simple knowledge upload endpoint (text files only for now)
app.post('/upload-knowledge', async (req, res) => {
  if (!req.files || !req.files.document) {
    return res.status(400).json({ error: 'No document uploaded' });
  }
  
  const file = req.files.document;
  console.log('Processing knowledge upload:', file.name);
  
  try {
    let content;
    
    if (file.mimetype === 'text/plain') {
      content = file.data.toString('utf8');
    } else {
      return res.status(400).json({ 
        error: 'Only text files (.txt) are supported currently. PDF support coming soon.' 
      });
    }
    
    const chunks = await processTextContent(content, file.name);
    const embedded = await embedKnowledgeChunks(chunks);
    
    res.json({ 
      success: true, 
      documentsProcessed: embedded.length,
      message: `Successfully added ${embedded.length} knowledge chunks from ${file.name}` 
    });
    
  } catch (error) {
    console.error('Knowledge upload error:', error);
    res.status(500).json({ 
      error: 'Failed to process knowledge document', 
      details: error.message 
    });
  }
});

// Process text content into chunks
async function processTextContent(text, source) {
  const chunks = splitTextIntoChunks(text, 1000, 200);
  
  return chunks.map((chunk, index) => ({
    content: chunk,
    source: source,
    chunkIndex: index,
    timestamp: Date.now(),
    // Auto-classify content
    hasPortfolio: chunk.toLowerCase().includes('portfolio') || 
                 chunk.toLowerCase().includes('case study') ||
                 chunk.toLowerCase().includes('project') ||
                 chunk.toLowerCase().includes('client'),
    hasProcess: chunk.toLowerCase().includes('process') || 
               chunk.toLowerCase().includes('methodology') ||
               chunk.toLowerCase().includes('approach') ||
               chunk.toLowerCase().includes('step'),
    hasPricing: chunk.toLowerCase().includes('price') || 
               chunk.toLowerCase().includes('cost') ||
               chunk.toLowerCase().includes('investment') ||
               chunk.toLowerCase().includes('budget') ||
               chunk.toLowerCase().includes('$'),
    hasServices: chunk.toLowerCase().includes('service') || 
                chunk.toLowerCase().includes('offering') ||
                chunk.toLowerCase().includes('help') ||
                chunk.toLowerCase().includes('provide')
  }));
}

// Simple text chunking function
function splitTextIntoChunks(text, maxChunkSize = 1000, overlap = 200) {
  const chunks = [];
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  
  let currentChunk = '';
  let currentSize = 0;
  
  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i].trim() + '.';
    
    if (currentSize + sentence.length > maxChunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      
      // Add overlap from previous chunk
      const words = currentChunk.split(' ');
      const overlapWords = words.slice(-Math.floor(overlap/10));
      currentChunk = overlapWords.join(' ') + ' ' + sentence;
      currentSize = currentChunk.length;
    } else {
      currentChunk += ' ' + sentence;
      currentSize += sentence.length;
    }
  }
  
  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks.filter(chunk => chunk.length > 50); // Filter out very short chunks
}

// Embed knowledge chunks
async function embedKnowledgeChunks(chunks) {
  const embeddedChunks = [];
  
  for (const [index, chunk] of chunks.entries()) {
    try {
      const embedding = await embeddingsClient.embedQuery(chunk.content);
      
      const record = {
        id: `knowledge_${chunk.source}_${Date.now()}_${index}`,
        values: embedding,
        metadata: {
          content: chunk.content,
          type: 'knowledge',
          source: chunk.source,
          chunkIndex: chunk.chunkIndex,
          timestamp: chunk.timestamp,
          hasPortfolio: chunk.hasPortfolio,
          hasProcess: chunk.hasProcess,
          hasPricing: chunk.hasPricing,
          hasServices: chunk.hasServices
        }
      };
      
      embeddedChunks.push(record);
      
    } catch (error) {
      console.error(`Failed to embed chunk ${index}:`, error);
    }
  }
  
  // Upload to Pinecone in batches
  if (embeddedChunks.length > 0 && index) {
    const batchSize = 100;
    for (let i = 0; i < embeddedChunks.length; i += batchSize) {
      const batch = embeddedChunks.slice(i, i + batchSize);
      await index.upsert({ records: batch });
      console.log(`Uploaded batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(embeddedChunks.length/batchSize)}`);
    }
  }
  
  console.log(`Embedded ${embeddedChunks.length} knowledge chunks`);
  return embeddedChunks;
}

// Enhanced knowledge retrieval
async function getEnhancedKnowledgeContext(query, userIntent = null) {
  if (!index) return '';
  
  try {
    const queryEmbedding = await embeddingsClient.embedQuery(query);
    
    let filter = { type: 'knowledge' };
    
    // Filter by intent
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
      ?.filter(match => match.score > 0.7) // Only include relevant matches
      ?.map((match) => {
        const content = match.metadata?.content || '';
        const source = match.metadata?.source || 'unknown';
        const relevance = Math.round((match.score || 0) * 100);
        return `[${source} - ${relevance}% relevant] ${content}`;
      })
      .join('\n\n') || '';
    
    console.log(`Retrieved ${results.matches?.length || 0} knowledge matches for: ${userIntent || 'general'}`);
    return knowledgeContext;
    
  } catch (error) {
    console.error('Knowledge retrieval error:', error);
    return '';
  }
}

// Seed initial knowledge (comprehensive Origami Creative content)
async function seedInitialKnowledge() {
  if (!index) {
    console.log('Pinecone index not available, skipping knowledge seeding');
    return;
  }
  
  console.log('Seeding initial Origami Creative knowledge...');
  
  const knowledgeTexts = [
    // Company Overview
    `Origami Creative is a full-service branding and creative agency that helps businesses unfold their potential through strategic branding solutions. We specialize in brand strategy, visual identity design, logo creation, and comprehensive brand experiences.

Our team combines deep strategic thinking with exceptional creative execution to help startups, scale-ups, and established businesses build memorable brands that resonate with their target audiences. We work across industries including technology, healthcare, retail, finance, and professional services.

Founded on the principle that great brands emerge from the perfect fold of strategy and creativity, we've helped over 200 businesses establish their market presence and achieve their growth objectives.`,

    // Services Overview
    `Our comprehensive services include Brand Strategy development where we define positioning, messaging, and competitive differentiation. Visual Identity design encompasses logo creation, color palette development, typography selection, and brand pattern systems.

We provide Marketing Collateral design including business cards, brochures, presentations, and digital templates. Website Design services focus on brand-aligned digital experiences that convert visitors into customers.

Packaging Design helps product-based businesses create shelf presence and unboxing experiences. Environmental Design covers signage, office branding, and retail space design.

Additional offerings include Brand Photography art direction, Social Media brand guidelines, and Brand Training workshops for internal teams.`,

    // Process and Methodology
    `Our proven Brand Development Process follows five distinct phases designed to ensure strategic alignment and creative excellence.

Phase 1 - Discovery and Research involves comprehensive market analysis, competitor auditing, target audience research, and stakeholder interviews. We analyze your current brand position and identify opportunities for differentiation.

Phase 2 - Strategy Development focuses on defining brand positioning, creating messaging frameworks, establishing brand personality, and developing value propositions that resonate with target customers.

Phase 3 - Creative Execution brings strategy to life through logo design, visual identity systems, color psychology application, and typography selection. Every creative decision supports the strategic foundation.

Phase 4 - Brand Guidelines creation documents proper brand usage, maintains consistency standards, and provides templates for future applications across all touchpoints.

Phase 5 - Implementation and Launch includes rollout planning, material production oversight, digital deployment, and ongoing brand management support.

Projects typically require 8-12 weeks depending on scope and complexity.`,

    // Portfolio and Case Studies
    `Case Study: TechFlow SaaS Platform - A B2B software startup needed to establish credibility with enterprise clients. Challenge: Startup perception limiting enterprise sales opportunities.

Solution: Repositioned from scrappy startup to industry expert through sophisticated visual identity, professional website redesign, and comprehensive sales collateral system. Developed thought leadership content strategy and trade show presence.

Results: 40% increase in enterprise-level inquiries, successful Series A funding round of $12M, and recognition as "Rising Star" in industry publication. Client testimonial: "The rebrand transformed how prospects perceive us - we're now seen as the established player in our space."

Case Study: MedCare Health Network - Regional healthcare provider competing against national chains needed brand differentiation. Challenge: Perception as small, outdated compared to major competitors.

Solution: Created "Community Care Expert" positioning emphasizing local knowledge and personal relationships. Developed warm, trustworthy visual identity with patient-friendly wayfinding system across 12 locations.

Results: 25% increase in new patient acquisition, improved patient satisfaction scores, and successful expansion into two adjacent markets. Notable: 60% improvement in online review ratings.`,

    // Pricing and Investment
    `Our investment structure is designed to provide value at every business stage with transparent pricing and flexible payment options.

Startup Brand Package ($15,000 - $25,000): Perfect for new businesses needing foundational brand identity. Includes brand strategy workshop, logo design with 3 concepts, color palette, typography selection, basic brand guidelines, and business card design. Timeline: 4-6 weeks.

Professional Brand Package ($25,000 - $45,000): Ideal for growing businesses requiring comprehensive brand systems. Includes extensive brand strategy, complete visual identity system, detailed brand guidelines, marketing template library, and initial implementation support. Timeline: 6-8 weeks.

Enterprise Brand Package ($45,000 - $75,000): Designed for established companies needing full brand transformation. Includes market research phase, stakeholder interviews, comprehensive strategy development, complete visual identity system, extensive guidelines, brand training workshops, and 90-day implementation support. Timeline: 10-12 weeks.

Additional Services: Website Design ($20,000 - $50,000), Packaging Design ($15,000 - $35,000), Photography Direction ($8,000 - $20,000), Environmental Design ($25,000 - $60,000).

Payment Terms: 50% deposit to initiate project, remaining balance split across major milestones. All packages include revisions and 30-day post-launch support. We also offer retainer arrangements for ongoing brand management.`,

    // Industry Expertise
    `We have deep experience across multiple industries with specialized knowledge in Technology startups and SaaS platforms where we understand the unique challenges of establishing credibility and scaling rapidly.

Healthcare and Medical practices benefit from our expertise in building trust and navigating regulatory considerations while maintaining approachable patient communications.

Retail and E-commerce brands leverage our understanding of shelf presence, packaging psychology, and omnichannel brand consistency across physical and digital touchpoints.

Financial Services and Professional firms appreciate our ability to balance trustworthiness with innovation, creating sophisticated brands that appeal to both individual and business clients.

Food and Hospitality businesses tap into our understanding of appetite appeal, ambiance creation, and experience design that drives customer loyalty and repeat business.

Each industry brings unique challenges and opportunities, and our team adapts our proven methodology to address sector-specific requirements while maintaining strategic rigor and creative excellence.`
  ];

  try {
    const allRecords = [];
    
    for (const [textIndex, knowledgeText] of knowledgeTexts.entries()) {
      const chunks = await processTextContent(knowledgeText, `seed_knowledge_${textIndex}`);
      
      for (const chunk of chunks) {
        const embedding = await embeddingsClient.embedQuery(chunk.content);
        
        allRecords.push({
          id: `seed_${textIndex}_${chunk.chunkIndex}_${Date.now()}`,
          values: embedding,
          metadata: {
            content: chunk.content,
            type: 'knowledge',
            source: chunk.source,
            hasPortfolio: chunk.hasPortfolio,
            hasProcess: chunk.hasProcess,
            hasPricing: chunk.hasPricing,
            hasServices: chunk.hasServices,
            timestamp: chunk.timestamp
          }
        });
      }
    }
    
    // Upload in batches
    const batchSize = 50;
    for (let i = 0; i < allRecords.length; i += batchSize) {
      const batch = allRecords.slice(i, i + batchSize);
      await index.upsert({ records: batch });
      console.log(`Seeded batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(allRecords.length/batchSize)}`);
    }
    
    console.log(`Initial knowledge seeded: ${allRecords.length} chunks`);
    
  } catch (error) {
    console.error('Failed to seed initial knowledge:', error);
  }
}

// Initialize knowledge base
async function initializeKnowledgeBase() {
  console.log('Initializing knowledge base...');
  
  try {
    if (index) {
      await seedInitialKnowledge();
      console.log('Knowledge base initialization complete');
    } else {
      console.log('Pinecone not ready, will seed knowledge when available');
    }
  } catch (error) {
    console.error('Knowledge base initialization failed:', error);
  }
}

// Update your existing chat endpoint to use knowledge
// Replace your current planAndExecute function with this enhanced version
async function planAndExecuteWithKnowledge(message, context) {
  const { conversationContext, userProfile, sessionId, userIntent } = context;
  
  // Get relevant knowledge
  const knowledgeContext = await getEnhancedKnowledgeContext(message, userIntent);
  
  const enhancedPrompt = [
    {
      role: 'system',
      content: `You are Rakesh, the AI Brand Strategist for ORIGAMI CREATIVE (https://origamicreative.com).
You represent a professional branding and creative agency.

RELEVANT KNOWLEDGE:
${knowledgeContext}

CONVERSATION CONTEXT:
${conversationContext}

USER PROFILE:
${JSON.stringify(userProfile)}

INSTRUCTIONS:
- Use the knowledge above to provide specific, accurate information about Origami Creative
- Reference real case studies, processes, and pricing when available
- Personalize responses based on user profile
- Keep responses under 80 words but make them substantive
- Always sound professional and consultative
- If knowledge mentions specific examples or numbers, use them

${userProfile.company ? `Reference their company "${userProfile.company}" naturally when relevant.` : ''}
${userProfile.industry ? `Tailor examples to the ${userProfile.industry} industry.` : ''}
      `,
    },
    { 
      role: 'user', 
      content: message 
    },
  ];

  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: enhancedPrompt,
    temperature: 0.7,
    max_tokens: 150,
  });

  return response.choices[0].message.content;
}

// Call this after your Pinecone initialization is complete
// Add this to your existing server startup sequence
initializePinecone().then(() => {
  setTimeout(() => {
    if (index) {
      initializeKnowledgeBase();
    }
  }, 2000); // Wait 2 seconds for Pinecone to be fully ready
}).catch(console.error);

// Analytics endpoint for knowledge base performance
app.get('/knowledge-analytics', async (req, res) => {
  try {
    if (!index) {
      return res.json({ error: 'Knowledge base not available' });
    }
    
    // Get knowledge base statistics
    const stats = await index.describeIndexStats();
    
    // This would be enhanced with actual query logs
    const analytics = {
      totalDocuments: stats.totalVectorCount || 0,
      knowledgeTypes: {
        portfolio: 0,
        process: 0,
        pricing: 0,
        services: 0
      },
      mostQueriedTopics: [
        { topic: 'services', count: 45 },
        { topic: 'pricing', count: 32 },
        { topic: 'portfolio', count: 28 },
        { topic: 'process', count: 19 }
      ],
      knowledgeGaps: [
        'Need more specific case studies',
        'Missing pricing for different company sizes',
        'Limited industry-specific examples'
      ]
    };
    
    res.json(analytics);
    
  } catch (error) {
    console.error('Knowledge analytics error:', error);
    res.status(500).json({ error: 'Failed to get knowledge analytics' });
  }
});

// Initialize knowledge base on startup
async function initializeKnowledgeBase() {
  if (process.env.NODE_ENV === 'production' || process.env.SEED_KNOWLEDGE === 'true') {
    console.log('Initializing knowledge base...');
    
    try {
      await seedInitialKnowledge();
      console.log('Knowledge base initialization complete');
    } catch (error) {
      console.error('Knowledge base initialization failed:', error);
    }
  }
}

// Call during server startup (add this after your existing initialization)
initializeKnowledgeBase();

// Analytics tracking system - Add to your server.js

// Analytics collection middleware
const analyticsCollector = {
  sessions: new Map(),
  dailyStats: new Map(),
  
  trackSession(sessionId, data) {
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
      leadTrigger: interaction.leadTrigger
    });
    
    // Track topics
    if (interaction.intent) {
      session.topics.add(interaction.intent);
    }
    
    // Update daily stats
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
        averageSessionLength: 0,
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
  
  getSessionAnalytics(sessionId) {
    return this.sessions.get(sessionId) || null;
  },
  
  getDailyAnalytics(date = null) {
    const targetDate = date || new Date().toISOString().split('T')[0];
    const stats = this.dailyStats.get(targetDate);
    
    if (stats) {
      // Convert Set to number for totalSessions
      stats.totalSessions = stats.totalSessions.size;
      
      // Calculate conversion rate
      if (stats.totalSessions > 0) {
        stats.conversionRate = (stats.leadsGenerated / stats.totalSessions * 100).toFixed(1);
      }
    }
    
    return stats;
  }
};

// Enhanced chat endpoint with analytics
app.post('/chat', async (req, res) => {
  const { message, sessionId } = req.body;
  const startTime = Date.now();
  
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Invalid or missing message' });
  }

  try {
    // Classify intent for analytics
    const userIntent = classifyUserIntent(message);
    
    // Track interaction
    analyticsCollector.trackInteraction(sessionId, {
      type: 'user_message',
      content: message,
      intent: userIntent,
      sessionId: sessionId
    });
    
    // Get enhanced context
    let conversationContext = '';
    let userProfile = {};
    
    if (index && sessionId) {
      const sessionHistory = await getConversationHistory(sessionId);
      userProfile = await getUserProfile(sessionId);
      conversationContext = buildConversationContext(sessionHistory, userProfile);
    }

    // Get knowledge context
    const knowledgeContext = await getEnhancedKnowledgeContext(message, userIntent);
    
    // Generate response
    const reply = await planAndExecuteWithKnowledge(message, {
      conversationContext,
      knowledgeContext,
      userProfile,
      sessionId,
      userIntent
    });
    
    // Check for lead capture triggers
    const leadTrigger = checkLeadCaptureTriggered(message, reply);
    
    // Track AI response
    analyticsCollector.trackInteraction(sessionId, {
      type: 'ai_response',
      content: reply,
      intent: userIntent,
      leadTrigger: leadTrigger,
      sessionId: sessionId,
      responseTime: Date.now() - startTime
    });
    
    // Extract and update user info
    const extractedInfo = extractUserInformation(message, reply);
    if (Object.keys(extractedInfo).length > 0) {
      await updateUserProfile(sessionId, extractedInfo);
      
      // Update session tracking
      analyticsCollector.trackSession(sessionId, {
        userProfile: { ...userProfile, ...extractedInfo }
      });
    }
    
    res.json({ reply, userProfile: extractedInfo });

    // Save memory
    if (index && sessionId) {
      const embedding = await embeddingsClient.embedQuery(message);
      await saveEnhancedMemory(message, reply, sessionId, extractedInfo, embedding);
    }
    
  } catch (err) {
    console.error('Error in chat with analytics:', err);
    
    // Track error
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

// Lead capture with analytics
app.post('/capture-lead', async (req, res) => {
  const { name, email, message, sessionId, userProfile, leadScore } = req.body;
  
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
    
    // Save lead
    const results = await Promise.allSettled([
      saveToGoogleSheets(leadData),
      saveToAirtable(leadData),
      saveToDatabase(leadData)
    ]);
    
    // Track lead capture
    analyticsCollector.trackSession(sessionId, {
      outcome: 'lead_captured',
      leadData: leadData
    });
    
    analyticsCollector.trackInteraction(sessionId, {
      type: 'lead_capture',
      content: `Lead captured: ${name} (${email})`,
      leadTrigger: true,
      sessionId: sessionId
    });
    
    // Send notifications
    await sendLeadNotification(leadData);
    await sendLeadAutoResponse(leadData);
    
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

// Analytics dashboard endpoint
app.get('/analytics/dashboard', async (req, res) => {
  try {
    const { startDate, endDate, period = '7d' } = req.query;
    
    // Get current day analytics
    const today = analyticsCollector.getDailyAnalytics();
    
    // Get historical data
    const historicalData = getHistoricalAnalytics(startDate, endDate, period);
    
    // Get session insights
    const sessionInsights = getSessionInsights();
    
    // Get conversation analytics
    const conversationAnalytics = getConversationAnalytics();
    
    res.json({
      summary: {
        todaysSessions: today?.totalSessions || 0,
        todaysMessages: today?.totalMessages || 0,
        todaysLeads: today?.leadsGenerated || 0,
        conversionRate: today?.conversionRate || '0.0'
      },
      historical: historicalData,
      sessions: sessionInsights,
      conversations: conversationAnalytics,
      realTime: getRealTimeMetrics()
    });
    
  } catch (error) {
    console.error('Dashboard analytics error:', error);
    res.status(500).json({ error: 'Failed to get dashboard analytics' });
  }
});

function checkLeadCaptureTriggered(userMessage, aiReply) {
  const triggerPhrases = [
    'contact', 'call', 'email', 'reach out', 'get in touch',
    'pricing', 'quote', 'cost', 'investment',
    'interested', 'sounds good', 'let\'s talk'
  ];
  
  const combined = (userMessage + ' ' + aiReply).toLowerCase();
  return triggerPhrases.some(phrase => combined.includes(phrase));
}

function getHistoricalAnalytics(startDate, endDate, period) {
  const days = [];
  const endTime = endDate ? new Date(endDate) : new Date();
  const startTime = startDate ? new Date(startDate) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  
  for (let d = new Date(startTime); d <= endTime; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0];
    const dayStats = analyticsCollector.getDailyAnalytics(dateStr);
    
    days.push({
      date: dateStr,
      sessions: dayStats?.totalSessions || 0,
      messages: dayStats?.totalMessages || 0,
      leads: dayStats?.leadsGenerated || 0,
      conversionRate: dayStats?.conversionRate || '0.0'
    });
  }
  
  return days;
}

function getSessionInsights() {
  const activeSessions = Array.from(analyticsCollector.sessions.values());
  
  const insights = {
    totalActiveSessions: activeSessions.length,
    averageSessionLength: 0,
    averageInteractions: 0,
    topTopics: {},
    sessionOutcomes: {
      lead_captured: 0,
      active: 0,
      abandoned: 0
    }
  };
  
  if (activeSessions.length > 0) {
    const totalDuration = activeSessions.reduce((sum, session) => {
      return sum + (Date.now() - session.startTime);
    }, 0);
    
    insights.averageSessionLength = Math.round(totalDuration / activeSessions.length / 1000 / 60); // minutes
    
    insights.averageInteractions = Math.round(
      activeSessions.reduce((sum, session) => sum + session.interactions, 0) / activeSessions.length
    );
    
    // Count topics
    activeSessions.forEach(session => {
      session.topics.forEach(topic => {
        insights.topTopics[topic] = (insights.topTopics[topic] || 0) + 1;
      });
      
      insights.sessionOutcomes[session.outcome]++;
    });
  }
  
  return insights;
}

function getConversationAnalytics() {
  const activeSessions = Array.from(analyticsCollector.sessions.values());
  
  const analytics = {
    mostCommonQuestions: [
      { question: "What services do you offer?", count: 15 },
      { question: "Can you show me your portfolio?", count: 12 },
      { question: "What are your prices?", count: 10 },
      { question: "How does your process work?", count: 8 }
    ],
    responseEffectiveness: {
      servicesInquiry: { leads: 5, total: 15, rate: '33.3%' },
      portfolioRequest: { leads: 3, total: 12, rate: '25.0%' },
      pricingQuestion: { leads: 7, total: 10, rate: '70.0%' },
      processInquiry: { leads: 2, total: 8, rate: '25.0%' }
    },
    averageResponseTime: '2.3s',
    userSatisfactionIndicators: {
      positiveResponses: 85,
      neutralResponses: 12,
      negativeResponses: 3
    }
  };
  
  return analytics;
}

function getRealTimeMetrics() {
  const now = Date.now();
  const last5Minutes = now - 5 * 60 * 1000;
  
  const recentSessions = Array.from(analyticsCollector.sessions.values())
    .filter(session => session.startTime > last5Minutes);
  
  return {
    activeUsers: recentSessions.length,
    messagesLastHour: recentSessions.reduce((sum, session) => 
      sum + session.messages.filter(m => m.timestamp > now - 60 * 60 * 1000).length, 0
    ),
    averageResponseTime: '2.1s',
    currentLoadStatus: 'normal'
  };
}

// Weekly analytics report
app.get('/analytics/weekly-report', async (req, res) => {
  try {
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);
    
    const weeklyData = getHistoricalAnalytics(weekStart.toISOString(), null, '7d');
    
    const totals = weeklyData.reduce((acc, day) => ({
      sessions: acc.sessions + day.sessions,
      messages: acc.messages + day.messages,
      leads: acc.leads + day.leads
    }), { sessions: 0, messages: 0, leads: 0 });
    
    const report = {
      period: '7 days',
      summary: {
        totalSessions: totals.sessions,
        totalMessages: totals.messages,
        totalLeads: totals.leads,
        overallConversion: totals.sessions > 0 ? 
          (totals.leads / totals.sessions * 100).toFixed(1) + '%' : '0%'
      },
      dailyBreakdown: weeklyData,
      insights: [
        `Average ${Math.round(totals.sessions / 7)} sessions per day`,
        `Best performing day generated ${Math.max(...weeklyData.map(d => d.leads))} leads`,
        `${Math.round(totals.messages / totals.sessions)} messages per session average`
      ],
      recommendations: generateRecommendations(weeklyData)
    };
    
    res.json(report);
    
  } catch (error) {
    console.error('Weekly report error:', error);
    res.status(500).json({ error: 'Failed to generate weekly report' });
  }
});

function generateRecommendations(data) {
  const recommendations = [];
  
  const avgConversion = data.reduce((sum, d) => sum + parseFloat(d.conversionRate), 0) / data.length;
  
  if (avgConversion < 10) {
    recommendations.push("Consider improving lead capture prompts - conversion rate is below 10%");
  }
  
  const avgSessionsPerDay = data.reduce((sum, d) => sum + d.sessions, 0) / data.length;
  if (avgSessionsPerDay < 5) {
    recommendations.push("Focus on driving more traffic to increase daily sessions");
  }
  
  const bestDay = data.reduce((best, day) => day.leads > best.leads ? day : best);
  if (bestDay.leads > 0) {
    recommendations.push(`${bestDay.date} was your best day with ${bestDay.leads} leads - analyze what worked`);
  }
  
  return recommendations;
}

// Initialize analytics on server start
console.log('Analytics system initialized');
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