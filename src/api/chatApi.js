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
export const getTTS = async (text) => {
  return new Promise((resolve) => {
    if (!text || !window.speechSynthesis) {
      resolve();
      return;
    }

    try {
      window.speechSynthesis.cancel();
      
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      utterance.pitch = 0.8;
      utterance.volume = 0.8;

      const voices = window.speechSynthesis.getVoices();
      const preferredVoice = voices.find(voice => 
        voice.lang.startsWith('en') && 
        (voice.name.includes('Google') || voice.name.includes('Microsoft'))
      ) || voices.find(voice => voice.lang.startsWith('en'));
      
      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }

      utterance.onend = () => resolve();
      utterance.onerror = () => resolve();

      window.speechSynthesis.speak(utterance);
      
      setTimeout(() => {
        if (window.speechSynthesis.speaking) {
          window.speechSynthesis.cancel();
        }
        resolve();
      }, 15000);
      
    } catch (error) {
      console.warn('TTS error:', error);
      resolve();
    }
  });
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