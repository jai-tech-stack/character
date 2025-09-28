// Complete chatApi.js - Replace your existing file with this complete version
// Includes: Real AI modes, Security, Male voice fix, Responsive support

const API_BASE_URL = 'https://character-chan.onrender.com';

console.log('Loading secure FoxMandal AI API...');

// ===== SECURITY FUNCTIONS =====

// Input sanitization
export function sanitizeInput(userInput) {
  if (!userInput || typeof userInput !== 'string') {
    return '';
  }
  
  return userInput
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/[<>\"'%;()&+]/g, '')
    .substring(0, 2000)
    .trim();
}

// Rate limiting
class RateLimiter {
  constructor(maxRequests = 15, timeWindow = 60000) {
    this.requests = new Map();
    this.maxRequests = maxRequests;
    this.timeWindow = timeWindow;
  }
  
  isAllowed(identifier = 'default') {
    const now = Date.now();
    const userRequests = this.requests.get(identifier) || [];
    
    const validRequests = userRequests.filter(time => now - time < this.timeWindow);
    
    if (validRequests.length >= this.maxRequests) {
      return false;
    }
    
    validRequests.push(now);
    this.requests.set(identifier, validRequests);
    return true;
  }
}

const rateLimiter = new RateLimiter(15, 60000);

// Suspicious pattern detection
function containsSuspiciousPatterns(message) {
  const suspiciousPatterns = [
    /ignore\s+previous\s+instructions/i,
    /forget\s+everything/i,
    /you\s+are\s+now/i,
    /system\s*:\s*/i,
    /admin\s+mode/i,
    /javascript:/i,
    /eval\(/i,
    /union\s+select/i,
    /drop\s+table/i,
    /'; --/,
    /on\w+\s*=/i,
    /<script/i
  ];
  
  return suspiciousPatterns.some(pattern => pattern.test(message));
}

// ===== REAL AI MODE SYSTEM =====

// Create mode-specific prompts for genuine AI differentiation
function createModeSpecificPrompt(message, aiMode) {
  switch(aiMode) {
    case 'agentic':
      return {
        systemPrompt: `You are an autonomous legal agent at FoxMandal law firm. You must:
1. Break down legal queries into specific research tasks
2. Identify what legal research you would perform step-by-step
3. Explain your autonomous reasoning process clearly
4. Provide specific actionable recommendations
5. Suggest follow-up actions you would take independently

Show actual methodical thinking and autonomous decision-making, not generic responses.`,
        enhancedMessage: `As an autonomous legal agent, analyze this query using step-by-step reasoning: ${message}`,
        temperature: 0.3,
        maxTokens: 300,
        processingType: 'autonomous_analysis'
      };

    case 'agi':
      return {
        systemPrompt: `You are a general intelligence system at FoxMandal analyzing legal matters across multiple domains. You must:
1. Analyze legal aspects (Indian laws, regulations, precedents)
2. Consider business implications (costs, risks, opportunities)
3. Evaluate technical/procedural requirements
4. Assess ethical considerations and stakeholder impacts
5. Provide integrated cross-domain recommendations

Show actual cross-domain thinking with specific insights from each area.`,
        enhancedMessage: `Analyze this from legal, business, technical, and ethical perspectives: ${message}`,
        temperature: 0.4,
        maxTokens: 400,
        processingType: 'cross_domain_analysis'
      };

    case 'asi':
      return {
        systemPrompt: `You are an advanced intelligence system with sophisticated analytical capabilities. You must:
1. Perform deep multi-layered analysis of the legal query
2. Consider long-term implications (3-5 year projections)
3. Identify non-obvious connections and patterns in Indian legal system
4. Provide probabilistic assessments of legal outcomes
5. Suggest optimal strategies with quantified risk analysis

Show advanced reasoning with specific probability assessments and strategic insights.`,
        enhancedMessage: `Provide deep analysis with probability assessments and long-term projections: ${message}`,
        temperature: 0.2,
        maxTokens: 500,
        processingType: 'advanced_analysis'
      };

    default: // standard
      return {
        systemPrompt: `You are Advocate Arjun, a senior legal consultant at FoxMandal law firm in India. Provide helpful, accurate legal guidance while always recommending professional consultation for specific cases. Focus on Indian law and FoxMandal's expertise.`,
        enhancedMessage: message,
        temperature: 0.5,
        maxTokens: 200,
        processingType: 'standard_consultation'
      };
  }
}

// ===== CONVERSATION MANAGEMENT =====

export class ConversationManager {
  constructor() {
    this.conversations = new Map();
  }
  
  updateConversation(sessionId, message, response, aiMode) {
    if (!this.conversations.has(sessionId)) {
      this.conversations.set(sessionId, {
        messages: [],
        context: {},
        aiMode: aiMode,
        startTime: Date.now()
      });
    }
    
    const conversation = this.conversations.get(sessionId);
    conversation.messages.push({
      user: message,
      assistant: response,
      timestamp: Date.now(),
      mode: aiMode
    });
    
    conversation.context = this.buildContext(conversation.messages, aiMode);
  }
  
  buildContext(messages, aiMode) {
    const recentMessages = messages.slice(-3);
    
    switch(aiMode) {
      case 'agentic':
        return {
          actionsTaken: this.extractActions(recentMessages),
          researchAreas: this.identifyResearchAreas(recentMessages)
        };
      case 'agi':
        return {
          legalAspects: this.extractLegalPoints(recentMessages),
          businessImplications: this.extractBusinessPoints(recentMessages)
        };
      case 'asi':
        return {
          complexityLevel: this.assessComplexity(recentMessages),
          riskFactors: this.identifyRisks(recentMessages)
        };
      default:
        return {
          legalArea: this.identifyLegalArea(recentMessages)
        };
    }
  }
  
  extractActions(messages) {
    const actions = new Set();
    messages.forEach(msg => {
      if (msg.assistant.toLowerCase().includes('research')) actions.add('legal_research');
      if (msg.assistant.toLowerCase().includes('analyze')) actions.add('analysis');
      if (msg.assistant.toLowerCase().includes('review')) actions.add('document_review');
    });
    return Array.from(actions);
  }
  
  identifyResearchAreas(messages) {
    const areas = new Set();
    const content = messages.map(m => m.user).join(' ').toLowerCase();
    if (content.includes('contract')) areas.add('contract_law');
    if (content.includes('corporate')) areas.add('corporate_law');
    if (content.includes('litigation')) areas.add('litigation');
    return Array.from(areas);
  }
  
  extractLegalPoints(messages) {
    return messages
      .map(msg => msg.assistant.match(/\b(law|legal|regulation|statute|act|section)\b/gi))
      .filter(Boolean)
      .flat()
      .slice(0, 5);
  }
  
  extractBusinessPoints(messages) {
    return messages
      .map(msg => msg.assistant.match(/\b(business|commercial|cost|revenue|profit|risk)\b/gi))
      .filter(Boolean)
      .flat()
      .slice(0, 5);
  }
  
  assessComplexity(messages) {
    const indicators = ['multiple', 'complex', 'international', 'precedent'];
    const content = messages.map(m => m.user).join(' ').toLowerCase();
    const matches = indicators.filter(indicator => content.includes(indicator));
    return matches.length > 1 ? 'high' : 'medium';
  }
  
  identifyRisks(messages) {
    const risks = [];
    const content = messages.map(m => m.user).join(' ').toLowerCase();
    if (content.includes('urgent') || content.includes('deadline')) {
      risks.push('time-sensitive');
    }
    if (content.includes('court') || content.includes('litigation')) {
      risks.push('litigation-risk');
    }
    return risks;
  }
  
  identifyLegalArea(messages) {
    const content = messages.map(m => m.user).join(' ').toLowerCase();
    if (content.includes('contract')) return 'contract_law';
    if (content.includes('corporate')) return 'corporate_law';
    if (content.includes('property')) return 'real_estate';
    return 'general_legal';
  }
  
  getContext(sessionId) {
    return this.conversations.get(sessionId)?.context || {};
  }
}

const conversationManager = new ConversationManager();

// ===== MAIN API FUNCTIONS =====

// Enhanced secure sendMessage with real AI modes
export const sendMessage = async (message, sessionId = null, aiMode = 'standard') => {
  if (!message || typeof message !== 'string') {
    throw new Error('Message is required and must be a string');
  }

  const clientId = sessionId || 'anonymous';
  if (!rateLimiter.isAllowed(clientId)) {
    throw new Error('Too many requests. Please wait before sending another message.');
  }

  const sanitizedMessage = sanitizeInput(message);
  
  if (sanitizedMessage.length < 1) {
    throw new Error('Invalid message content');
  }

  if (containsSuspiciousPatterns(sanitizedMessage)) {
    throw new Error('Message contains potentially harmful content');
  }

  try {
    const modePrompts = createModeSpecificPrompt(sanitizedMessage, aiMode);
    
    const response = await fetch(`${API_BASE_URL}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-ID': sessionId || generateSessionId(aiMode),
      },
      body: JSON.stringify({ 
        message: modePrompts.enhancedMessage,
        sessionId: sessionId || generateSessionId(aiMode),
        aiMode,
        systemPrompt: modePrompts.systemPrompt,
        temperature: modePrompts.temperature,
        maxTokens: modePrompts.maxTokens,
        timestamp: Date.now()
      })
    });

    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.reply || typeof data.reply !== 'string') {
      throw new Error('Invalid response from server');
    }
    
    // Update conversation context
    conversationManager.updateConversation(
      sessionId || generateSessionId(aiMode), 
      sanitizedMessage, 
      data.reply, 
      aiMode
    );
    
    return {
      reply: data.reply,
      userProfile: data.userProfile || {},
      aiMode,
      confidence: data.confidence || 0.8,
      processingType: modePrompts.processingType
    };
    
  } catch (error) {
    console.error('sendMessage error:', error);
    throw error;
  }
};

// Enhanced lead capture with security and AI mode context
export const captureLead = async (leadData, sessionId, aiMode = 'standard') => {
  if (!leadData.name || !leadData.email) {
    throw new Error('Name and email are required');
  }
  
  // Sanitize lead data
  const sanitizedData = {
    name: sanitizeInput(leadData.name),
    email: leadData.email.trim().toLowerCase(),
    phone: leadData.phone ? sanitizeInput(leadData.phone) : '',
    message: leadData.message ? sanitizeInput(leadData.message) : '',
    legalArea: leadData.legalArea || 'general',
    urgency: leadData.urgency || 'medium'
  };
  
  try {
    const response = await fetch(`${API_BASE_URL}/capture-lead`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...sanitizedData,
        sessionId,
        aiMode,
        timestamp: new Date().toISOString(),
        source: `foxmandal_${aiMode}_ai`
      })
    });

    if (!response.ok) {
      throw new Error(`Lead capture failed: ${response.status}`);
    }

    return await response.json();
    
  } catch (error) {
    console.error('Lead capture error:', error);
    throw new Error('Failed to submit your information. Please try again.');
  }
};

// ===== ENHANCED TTS WITH MALE VOICE AND SECURITY =====

export const getTTS = async (text, aiMode = 'standard') => {
  return new Promise((resolve) => {
    if (!text || !window.speechSynthesis) {
      resolve();
      return;
    }

    try {
      window.speechSynthesis.cancel();
      
      setTimeout(() => {
        let processedText = text
          .replace(/Adv\./g, 'Advocate')
          .replace(/FoxMandal/g, 'FoxMandal')
          .replace(/AGI/g, 'A-G-I')
          .replace(/ASI/g, 'A-S-I')
          .replace(/AI/g, 'A-I')
          .replace(/SEBI/g, 'S-E-B-I')
          .replace(/GST/g, 'G-S-T')
          .replace(/\./g, '. ')
          .replace(/:/g, ': ')
          .substring(0, 1000); // Security limit

        const utterance = new SpeechSynthesisUtterance(processedText);
        
        const setVoiceAndSpeak = () => {
          const voices = window.speechSynthesis.getVoices();
          
          // FORCE MALE VOICE SELECTION
          const maleVoice = voices.find(voice => 
            voice.lang.startsWith('en') && (
              voice.name.toLowerCase().includes('male') ||
              voice.name.toLowerCase().includes('david') ||
              voice.name.toLowerCase().includes('daniel') ||
              voice.name.toLowerCase().includes('mark') ||
              voice.name.toLowerCase().includes('james') ||
              (voice.name.includes('Google') && 
               !voice.name.toLowerCase().includes('female') &&
               !voice.name.toLowerCase().includes('karen') &&
               !voice.name.toLowerCase().includes('susan'))
            )
          ) || voices.find(voice => 
            voice.lang.startsWith('en') && voice.name.includes('Google')
          ) || voices.find(voice => voice.lang.startsWith('en'));
          
          if (maleVoice) {
            utterance.voice = maleVoice;
            console.log(`Selected male voice: ${maleVoice.name} for ${aiMode} mode`);
          }

          // Mode-specific voice settings
          switch(aiMode) {
            case 'asi':
              utterance.rate = 0.75;
              utterance.pitch = 0.6;
              utterance.volume = 0.95;
              break;
            case 'agi':
              utterance.rate = 0.8;
              utterance.pitch = 0.7;
              utterance.volume = 0.9;
              break;
            case 'agentic':
              utterance.rate = 0.85;
              utterance.pitch = 0.8;
              utterance.volume = 0.9;
              break;
            default:
              utterance.rate = 0.9;
              utterance.pitch = 0.85;
              utterance.volume = 0.85;
          }

          let speechEnded = false;
          
          utterance.onstart = () => {
            console.log(`TTS started (${aiMode} mode)`);
          };
          
          utterance.onend = () => {
            if (!speechEnded) {
              speechEnded = true;
              resolve();
            }
          };

          utterance.onerror = () => {
            if (!speechEnded) {
              speechEnded = true;
              resolve();
            }
          };

          window.speechSynthesis.speak(utterance);
          
          const timeout = Math.max(8000, processedText.length * (aiMode === 'asi' ? 120 : 80));
          setTimeout(() => {
            if (!speechEnded) {
              window.speechSynthesis.cancel();
              speechEnded = true;
              resolve();
            }
          }, timeout);
        };

        if (window.speechSynthesis.getVoices().length === 0) {
          window.speechSynthesis.onvoiceschanged = () => {
            window.speechSynthesis.onvoiceschanged = null;
            setVoiceAndSpeak();
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

// TTS control functions
export const stopTTS = () => {
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
};

export const pauseTTS = () => {
  if (window.speechSynthesis && window.speechSynthesis.speaking) {
    window.speechSynthesis.pause();
  }
};

export const resumeTTS = () => {
  if (window.speechSynthesis && window.speechSynthesis.paused) {
    window.speechSynthesis.resume();
  }
};

// ===== UTILITY FUNCTIONS =====

export const checkHealth = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/health`);
    const data = await response.json();
    
    return {
      status: response.ok ? 'healthy' : 'unhealthy',
      details: data,
      aiCapabilities: {
        standard: true,
        agentic: data.services?.openai && data.services?.pinecone,
        agi: data.services?.openai,
        asi: data.services?.openai,
        tts: 'speechSynthesis' in window
      }
    };
  } catch (error) {
    return {
      status: 'unreachable',
      details: { error: error.message },
      aiCapabilities: {
        standard: false,
        agentic: false,
        agi: false,
        asi: false,
        tts: 'speechSynthesis' in window
      }
    };
  }
};

function generateSessionId(aiMode = 'standard') {
  return `session_foxmandal_${aiMode}_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

export const AI_MODES = {
  standard: {
    name: 'Standard AI',
    description: 'Traditional legal consultation with FoxMandal expertise',
    capabilities: ['legal_consultation', 'document_review', 'compliance_check'],
    icon: '⚖️',
    color: '#1e40af'
  },
  agentic: {
    name: 'Agentic AI',
    description: 'Autonomous legal agent with step-by-step reasoning',
    capabilities: ['autonomous_research', 'step_by_step_analysis', 'independent_planning'],
    icon: '🔬',
    color: '#b87333'
  },
  agi: {
    name: 'AGI',
    description: 'Cross-domain intelligence analyzing legal, business, and technical aspects',
    capabilities: ['cross_domain_analysis', 'holistic_reasoning', 'integrated_solutions'],
    icon: '🤖',
    color: '#1976d2'
  },
  asi: {
    name: 'ASI',
    description: 'Advanced intelligence with probabilistic analysis and long-term projections',
    capabilities: ['probabilistic_modeling', 'advanced_analysis', 'strategic_projections'],
    icon: '🧠',
    color: '#4a4af5'
  }
};

export const getModeConfig = (mode) => {
  return AI_MODES[mode] || AI_MODES.standard;
};

// Device optimization
export class DeviceOptimizer {
  static isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }
  
  static isTablet() {
    return /iPad|Android(?!.*Mobile)/i.test(navigator.userAgent);
  }
  
  static isTouchDevice() {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  }
  
  static getOptimalSettings() {
    const isMobile = this.isMobile();
    
    return {
      pixelRatio: Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2),
      antialias: !isMobile,
      shadows: !isMobile,
      animationSpeed: isMobile ? 0.5 : 1,
      particleCount: isMobile ? 25 : 50,
      touchFriendly: this.isTouchDevice(),
      voiceTimeout: isMobile ? 20000 : 15000
    };
  }
}

// Initialize male voice preference on load
if (typeof window !== 'undefined') {
  const initializeMaleVoice = () => {
    const voices = window.speechSynthesis.getVoices();
    console.log('Initializing male voice preference...');
    
    const maleVoice = voices.find(voice => 
      voice.lang.startsWith('en') && (
        voice.name.toLowerCase().includes('male') ||
        voice.name.toLowerCase().includes('david') ||
        (voice.name.includes('Google') && !voice.name.toLowerCase().includes('female'))
      )
    );
    
    if (maleVoice) {
      window.preferredMaleVoice = maleVoice;
      console.log('Male voice preference set:', maleVoice.name);
    }
  };
  
  if (window.speechSynthesis.getVoices().length === 0) {
    window.speechSynthesis.onvoiceschanged = () => {
      initializeMaleVoice();
      window.speechSynthesis.onvoiceschanged = null;
    };
  } else {
    initializeMaleVoice();
  }
}

export { conversationManager };

console.log('FoxMandal AI API loaded with real AI modes, security, and male voice preference');