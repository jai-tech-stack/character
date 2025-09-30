// OPTIMIZED Fast AI Mode System - chatApi.js
// Single API calls per mode for speed

const API_BASE_URL = 'https://character-chan.onrender.com';

console.log('Loading OPTIMIZED AI Mode System for FoxMandal...');

class OptimizedAIProcessor {
  constructor() {
    this.conversationHistory = new Map();
  }

  // AGENTIC AI - Single optimized call with comprehensive analysis
  async processAgentic(message, sessionId) {
    return await this.sendToBackend({
      message,
      sessionId,
      aiMode: 'agentic',
      systemPrompt: `You are Advocate Arjun, an advanced legal AI assistant at FoxMandal. Provide detailed step-by-step legal analysis:

STEP 1 - LEGAL ANALYSIS:
Identify the core legal issues and applicable Indian laws.

STEP 2 - KEY CONSIDERATIONS:
List critical factors, risks, and compliance requirements.

STEP 3 - RECOMMENDED ACTIONS:
Provide clear, actionable next steps.

STEP 4 - CONSULTATION ADVICE:
Specify when professional legal consultation is necessary.

Keep response focused, practical, and under 400 words.`,
      temperature: 0.4,
      maxTokens: 500
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

      console.log(`Sending optimized ${params.aiMode} request...`);

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
      return `I apologize, but I'm experiencing technical difficulties. Please try again in a moment.`;
    }
  }

  generateSessionId(aiMode = 'agentic') {
    return `session_foxmandal_${aiMode}_${Date.now()}_${Math.random().toString(36).substring(2, 15).toLowerCase()}`;
  }

  updateConversationContext(sessionId, message, response, mode) {
    const context = this.conversationHistory.get(sessionId) || { history: [] };
    context.history.push({ message, response, mode, timestamp: Date.now() });
    
    if (context.history.length > 3) {
      context.history = context.history.slice(-3);
    }
    
    this.conversationHistory.set(sessionId, context);
  }
}

const aiProcessor = new OptimizedAIProcessor();

// ===== MAIN API FUNCTION =====

export const sendMessage = async (message, sessionId = null, aiMode = 'agentic') => {
  if (!message || typeof message !== 'string') {
    throw new Error('Message is required and must be a string');
  }

  const sanitizedMessage = message.trim().substring(0, 2000);
  if (!sanitizedMessage) {
    throw new Error('Message cannot be empty');
  }

  const session = sessionId || aiProcessor.generateSessionId(aiMode);

  try {
    console.log(`Processing optimized request: "${sanitizedMessage.substring(0, 50)}..."`);
    
    const response = await aiProcessor.processAgentic(sanitizedMessage, session);

    aiProcessor.updateConversationContext(session, sanitizedMessage, response, aiMode);

    return {
      reply: response,
      aiMode: 'agentic',
      sessionId: session,
      processingType: 'optimized_agentic',
      confidence: calculateConfidence(response)
    };

  } catch (error) {
    console.error('AI processing error:', error);
    
    return {
      reply: `I apologize, but I'm experiencing technical difficulties processing your legal query. Please try rephrasing your question or contact our support team.`,
      aiMode: 'agentic',
      sessionId: session,
      processingType: 'error',
      confidence: 0.3
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

// ===== TTS FUNCTION =====

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
            console.log(`Selected voice: ${maleVoice.name}`);
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

// ===== DOCUMENT ANALYSIS =====

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

// ===== OTHER FUNCTIONS =====

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

console.log('Optimized AI Mode System loaded - Fast single-call processing');