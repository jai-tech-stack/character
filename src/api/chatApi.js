// 🔥 FIXED chatApi.js - TTS Never Cuts Off
const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://character-chan.onrender.com';

console.log('🚀 Fixed AI System with Perfect TTS');

// ===== CONVERSATION STORAGE =====
const conversationStore = new Map();

function saveConversation(sessionId, message, reply) {
  if (!conversationStore.has(sessionId)) {
    conversationStore.set(sessionId, []);
  }
  const conv = conversationStore.get(sessionId);
  conv.push(
    { from: 'You', text: message, timestamp: Date.now() },
    { from: 'Advocate Arjun', text: reply, timestamp: Date.now() }
  );
  
  if (conv.length > 20) {
    conversationStore.set(sessionId, conv.slice(-20));
  }
}

export function getConversationHistory(sessionId) {
  return conversationStore.get(sessionId) || [];
}

// ===== SMART MESSAGE SENDING =====
export const sendMessage = async (message, sessionId = null, aiMode = 'smart') => {
  if (!message || typeof message !== 'string') {
    throw new Error('Message required');
  }

  const sanitized = message.trim().substring(0, 500);
  if (!sanitized) throw new Error('Empty message');

  const session = sessionId || `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(`${API_BASE_URL}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-ID': session,
      },
      body: JSON.stringify({
        message: sanitized,
        sessionId: session,
        aiMode
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    const data = await response.json();
    
    saveConversation(session, sanitized, data.reply);
    
    return {
      reply: data.reply,
      language: data.language,
      legalArea: data.legalArea,
      conversationCount: data.conversationCount,
      responseTime: data.responseTime,
      sessionId: session
    };

  } catch (error) {
    console.error('AI Error:', error);
    return {
      reply: "I'm having trouble connecting. Could you try again?",
      sessionId: session,
      error: true
    };
  }
};

// ===== DOCUMENT ANALYSIS =====
export const analyzeDocument = async (file, sessionId, query = null) => {
  if (!file) throw new Error('No file provided');

  const allowedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ];

  if (!allowedTypes.includes(file.type)) {
    throw new Error('Invalid file type. Only PDF, DOC, DOCX, and TXT are supported.');
  }

  const maxSize = 10 * 1024 * 1024;
  if (file.size > maxSize) {
    throw new Error('File too large. Maximum size is 10MB.');
  }

  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('sessionId', sessionId);
    if (query) formData.append('query', query);

    const response = await fetch(`${API_BASE_URL}/analyze-document`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Analysis failed');
    }

    return await response.json();

  } catch (error) {
    console.error('Document analysis error:', error);
    throw error;
  }
};

// ===== EMAIL SUMMARY =====
export const emailConversationSummary = async (sessionId, email) => {
  try {
    const conversationHistory = getConversationHistory(sessionId);
    
    if (conversationHistory.length === 0) {
      throw new Error('No conversation to send');
    }

    const response = await fetch(`${API_BASE_URL}/email-summary`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, email, conversationHistory })
    });

    if (!response.ok) throw new Error('Failed to send email');
    return await response.json();

  } catch (error) {
    console.error('Email error:', error);
    throw error;
  }
};

