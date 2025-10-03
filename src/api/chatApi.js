// ⚡ ULTRA-FAST chatApi.js - Optimized for Speed
// Target: <2 second responses

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://character-chan.onrender.com';

console.log('⚡ Ultra-Fast AI System loaded');

// ===== FAST REQUEST (No Extra Processing) =====
export const sendMessage = async (message, sessionId = null, aiMode = 'fast') => {
  if (!message || typeof message !== 'string') {
    throw new Error('Message required');
  }

  const sanitized = message.trim().substring(0, 500); // Shorter limit
  if (!sanitized) throw new Error('Empty message');

  const session = sessionId || `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout

    const response = await fetch(`${API_BASE_URL}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-ID': session,
      },
      body: JSON.stringify({
        message: sanitized,
        sessionId: session,
        aiMode: 'fast'
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    const data = await response.json();
    return {
      reply: data.reply,
      aiMode: 'fast',
      sessionId: session,
      responseTime: data.responseTime
    };

  } catch (error) {
    console.error('AI Error:', error);
    return {
      reply: "I'm having trouble connecting. Could you try again?",
      aiMode: 'fast',
      sessionId: session,
      error: true
    };
  }
};

// ===== FAST GREETING (Single Cached Request) =====
export const generateAIIntroduction = async (sessionId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/greeting`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId })
    });

    if (!response.ok) {
      throw new Error('Greeting failed');
    }

    const data = await response.json();
    return data.reply;

  } catch (error) {
    console.error('Greeting error:', error);
    return "Hi! I'm Advocate Arjun from FoxMandal. How can I help with your legal questions today?";
  }
};

// ===== OPTIMIZED TTS (Shorter Speech) =====
export const getTTS = async (text) => {
  return new Promise((resolve) => {
    if (!text || !window.speechSynthesis) {
      resolve();
      return;
    }

    try {
      window.speechSynthesis.cancel();
      
      // Shorten text for faster speech
      const shortText = text.substring(0, 300).replace(/FoxMandal/g, 'Fox Mandal');

      const utterance = new SpeechSynthesisUtterance(shortText);
      utterance.rate = 1.1; // Slightly faster
      utterance.pitch = 0.9;
      utterance.volume = 0.9;
      
      utterance.onend = () => resolve();
      utterance.onerror = () => resolve();

      window.speechSynthesis.speak(utterance);
      
      // Auto-cancel after 6 seconds
      setTimeout(() => {
        window.speechSynthesis.cancel();
        resolve();
      }, 6000);
      
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

// ===== SIMPLE RE-ENGAGEMENT (No Complex Logic) =====
export const checkUserReEngagement = (sessionId) => {
  return {
    shouldGreet: false // Disabled for speed - let user initiate
  };
};

// ===== LEAD CAPTURE (Unchanged) =====
export const captureLead = async (leadData, sessionId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/capture-lead`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...leadData, sessionId })
    });
    
    if (!response.ok) throw new Error('Lead capture failed');
    return await response.json();
  } catch (error) {
    console.error('Lead error:', error);
    throw error;
  }
};

// ===== HEALTH CHECK =====
export const checkHealth = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/health`, { timeout: 3000 });
    return { status: response.ok ? 'healthy' : 'unhealthy' };
  } catch (error) {
    return { status: 'error', message: error.message };
  }
};

console.log('⚡ Fast AI ready:', API_BASE_URL);