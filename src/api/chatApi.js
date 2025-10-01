// COMPLETE chatApi.js - All Features, Bug-Free
// Fast AI + Context Memory + Re-engagement + Document Analysis

const API_BASE_URL = 'https://character-chan.onrender.com';

console.log('Loading Complete AI System with Context Memory for FoxMandal...');

class OptimizedAIProcessor {
  constructor() {
    this.conversationHistory = new Map();
    this.userPreferences = new Map();
    this.lastInteractionTime = new Map();
  }

  updateUserProfile(sessionId, data) {
    const profile = this.userPreferences.get(sessionId) || {
      name: null,
      legalInterests: [],
      interactionCount: 0,
      firstInteraction: Date.now(),
      preferredTopics: new Set()
    };

    if (data.legalArea) profile.preferredTopics.add(data.legalArea);
    if (data.name) profile.name = data.name;
    profile.interactionCount++;

    this.userPreferences.set(sessionId, profile);
    return profile;
  }

  checkReEngagement(sessionId) {
    const lastTime = this.lastInteractionTime.get(sessionId);
    const now = Date.now();
    const inactiveMinutes = lastTime ? (now - lastTime) / 60000 : 0;

    this.lastInteractionTime.set(sessionId, now);

    if (inactiveMinutes >= 2 && inactiveMinutes <= 30) {
      return {
        shouldGreet: true,
        inactiveMinutes: Math.floor(inactiveMinutes),
        greeting: this.generateReEngagementGreeting(sessionId, inactiveMinutes)
      };
    }

    return { shouldGreet: false };
  }

  generateReEngagementGreeting(sessionId, minutes) {
    const profile = this.userPreferences.get(sessionId);
    const history = this.getConversationContext(sessionId);
    
    let greeting = `Welcome back! `;

    if (profile?.name) {
      greeting = `Welcome back, ${profile.name}! `;
    }

    if (history.lastTopic) {
      greeting += `I see we were discussing ${history.lastTopic}. Would you like to continue, or is there something new I can help you with?`;
    } else if (minutes < 5) {
      greeting += `I'm here to help with any legal questions you have.`;
    } else {
      greeting += `It's been ${minutes} minutes. How can I assist you with your legal matters today?`;
    }

    return greeting;
  }

