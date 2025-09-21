// src/api/chatApi.js - TEMPORARY TEST
const API_URL = 'https://character-chan.onrender.com'; // Hardcoded for now

console.log('🔍 Using API_URL:', API_URL); // Should show your Render URL

export async function sendMessage(message, sessionId = null) {
  console.log('🚀 Calling:', `${API_URL}/chat`);
  try {
    const res = await fetch(`${API_URL}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, sessionId }),
    });
    if (!res.ok) throw new Error(`Server error: ${res.status}`);
    return res.json();
  } catch (err) {
    console.error("sendMessage error:", err);
    throw err;
  }
}

export async function getTTS(text) {
  console.log('🚀 Calling:', `${API_URL}/tts`);
  try {
    const res = await fetch(`${API_URL}/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) throw new Error(`Server error: ${res.status}`);
    return res.arrayBuffer();
  } catch (err) {
    console.error("getTTS error:", err);
    throw err;
  }
}