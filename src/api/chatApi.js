// src/api/chatApi.js
const API_URL = import.meta.env.VITE_API_URL;

export async function sendMessage(message, sessionId = null) {
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