  async processAgentic(message, sessionId, contextData = {}) {
    const profile = this.updateUserProfile(sessionId, contextData);
    const conversationContext = this.getConversationContext(sessionId);
    
    let contextPrompt = '';
    
    if (conversationContext.history?.length > 0) {
      const recentHistory = conversationContext.history.slice(-2).map(h => 
        `User: ${h.message}\nAdvocate: ${h.response.substring(0, 150)}`
      ).join('\n');
      
      contextPrompt = `\n\nPREVIOUS CONVERSATION CONTEXT:\n${recentHistory}\n\nCurrent question relates to previous discussion.`;
    }

    if (profile.preferredTopics.size > 0) {
      contextPrompt += `\n\nUser has shown interest in: ${Array.from(profile.preferredTopics).join(', ')}`;
    }

    return await this.sendToBackend({
      message: message + contextPrompt,
      sessionId,
      aiMode: 'agentic',
      systemPrompt: `You are Advocate Arjun, an advanced legal AI assistant at FoxMandal. ${profile.name ? `The user's name is ${profile.name}.` : ''} This is interaction #${profile.interactionCount}.

Provide detailed step-by-step legal analysis with natural conversation flow:

STEP 1 - LEGAL ANALYSIS:
Identify core legal issues and applicable Indian laws.

STEP 2 - KEY CONSIDERATIONS:
List critical factors, risks, and compliance requirements.

STEP 3 - RECOMMENDED ACTIONS:
Provide clear, actionable next steps.

STEP 4 - CONSULTATION ADVICE:
Specify when professional legal consultation is necessary.

CONVERSATION GUIDELINES:
- Reference previous topics naturally if relevant
- Show empathy and emotional intelligence
- Ask clarifying questions when needed
- Handle topic changes gracefully
- Keep responses focused, practical, under 400 words`,
      temperature: 0.4,
      maxTokens: 500
    });
  }

  async generateIntroduction(sessionId, isReturning = false) {
    const profile = this.userPreferences.get(sessionId);
    
    if (isReturning && profile) {
      return `Welcome back${profile.name ? `, ${profile.name}` : ''}! I remember we've discussed ${Array.from(profile.preferredTopics).join(' and ')} before. I'm Advocate Arjun, your AI legal assistant from FoxMandal. I'm here to help you with any legal questions. What's on your mind today?`;
    }

    return await this.sendToBackend({
      message: "Introduce yourself warmly as Advocate Arjun, an intelligent legal AI assistant. Be personable, professional, and encourage questions.",
      sessionId,
      aiMode: 'agentic',
      systemPrompt: `You are Advocate Arjun from FoxMandal. Introduce yourself naturally:
- Warm, professional greeting
- Explain your capabilities (contract review, legal advice, consultation scheduling)
- Invite user to ask anything
- Keep it conversational, under 100 words`,
      temperature: 0.7,
      maxTokens: 150
    });
  }

  async sendToBackend(params) {
    try {
      const requestBody = {
        message: params.message || '',
        sessionId: params.sessionId || this.generateSessionId(params.aiMode),
        aiMode: params.aiMode || 'agentic',
        systemPrompt: params.systemPrompt,
        temperature: params.temperature || 0.4,
        maxTokens: params.maxTokens || 500,
        timestamp: Date.now()
      };

      if (!requestBody.message.trim()) {
        throw new Error('Message cannot be empty');
      }

      if (requestBody.message.length > 2000) {
        requestBody.message = requestBody.message.substring(0, 2000);
      }

      const response = await fetch(`${API_BASE_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-ID': requestBody.sessionId,
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Backend error (${response.status}):`, errorText);
        throw new Error(`API Error: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.reply || typeof data.reply !== 'string') {
        throw new Error('Invalid response format from backend');
      }

      return data.reply;

    } catch (error) {
      console.error('Backend API Error:', error);
      return `I apologize for the technical difficulty. Please try rephrasing your question, and I'll do my best to assist you.`;
    }
  }

  generateSessionId(aiMode = 'agentic') {
    return `session_foxmandal_${aiMode}_${Date.now()}_${Math.random().toString(36).substring(2, 15).toLowerCase()}`;
  }

  getConversationContext(sessionId) {
    return this.conversationHistory.get(sessionId) || { history: [], lastTopic: null };
  }

  updateConversationContext(sessionId, message, response, topic = null) {
    const context = this.getConversationContext(sessionId);
    context.history = context.history || [];
    context.history.push({ 
      message, 
      response, 
      timestamp: Date.now(),
      topic 
    });
    
    if (topic) context.lastTopic = topic;
    
    if (context.history.length > 5) {
      context.history = context.history.slice(-5);
    }
    
    this.conversationHistory.set(sessionId, context);
  }

  extractTopic(message) {
    const topicKeywords = {
      'contract': ['contract', 'agreement', 'terms'],
      'employment': ['employment', 'job', 'workplace', 'termination'],
      'property': ['property', 'real estate', 'land', 'lease'],
      'taxation': ['tax', 'gst', 'income tax'],
      'corporate': ['company', 'business', 'corporate'],
      'litigation': ['court', 'lawsuit', 'legal action']
    };

    const lowerMessage = message.toLowerCase();
    for (const [topic, keywords] of Object.entries(topicKeywords)) {
      if (keywords.some(kw => lowerMessage.includes(kw))) {
        return topic;
      }
    }
    return 'general legal';
  }
}

const aiProcessor = new OptimizedAIProcessor();

// ===== EXPORTED FUNCTIONS =====

export const sendMessage = async (message, sessionId = null, aiMode = 'agentic', contextData = {}) => {
  if (!message || typeof message !== 'string') {
    throw new Error('Message is required and must be a string');
  }

  const sanitizedMessage = message.trim().substring(0, 2000);
  if (!sanitizedMessage) {
    throw new Error('Message cannot be empty');
  }

  const session = sessionId || aiProcessor.generateSessionId(aiMode);

  try {
    const reEngagement = aiProcessor.checkReEngagement(session);
    const response = await aiProcessor.processAgentic(sanitizedMessage, session, contextData);
    const topic = aiProcessor.extractTopic(sanitizedMessage);
    aiProcessor.updateConversationContext(session, sanitizedMessage, response, topic);

    return {
      reply: response,
      aiMode: 'agentic',
      sessionId: session,
      processingType: 'optimized_agentic',
      confidence: calculateConfidence(response),
      reEngagement: reEngagement.shouldGreet ? reEngagement : null,
      contextRetained: true
    };

  } catch (error) {
    console.error('AI processing error:', error);
    
    return {
      reply: `I apologize for the technical difficulty. Let me try to help you anyway - could you rephrase your legal question?`,
      aiMode: 'agentic',
      sessionId: session,
      processingType: 'error',
      confidence: 0.3
    };
  }
};

export const generateAIIntroduction = async (sessionId) => {
  const profile = aiProcessor.userPreferences.get(sessionId);
  const isReturning = profile && profile.interactionCount > 0;
  return await aiProcessor.generateIntroduction(sessionId, isReturning);
};

export const checkUserReEngagement = (sessionId) => {
  return aiProcessor.checkReEngagement(sessionId);
};

export const getTTS = async (text) => {
  return new Promise((resolve) => {
    if (!text || !window.speechSynthesis) {
      resolve();
      return;
    }

    try {
      window.speechSynthesis.cancel();
      
      setTimeout(() => {
        const processedText = text
          .replace(/FoxMandal/g, 'Fox Mandal')
          .substring(0, 1000);

        const utterance = new SpeechSynthesisUtterance(processedText);
        
        const setVoiceAndSpeak = () => {
          const voices = window.speechSynthesis.getVoices();
          
          const maleVoice = voices.find(voice => 
            voice.lang.startsWith('en') && (
              voice.name.toLowerCase().includes('male') ||
              voice.name.toLowerCase().includes('david') ||
              !voice.name.toLowerCase().includes('female')
            )
          );
          
          if (maleVoice) {
            utterance.voice = maleVoice;
          }

          utterance.rate = 0.85;
          utterance.pitch = 0.8;
          utterance.volume = 0.85;
          utterance.onend = () => resolve();
          utterance.onerror = () => resolve();

          window.speechSynthesis.speak(utterance);
          
          setTimeout(() => {
            window.speechSynthesis.cancel();
            resolve();
          }, Math.max(8000, processedText.length * 100));
        };

        if (window.speechSynthesis.getVoices().length === 0) {
          window.speechSynthesis.onvoiceschanged = () => {
            setVoiceAndSpeak();
            window.speechSynthesis.onvoiceschanged = null;
          };
        } else {
          setVoiceAndSpeak();
        }
        
      }, 100);
      
    } catch (error) {
      console.warn('TTS error:', error);
      resolve();
    }
  });
};

export const stopTTS = () => {
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
};

export const analyzeDocument = async (file, sessionId, aiMode = 'agentic') => {
  if (!file) throw new Error('No file provided');

  const allowedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ];

