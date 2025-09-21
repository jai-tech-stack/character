import { useCallback } from 'react';

export default function useTTS() {
  const speak = useCallback(async (text) => {
    try {
      console.log('🔊 Using browser TTS for:', text?.substring(0, 50));
      
      if (!text || typeof text !== 'string') {
        console.error('Invalid text for TTS:', text);
        return;
      }

      // Check if browser supports speech synthesis
      if (!('speechSynthesis' in window)) {
        console.error('Speech synthesis not supported in this browser');
        return;
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
        console.log('Using voice:', preferredVoice.name);
      }

      // Add event listeners
      utterance.onstart = () => console.log('TTS started');
      utterance.onend = () => console.log('TTS finished');
      utterance.onerror = (event) => console.error('TTS error:', event.error);

      // Speak the text
      window.speechSynthesis.speak(utterance);
      
    } catch (err) {
      console.error('TTS error:', err);
    }
  }, []);

  return { speak };
}