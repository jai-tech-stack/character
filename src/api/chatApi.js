// src/api/chatApi.js
const API_BASE_URL = "https://character-chan.onrender.com";
//import.meta.env.VITE_API_URL || "http://localhost:3001";
 // src/api/chatApi.js - Unified API for switching between clients
// Client configuration - easily switch between different AI personalities
const CLIENT_CONFIG = {
  foxmandal: {
    endpoint: '/chat',
    assistantName: 'Adv. Arjun',
    industry: 'legal',
    leadEndpoint: '/capture-lead'
  },
  origami: {
    endpoint: '/chat',
    assistantName: 'Rakesh', 
    industry: 'branding',
    leadEndpoint: '/capture-lead'
  }
};

// Get current client from environment or default to foxmandal
const currentClient = import.meta.env.VITE_CLIENT || 'foxmandal';
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
        sessionId: sessionId || generateSessionId(),
        client: currentClient
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
    
    // Handle different response formats
    if (data.reply) {
      return {
        reply: data.reply,
        userProfile: data.userProfile || {}
      };
    } else if (data.message) {
      return {
        reply: data.message,
        userProfile: data.userProfile || {}
      };
    } else {
      throw new Error('Invalid response format from server');
    }
    
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
        client: currentClient,
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

// Text-to-Speech using browser API (server TTS disabled)
export const getTTS = async (text) => {
  return new Promise((resolve, reject) => {
    if (!text || !window.speechSynthesis) {
      resolve();
      return;
    }

    try {
      // Cancel any ongoing speech
      window.speechSynthesis.cancel();
      
      const utterance = new SpeechSynthesisUtterance(text);
      
      // Configure voice settings based on client
      if (currentClient === 'foxmandal') {
        utterance.rate = 0.9;
        utterance.pitch = 0.8;
        utterance.volume = 0.8;
      } else {
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        utterance.volume = 0.9;
      }

      // Try to use a professional-sounding voice
      const voices = window.speechSynthesis.getVoices();
      const preferredVoice = voices.find(voice => 
        voice.lang.startsWith('en') && 
        (voice.name.includes('Google') || voice.name.includes('Microsoft'))
      ) || voices.find(voice => voice.lang.startsWith('en'));
      
      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }

      utterance.onend = () => resolve();
      utterance.onerror = (event) => {
        console.warn('TTS Error:', event.error);
        resolve(); // Don't reject, just continue silently
      };

      window.speechSynthesis.speak(utterance);
      
      // Fallback timeout
      setTimeout(() => {
        if (window.speechSynthesis.speaking) {
          window.speechSynthesis.cancel();
        }
        resolve();
      }, 15000); // 15 second timeout
      
    } catch (error) {
      console.warn('TTS setup error:', error);
      resolve(); // Continue silently on TTS errors
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
  return `session_${currentClient}_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

// Export current configuration for components to use
export const getCurrentConfig = () => ({
  ...config,
  client: currentClient,
  apiUrl: API_BASE_URL
});

// Conversation memory functions (if needed by server)
export const getConversationHistory = async (sessionId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/conversation/${sessionId}`);
    if (response.ok) {
      return await response.json();
    }
    return { messages: [] };
  } catch (error) {
    console.warn('Failed to get conversation history:', error);
    return { messages: [] };
  }
};

export const saveConversationTurn = async (sessionId, userMessage, aiResponse) => {
  try {
    await fetch(`${API_BASE_URL}/conversation/${sessionId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userMessage,
        aiResponse,
        timestamp: new Date().toISOString(),
        client: currentClient
      })
    });
  } catch (error) {
    console.warn('Failed to save conversation:', error);
  }
};