  if (!allowedTypes.includes(file.type)) {
    throw new Error('Invalid file type. Only PDF, DOC, DOCX, and TXT files are allowed.');
  }

  const maxSize = 10 * 1024 * 1024;
  if (file.size > maxSize) {
    throw new Error('File too large. Maximum size is 10MB.');
  }

  try {
    const formData = new FormData();
    formData.append('document', file);
    formData.append('sessionId', sessionId);
    formData.append('aiMode', aiMode);
    formData.append('message', `Analyzing document: ${file.name}`);

    const response = await fetch(`${API_BASE_URL}/analyze-document`, {
      method: 'POST',
      headers: { 'X-Session-ID': sessionId },
      body: formData
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Analysis failed');
    }

    return await response.json();

  } catch (error) {
    console.error('Document analysis error:', error);
    throw new Error(error.message || 'Failed to analyze document');
  }
};

export const captureLead = async (leadData, sessionId, aiMode = 'agentic') => {
  try {
    const response = await fetch(`${API_BASE_URL}/capture-lead`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        ...leadData, 
        sessionId, 
        aiMode,
        timestamp: new Date().toISOString()
      })
    });
    
    if (!response.ok) {
      throw new Error('Lead capture failed');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Lead capture error:', error);
    throw new Error('Failed to capture lead information');
  }
};

export const checkHealth = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/health`);
    const data = await response.json();
    return {
      status: response.ok ? 'healthy' : 'unhealthy',
      details: data
    };
  } catch (error) {
    return { 
      status: 'error', 
      message: error.message
    };
  }
};

function calculateConfidence(response) {
  let confidence = 0.80;

  if (response.includes('step') || response.includes('STEP')) confidence += 0.05;
  if (response.includes('recommend') || response.includes('advice')) confidence += 0.03;
  if (response.length > 300) confidence += 0.02;
  if (response.length < 100) confidence -= 0.15;
  if (response.includes('error') || response.includes('difficult')) confidence -= 0.3;

  return Math.max(0.3, Math.min(0.90, confidence));
}

console.log('Complete AI System loaded successfully');