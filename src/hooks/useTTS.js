import axios from 'axios';
import { useCallback } from 'react';

export default function useTTS() {
  const speak = async (text) => {
    try {
      const res = await fetch('http://localhost:3001/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      if (!res.ok) throw new Error(`TTS failed: ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      new Audio(url).play();
    } catch (err) {
      console.error('❌ TTS hook error:', err);
    }
  };
  return { speak };
}