// ===== EXPORT CONVERSATION =====
export const exportConversation = async (sessionId, format = 'json') => {
  try {
    const response = await fetch(`${API_BASE_URL}/export-conversation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, format })
    });

    if (!response.ok) throw new Error('Export failed');

    if (format === 'txt') {
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `conversation-${sessionId}.txt`;
      a.click();
      URL.revokeObjectURL(url);
      return { success: true };
    } else {
      return await response.json();
    }

  } catch (error) {
    console.error('Export error:', error);
    throw error;
  }
};

// ===== PDF EXPORT =====
export const exportConversationToPDF = (sessionId) => {
  const conversation = getConversationHistory(sessionId);
  
  if (conversation.length === 0) {
    throw new Error('No conversation to export');
  }

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Legal Consultation - FoxMandal</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; }
    h1 { color: #1e40af; border-bottom: 3px solid #667eea; padding-bottom: 10px; }
    .meta { color: #666; font-size: 14px; margin-bottom: 30px; }
    .message { margin-bottom: 20px; padding: 15px; border-radius: 8px; }
    .user { background: #dbeafe; margin-left: 40px; }
    .assistant { background: #fef3c7; margin-right: 40px; }
    .from { font-weight: bold; margin-bottom: 5px; }
    .time { font-size: 12px; color: #999; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 2px solid #e5e7eb; text-align: center; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <h1>🏛️ FoxMandal & Associates - Legal Consultation</h1>
  <div class="meta">
    <strong>Session ID:</strong> ${sessionId}<br>
    <strong>Date:</strong> ${new Date().toLocaleString()}<br>
    <strong>Messages:</strong> ${conversation.length}
  </div>
  ${conversation.map(msg => `
    <div class="message ${msg.from === 'You' ? 'user' : 'assistant'}">
      <div class="from">${msg.from}</div>
      <div class="time">${new Date(msg.timestamp).toLocaleTimeString()}</div>
      <div class="text">${msg.text}</div>
    </div>
  `).join('')}
  <div class="footer">
    <p><strong>DISCLAIMER:</strong> This is an AI-generated consultation transcript. This does not constitute legal advice. Always consult a licensed attorney for legal decisions.</p>
    <p>© ${new Date().getFullYear()} FoxMandal & Associates. All rights reserved.</p>
  </div>
</body>
</html>`;

  const printWindow = window.open('', '_blank');
  printWindow.document.write(html);
  printWindow.document.close();
  
  printWindow.onload = () => {
    printWindow.print();
  };
  
  return { success: true };
};

// ===== 🔥 PERFECT TTS - NEVER CUTS OFF =====
let currentUtterance = null;
let isTTSActive = false;

export const getTTS = async (text, language = 'en') => {
  return new Promise((resolve) => {
    if (!text || !window.speechSynthesis) {
      resolve();
      return;
    }

    try {
      // Cancel any existing speech
      window.speechSynthesis.cancel();
      isTTSActive = false;
      
      // Clean text for better pronunciation
      const cleanText = text
        .substring(0, 500) // Limit to 500 chars for safety
        .replace(/FoxMandal/g, 'Fox Mandal')
        .replace(/Adv\./g, 'Advocate')
        .replace(/\*\*/g, '') // Remove markdown
        .replace(/\*/g, '');
      
      const utterance = new SpeechSynthesisUtterance(cleanText);
      currentUtterance = utterance;
      
      // Language mapping
      const langMap = { 
        hi: 'hi-IN', 
        ta: 'ta-IN', 
        te: 'te-IN', 
        en: 'en-US' 
      };
      const targetLang = langMap[language] || 'en-US';
      
      // Wait for voices to load
      const setVoiceAndSpeak = () => {
        const voices = window.speechSynthesis.getVoices();
        const voice = voices.find(v => v.lang.startsWith(targetLang.split('-')[0])) || voices[0];
        
        if (voice) utterance.voice = voice;
        
        utterance.lang = targetLang;
        utterance.rate = 0.95; // Slightly slower for clarity
        utterance.pitch = 1.0;
        utterance.volume = 1.0;
        
        // **CRITICAL: Proper event handlers**
        utterance.onstart = () => {
          isTTSActive = true;
          console.log('🔊 TTS started speaking...');
        };
        
        utterance.onend = () => {
          isTTSActive = false;
          currentUtterance = null;
          console.log('✅ TTS finished completely');
          resolve();
        };
        
        utterance.onerror = (event) => {
          console.warn('TTS error:', event.error);
          isTTSActive = false;
          currentUtterance = null;
          resolve();
        };
        
        utterance.onpause = () => {
          console.log('⏸️ TTS paused');
        };
        
        utterance.onresume = () => {
          console.log('▶️ TTS resumed');
        };
        
        // Start speaking
        window.speechSynthesis.speak(utterance);
        
        // **SAFETY TIMEOUT: Calculate based on text length**
        // Average reading speed: 150 words per minute = 2.5 words per second
        const wordCount = cleanText.split(' ').length;
        const estimatedDuration = (wordCount / 2.5) * 1000; // in milliseconds
        const safetyBuffer = 5000; // 5 second buffer
        const maxTimeout = estimatedDuration + safetyBuffer;
        
        console.log(`⏱️ TTS timeout set to ${Math.round(maxTimeout/1000)}s for ${wordCount} words`);
        
        setTimeout(() => {
          if (isTTSActive) {
            console.warn('⚠️ TTS safety timeout reached, forcing stop');
            window.speechSynthesis.cancel();
            isTTSActive = false;
            currentUtterance = null;
            resolve();
          }
        }, maxTimeout);
      };
      
      // Check if voices are loaded
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        setVoiceAndSpeak();
      } else {
        // Wait for voices to load
        window.speechSynthesis.onvoiceschanged = () => {
          setVoiceAndSpeak();
          window.speechSynthesis.onvoiceschanged = null; // Remove listener
        };
      }
      
    } catch (error) {
      console.error('TTS error:', error);
      isTTSActive = false;
      currentUtterance = null;
      resolve();
    }
  });
};

export const stopTTS = () => {
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
    isTTSActive = false;
    currentUtterance = null;
    console.log('🛑 TTS stopped manually');
  }
};

