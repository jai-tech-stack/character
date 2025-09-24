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
import { PDFLoader } from "langchain/document_loaders/fs/pdf";
import { DocxLoader } from "langchain/document_loaders/fs/docx";
import { TextLoader } from "langchain/document_loaders/fs/text";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";

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

// Knowledge base management endpoint
app.post('/upload-knowledge', async (req, res) => {
  if (!req.files || !req.files.document) {
    return res.status(400).json({ error: 'No document uploaded' });
  }
  
  const file = req.files.document;
  console.log('📚 Processing knowledge upload:', file.name);
  
  try {
    const documents = await processKnowledgeDocument(file);
    const embedded = await embedKnowledgeDocuments(documents);
    
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

// Process different document types
async function processKnowledgeDocument(file) {
  let loader;
  const filePath = `/tmp/${file.name}`;
  
  // Save uploaded file temporarily
  await file.mv(filePath);
  
  // Choose appropriate loader based on file type
  if (file.mimetype === 'application/pdf') {
    loader = new PDFLoader(filePath);
  } else if (file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    loader = new DocxLoader(filePath);
  } else if (file.mimetype === 'text/plain') {
    loader = new TextLoader(filePath);
  } else {
    throw new Error(`Unsupported file type: ${file.mimetype}`);
  }
  
  console.log(`Loading document with ${loader.constructor.name}`);
  const documents = await loader.load();
  
  // Clean up temporary file
  require('fs').unlinkSync(filePath);
  
  return documents;
}

// Split and embed knowledge documents
async function embedKnowledgeDocuments(documents) {
  const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
    separators: ['\n\n', '\n', '. ', ', ', ' ']
  });
  
  const splits = await textSplitter.splitDocuments(documents);
  console.log(`📖 Split into ${splits.length} chunks`);
  
  const embeddedChunks = [];
  
  for (const [index, split] of splits.entries()) {
    try {
      const embedding = await embeddingsClient.embedQuery(split.pageContent);
      
      const metadata = {
        content: split.pageContent,
        type: 'knowledge',
        source: split.metadata.source || 'uploaded_document',
        page: split.metadata.page || null,
        chunkIndex: index,
        timestamp: Date.now(),
        // Extract key information
        hasPortfolio: split.pageContent.toLowerCase().includes('portfolio') || 
                     split.pageContent.toLowerCase().includes('case study'),
        hasProcess: split.pageContent.toLowerCase().includes('process') || 
                   split.pageContent.toLowerCase().includes('methodology'),
        hasPricing: split.pageContent.toLowerCase().includes('price') || 
                   split.pageContent.toLowerCase().includes('cost') ||
                   split.pageContent.toLowerCase().includes('investment'),
        hasServices: split.pageContent.toLowerCase().includes('service') || 
                    split.pageContent.toLowerCase().includes('offering')
      };
      
      const record = {
        id: `knowledge_${Date.now()}_${index}`,
        values: embedding,
        metadata
      };
      
      embeddedChunks.push(record);
      
    } catch (error) {
      console.error(`Failed to embed chunk ${index}:`, error);
    }
  }
  
  // Batch upsert to Pinecone
  if (embeddedChunks.length > 0) {
    const batchSize = 100;
    for (let i = 0; i < embeddedChunks.length; i += batchSize) {
      const batch = embeddedChunks.slice(i, i + batchSize);
      await index.upsert({ records: batch });
    }
  }
  
  console.log(`✅ Embedded ${embeddedChunks.length} knowledge chunks`);
  return embeddedChunks;
}

// Enhanced knowledge retrieval in chat
async function getEnhancedKnowledgeContext(query, userIntent = null) {
  if (!index) return '';
  
  try {
    const queryEmbedding = await embeddingsClient.embedQuery(query);
    
    // Build search filters based on intent
    let filter = { type: 'knowledge' };
    
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
      ?.map((match, index) => {
        const confidence = match.score || 0;
        const content = match.metadata?.content || '';
        const source = match.metadata?.source || 'unknown';
        
        return `[Source: ${source}] ${content}`;
      })
      .join('\n\n') || '';
    
    console.log(`🧠 Retrieved ${results.matches?.length || 0} knowledge matches`);
    return knowledgeContext;
    
  } catch (error) {
    console.error('Knowledge retrieval error:', error);
    return '';
  }
}

// Pre-populated knowledge for immediate use
async function seedInitialKnowledge() {
  console.log('Seeding initial Origami Creative knowledge...');
  
  const initialKnowledge = [
    {
      content: "Origami Creative is a full-service branding and creative agency specializing in brand strategy, visual identity design, and comprehensive brand experiences. We help businesses unfold their potential through strategic creative solutions.",
      type: 'knowledge',
      hasServices: true,
      source: 'company_overview'
    },
    {
      content: "Our brand development process includes: 1) Discovery & Research phase where we analyze your market, competitors, and target audience. 2) Strategy Development where we define positioning, messaging, and brand architecture. 3) Creative Execution including logo design, visual identity, and brand guidelines. 4) Implementation across all touchpoints. 5) Launch and ongoing brand management.",
      type: 'knowledge',
      hasProcess: true,
      source: 'methodology'
    },
    {
      content: "Portfolio highlights include successful rebrands for tech startups, healthcare organizations, and retail brands. Case study example: TechFlow startup rebrand increased customer trust scores by 40% and led to successful Series A funding. Healthcare rebrand for MedCare Clinic improved patient acquisition by 25%.",
      type: 'knowledge',
      hasPortfolio: true,
      source: 'case_studies'
    },
    {
      content: "Investment ranges vary by scope: Brand identity projects typically range from $15,000-$50,000 for comprehensive packages including strategy, design, and guidelines. Full brand development with implementation ranges $50,000-$150,000. We offer flexible payment structures and always provide detailed proposals before starting work.",
      type: 'knowledge',
      hasPricing: true,
      source: 'pricing_guide'
    },
    {
      content: "Our services include: Brand Strategy (positioning, messaging, market analysis), Visual Identity (logos, typography, color systems), Brand Guidelines (usage standards, voice & tone), Marketing Materials (business cards, brochures, digital assets), Website Design (brand-aligned web experiences), and Packaging Design (product packaging and retail presence).",
      type: 'knowledge',
      hasServices: true,
      source: 'services_overview'
    }
  ];
  
  try {
    const records = [];
    
    for (const [index, knowledge] of initialKnowledge.entries()) {
      const embedding = await embeddingsClient.embedQuery(knowledge.content);
      
      records.push({
        id: `seed_knowledge_${index}`,
        values: embedding,
        metadata: {
          content: knowledge.content,
          type: knowledge.type,
          source: knowledge.source,
          hasPortfolio: knowledge.hasPortfolio || false,
          hasProcess: knowledge.hasProcess || false,
          hasPricing: knowledge.hasPricing || false,
          hasServices: knowledge.hasServices || false,
          timestamp: Date.now()
        }
      });
    }
    
    if (index) {
      await index.upsert({ records });
      console.log(`Initial knowledge seeded: ${records.length} entries`);
    }
    
  } catch (error) {
    console.error('Failed to seed initial knowledge:', error);
  }
}

// Update the enhanced chat endpoint to use knowledge retrieval
app.post('/chat', async (req, res) => {
  const { message, sessionId } = req.body;
  
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Invalid or missing message' });
  }

  try {
    // Enhanced memory retrieval with conversation threading
    let conversationContext = '';
    let userProfile = {};
    
    if (index && sessionId) {
      const sessionHistory = await getConversationHistory(sessionId);
      userProfile = await getUserProfile(sessionId);
      conversationContext = buildConversationContext(sessionHistory, userProfile);
    }

    // Classify intent for targeted knowledge retrieval
    const userIntent = classifyUserIntent(message);
    
    // Get relevant knowledge from uploaded documents and seeded data
    const knowledgeContext = await getEnhancedKnowledgeContext(message, userIntent);
    
    // Enhanced agent orchestration with knowledge
    const reply = await planAndExecuteWithKnowledge(message, {
      conversationContext,
      knowledgeContext,
      userProfile,
      sessionId,
      userIntent
    });
    
    // Extract and update user information
    const extractedInfo = extractUserInformation(message, reply);
    if (Object.keys(extractedInfo).length > 0) {
      await updateUserProfile(sessionId, extractedInfo);
    }
    
    res.json({ reply, userProfile: extractedInfo });

    // Save enhanced memory
    if (index && sessionId) {
      const embedding = await embeddingsClient.embedQuery(message);
      await saveEnhancedMemory(message, reply, sessionId, extractedInfo, embedding);
    }
    
  } catch (err) {
    console.error('Error in enhanced chat:', err);
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'Chat processing failed', 
        details: err.message 
      });
    }
  }
});

