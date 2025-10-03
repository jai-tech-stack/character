import React, { useState, useEffect, useRef, useCallback } from "react";
import { useSpeechRecognition } from "react-speech-kit";
import { sendMessage, getTTS, stopTTS, captureLead, generateAIIntroduction, checkUserReEngagement } from "../api/chatApi";

export default function ChatAssistant() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState([]);
  const [sessionId] = useState(() => 
    `session_foxmandal_agentic_${Date.now()}_${Math.random().toString(36).substring(2, 15).toLowerCase()}`
  );
  const [isTyping, setIsTyping] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showLeadCapture, setShowLeadCapture] = useState(false);
  const [hasNewMessage, setHasNewMessage] = useState(false);
  const [lastActivityTime, setLastActivityTime] = useState(Date.now());
  const [leadData, setLeadData] = useState({ name: '', email: '', phone: '', message: '' });
  
  const messagesEndRef = useRef(null);
  const inactivityTimerRef = useRef(null);
  const reEngagementShownRef = useRef(false);
  
  const { listen, listening, stop } = useSpeechRecognition({ 
    onResult: handleUser 
  });

  // Inactivity detection - 2.5 minutes
  useEffect(() => {
    if (!open) return;

    const checkInactivity = () => {
      const now = Date.now();
      const inactiveMinutes = (now - lastActivityTime) / 60000;
      
      // Only show re-engagement once per session opening
      if (inactiveMinutes >= 2.5 && 
          msgs.length > 0 && 
          !isTyping && 
          !listening && 
          !reEngagementShownRef.current) {
        handleReEngagement();
        reEngagementShownRef.current = true;
      }
    };

    inactivityTimerRef.current = setInterval(checkInactivity, 30000);
    return () => clearInterval(inactivityTimerRef.current);
  }, [open, lastActivityTime, msgs.length, isTyping, listening]);

  // Reset re-engagement flag when user interacts
  useEffect(() => {
    if (listening || isTyping) {
      setLastActivityTime(Date.now());
      reEngagementShownRef.current = false;
    }
  }, [listening, isTyping]);

  // Reset re-engagement when chat opens
  useEffect(() => {
    if (open) {
      reEngagementShownRef.current = false;
    }
  }, [open]);

  useEffect(() => {
    scrollToBottom();
  }, [msgs, isTyping]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleReEngagement = async () => {
    const reEngagement = checkUserReEngagement(sessionId);
    
    if (reEngagement.shouldGreet) {
      const greeting = reEngagement.greeting;
      
      if (!open) {
        setHasNewMessage(true);
      }
      
      const aiMessage = {
        from: 'Advocate Arjun',
        text: greeting,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        id: Date.now(),
        isReEngagement: true
      };
      
      setMsgs(prev => [...prev, aiMessage]);
      
      if (open) {
        await speakResponse(greeting);
      }
      
      setLastActivityTime(Date.now());
    }
  };

  const speakResponse = useCallback(async (text) => {
    setIsSpeaking(true);
    try {
      await getTTS(text.replace(/Adv\./g, 'Advocate'));
    } catch (err) {
      console.error("TTS error:", err);
    } finally {
      setIsSpeaking(false);
    }
  }, []);

  async function handleUser(text, isQuickAction = false) {
    if (!text?.trim()) return;
    
    setLastActivityTime(Date.now());
    setHasNewMessage(false);
    reEngagementShownRef.current = false;
    
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    if (!isQuickAction) {
      setMsgs(prev => [...prev, { 
        from: 'You', 
        text, 
        timestamp,
        id: Date.now()
      }]);
    }
    
    setIsTyping(true);
    setIsProcessing(true);

    try {
      const response = await sendMessage(text, sessionId, 'agentic', {
        legalArea: extractLegalArea(text),
        name: leadData.name || null
      });
      
      setIsTyping(false);
      setIsProcessing(false);
      
      const aiMessage = {
        from: 'Advocate Arjun', 
        text: response.reply, 
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        id: Date.now()
      };
      
      setMsgs(prev => [...prev, aiMessage]);

      if (response.reply.toLowerCase().includes('consultation') || 
          text.toLowerCase().includes('lawyer') ||
          text.toLowerCase().includes('hire')) {
        setTimeout(() => setShowLeadCapture(true), 2000);
      }

      stop();
      await speakResponse(response.reply);

    } catch (err) {
      console.error('AI error:', err);
      setIsTyping(false);
      setIsProcessing(false);
      const errorMsg = `I encountered an issue. Could you please rephrase your question?`;
      setMsgs(prev => [...prev, { 
        from: 'Advocate Arjun', 
        text: errorMsg, 
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        id: Date.now()
      }]);
      await speakResponse(errorMsg);
    }
  }

  function extractLegalArea(text) {
    const lowerText = text.toLowerCase();
    if (lowerText.includes('contract')) return 'contracts';
    if (lowerText.includes('employment') || lowerText.includes('job')) return 'employment_law';
    if (lowerText.includes('property') || lowerText.includes('real estate')) return 'real_estate';
    if (lowerText.includes('tax')) return 'tax_law';
    if (lowerText.includes('company') || lowerText.includes('business')) return 'corporate_law';
    return 'general_inquiry';
  }

  async function toggleRecording() {
    if (!open) {
      setOpen(true);
      setHasNewMessage(false);
      if (msgs.length === 0) {
        setTimeout(async () => {
          try {
            const welcomeMsg = await generateAIIntroduction(sessionId);
            setMsgs([{
              from: 'Advocate Arjun',
              text: welcomeMsg,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              id: Date.now(),
              isIntroduction: true
            }]);
            speakResponse(welcomeMsg);
          } catch (error) {
            const fallbackMsg = "Hello! I'm Advocate Arjun from FoxMandal. How can I assist you with your legal matters today?";
            setMsgs([{
              from: 'Advocate Arjun',
              text: fallbackMsg,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              id: Date.now()
            }]);
            speakResponse(fallbackMsg);
          }
        }, 500);
      }
    }
    
    if (listening || isSpeaking) {
      stopTTS();
      stop();
      setIsSpeaking(false);
    } else if (!isProcessing) {
      listen({ interimResults: false });
    }
  }

  async function handleQuickAction(action) {
    setLastActivityTime(Date.now());
    
    const queries = {
      'contract': 'I need help reviewing a contract',
      'employment': 'I have questions about employment law',
      'property': 'I need legal advice about property matters',
      'consultation': 'I would like to schedule a legal consultation'
    };
    
    await handleUser(queries[action], true);
  }

  async function handleLeadSubmit() {
    if (!leadData.name || !leadData.email) return;
    
    try {
      await captureLead(leadData, sessionId, 'agentic');
      setShowLeadCapture(false);
      
      const successMsg = `Thank you${leadData.name ? ', ' + leadData.name : ''}! Our legal team will contact you within 24 hours.`;
      setMsgs(prev => [...prev, {
        from: 'System',
        text: successMsg,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        id: Date.now()
      }]);
      speakResponse(successMsg);
      
      setLeadData({ name: '', email: '', phone: '', message: '' });
      
    } catch (error) {
      console.error('Lead capture error:', error);
    }
  }

  function closeChat() {
    setOpen(false);
    stopTTS();
    stop();
    setIsSpeaking(false);
    setIsProcessing(false);
    setShowLeadCapture(false);
  }

  const getButtonIcon = () => {
    if (isProcessing) return '⚙️';
    if (listening) return '🎤';
    if (isSpeaking) return '🔊';
    return '⚖️';
  };

  const getStatusText = () => {
    if (isProcessing) return 'Processing...';
    if (listening) return 'Listening...';
    if (isSpeaking) return 'Speaking...';
    return 'Online';
  };

  return (
    <>
      {open && (
        <div style={{
          position: 'fixed',
          bottom: '10rem',
          right: '2rem',
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(30px)',
          width: '450px',
          maxWidth: 'calc(100vw - 4rem)',
          maxHeight: '600px',
          borderRadius: '20px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          zIndex: 999,
          overflow: 'hidden'
        }}>
          {/* Header */}
          <div style={{
            background: 'linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%)',
            color: 'white',
            padding: '1rem 1.5rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '600' }}>
                Advocate Arjun - Smart AI
              </h3>
              <div style={{ fontSize: '0.8rem', opacity: 0.9, marginTop: '0.2rem' }}>
                {getStatusText()}
              </div>
            </div>
            <button 
              onClick={closeChat}
              style={{
                background: 'rgba(255, 255, 255, 0.2)',
                border: 'none',
                color: 'white',
                width: '30px',
                height: '30px',
                borderRadius: '50%',
                cursor: 'pointer',
                fontSize: '1rem'
              }}
            >
              ×
            </button>
          </div>
          
          {/* Messages */}
          <div style={{
            padding: '1rem',
            maxHeight: '400px',
            overflowY: 'auto'
          }}>
            {msgs.map((msg) => (
              <div key={msg.id} style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
                  <span style={{ fontWeight: '600', fontSize: '0.85rem', color: msg.from === 'You' ? '#1e40af' : '#b87333' }}>
                    {msg.from}
                  </span>
                  <span style={{ fontSize: '0.7rem', color: '#999' }}>
                    {msg.timestamp}
                  </span>
                  {msg.isReEngagement && (
                    <span style={{ fontSize: '0.8rem' }}>👋</span>
                  )}
                </div>
                <div style={{
                  background: msg.from === 'You' ? 
                    'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)' : 
                    'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                  padding: '0.8rem 1rem',
                  borderRadius: '15px',
                  fontSize: '0.9rem',
                  lineHeight: '1.4',
                  marginLeft: msg.from === 'You' ? '2rem' : '0',
                  marginRight: msg.from === 'You' ? '0' : '2rem'
                }}>
                  {msg.text}
                </div>
              </div>
            ))}
            
            {isTyping && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.8rem 1rem' }}>
                <span style={{ fontSize: '0.85rem', color: '#666' }}>Advocate Arjun is analyzing...</span>
                <div style={{ display: 'flex', gap: '3px' }}>
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#b87333', animation: 'pulse 1.4s infinite' }} />
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#b87333', animation: 'pulse 1.4s 0.2s infinite' }} />
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#b87333', animation: 'pulse 1.4s 0.4s infinite' }} />
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
          
          {/* Lead Capture */}
          {showLeadCapture && (
            <div style={{ background: '#f8fafc', borderTop: '1px solid #e5e7eb', padding: '1rem' }}>
              <div style={{ fontWeight: '600', marginBottom: '0.5rem' }}>Schedule Legal Consultation</div>
              <input
                type="text"
                placeholder="Your Name"
                value={leadData.name}
                onChange={(e) => setLeadData({...leadData, name: e.target.value})}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '8px', marginBottom: '0.5rem' }}
              />
              <input
                type="email"
                placeholder="Email"
                value={leadData.email}
                onChange={(e) => setLeadData({...leadData, email: e.target.value})}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '8px', marginBottom: '0.5rem' }}
              />
              <button 
                onClick={handleLeadSubmit}
                disabled={!leadData.name || !leadData.email}
                style={{
                  background: 'linear-gradient(45deg, #1e40af, #1e3a8a)',
                  color: 'white',
                  border: 'none',
                  padding: '0.6rem 1.2rem',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  width: '100%',
                  opacity: (!leadData.name || !leadData.email) ? 0.6 : 1
                }}
              >
                Schedule Consultation
              </button>
            </div>
          )}
          
          {/* Quick Actions */}
          <div style={{ padding: '1rem', borderTop: '1px solid #e5e7eb', background: '#fafafa' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.5rem' }}>Quick Actions</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {['contract', 'employment', 'property', 'consultation'].map(action => (
                <button 
                  key={action}
                  onClick={() => handleQuickAction(action)}
                  style={{
                    background: 'white',
                    border: '1px solid #d1d5db',
                    padding: '0.4rem 0.8rem',
                    borderRadius: '12px',
                    fontSize: '0.8rem',
                    cursor: 'pointer'
                  }}
                >
                  {action.charAt(0).toUpperCase() + action.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      
      {/* Floating Button */}
      <button 
        onClick={toggleRecording}
        style={{
          position: 'fixed',
          bottom: '2rem',
          right: '2rem',
          background: listening ? 'linear-gradient(45deg, #b87333, #92400e)' :
                     isProcessing ? 'linear-gradient(45deg, #fbbf24, #f59e0b)' :
                     'linear-gradient(45deg, #1e40af, #1e3a8a)',
          border: 'none',
          borderRadius: '50%',
          width: '70px',
          height: '70px',
          color: 'white',
          fontSize: '1.8rem',
          zIndex: 1000,
          cursor: 'pointer',
          boxShadow: hasNewMessage ? '0 0 0 0 rgba(102, 126, 234, 0.7)' : '0 8px 25px rgba(0,0,0,0.3)',
          animation: (listening || isProcessing || hasNewMessage) ? 'pulse 1.5s infinite' : 'none'
        }}
      >
        {getButtonIcon()}
      </button>

      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.1); opacity: 0.8; }
        }
        
        @media (max-width: 768px) {
          [style*="width: 450px"] {
            width: calc(100vw - 2rem) !important;
            right: 1rem !important;
            bottom: 8rem !important;
          }
          
          [style*="width: 70px"][style*="height: 70px"] {
            width: 60px !important;
            height: 60px !important;
            bottom: 1.5rem !important;
            right: 1.5rem !important;
            fontSize: 1.5rem !important;
          }
        }
      `}</style>
    </>
  );
}