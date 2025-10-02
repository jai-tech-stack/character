// ENHANCED chatApi.js - With Multilingual Support
// Fast AI + Context Memory + Re-engagement + Auto-Language Detection

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://character-chan.onrender.com';

console.log('Loading Multilingual AI System with Context Memory...');

// Language detection
function detectLanguage(text) {
  const hindiPattern = /[\u0900-\u097F]/;
  const tamilPattern = /[\u0B80-\u0BFF]/;
  const spanishPattern = /[áéíóúñ¿¡]/i;
  
  if (hindiPattern.test(text)) return 'hi';
  if (tamilPattern.test(text)) return 'ta';
  if (spanishPattern.test(text)) return 'es';
  return 'en';
}

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
      preferredTopics: new Set(),
      preferredLanguage: 'en'
    };

    if (data.legalArea) profile.preferredTopics.add(data.legalArea);
    if (data.name) profile.name = data.name;
    if (data.language) profile.preferredLanguage = data.language;
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
    const lang = profile?.preferredLanguage || 'en';
    
    const greetings = {
      en: {
        welcome: `Welcome back${profile?.name ? `, ${profile.name}` : ''}!`,
        continuing: `I see we were discussing ${history.lastTopic}. Would you like to continue, or is there something new I can help you with?`,
        fresh: `I'm here to help with any legal questions you have.`,
        timed: `It's been ${minutes} minutes. How can I assist you with your legal matters today?`
      },
      hi: {
        welcome: `वापस आपका स्वागत है${profile?.name ? `, ${profile.name}` : ''}!`,
        continuing: `मैं देख रहा हूं कि हम ${history.lastTopic} पर चर्चा कर रहे थे। क्या आप जारी रखना चाहेंगे, या कुछ नया है जिसमें मैं मदद कर सकता हूं?`,
        fresh: `मैं किसी भी कानूनी प्रश्न में आपकी सहायता के लिए यहां हूं।`,
        timed: `${minutes} मिनट हो गए हैं। आज मैं आपके कानूनी मामलों में कैसे सहायता कर सकता हूं?`
      },
      ta: {
        welcome: `மீண்டும் வரவேற்கிறோம்${profile?.name ? `, ${profile.name}` : ''}!`,
        continuing: `நாம் ${history.lastTopic} பற்றி விவாதித்துக் கொண்டிருந்தோம் என்று பார்க்கிறேன். தொடர விரும்புகிறீர்களா, அல்லது நான் உதவக்கூடிய புதிய ஏதாவது உள்ளதா?`,
        fresh: `எந்தவொரு சட்ட கேள்விகளுக்கும் உதவ நான் இங்கே இருக்கிறேன்.`,
        timed: `${minutes} நிமிடங்கள் ஆகிவிட்டன. இன்று உங்கள் சட்ட விஷயங்களில் நான் எவ்வாறு உதவ முடியும்?`
      },
      es: {
        welcome: `¡Bienvenido de nuevo${profile?.name ? `, ${profile.name}` : ''}!`,
        continuing: `Veo que estábamos discutiendo ${history.lastTopic}. ¿Le gustaría continuar, o hay algo nuevo en lo que pueda ayudarle?`,
        fresh: `Estoy aquí para ayudarle con cualquier pregunta legal que tenga.`,
        timed: `Han pasado ${minutes} minutos. ¿Cómo puedo asistirle con sus asuntos legales hoy?`
      }
    };
    
    let greeting = greetings[lang].welcome + ' ';

    if (history.lastTopic) {
      greeting += greetings[lang].continuing;
    } else if (minutes < 5) {
      greeting += greetings[lang].fresh;
    } else {
      greeting += greetings[lang].timed;
    }

    return greeting;
  }

  async processAgentic(message, sessionId, contextData = {}) {
    const detectedLang = detectLanguage(message);
    const profile = this.updateUserProfile(sessionId, { 
      ...contextData, 
      language: detectedLang 
    });
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

    // Add language instruction
    const languageInstruction = detectedLang !== 'en' 
      ? `\n\nIMPORTANT: User is communicating in ${this.getLanguageName(detectedLang)}. Respond in the same language naturally and fluently.`
      : '';

    return await this.sendToBackend({
      message: message + contextPrompt,
      sessionId,
      aiMode: 'agentic',
      systemPrompt: `You are Advocate Arjun, an advanced multilingual legal AI assistant at FoxMandal. ${profile.name ? `The user's name is ${profile.name}.` : ''} This is interaction #${profile.interactionCount}.${languageInstruction}

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
- Keep responses focused, practical, under 400 words
- Respond in user's language (${this.getLanguageName(detectedLang)})`,
      temperature: 0.4,
      maxTokens: 500
    });
  }

  getLanguageName(code) {
    const languages = {
      'en': 'English',
      'hi': 'Hindi',
      'ta': 'Tamil',
      'es': 'Spanish'
    };
    return languages[code] || 'English';
  }

  async generateIntroduction(sessionId, isReturning = false, language = 'en') {
    const profile = this.userPreferences.get(sessionId);
    
    if (isReturning && profile) {
      const topics = Array.from(profile.preferredTopics).join(' and ');
      const greetings = {
        en: `Welcome back${profile.name ? `, ${profile.name}` : ''}! I remember we've discussed ${topics} before. I'm Advocate Arjun, your AI legal assistant from FoxMandal. I'm here to help you with any legal questions. What's on your mind today?`,
        hi: `वापस आपका स्वागत है${profile.name ? `, ${profile.name}` : ''}! मुझे याद है हमने ${topics} पर चर्चा की थी। मैं एडवोकेट अर्जुन हूं, FoxMandal से आपका AI कानूनी सहायक। मैं किसी भी कानूनी प्रश्न में आपकी सहायता के लिए यहां हूं। आज आपके मन में क्या है?`,
        ta: `மீண்டும் வரவேற்கிறோம்${profile.name ? `, ${profile.name}` : ''}! நாம் ${topics} பற்றி விவாதித்தோம் என்று எனக்கு நினைவிருக்கிறது। நான் அட்வகேட் அர்ஜுன், FoxMandal இலிருந்து உங்கள் AI சட்ட உதவியாளர். எந்தவொரு சட்ட கேள்விகளுக்கும் உதவ நான் இங்கே இருக்கிறேன். இன்று உங்கள் மனதில் என்ன இருக்கிறது?`,
        es: `¡Bienvenido de nuevo${profile.name ? `, ${profile.name}` : ''}! Recuerdo que hemos discutido ${topics} antes. Soy el Abogado Arjun, su asistente legal de IA de FoxMandal. Estoy aquí para ayudarle con cualquier pregunta legal. ¿Qué tiene en mente hoy?`
      };
      return greetings[language] || greetings['en'];
    }

    return await this.sendToBackend({
      message: `Introduce yourself warmly as Advocate Arjun, an intelligent legal AI assistant. Be personable, professional, and encourage questions. Respond in ${this.getLanguageName(language)}.`,
      sessionId,
      aiMode: 'agentic',
      systemPrompt: `You are Advocate Arjun from FoxMandal. Introduce yourself naturally in ${this.getLanguageName(language)}:
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
      'contract': ['contract', 'agreement', 'terms', 'अनुबंध', 'ஒப்பந்தம்', 'contrato'],
      'employment': ['employment', 'job', 'workplace', 'termination', 'रोजगार', 'வேலை', 'empleo'],
      'property': ['property', 'real estate', 'land', 'lease', 'संपत्ति', 'சொத்து', 'propiedad'],
      'taxation': ['tax', 'gst', 'income tax', 'कर', 'வரி', 'impuesto'],
      'corporate': ['company', 'business', 'corporate', 'कंपनी', 'நிறுவனம்', 'empresa'],
      'litigation': ['court', 'lawsuit', 'legal action', 'अदालत', 'நீதிமன்றம்', 'tribunal']
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
  const detectedLang = detectLanguage(sanitizedMessage);

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
      contextRetained: true,
      detectedLanguage: detectedLang
    };

  } catch (error) {
    console.error('AI processing error:', error);
    
    const errorMessages = {
      en: `I apologize for the technical difficulty. Let me try to help you anyway - could you rephrase your legal question?`,
      hi: `तकनीकी कठिनाई के लिए मुझे खेद है। फिर भी मुझे आपकी मदद करने दें - क्या आप अपना कानूनी प्रश्न दोबारा बता सकते हैं?`,
      ta: `தொழில்நுட்ப சிரமத்திற்கு மன்னிக்கவும். எப்படியும் உங்களுக்கு உதவ முயற்சிக்கிறேன் - உங்கள் சட்ட கேள்வியை மறுபடி கூற முடியுமா?`,
      es: `Disculpe la dificultad técnica. Déjeme intentar ayudarle de todos modos - ¿podría reformular su pregunta legal?`
    };
    
    return {
      reply: errorMessages[detectedLang] || errorMessages['en'],
      aiMode: 'agentic',
      sessionId: session,
      processingType: 'error',
      confidence: 0.3,
      detectedLanguage: detectedLang
    };
  }
};

export const generateAIIntroduction = async (sessionId, language = 'en') => {
  const profile = aiProcessor.userPreferences.get(sessionId);
  const isReturning = profile && profile.interactionCount > 0;
  return await aiProcessor.generateIntroduction(sessionId, isReturning, language);
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
          
          // Detect language for TTS voice selection
          const detectedLang = detectLanguage(text);
          const langCode = detectedLang === 'hi' ? 'hi-IN' : 
                          detectedLang === 'ta' ? 'ta-IN' : 
                          detectedLang === 'es' ? 'es-ES' : 'en-US';
          
          const appropriateVoice = voices.find(voice => voice.lang.startsWith(langCode.split('-')[0]));
          
          if (appropriateVoice) {
            utterance.voice = appropriateVoice;
            utterance.lang = langCode;
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

console.log('Multilingual AI System loaded successfully with backend:', API_BASE_URL);