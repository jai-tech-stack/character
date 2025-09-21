// src/api/chatApi.js
const API_URL = "https://character-chan.onrender.com";
//import.meta.env.VITE_API_URL || "http://localhost:3001";

console.log('🔍 API_URL being used:', API_URL);

export async function sendMessage(message, sessionId = null) {
  console.log('🚀 Calling:', `${API_URL}/chat`);
  
  try {
    const res = await fetch(`${API_URL}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, sessionId }),
    });
    
    console.log('📡 Response status:', res.status);
    
    if (!res.ok) {
      throw new Error(`Server error: ${res.status} ${res.statusText}`);
    }
    
    const data = await res.json();
    console.log('✅ Chat response received');
    return data;
  } catch (err) {
    console.error("❌ sendMessage error:", err);
    throw err;
  }
}

// Browser-based TTS function - no server call needed
export async function getTTS(text) {
  console.log('🔊 Using browser TTS for:', text?.substring(0, 50));
  
  try {
    if (!text || typeof text !== 'string') {
      throw new Error('Invalid text for TTS');
    }

    // Check if browser supports speech synthesis
    if (!('speechSynthesis' in window)) {
      throw new Error('Speech synthesis not supported in this browser');
    }

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    
    // Configure voice settings
    utterance.rate = 0.9;     // Slightly slower than default
    utterance.pitch = 1.0;    // Normal pitch
    utterance.volume = 0.8;   // Slightly quieter
    
    // Try to use a better voice if available
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(voice => 
      voice.name.includes('Google') || 
      voice.name.includes('Microsoft') ||
      voice.lang.startsWith('en')
    );
    
    if (preferredVoice) {
      utterance.voice = preferredVoice;
      console.log('🎙️ Using voice:', preferredVoice.name);
    }

    // Return a promise that resolves when speech is complete
    return new Promise((resolve, reject) => {
      utterance.onstart = () => console.log('🔊 TTS started');
      utterance.onend = () => {
        console.log('✅ TTS finished');
        resolve();
      };
      utterance.onerror = (event) => {
        console.error('❌ TTS error:', event.error);
        reject(new Error(`TTS failed: ${event.error}`));
      };

      // Speak the text
      window.speechSynthesis.speak(utterance);
    });
    
  } catch (err) {
    console.error("❌ getTTS error:", err);
    throw err;
  }
}