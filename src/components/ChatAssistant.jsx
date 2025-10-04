// 🚀 ULTIMATE ChatAssistant - All Features
import React, { useState, useEffect, useRef, useCallback } from "react";
import { useSpeechRecognition } from "react-speech-kit";
import { 
  sendMessage, getTTS, stopTTS, captureLead, generateAIIntroduction,
  getConversationHistory, exportConversationToPDF, emailConversationSummary,
  getConversationStats
} from "../api/chatApi";

export default function ChatAssistant() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState([]);
  const [sessionId] = useState(() => 
    `session_ultimate_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`
  );
  const [isTyping, setIsTyping] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showLeadCapture, setShowLeadCapture] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [leadData, setLeadData] = useState({ name: '', email: '', phone: '', message: '' });
  const [language, setLanguage] = useState('en');
  const [stats, setStats] = useState(null);
  
  const messagesEndRef = useRef(null);
  const { listen, listening, stop } = useSpeechRecognition({ onResult: handleUser });

  useEffect(() => {
    scrollToBottom();
  }, [msgs, isTyping]);

  useEffect(() => {
    if (open && msgs.length > 0) {
      const s = getConversationStats(sessionId);
      setStats(s);
    }
  }, [msgs, open, sessionId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const speakResponse = useCallback(async (text, lang) => {
    setIsSpeaking(true);
    try {
      await getTTS(text.replace(/Adv\./g, 'Advocate'), lang);
    } catch (err) {
      console.error("TTS error:", err);
    } finally {
      setIsSpeaking(false);
    }
  }, []);

  async function handleUser(text, isQuickAction = false) {
    if (!text?.trim()) return;
    
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
      const response = await sendMessage(text, sessionId, 'smart');
      
      setIsTyping(false);
      setIsProcessing(false);
      setLanguage(response.language || 'en');
      
      const aiMessage = {
        from: 'Advocate Arjun', 
        text: response.reply, 
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        id: Date.now(),
        language: response.language,
        legalArea: response.legalArea,
        responseTime: response.responseTime
      };
      
      setMsgs(prev => [...prev, aiMessage]);

      // Auto-suggest lead capture after 3+ messages
      if (response.conversationCount >= 3 && !showLeadCapture) {
        setTimeout(() => setShowLeadCapture(true), 3000);
      }

      stop();
      await speakResponse(response.reply, response.language);

    } catch (err) {
      console.error('AI error:', err);
      setIsTyping(false);
      setIsProcessing(false);
      const errorMsg = `I encountered an issue. Could you rephrase your question?`;
      setMsgs(prev => [...prev, { 
        from: 'Advocate Arjun', 
        text: errorMsg, 
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        id: Date.now()
      }]);
      await speakResponse(errorMsg, language);
    }
  }

  async function toggleRecording() {
    if (!open) {
      setOpen(true);
      if (msgs.length === 0) {
        setTimeout(async () => {
          const welcomeMsg = await generateAIIntroduction(sessionId, language);
          setMsgs([{
            from: 'Advocate Arjun',
            text: welcomeMsg,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            id: Date.now()
          }]);
          speakResponse(welcomeMsg, language);
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
    const queries = {
      'contract': 'I need help reviewing a contract',
      'employment': 'I have questions about employment law',
      'property': 'I need legal advice about property matters',
      'consultation': 'I would like to schedule a legal consultation',
      'document': 'I want to analyze a legal document'
    };
    
    await handleUser(queries[action], true);
  }

  async function handleLeadSubmit() {
    if (!leadData.name || !leadData.email) return;
    
    try {
      await captureLead(leadData, sessionId, 'chat');
      setShowLeadCapture(false);
      
      const successMsg = `Thank you, ${leadData.name}! Our legal team will contact you within 24 hours at ${leadData.email}.`;
      setMsgs(prev => [...prev, {
        from: 'System',
        text: successMsg,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        id: Date.now()
      }]);
      speakResponse(successMsg, language);
      
      setLeadData({ name: '', email: '', phone: '', message: '' });
      
    } catch (error) {
      console.error('Lead capture error:', error);
    }
  }

  async function handleExport(format) {
    try {
      if (format === 'pdf') {
        exportConversationToPDF(sessionId);
      } else if (format === 'email') {
        const email = prompt('Enter your email address:');
        if (email) {
          await emailConversationSummary(sessionId, email);
          alert(`Conversation summary sent to ${email}`);
        }
      }
      setShowExportMenu(false);
    } catch (error) {
      alert('Export failed: ' + error.message);
    }
  }

  function closeChat() {
    setOpen(false);
    stopTTS();
    stop();
    setIsSpeaking(false);
    setIsProcessing(false);
    setShowLeadCapture(false);
    setShowExportMenu(false);
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
    return 'Online • Smart AI';
  };

  return (
    <>
      {open && (
        <div style={{
          position: 'fixed',
          bottom: '10rem',
          right: '2rem',
          background: 'rgba(255, 255, 255, 0.98)',
          backdropFilter: 'blur(30px)',
          width: '480px',
          maxWidth: 'calc(100vw - 4rem)',
          maxHeight: '650px',
          borderRadius: '24px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          zIndex: 999,
          overflow: 'hidden',
          border: '1px solid rgba(102, 126, 234, 0.2)'
        }}>
          {/* Header */}
          <div style={{
            background: 'linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%)',
            color: 'white',
            padding: '1.2rem 1.5rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '600' }}>
                Advocate Arjun
              </h3>
              <div style={{ fontSize: '0.8rem', opacity: 0.9, marginTop: '0.3rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <span>{getStatusText()}</span>
                {language !== 'en' && (
                  <span style={{ background: 'rgba(255,255,255,0.2)', padding: '0.2rem 0.5rem', borderRadius: '8px', fontSize: '0.7rem' }}>
                    {language.toUpperCase()}
                  </span>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button 
                onClick={() => setShowExportMenu(!showExportMenu)}
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
                title="Export conversation"
              >
                📥
              </button>
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
          </div>

          {/* Export Menu */}
          {showExportMenu && (
            <div style={{
              background: '#f8fafc',
              padding: '0.8rem 1rem',
              borderBottom: '1px solid #e5e7eb',
              display: 'flex',
              gap: '0.5rem',
              flexWrap: 'wrap'
            }}>
              <button 
                onClick={() => handleExport('pdf')}
                style={{
                  background: 'white',
                  border: '1px solid #d1d5db',
                  padding: '0.4rem 0.8rem',
                  borderRadius: '8px',
                  fontSize: '0.8rem',
                  cursor: 'pointer'
                }}
              >
                📄 Export PDF
              </button>
              <button 
                onClick={() => handleExport('email')}
                style={{
                  background: 'white',
                  border: '1px solid #d1d5db',
                  padding: '0.4rem 0.8rem',
                  borderRadius: '8px',
                  fontSize: '0.8rem',
                  cursor: 'pointer'
                }}
              >
                📧 Email Summary
              </button>
            </div>
          )}

          {/* Stats Bar */}
          {stats && (
            <div style={{
              background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
              padding: '0.6rem 1rem',
              fontSize: '0.75rem',
              display: 'flex',
              justifyContent: 'space-between',
              borderBottom: '1px solid #f59e0b'
            }}>
              <span>💬 {stats.messageCount} messages</span>
              <span>⏱️ {Math.round(stats.duration / 1000 / 60)}min</span>
            </div>
          )}
          
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
                  {msg.responseTime && (
                    <span style={{ fontSize: '0.7rem', color: '#10b981' }}>
                      ⚡{msg.responseTime}ms
                    </span>
                  )}
                </div>
                <div style={{
                  background: msg.from === 'You' ? 
                    'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)' : 
                    msg.from === 'System' ?
                    'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)' :
                    'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                  padding: '0.8rem 1rem',
                  borderRadius: '15px',
                  fontSize: '0.9rem',
                  lineHeight: '1.5',
                  marginLeft: msg.from === 'You' ? '2rem' : '0',
                  marginRight: msg.from === 'You' ? '0' : '2rem'
                }}>
                  {msg.text}
                </div>
              </div>
            ))}
            
            {isTyping && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.8rem 1rem' }}>
                <span style={{ fontSize: '0.85rem', color: '#666' }}>Advocate Arjun is thinking...</span>
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
              <div style={{ fontWeight: '600', marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>📞 Schedule Consultation</span>
                <button 
                  onClick={() => setShowLeadCapture(false)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem' }}
                >
                  ×
                </button>
              </div>
              <input
                type="text"
                placeholder="Your Name *"
                value={leadData.name}
                onChange={(e) => setLeadData({...leadData, name: e.target.value})}
                style={{ width: '100%', padding: '0.6rem', border: '1px solid #d1d5db', borderRadius: '8px', marginBottom: '0.5rem', fontSize: '0.9rem' }}
              />
              <input
                type="email"
                placeholder="Email *"
                value={leadData.email}
                onChange={(e) => setLeadData({...leadData, email: e.target.value})}
                style={{ width: '100%', padding: '0.6rem', border: '1px solid #d1d5db', borderRadius: '8px', marginBottom: '0.5rem', fontSize: '0.9rem' }}
              />
              <input
                type="tel"
                placeholder="Phone (optional)"
                value={leadData.phone}
                onChange={(e) => setLeadData({...leadData, phone: e.target.value})}
                style={{ width: '100%', padding: '0.6rem', border: '1px solid #d1d5db', borderRadius: '8px', marginBottom: '0.5rem', fontSize: '0.9rem' }}
              />
              <textarea
                placeholder="Brief description of your legal matter (optional)"
                value={leadData.message}
                onChange={(e) => setLeadData({...leadData, message: e.target.value})}
                rows={2}
                style={{ width: '100%', padding: '0.6rem', border: '1px solid #d1d5db', borderRadius: '8px', marginBottom: '0.5rem', fontSize: '0.9rem', resize: 'none' }}
              />
              <button 
                onClick={handleLeadSubmit}
                disabled={!leadData.name || !leadData.email}
                style={{
                  background: (!leadData.name || !leadData.email) ? '#d1d5db' : 'linear-gradient(45deg, #1e40af, #1e3a8a)',
                  color: 'white',
                  border: 'none',
                  padding: '0.7rem 1.2rem',
                  borderRadius: '10px',
                  cursor: (!leadData.name || !leadData.email) ? 'not-allowed' : 'pointer',
                  width: '100%',
                  fontWeight: '600',
                  fontSize: '0.9rem'
                }}
              >
                📅 Schedule Consultation
              </button>
            </div>
          )}
          
          {/* Quick Actions */}
          <div style={{ padding: '1rem', borderTop: '1px solid #e5e7eb', background: 'linear-gradient(135deg, #fafafa 0%, #f3f4f6 100%)' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.6rem', color: '#374151' }}>⚡ Quick Actions</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {['contract', 'employment', 'property', 'document', 'consultation'].map(action => (
                <button 
                  key={action}
                  onClick={() => handleQuickAction(action)}
                  disabled={isProcessing}
                  style={{
                    background: 'white',
                    border: '1px solid #d1d5db',
                    padding: '0.5rem 0.9rem',
                    borderRadius: '12px',
                    fontSize: '0.8rem',
                    cursor: isProcessing ? 'not-allowed' : 'pointer',
                    fontWeight: '500',
                    opacity: isProcessing ? 0.6 : 1,
                    transition: 'all 0.2s',
                    ':hover': { background: '#f3f4f6' }
                  }}
                >
                  {action === 'contract' && '📄'} 
                  {action === 'employment' && '👔'} 
                  {action === 'property' && '🏠'} 
                  {action === 'document' && '📋'} 
                  {action === 'consultation' && '📞'} 
                  {' ' + action.charAt(0).toUpperCase() + action.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Language Selector */}
          <div style={{ 
            padding: '0.6rem 1rem', 
            background: '#f8fafc', 
            borderTop: '1px solid #e5e7eb',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '0.75rem',
            color: '#6b7280'
          }}>
            <span>🌐 Language: {language === 'en' ? 'English' : language === 'hi' ? 'हिंदी' : language === 'ta' ? 'தமிழ்' : 'తెలుగు'}</span>
            <span style={{ color: '#10b981', fontWeight: '600' }}>✓ Context Aware</span>
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
          background: listening ? 'linear-gradient(45deg, #dc2626, #991b1b)' :
                     isProcessing ? 'linear-gradient(45deg, #f59e0b, #d97706)' :
                     'linear-gradient(45deg, #1e40af, #1e3a8a)',
          border: 'none',
          borderRadius: '50%',
          width: '70px',
          height: '70px',
          color: 'white',
          fontSize: '2rem',
          zIndex: 1000,
          cursor: 'pointer',
          boxShadow: '0 8px 25px rgba(0,0,0,0.3)',
          animation: (listening || isProcessing) ? 'pulse 1.5s infinite' : 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.3s ease'
        }}
        title={listening ? 'Click to stop' : 'Click to speak'}
      >
        {getButtonIcon()}
      </button>

      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); box-shadow: 0 8px 25px rgba(0,0,0,0.3); }
          50% { transform: scale(1.1); box-shadow: 0 12px 35px rgba(0,0,0,0.4); }
        }
        
        @media (max-width: 768px) {
          [style*="width: 480px"] {
            width: calc(100vw - 2rem) !important;
            right: 1rem !important;
            bottom: 8rem !important;
          }
          
          [style*="width: 70px"][style*="height: 70px"] {
            width: 60px !important;
            height: 60px !important;
            bottom: 1.5rem !important;
            right: 1.5rem !important;
            font-size: 1.6rem !important;
          }
        }
        
        button:hover {
          filter: brightness(1.05);
        }
      `}</style>
    </>
  );
}