// Enhanced src/api/chatApi.js with Agentic AI, AGI, ASI support and pronunciation fixes
const API_BASE_URL = "https://character-chan.onrender.com";

console.log('🔍 API_BASE_URL being used:', API_BASE_URL);

export async function sendMessage(message, sessionId = null, aiMode = 'standard') {
  console.log('🚀 Calling:', `${API_BASE_URL}/chat`, 'Mode:', aiMode);
  
  try {
    const res = await fetch(`${API_BASE_URL}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        message, 
        sessionId,
        aiMode, // Pass the AI mode to backend
        timestamp: Date.now()
      }),
    });
    
    console.log('📡 Response status:', res.status);
    
    if (!res.ok) {
      throw new Error(`Server error: ${res.status} ${res.statusText}`);
    }
    
    const data = await res.json();
    console.log('✅ Chat response received for mode:', aiMode);
    return data;
  } catch (err) {
    console.error("❌ sendMessage error:", err);
    throw err;
  }
}

// Enhanced TTS with pronunciation fixes and mode-specific settings
export async function getTTS(text, aiMode = 'standard') {
  console.log('🔊 Using browser TTS for:', text?.substring(0, 50), 'Mode:', aiMode);
  
  try {
    if (!text || typeof text !== 'string') {
      throw new Error('Invalid text for TTS');
    }

    if (!('speechSynthesis' in window)) {
      throw new Error('Speech synthesis not supported in this browser');
    }

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();
    
    // Wait a brief moment for cancellation to complete
    await new Promise(resolve => setTimeout(resolve, 100));

    // Enhanced pronunciation fixes
    let processedText = text
      .replace(/Adv\./g, 'Advocate')
      .replace(/Foxmandal/g, 'Foxmandal')
      .replace(/Foxmandal/g, 'FoxMandal') // Keep original if already hyphenated
      .replace(/SEBI/g, 'S-E-B-I')
      .replace(/NCLT/g, 'N-C-L-T')
      .replace(/NCLAT/g, 'N-C-L-A-T')
      .replace(/FEMA/g, 'F-E-M-A')
      .replace(/GST/g, 'G-S-T')
      .replace(/RERA/g, 'R-E-R-A')
      .replace(/IP/g, 'Intellectual Property')
      .replace(/\bvs?\.\s/gi, 'versus ')
      .replace(/Ltd\./g, 'Limited')
      .replace(/Pvt\./g, 'Private')
      .replace(/AGI/g, 'A-G-I')
      .replace(/ASI/g, 'A-S-I')
      .replace(/API/g, 'A-P-I')
      .replace(/AI/g, 'A-I');

    const utterance = new SpeechSynthesisUtterance(processedText);
    
    // Mode-specific voice settings
    switch(aiMode) {
      case 'asi':
        utterance.rate = 0.7;   // Slower, more deliberate
        utterance.pitch = 0.7;  // Lower pitch for authority
        utterance.volume = 0.9;
        break;
      case 'agi':
        utterance.rate = 0.8;   // Measured pace
        utterance.pitch = 0.8;  // Slightly lower
        utterance.volume = 0.85;
        break;
      case 'agentic':
        utterance.rate = 0.85;  // Confident pace
        utterance.pitch = 0.9;  // Natural pitch
        utterance.volume = 0.9;
        break;
      default: // standard
        utterance.rate = 0.9;
        utterance.pitch = 1.0;
        utterance.volume = 0.8;
    }

    // Enhanced voice selection with preference for quality voices
    const setVoiceAndSpeak = () => {
      const voices = window.speechSynthesis.getVoices();
      
      // Prioritize high-quality voices
      const preferredVoice = voices.find(voice => 
        voice.lang === 'en-IN' && voice.name.includes('Google')
      ) || voices.find(voice => 
        voice.lang === 'en-US' && voice.name.includes('Google')
      ) || voices.find(voice => 
        voice.lang === 'en-GB' && voice.name.includes('Google')
      ) || voices.find(voice => 
        voice.lang.startsWith('en') && 
        (voice.name.includes('Google') || voice.name.includes('Microsoft'))
      ) || voices.find(voice => voice.lang.startsWith('en'));
      
      if (preferredVoice) {
        utterance.voice = preferredVoice;
        console.log('🎙️ Using voice:', preferredVoice.name, 'for', aiMode, 'mode');
      }

      return new Promise((resolve, reject) => {
        let speechStarted = false;
        let speechEnded = false;

        utterance.onstart = () => {
          speechStarted = true;
          console.log('🔊 TTS started for', aiMode, 'mode');
        };

        utterance.onend = () => {
          if (!speechEnded) {
            speechEnded = true;
            console.log('✅ TTS finished for', aiMode, 'mode');
            resolve();
          }
        };

        utterance.onerror = (event) => {
          console.error('❌ TTS error:', event.error);
          if (!speechEnded) {
            speechEnded = true;
            resolve(); // Don't reject, continue silently
          }
        };

        // Start speaking
        window.speechSynthesis.speak(utterance);
        
        // Safety timeout - longer for complex AI responses
        const maxDuration = Math.max(
          aiMode === 'asi' ? 25000 : aiMode === 'agi' ? 20000 : 15000, 
          processedText.length * 80
        );
        
        setTimeout(() => {
          if (!speechEnded) {
            console.warn('TTS timeout reached for', aiMode, 'mode');
            window.speechSynthesis.cancel();
            speechEnded = true;
            resolve();
          }
        }, maxDuration);

        // Check if speech actually started
        setTimeout(() => {
          if (!speechStarted && !speechEnded && !window.speechSynthesis.speaking) {
            console.warn('TTS failed to start for', aiMode, 'mode');
            speechEnded = true;
            resolve();
          }
        }, 1000);
      });
    };

    // Handle voice loading
    if (window.speechSynthesis.getVoices().length === 0) {
      return new Promise((resolve) => {
        window.speechSynthesis.onvoiceschanged = async () => {
          window.speechSynthesis.onvoiceschanged = null;
          try {
            await setVoiceAndSpeak();
            resolve();
          } catch (error) {
            console.warn('TTS error in voice change handler:', error);
            resolve();
          }
        };
        
        // Fallback timeout
        setTimeout(() => {
          if (window.speechSynthesis.onvoiceschanged) {
            window.speechSynthesis.onvoiceschanged = null;
            console.warn('Voice loading timeout, proceeding anyway');
            setVoiceAndSpeak().then(resolve).catch(() => resolve());
          }
        }, 2000);
      });
    } else {
      return await setVoiceAndSpeak();
    }
    
  } catch (err) {
    console.error("❌ getTTS error:", err);
    // Don't throw - continue silently on TTS errors
    return Promise.resolve();
  }
}

// Stop TTS function
export function stopTTS() {
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
    console.log('🛑 TTS stopped');
  }
}

// Pause TTS function  
export function pauseTTS() {
  if (window.speechSynthesis && window.speechSynthesis.speaking) {
    window.speechSynthesis.pause();
    console.log('⏸️ TTS paused');
  }
}

// Resume TTS function
export function resumeTTS() {
  if (window.speechSynthesis && window.speechSynthesis.paused) {
    window.speechSynthesis.resume();
    console.log('▶️ TTS resumed');
  }
}

// Enhanced lead capture with AI mode context
export async function captureLead(leadData, sessionId, aiMode = 'standard') {
  console.log('📋 Capturing lead for', aiMode, 'mode');
  
  try {
    const res = await fetch(`${API_BASE_URL}/capture-lead`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...leadData,
        sessionId,
        aiMode,
        timestamp: Date.now(),
        source: `foxmandal_${aiMode}_ai`
      }),
    });
    
    if (!res.ok) {
      throw new Error(`Lead capture failed: ${res.status}`);
    }
    
    const data = await res.json();
    console.log('✅ Lead captured successfully');
    return data;
  } catch (err) {
    console.error("❌ captureLead error:", err);
    throw err;
  }
}

// Health check with AI mode capabilities
export async function checkHealth() {
  try {
    const res = await fetch(`${API_BASE_URL}/health`);
    const data = await res.json();
    console.log('❤️ Health check:', data.status);
    return {
      status: res.ok ? 'healthy' : 'unhealthy',
      details: data,
      aiCapabilities: {
        standard: true,
        agentic: data.services?.openai && data.services?.pinecone,
        agi: data.services?.openai,
        asi: data.services?.openai
      }
    };
  } catch (err) {
    console.error("❌ Health check failed:", err);
    return {
      status: 'unreachable',
      details: { error: err.message },
      aiCapabilities: {
        standard: false,
        agentic: false,
        agi: false,
        asi: false
      }
    };
  }
}

// Mode-specific configuration
export const AI_MODES = {
  standard: {
    name: 'Standard AI',
    description: 'Traditional legal consultation with Fox Mandal expertise',
    capabilities: ['legal_consultation', 'document_review', 'compliance_check'],
    icon: '⚖️'
  },
  agentic: {
    name: 'Agentic AI',
    description: 'Autonomous legal agent with independent research capabilities',
    capabilities: ['autonomous_research', 'multi_step_planning', 'independent_analysis'],
    icon: '🔬'
  },
  agi: {
    name: 'AGI',
    description: 'General intelligence across legal, business, and technical domains',
    capabilities: ['cross_domain_analysis', 'holistic_reasoning', 'integrated_solutions'],
    icon: '🤖'
  },
  asi: {
    name: 'ASI',
    description: 'Superintelligence with predictive modeling and quantum processing',
    capabilities: ['predictive_modeling', 'quantum_analysis', 'scenario_mapping'],
    icon: '🧠'
  }
};

// Get current mode configuration
export function getModeConfig(mode) {
  return AI_MODES[mode] || AI_MODES.standard;
}

// Session management
export function generateSessionId(aiMode = 'standard') {
  return `foxmandal_${aiMode}_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

// Enhanced error handling
export class APIError extends Error {
  constructor(message, status, mode) {
    super(message);
    this.name = 'APIError';
    this.status = status;
    this.mode = mode;
  }
}

// Export constants
export const API_ENDPOINTS = {
  chat: `${API_BASE_URL}/chat`,
  health: `${API_BASE_URL}/health`,
  captureLead: `${API_BASE_URL}/capture-lead`,
  analytics: `${API_BASE_URL}/legal-analytics`
};

console.log('🚀 Enhanced chatApi.js loaded with Agentic AI support');