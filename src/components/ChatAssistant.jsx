// src/components/ChatAssistant.jsx
import React, { useState, useEffect, useRef, useCallback } from "react";
import styled, { keyframes } from "styled-components";
import { useSpeechRecognition } from "react-speech-kit";
import { sendMessage, getTTS } from "../api/chatApi";
import { v4 as uuidv4 } from "uuid";

const pulse = keyframes`
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.1); }
`;

const slideIn = keyframes`
  from { transform: translateX(100%); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
`;

const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

const ChatBtn = styled.button`
  position: fixed;
  bottom: 2rem;
  right: 2rem;
  background: ${props => props.listening ? 
    'linear-gradient(45deg, #e74c3c, #c0392b)' : 
    'linear-gradient(45deg, #3498db, #2980b9)'
  };
  border: none;
  border-radius: 50%;
  width: 70px;
  height: 70px;
  color: white;
  font-size: 1.8rem;
  z-index: 1000;
  cursor: pointer;
  box-shadow: 0 8px 25px rgba(0,0,0,0.3);
  backdrop-filter: blur(10px);
  transition: all 0.3s ease;
  animation: ${props => props.listening ? pulse : 'none'} 1.5s infinite;
  
  @media (max-width: 768px) {
    width: 60px;
    height: 60px;
    font-size: 1.5rem;
    bottom: 1.5rem;
    right: 1.5rem;
  }
  
  &:hover {
    transform: translateY(-3px);
    box-shadow: 0 12px 35px rgba(0,0,0,0.4);
  }
  
  &:active {
    transform: translateY(-1px);
  }
  
  &::before {
    content: '';
    position: absolute;
    inset: -3px;
    border-radius: 50%;
    background: ${props => props.listening ? 
      'linear-gradient(45deg, #e74c3c, #c0392b)' : 
      'linear-gradient(45deg, #3498db, #2980b9)'
    };
    opacity: 0.3;
    z-index: -1;
    animation: ${props => props.listening ? pulse : 'none'} 2s infinite;
  }
`;

const ChatBox = styled.div`
  position: fixed;
  bottom: 10rem;
  right: 2rem;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(30px);
  padding: 0;
  width: 380px;
  max-width: calc(100vw - 4rem);
  max-height: 500px;
  border-radius: 20px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.2);
  border: 1px solid rgba(255, 255, 255, 0.2);
  z-index: 999;
  animation: ${slideIn} 0.4s ease-out;
  overflow: hidden;
  
  @media (max-width: 768px) {
    right: 1rem;
    left: 1rem;
    width: auto;
    max-width: none;
    bottom: 8rem;
  }
`;

const ChatHeader = styled.div`
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 1rem 1.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  
  h3 {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 600;
  }
  
  .status {
    font-size: 0.8rem;
    opacity: 0.9;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  
  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: ${props => props.listening ? '#e74c3c' : '#2ecc71'};
    animation: ${props => props.listening ? pulse : 'none'} 1s infinite;
  }
`;

const MessagesContainer = styled.div`
  padding: 1rem;
  max-height: 350px;
  overflow-y: auto;
  
  &::-webkit-scrollbar {
    width: 6px;
  }
  
  &::-webkit-scrollbar-track {
    background: rgba(0,0,0,0.1);
    border-radius: 3px;
  }
  
  &::-webkit-scrollbar-thumb {
    background: rgba(0,0,0,0.3);
    border-radius: 3px;
  }
`;

const Message = styled.div`
  margin-bottom: 1rem;
  animation: ${fadeIn} 0.3s ease;
  
  &:last-child {
    margin-bottom: 0;
  }
  
  .message-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.3rem;
  }
  
  .sender {
    font-weight: 600;
    font-size: 0.85rem;
    color: ${props => props.isUser ? '#3498db' : '#e74c3c'};
  }
  
  .timestamp {
    font-size: 0.7rem;
    color: #999;
  }
  
  .content {
    background: ${props => props.isUser ? 
      'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)' : 
      'linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%)'
    };
    padding: 0.8rem 1rem;
    border-radius: 15px;
    font-size: 0.9rem;
    line-height: 1.4;
    color: #333;
    margin-left: ${props => props.isUser ? '2rem' : '0'};
    margin-right: ${props => props.isUser ? '0' : '2rem'};
    position: relative;
    
    &::before {
      content: '';
      position: absolute;
      top: 10px;
      ${props => props.isUser ? 'right: -8px' : 'left: -8px'};
      width: 0;
      height: 0;
      border: 8px solid transparent;
      border-${props => props.isUser ? 'left' : 'right'}-color: ${props => props.isUser ? '#bbdefb' : '#ffe0b2'};
    }
  }
`;

