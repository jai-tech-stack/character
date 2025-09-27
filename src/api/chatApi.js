// src/api/chatApi.js - Updated for Fox Mandal Live Deployment
const API_BASE_URL = 'https://character-chan.onrender.com';

// Client configuration for Fox Mandal Legal AI
const CLIENT_CONFIG = {
  foxmandal: {
    endpoint: '/chat',
    assistantName: 'Adv. Arjun',
    industry: 'legal',
    leadEndpoint: '/capture-lead'
  }
};

const currentClient = 'foxmandal';
const config = CLIENT_CONFIG[currentClient];

export const sendMessage = async (message, sessionId = null) => {
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
        sessionId: sessionId || generateSessionId()
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
      userProfile: data.userProfile || {}
    };
    
  } catch (error) {
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      throw new Error(`Unable to connect to ${config.assistantName}. Please check your connection and try again.`);
    }
    throw error;
  }
};

export const captureLead = async (leadData, sessionId) => {
  try {
    const response = await fetch(`${API_BASE_URL}${config.leadEndpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...leadData,
        sessionId,
        timestamp: new Date().toISOString()
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

// Text-to-Speech using browser API
// Enhanced TTS system with pronunciation fixes for chatApi.js
export const getTTS = async (text) => {
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
        // Fix pronunciation issues
        let processedText = text
          .replace(/Adv\./g, 'Advocate')  // Replace "Adv." with "Advocate"
          .replace(/Fox Mandal/g, 'Fox Man-dal')  // Proper pronunciation
          .replace(/SEBI/g, 'S-E-B-I')  // Spell out acronyms
          .replace(/NCLT/g, 'N-C-L-T')
          .replace(/NCLAT/g, 'N-C-L-A-T')
          .replace(/FEMA/g, 'F-E-M-A')
          .replace(/GST/g, 'G-S-T')
          .replace(/RERA/g, 'R-E-R-A')
          .replace(/IP/g, 'Intellectual Property')
          .replace(/\b(vs?\.?)\b/gi, 'versus')  // Replace "v." or "vs." with "versus"
          .replace(/Ltd\./g, 'Limited')
          .replace(/Pvt\./g, 'Private');

        const utterance = new SpeechSynthesisUtterance(processedText);
        
        // Optimize settings for legal content
        utterance.rate = 0.85;  // Slightly slower for clarity
        utterance.pitch = 0.9;  // Professional tone
        utterance.volume = 0.9;
        utterance.lang = 'en-IN';  // Indian English if available
        
        // Wait for voices to load
        const setVoiceAndSpeak = () => {
          const voices = window.speechSynthesis.getVoices();
          
          // Prefer Indian English voices, then British, then any English
          const preferredVoice = voices.find(voice => 
            voice.lang === 'en-IN' && voice.name.includes('Google')
          ) || voices.find(voice => 
            voice.lang === 'en-GB' && voice.name.includes('Google')
          ) || voices.find(voice => 
            voice.lang.startsWith('en') && 
            (voice.name.includes('Google') || voice.name.includes('Microsoft'))
          ) || voices.find(voice => voice.lang.startsWith('en'));
          
          if (preferredVoice) {
            utterance.voice = preferredVoice;
          }

          let speechStarted = false;
          let speechEnded = false;

          utterance.onstart = () => {
            speechStarted = true;
            console.log('TTS started:', processedText.substring(0, 50) + '...');
          };

          utterance.onend = () => {
            if (!speechEnded) {
              speechEnded = true;
              console.log('TTS completed successfully');
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

          // Safety timeout - resolve if speech doesn't complete
          const maxDuration = Math.max(10000, processedText.length * 100); // Minimum 10s, or 100ms per character
          const timeoutId = setTimeout(() => {
            if (!speechEnded) {
              console.warn('TTS timeout reached, cancelling speech');
              window.speechSynthesis.cancel();
              speechEnded = true;
              resolve();
            }
          }, maxDuration);

          // Clear timeout when speech completes normally
          const originalOnEnd = utterance.onend;
          utterance.onend = () => {
            clearTimeout(timeoutId);
            originalOnEnd();
          };

          // Start speaking
          window.speechSynthesis.speak(utterance);
          
          // Double-check if speech actually started after a brief delay
          setTimeout(() => {
            if (!speechStarted && !window.speechSynthesis.speaking) {
              console.warn('TTS failed to start, resolving anyway');
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
        
      }, 100); // Short delay after cancellation
      
    } catch (error) {
      console.warn('TTS setup error:', error);
      resolve(); // Continue silently on TTS errors
    }
  });
};

// Enhanced speech control functions
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
// Health check endpoint
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
      status: 'unreachable',
      details: { error: error.message }
    };
  }
};

// Generate session ID
function generateSessionId() {
  return `session_foxmandal_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

// Export current configuration
export const getCurrentConfig = () => ({
  ...config,
  client: currentClient,
  apiUrl: API_BASE_URL
});