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
// Responsive Design & Voice Gender Fix Solutions

// 1. VOICE GENDER FIX - Force Male Voice Selection
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
          .replace(/Fox Mandal/g, 'Fox Mandal'); // Keep original pronunciation

        const utterance = new SpeechSynthesisUtterance(processedText);
        
        // VOICE GENDER SELECTION - PREFER MALE VOICES
        const setVoiceAndSpeak = () => {
          const voices = window.speechSynthesis.getVoices();
          console.log('Available voices:', voices.map(v => ({ name: v.name, lang: v.lang, gender: v.name })));
          
          // PRIORITY: Male voices for professional legal consultation
          const maleVoice = voices.find(voice => 
            voice.lang.startsWith('en') && (
              voice.name.toLowerCase().includes('male') ||
              voice.name.toLowerCase().includes('david') ||
              voice.name.toLowerCase().includes('mark') ||
              voice.name.toLowerCase().includes('daniel') ||
              voice.name.toLowerCase().includes('james') ||
              voice.name.toLowerCase().includes('alex') ||
              voice.name.toLowerCase().includes('ryan') ||
              // Google male voices
              (voice.name.includes('Google') && 
               !voice.name.toLowerCase().includes('female') &&
               !voice.name.toLowerCase().includes('karen') &&
               !voice.name.toLowerCase().includes('susan') &&
               !voice.name.toLowerCase().includes('victoria'))
            )
          );

          // Fallback to any English voice if no clear male voice found
          const fallbackVoice = maleVoice || voices.find(voice => 
            voice.lang.startsWith('en') && voice.name.includes('Google')
          ) || voices.find(voice => voice.lang.startsWith('en'));
          
          if (fallbackVoice) {
            utterance.voice = fallbackVoice;
            console.log('Selected voice:', fallbackVoice.name, 'for', aiMode, 'mode');
          }

          // Mode-specific settings with professional male tone
          switch(aiMode) {
            case 'asi':
              utterance.rate = 0.7;
              utterance.pitch = 0.6; // Lower pitch for authority
              utterance.volume = 0.95;
              break;
            case 'agi':
              utterance.rate = 0.8;
              utterance.pitch = 0.7; // Professional low tone
              utterance.volume = 0.9;
              break;
            case 'agentic':
              utterance.rate = 0.85;
              utterance.pitch = 0.8; // Confident male tone
              utterance.volume = 0.9;
              break;
            default:
              utterance.rate = 0.85;
              utterance.pitch = 0.8; // Standard professional male voice
              utterance.volume = 0.9;
          }

          let speechEnded = false;
          
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

// 2. RESPONSIVE DESIGN FIXES
const ResponsiveStyles = `
/* Global Responsive Base */
* {
  box-sizing: border-box;
}

/* Mobile-First Approach */
.container {
  width: 100%;
  padding: 0 1rem;
}

/* AI Core Responsive Sizing */
.ai-core {
  width: min(200px, 40vw);
  height: min(200px, 40vw);
  max-width: 350px;
  max-height: 350px;
  
  /* Mobile adjustments */
  @media (max-width: 768px) {
    width: min(150px, 35vw);
    height: min(150px, 35vw);
  }
  
  /* Very small screens */
  @media (max-width: 480px) {
    width: min(120px, 30vw);
    height: min(120px, 30vw);
  }
}

/* Chat Interface Responsive */
.chat-box {
  width: min(450px, 95vw);
  max-height: min(600px, 70vh);
  
  @media (max-width: 768px) {
    width: calc(100vw - 2rem);
    max-height: min(500px, 60vh);
    bottom: 6rem;
  }
  
  @media (max-width: 480px) {
    width: calc(100vw - 1rem);
    max-height: min(400px, 50vh);
    bottom: 5rem;
  }
}

/* Mode Selector Responsive */
.mode-selector {
  @media (max-width: 768px) {
    flex-direction: row;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  
  @media (max-width: 480px) {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background: rgba(0,0,0,0.9);
    padding: 1rem;
    z-index: 1000;
  }
}

/* Button Responsive */
.mode-button, .control-button {
  padding: clamp(0.5rem, 2vw, 1rem) clamp(0.8rem, 3vw, 2rem);
  font-size: clamp(0.8rem, 2.5vw, 1rem);
  
  @media (max-width: 480px) {
    min-width: calc(50% - 0.25rem);
    text-align: center;
  }
}

/* Status Display Responsive */
.status-display {
  @media (max-width: 768px) {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    transform: none;
    border-radius: 0;
    padding: 0.8rem 1rem;
  }
}

/* Response Bubble Responsive */
.response-bubble {
  max-width: min(80vw, 600px);
  padding: clamp(1rem, 4vw, 2rem);
  font-size: clamp(0.9rem, 2.8vw, 1.1rem);
  
  @media (max-width: 768px) {
    left: 1rem;
    right: 1rem;
    transform: none;
    max-width: none;
    bottom: min(8rem, 15vh);
  }
}

/* Three.js Canvas Responsive */
canvas {
  max-width: 100%;
  max-height: 100vh;
  display: block;
}

/* Touch-friendly interactions */
@media (hover: none) and (pointer: coarse) {
  .ai-core, .mode-button, .control-button {
    transform: none !important;
  }
  
  .ai-core:active {
    transform: translate(-50%, -50%) scale(0.95) !important;
  }
  
  .mode-button:active, .control-button:active {
    transform: scale(0.95) !important;
  }
}

/* Landscape mobile orientation */
@media (orientation: landscape) and (max-height: 500px) {
  .ai-core {
    width: min(120px, 25vh);
    height: min(120px, 25vh);
  }
  
  .response-bubble {
    max-height: 30vh;
    overflow-y: auto;
  }
  
  .mode-selector {
    flex-direction: row;
    gap: 0.3rem;
  }
}
`;

// 3. DEVICE DETECTION & OPTIMIZATION
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
    const isTouch = this.isTouchDevice();
    
    return {
      // Three.js performance settings
      pixelRatio: Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2),
      antialias: !isMobile,
      shadows: !isMobile,
      
      // Animation settings
      animationSpeed: isMobile ? 0.5 : 1,
      particleCount: isMobile ? 25 : 50,
      
      // UI settings
      touchFriendly: isTouch,
      hoverEffects: !isTouch,
      
      // Voice settings
      autoPlay: !isMobile, // Mobile often blocks autoplay
      voiceTimeout: isMobile ? 20000 : 15000
    };
  }
}

