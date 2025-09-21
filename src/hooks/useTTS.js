import { useCallback } from 'react';

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

export default function useTTS() {
  const speak = useCallback(async (text) => {
    try {
      console.log('🚀 TTS Hook calling:', `${API_URL}/tts`);
      
      const res = await fetch(`${API_URL}/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      
      console.log('📡 TTS Hook Response:', res.status);
      
      if (!res.ok) {
        throw new Error(`TTS failed: ${res.status} ${res.statusText}`);
      }
      
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      
      audio.onended = () => URL.revokeObjectURL(url); // Clean up
      await audio.play();
      
    } catch (err) {
      console.error('❌ TTS hook error:', err);
    }
  }, []);

  return { speak };
}