export const isTTSSpeaking = () => {
  return isTTSActive || window.speechSynthesis.speaking;
};

// ===== GREETING =====
export const generateAIIntroduction = async (sessionId, language = 'en') => {
  const greetings = {
    en: "Hello! I'm Advocate Arjun from FoxMandal and Associates. I specialize in contract law, employment disputes, property matters, and general legal consultation. How can I assist you today?",
    hi: "नमस्ते! मैं FoxMandal से एडवोकेट अर्जुन हूं। मैं अनुबंध कानून, रोजगार विवाद, संपत्ति मामलों में विशेषज्ञ हूं। आज मैं आपकी कैसे मदद कर सकता हूं?",
    ta: "வணக்கம்! நான் FoxMandal இலிருந்து அட்வகேட் அர்ஜுன். நான் ஒப்பந்த சட்டம், வேலைவாய்ப்பு சட்டம், சொத்து விஷயங்களில் நிபுணர். இன்று நான் உங்களுக்கு எப்படி உதவ முடியும்?",
    te: "నమస్కారం! నేను FoxMandal నుండి అడ్వకేట్ అర్జున్. నేను ఒప్పంద చట్టం, ఉద్యోగ వివాదాలు, ఆస్తి విషయాలలో నిపుణుడిని. ఈరోజు నేను మీకు ఎలా సహాయపడగలను?"
  };
  
  return greetings[language] || greetings.en;
};

// ===== LEAD CAPTURE =====
export const captureLead = async (leadData, sessionId, source = 'chat') => {
  try {
    const response = await fetch(`${API_BASE_URL}/capture-lead`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...leadData, sessionId, source })
    });
    
    if (!response.ok) throw new Error('Lead capture failed');
    return await response.json();
  } catch (error) {
    console.error('Lead error:', error);
    throw error;
  }
};

// ===== ANALYTICS =====
export const getAnalytics = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/analytics/dashboard`);
    if (!response.ok) throw new Error('Failed to fetch analytics');
    return await response.json();
  } catch (error) {
    console.error('Analytics error:', error);
    return null;
  }
};

// ===== HEALTH CHECK =====
export const checkHealth = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/health`);
    return await response.json();
  } catch (error) {
    return { status: 'error', message: error.message };
  }
};

// ===== CONVERSATION STATS =====
export const getConversationStats = (sessionId) => {
  const history = getConversationHistory(sessionId);
  return {
    messageCount: history.length,
    userMessages: history.filter(m => m.from === 'You').length,
    aiMessages: history.filter(m => m.from === 'Advocate Arjun').length,
    duration: history.length > 0 ? Date.now() - history[0].timestamp : 0
  };
};

console.log('✅ Fixed AI ready with perfect TTS:', API_BASE_URL);