const CloseButton = styled.button`
  background: rgba(255, 255, 255, 0.2);
  border: none;
  color: white;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  transition: all 0.3s ease;
  
  &:hover {
    background: rgba(255, 255, 255, 0.3);
    transform: rotate(90deg);
  }
`;

const ChatFooter = styled.div`
  padding: 1rem;
  background: rgba(0,0,0,0.02);
  border-top: 1px solid rgba(0,0,0,0.1);
  display: flex;
  gap: 0.5rem;
  align-items: center;
  
  .quick-actions {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  
  .quick-btn {
    background: rgba(52, 152, 219, 0.1);
    border: 1px solid rgba(52, 152, 219, 0.3);
    color: #3498db;
    padding: 0.4rem 0.8rem;
    border-radius: 20px;
    font-size: 0.8rem;
    cursor: pointer;
    transition: all 0.3s ease;
    
    &:hover {
      background: rgba(52, 152, 219, 0.2);
      transform: translateY(-1px);
    }
  }
`;

const TypingIndicator = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.8rem 1rem;
  margin-bottom: 1rem;
  font-style: italic;
  color: #666;
  font-size: 0.85rem;
  
  .dots {
    display: flex;
    gap: 3px;
  }
  
  .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #999;
    animation: ${pulse} 1.4s infinite;
    
    &:nth-child(1) { animation-delay: 0s; }
    &:nth-child(2) { animation-delay: 0.2s; }
    &:nth-child(3) { animation-delay: 0.4s; }
  }
