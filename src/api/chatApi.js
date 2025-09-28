// src/api/chatApi.js - Enhanced for Agentic AI, AGI, ASI Support
const API_BASE_URL = 'https://character-chan.onrender.com';

// Enhanced client configuration with AI modes
const CLIENT_CONFIG = {
  foxmandal: {
    endpoint: '/chat',
    assistantName: 'Advocate Arjun', // Fixed from 'Adv. Arjun'
    industry: 'legal',
    leadEndpoint: '/capture-lead'
  }
};

const currentClient = 'foxmandal';
const config = CLIENT_CONFIG[currentClient];

// Enhanced sendMessage with AI mode support
export const sendMessage = async (message, sessionId = null, aiMode = 'standard') => {
  if (!message || typeof message !== 'string') {
    throw new Error('Message is required and must be a string');
  }

  try {
    const response = await fetch(`${API_BASE_URL}${config.endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        message: message.trim(),
        sessionId: sessionId || generateSessionId(aiMode),
        aiMode: aiMode,
        timestamp: Date.now()
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API Error:', response.status, errorText);
      
      if (response.status === 429) {
        throw new Error('Too many requests. Please wait a moment and try again.');
      } else if (response.status >= 500) {
        throw new Error('Server temporarily unavailable. Please try again.');
      } else {
        throw new Error(`API Error: ${response.status}`);
      }
    }

    const data = await response.json();
    
    return {
      reply: data.reply || data.message || 'I apologize, but I encountered an issue processing your request.',
      userProfile: data.userProfile || {},
      aiMode: aiMode
    };
    
  } catch (error) {
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      throw new Error(`Unable to connect to ${config.assistantName}. Please check your connection and try again.`);
    }
    throw error;
  }
};

// Enhanced lead capture with AI mode context
export const captureLead = async (leadData, sessionId, aiMode = 'standard') => {
  try {
    const response = await fetch(`${API_BASE_URL}${config.leadEndpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...leadData,
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

// Enhanced TTS with AI mode-specific settings and pronunciation fixes
export const getTTS = async (text, aiMode = 'standard') => {
  return new Promise((resolve) => {
    if (!text || !window.speechSynthesis) {
      resolve();
      return;
    }

    try {
      // Cancel any ongoing speech first
      window.speechSynthesis.cancel();
      
      // Wait a moment for cancellation to complete
      setTimeout(() => {
        // Enhanced pronunciation fixes
        let processedText = text
          .replace(/Adv\./g, 'Advocate')
          .replace(/FoxMandal/g, 'FoxMandal')
          .replace(/SEBI/g, 'S-E-B-I')
          .replace(/NCLT/g, 'N-C-L-T')
          .replace(/NCLAT/g, 'N-C-L-A-T')
          .replace(/FEMA/g, 'F-E-M-A')
          .replace(/GST/g, 'G-S-T')
          .replace(/RERA/g, 'R-E-R-A')
          .replace(/IP/g, 'Intellectual Property')
          .replace(/\b(vs?\.?)\b/gi, 'versus')
          .replace(/Ltd\./g, 'Limited')
          .replace(/Pvt\./g, 'Private')
          // AI-specific pronunciation fixes
          .replace(/AGI/g, 'A-G-I')
          .replace(/ASI/g, 'A-S-I')
          .replace(/AI/g, 'A-I');

        const utterance = new SpeechSynthesisUtterance(processedText);
        
        // AI mode-specific voice settings
        switch(aiMode) {
          case 'asi':
            utterance.rate = 0.7;   // Slower, more authoritative
            utterance.pitch = 0.7;  // Deeper voice
            utterance.volume = 0.95;
            break;
          case 'agi':
            utterance.rate = 0.8;   // Measured pace
            utterance.pitch = 0.8;  // Professional tone
            utterance.volume = 0.9;
            break;
          case 'agentic':
            utterance.rate = 0.85;  // Confident delivery
            utterance.pitch = 0.9;  // Clear tone
            utterance.volume = 0.9;
            break;
          default: // standard
            utterance.rate = 0.85;
            utterance.pitch = 0.9;
            utterance.volume = 0.9;
        }
        
        utterance.lang = 'en-IN'; // Indian English preference
        
        const setVoiceAndSpeak = () => {
          const voices = window.speechSynthesis.getVoices();
          
          // Enhanced voice selection with AI mode preferences
          let preferredVoice;
          
          if (aiMode === 'asi' || aiMode === 'agi') {
            // Prefer deeper, more authoritative voices for advanced AI
            preferredVoice = voices.find(voice => 
              voice.lang === 'en-GB' && voice.name.includes('Google')
            );
          }
          
          if (!preferredVoice) {
            // Fallback to standard selection
            preferredVoice = voices.find(voice => 
              voice.lang === 'en-IN' && voice.name.includes('Google')
            ) || voices.find(voice => 
              voice.lang === 'en-GB' && voice.name.includes('Google')
            ) || voices.find(voice => 
              voice.lang.startsWith('en') && 
              (voice.name.includes('Google') || voice.name.includes('Microsoft'))
            ) || voices.find(voice => voice.lang.startsWith('en'));
          }
          
          if (preferredVoice) {
            utterance.voice = preferredVoice;
            console.log(`TTS using voice: ${preferredVoice.name} for ${aiMode} mode`);
          }

          let speechStarted = false;
          let speechEnded = false;

          utterance.onstart = () => {
            speechStarted = true;
            console.log(`TTS started (${aiMode} mode):`, processedText.substring(0, 50) + '...');
          };

          utterance.onend = () => {
            if (!speechEnded) {
              speechEnded = true;
              console.log(`TTS completed (${aiMode} mode)`);
              resolve();
            }
          };

          utterance.onerror = (event) => {
            console.warn('TTS Error:', event.error);
            if (!speechEnded) {
              speechEnded = true;
              resolve(); // Don't block on TTS errors
            }
          };

          // Dynamic timeout based on AI mode (complex responses need more time)
          const baseDuration = Math.max(10000, processedText.length * 100);
          const modeDuration = aiMode === 'asi' ? baseDuration * 1.5 : 
                              aiMode === 'agi' ? baseDuration * 1.3 :
                              aiMode === 'agentic' ? baseDuration * 1.2 :
                              baseDuration;
          
          const timeoutId = setTimeout(() => {
            if (!speechEnded) {
              console.warn(`TTS timeout reached for ${aiMode} mode, cancelling speech`);
              window.speechSynthesis.cancel();
              speechEnded = true;
              resolve();
            }
          }, modeDuration);

          const originalOnEnd = utterance.onend;
          utterance.onend = () => {
            clearTimeout(timeoutId);
            originalOnEnd();
          };

          // Start speaking
          window.speechSynthesis.speak(utterance);
          
          // Check if speech started
          setTimeout(() => {
            if (!speechStarted && !window.speechSynthesis.speaking) {
              console.warn(`TTS failed to start for ${aiMode} mode`);
              speechEnded = true;
              resolve();
            }
          }, 1000);
        };

        // Handle voice loading
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
      console.warn('TTS setup error:', error);
      resolve();
    }
  });
};

// Enhanced TTS control functions
export const stopTTS = () => {
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
    console.log('TTS stopped');
  }
};

export const pauseTTS = () => {
  if (window.speechSynthesis && window.speechSynthesis.speaking) {
    window.speechSynthesis.pause();
    console.log('TTS paused');
  }
};

export const resumeTTS = () => {
  if (window.speechSynthesis && window.speechSynthesis.paused) {
    window.speechSynthesis.resume();
    console.log('TTS resumed');
  }
};

// Enhanced health check with AI capabilities
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

// Enhanced session ID generation with AI mode
function generateSessionId(aiMode = 'standard') {
  return `session_foxmandal_${aiMode}_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

// AI mode configurations
export const AI_MODES = {
  standard: {
    name: 'Standard AI',
    description: 'Traditional legal consultation with Fox Mandal expertise',
    capabilities: ['legal_consultation', 'document_review', 'compliance_check'],
    icon: '⚖️',
    color: '#1e40af'
  },
  agentic: {
    name: 'Agentic AI',
    description: 'Autonomous legal agent with independent research capabilities',
    capabilities: ['autonomous_research', 'multi_step_planning', 'independent_analysis'],
    icon: '🔬',
    color: '#b87333'
  },
  agi: {
    name: 'AGI',
    description: 'General intelligence across legal, business, and technical domains',
    capabilities: ['cross_domain_analysis', 'holistic_reasoning', 'integrated_solutions'],
    icon: '🤖',
    color: '#1976d2'
  },
  asi: {
    name: 'ASI',
    description: 'Superintelligence with predictive modeling and quantum processing',
    capabilities: ['predictive_modeling', 'quantum_analysis', 'scenario_mapping'],
    icon: '🧠',
    color: '#4a4af5'
  }
};

// Get AI mode configuration
export const getModeConfig = (mode) => {
  return AI_MODES[mode] || AI_MODES.standard;
};

// Validate AI mode
export const isValidMode = (mode) => {
  return Object.keys(AI_MODES).includes(mode);
};

// Enhanced configuration with AI mode support
export const getCurrentConfig = (aiMode = 'standard') => ({
  ...config,
  client: currentClient,
  apiUrl: API_BASE_URL,
  aiMode,
  modeConfig: getModeConfig(aiMode)
});

// Local AI processing for client-side capabilities
export class LocalAIProcessor {
  static classifyLegalArea(message) {
    const lowerMessage = message.toLowerCase();
    const areas = {
      'corporate_law': ['company', 'business', 'corporate', 'merger', 'acquisition'],
      'litigation': ['court', 'case', 'lawsuit', 'dispute', 'sue'],
      'contracts': ['contract', 'agreement', 'terms', 'breach'],
      'intellectual_property': ['trademark', 'patent', 'copyright', 'ip'],
      'employment_law': ['employee', 'termination', 'workplace', 'labor'],
      'real_estate': ['property', 'real estate', 'land', 'lease']
    };
    
    for (const [area, keywords] of Object.entries(areas)) {
      if (keywords.some(keyword => lowerMessage.includes(keyword))) {
        return area;
      }
    }
    return 'general_legal';
  }
  
  static assessUrgency(message) {
    const urgentKeywords = ['urgent', 'asap', 'emergency', 'deadline', 'court date'];
    return urgentKeywords.some(keyword => 
      message.toLowerCase().includes(keyword)
    ) ? 'high' : 'medium';
  }
}

// API endpoints for reference
export const API_ENDPOINTS = {
  chat: `${API_BASE_URL}/chat`,
  health: `${API_BASE_URL}/health`,
  captureLead: `${API_BASE_URL}/capture-lead`,
  analytics: `${API_BASE_URL}/legal-analytics`
};

console.log('Enhanced chatApi.js loaded with Agentic AI, AGI, ASI support');