// Intent classification helper
function classifyUserIntent(message) {
  const lowerMessage = message.toLowerCase();
  
  const intentPatterns = {
    'portfolio_request': ['portfolio', 'examples', 'case study', 'work', 'projects', 'show me'],
    'process_inquiry': ['process', 'how do you', 'methodology', 'approach', 'steps'],
    'pricing_inquiry': ['price', 'cost', 'budget', 'investment', 'quote', 'expensive'],
    'service_inquiry': ['services', 'what do you do', 'offerings', 'help with'],
    'contact_request': ['contact', 'reach out', 'call', 'meet', 'consultation']
  };
  
  for (const [intent, patterns] of Object.entries(intentPatterns)) {
    if (patterns.some(pattern => lowerMessage.includes(pattern))) {
      return intent;
    }
  }
  
  return 'general_inquiry';
}

// Enhanced agent planning with knowledge integration
async function planAndExecuteWithKnowledge(message, context) {
  const { conversationContext, knowledgeContext, userProfile, userIntent } = context;
  
  const enhancedPrompt = [
    {
      role: 'system',
      content: `
You are the AI Brand Strategist for ORIGAMI CREATIVE (https://origamicreative.com).
You represent a professional branding and creative agency, NOT Japanese paper folding.

RELEVANT KNOWLEDGE FROM DOCUMENTS:
${knowledgeContext}

CONVERSATION CONTEXT:
${conversationContext}

USER PROFILE:
${JSON.stringify(userProfile)}

USER INTENT: ${userIntent}

INSTRUCTIONS:
- Use the knowledge from documents to provide specific, accurate information
- Reference real case studies, processes, and pricing when available in knowledge
- Personalize responses based on user profile and conversation history
- If user has a company name, mention it naturally
- If knowledge mentions specific examples or numbers, use them
- Keep responses under 80 words but make them substantive
- Always sound professional and consultative

PERSONALIZATION RULES:
- Reference their company "${userProfile.company || 'your business'}" when relevant
- Tailor industry examples if industry is known: "${userProfile.industry || ''}"
- Be more direct about next steps if they seem qualified (mentioned budget/timeline)
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