// 4. RESPONSIVE THREE.JS SETUP
export const createResponsiveScene = (container) => {
  const settings = DeviceOptimizer.getOptimalSettings();
  
  const scene = new THREE.Scene();
  const renderer = new THREE.WebGLRenderer({ 
    antialias: settings.antialias,
    alpha: true,
    powerPreference: settings.isMobile ? 'low-power' : 'high-performance'
  });
  
  renderer.setPixelRatio(settings.pixelRatio);
  renderer.shadowMap.enabled = settings.shadows;
  
  // Responsive resize handler
  const handleResize = () => {
    const width = container.clientWidth;
    const height = container.clientHeight;
    
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  
  window.addEventListener('resize', handleResize);
  window.addEventListener('orientationchange', () => {
    setTimeout(handleResize, 500); // Delay for orientation change
  });
  
  return { scene, renderer, handleResize };
};

// 5. MOBILE-SPECIFIC OPTIMIZATIONS
export const mobileOptimizations = {
  // Prevent zoom on double tap
  preventZoom: () => {
    document.addEventListener('touchstart', (e) => {
      if (e.touches.length > 1) {
        e.preventDefault();
      }
    });
    
    let lastTouchEnd = 0;
    document.addEventListener('touchend', (e) => {
      const now = (new Date()).getTime();
      if (now - lastTouchEnd <= 300) {
        e.preventDefault();
      }
      lastTouchEnd = now;
    }, false);
  },
  
  // Optimize scroll behavior
  optimizeScroll: () => {
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    document.body.style.height = '100%';
  },
  
  // Viewport meta tag
  setViewport: () => {
    const viewport = document.querySelector('meta[name="viewport"]');
    if (viewport) {
      viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
    }
  }
};

// 6. FORCE MALE VOICE UTILITY
export const forceMaleVoice = () => {
  // Wait for voices to load and select male voice
  const selectMaleVoice = () => {
    const voices = window.speechSynthesis.getVoices();
    console.log('Setting up male voice preference...');
    
    // Create a test utterance to cache the preferred voice
    const testUtterance = new SpeechSynthesisUtterance('');
    const maleVoice = voices.find(voice => 
      voice.lang.startsWith('en') && (
        voice.name.toLowerCase().includes('male') ||
        voice.name.toLowerCase().includes('david') ||
        voice.name.toLowerCase().includes('daniel') ||
        (voice.name.includes('Google') && !voice.name.toLowerCase().includes('female'))
      )
    );
    
    if (maleVoice) {
      testUtterance.voice = maleVoice;
      console.log('Male voice selected:', maleVoice.name);
      // Store preference
      window.preferredVoice = maleVoice;
    }
  };
  
  if (window.speechSynthesis.getVoices().length === 0) {
    window.speechSynthesis.onvoiceschanged = () => {
      selectMaleVoice();
      window.speechSynthesis.onvoiceschanged = null;
    };
  } else {
    selectMaleVoice();
  }
};

// Initialize on load
if (typeof window !== 'undefined') {
  // Add responsive styles
  const style = document.createElement('style');
  style.textContent = ResponsiveStyles;
  document.head.appendChild(style);
  
  // Initialize mobile optimizations
  if (DeviceOptimizer.isMobile()) {
    mobileOptimizations.preventZoom();
    mobileOptimizations.optimizeScroll();
    mobileOptimizations.setViewport();
  }
  
  // Initialize male voice preference
  forceMaleVoice();
}
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