`;

export default function ChatAssistant() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState([]);
  const [sessionId] = useState(() => uuidv4());
  const [isTyping, setIsTyping] = useState(false);
  const [analytics, setAnalytics] = useState({
    sessionStart: Date.now(),
    interactions: 0,
    leadScore: 0,
    interests: new Set()
  });
  
  const idleTimer = useRef(null);
  const messagesEndRef = useRef(null);
  const { listen, listening, stop } = useSpeechRecognition({ onResult: handleUser });

  const quickActions = [
    "Tell me about services",
    "Show portfolio",
    "Contact information",
    "Pricing details"
  ];

  useEffect(() => {
    scheduleIdlePrompt();
    return () => clearTimeout(idleTimer.current);
  }, [open, msgs]);

  useEffect(() => {
    scrollToBottom();
  }, [msgs, isTyping]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  function scheduleIdlePrompt() {
    clearTimeout(idleTimer.current);
    if (open && msgs.length === 0) {
      idleTimer.current = setTimeout(() => {
        handleUser("Tell me about your services.");
      }, 35000);
    }
  }

  const updateAnalytics = useCallback((userInput, aiResponse) => {
    setAnalytics(prev => {
      const newAnalytics = {
        ...prev,
        interactions: prev.interactions + 1
      };

      // Lead scoring
      const lowerInput = userInput.toLowerCase();
      const lowerResponse = aiResponse.toLowerCase();
      
      if (lowerInput.includes('price') || lowerInput.includes('cost') || lowerInput.includes('budget')) {
        newAnalytics.leadScore += 15;
        newAnalytics.interests.add('pricing');
      }
      
      if (lowerInput.includes('contact') || lowerInput.includes('email') || lowerResponse.includes('contact')) {
        newAnalytics.leadScore += 25;
        newAnalytics.interests.add('contact');
      }
      
      if (lowerInput.includes('portfolio') || lowerInput.includes('work') || lowerInput.includes('examples')) {
        newAnalytics.leadScore += 10;
        newAnalytics.interests.add('portfolio');
      }
      
      if (lowerInput.includes('service') || lowerResponse.includes('service')) {
        newAnalytics.leadScore += 8;
        newAnalytics.interests.add('services');
      }

      // Log high-value interactions
      if (newAnalytics.leadScore > 30) {
        console.log('🔥 High-value lead detected:', {
          sessionId,
          leadScore: newAnalytics.leadScore,
          interests: Array.from(newAnalytics.interests),
          sessionDuration: Date.now() - newAnalytics.sessionStart
        });
      }

      return newAnalytics;
    });
  }, [sessionId]);

  async function handleUser(text, isQuickAction = false) {
    if (!text?.trim()) return;
    
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    if (!isQuickAction) {
      setMsgs(prev => [...prev, { 
        from: 'You', 
        text, 
        timestamp,
        id: uuidv4()
      }]);
    }
    
    clearTimeout(idleTimer.current);
    setIsTyping(true);

    try {
      const { reply } = await sendMessage(text, sessionId);
      
      setIsTyping(false);
      setMsgs(prev => [...prev, { 
        from: 'Rakesh', 
        text: reply, 
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        id: uuidv4()
      }]);

      // Update analytics
      updateAnalytics(text, reply);

      stop();
      try {
        await getTTS(reply);
      } catch (err) {
        console.error("TTS error:", err);
      }

    } catch (err) {
      console.error("Chat error:", err);
      setIsTyping(false);
      setMsgs(prev => [...prev, { 
        from: 'Rakesh', 
        text: "I'm experiencing connectivity issues. Please try again in a moment.", 
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        id: uuidv4()
      }]);
    }
  }

  function toggleRecording() {
    if (!open) {
      setOpen(true);
      // Add welcome message if first time opening
      if (msgs.length === 0) {
        setTimeout(() => {
          setMsgs([{
            from: 'Rakesh',
            text: "Hello! I'm Rakesh, your AI brand strategist. How can I help you today?",
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            id: uuidv4()
          }]);
        }, 500);
      }
    }
    
    listening ? stop() : listen({ interimResults: false });
  }

  function handleQuickAction(action) {
    handleUser(action, true);
  }

  function closeChat() {
    setOpen(false);
    stop();
    
    // Log session analytics
    const sessionDuration = Date.now() - analytics.sessionStart;
    console.log('📊 Session ended:', {
      sessionId,
      duration: sessionDuration,
      interactions: analytics.interactions,
      leadScore: analytics.leadScore,
      interests: Array.from(analytics.interests)
    });
  }

  return (
    <>
      {open && (
        <ChatBox>
          <ChatHeader listening={listening}>
            <div>
              <h3>Chat with Rakesh</h3>
              <div className="status">
                <div className="status-dot"></div>
                {listening ? 'Listening...' : 'Ready to help'}
              </div>
            </div>
            <CloseButton onClick={closeChat}>✕</CloseButton>
          </ChatHeader>
          
          <MessagesContainer>
            {msgs.map((msg) => (
              <Message key={msg.id} isUser={msg.from === 'You'}>
                <div className="message-header">
                  <span className="sender">{msg.from}</span>
                  <span className="timestamp">{msg.timestamp}</span>
                </div>
                <div className="content">{msg.text}</div>
              </Message>
            ))}
            
            {isTyping && (
              <TypingIndicator>
                <span>Rakesh is typing</span>
                <div className="dots">
                  <div className="dot"></div>
                  <div className="dot"></div>
                  <div className="dot"></div>
                </div>
              </TypingIndicator>
            )}
            
            <div ref={messagesEndRef} />
          </MessagesContainer>
          
          {msgs.length > 0 && (
            <ChatFooter>
              <div className="quick-actions">
                {quickActions.map((action, index) => (
                  <button 
                    key={index}
                    className="quick-btn"
                    onClick={() => handleQuickAction(action)}
                  >
                    {action}
                  </button>
                ))}
              </div>
            </ChatFooter>
          )}
        </ChatBox>
      )}
      
      <ChatBtn 
        listening={listening}
        onClick={toggleRecording}
        title={listening ? "Stop listening" : "Start voice chat"}
      >
        {listening ? '🔊' : '💬'}
      </ChatBtn>
    </>
  );
}