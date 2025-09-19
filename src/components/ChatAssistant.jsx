// src/components/ChatAssistant.jsx
import React, { useState, useEffect, useRef } from 'react';
import styled from 'styled-components';
import { useSpeechRecognition } from 'react-speech-kit';
import useTTS from '../hooks/useTTS';
import { v4 as uuidv4 } from 'uuid';

const ChatBtn = styled.button`
  position: absolute;
  bottom: 2rem;
  right: 2rem;
  background: #ff7f50;
  border: none;
  border-radius: 50%;
  width: 64px;
  height: 64px;
  color: white;
  font-size: 1.5rem;
  z-index: 100;
`;

const ChatBox = styled.div`
  position: absolute;
  bottom: 10rem;
  right: 2rem;
  background: white;
  padding: 1rem;
  width: 320px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.2);
  max-height: 300px;
  overflow-y: auto;
  border-radius: 8px;
`;

export default function ChatAssistant() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState([]);
  const [sessionId] = useState(() => uuidv4());
  const idleTimer = useRef(null);
  const { listen, listening, stop } = useSpeechRecognition({
    onResult: handleUser
  });
  const { speak } = useTTS();

  useEffect(() => {
    scheduleIdlePrompt();
    return () => clearTimeout(idleTimer.current);
  }, [open, msgs]);

  function scheduleIdlePrompt() {
    clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => {
      handleUser("Tell me about your services.");
    }, 35000);
  }

  async function handleUser(text) {
    if (!text?.trim()) return;
    setMsgs(prev => [...prev, { from: 'You', text }]);
    clearTimeout(idleTimer.current);

    try {
      const res = await fetch('http://localhost:3001/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, sessionId })
      });

      const { reply } = await res.json();
      setMsgs(prev => [...prev, { from: 'Rakesh', text: reply }]);
      speak(reply);
    } catch (err) {
      console.error('Chat error:', err);
    }
  }

  function toggleRecording() {
    setOpen(true);
    if (listening) stop();
    else listen({ interimResults: false });
  }

  return (
    <>
      {open && (
        <ChatBox>
          {msgs.map((m, i) => (
            <div key={i}><b>{m.from}:</b> {m.text}</div>
          ))}
        </ChatBox>
      )}
      <ChatBtn onClick={toggleRecording}>
        {listening ? '🔊' : '🎙️'}
      </ChatBtn>
    </>
  );
}
