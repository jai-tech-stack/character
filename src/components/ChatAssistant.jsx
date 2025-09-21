// src/components/ChatAssistant.jsx
import React, { useState, useEffect, useRef } from "react";
import styled from "styled-components";
import { useSpeechRecognition } from "react-speech-kit";
import useTTS from "../hooks/useTTS";
import { sendMessage, getTTS } from "../api/chatApi";
import { v4 as uuidv4 } from "uuid";

const ChatBtn = styled.button`
  position: absolute; bottom: 2rem; right: 2rem;
  background: #ff7f50; border: none; border-radius:50%;
  width:64px; height:64px; color:white; font-size:1.5rem; z-index:100;
`;

const ChatBox = styled.div`
  position: absolute; bottom: 10rem; right: 2rem; background:white;
  padding:1rem; width:320px; box-shadow:0 2px 8px rgba(0,0,0,0.2);
  max-height:300px; overflow-y:auto; border-radius:8px;
`;

export default function ChatAssistant() {
  const [open,setOpen]=useState(false);
  const [msgs,setMsgs]=useState([]);
  const [sessionId]=useState(()=>uuidv4());
  const idleTimer = useRef(null);
  const {listen,listening,stop} = useSpeechRecognition({ onResult: handleUser });
  const { speak } = useTTS();

  useEffect(()=>{
    scheduleIdlePrompt();
    return ()=>clearTimeout(idleTimer.current);
  },[open,msgs]);

  function scheduleIdlePrompt(){
    clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(()=>handleUser("Tell me about your services."), 35000);
  }

  async function handleUser(text){
    if(!text?.trim()) return;
    setMsgs(prev=>[...prev,{from:'You',text}]);
    clearTimeout(idleTimer.current);

    try {
      const { reply } = await sendMessage(text, sessionId);
      setMsgs(prev=>[...prev,{from:'Rakesh',text:reply}]);

      stop();
      try {
        const audioBuffer = await getTTS(reply);
        const audio = new Audio(URL.createObjectURL(new Blob([audioBuffer], { type:"audio/mp3" })));
        await audio.play();
      } catch(err){ console.error("TTS error:",err); }

    } catch(err){
      console.error("Chat error:",err);
      setMsgs(prev=>[...prev,{from:'Rakesh',text:"Sorry, I'm having trouble connecting."}]);
    }
  }

  function toggleRecording(){
    setOpen(true);
    listening?stop():listen({interimResults:false});
  }

  return (
    <>
      {open && (
        <ChatBox>
          {msgs.map((m,i)=>(<div key={i}><b>{m.from}:</b> {m.text}</div>))}
        </ChatBox>
      )}
      <ChatBtn onClick={toggleRecording}>{listening?'🔊':'🎙️'}</ChatBtn>
    </>
  );
}
