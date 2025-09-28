// CharacterView.jsx with Fixed TTS and Pronunciation
import React, { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import styled, { keyframes, createGlobalStyle } from "styled-components";
import { useSpeechRecognition } from "react-speech-kit";
import { sendMessage, getTTS, stopTTS } from "../api/chatApi";

const fadeIn = keyframes`from { opacity:0 } to { opacity:1 }`;
const pulse = keyframes`
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.1); }
`;

const GlobalStyles = createGlobalStyle`
  * { box-sizing: border-box; }
  body { margin: 0; overflow: hidden; font-family: 'Inter', -apple-system, sans-serif; }
`;

const Container = styled.div`
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%);
  transition: background 0.8s ease;
  
  &.corporate-mode { background: linear-gradient(135deg, #1e40af 0%, #3730a3 100%); }
  &.litigation-mode { background: linear-gradient(135deg, #7c2d12 0%, #92400e 100%); }
  &.consultation-mode { background: linear-gradient(135deg, #b87333 0%, #d97706 100%); }
`;

const Tooltip = styled.div`
  position: absolute;
  top: 1rem;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0,0,0,0.8);
  color: white;
  padding: 0.8rem 1.2rem;
  border-radius: 25px;
  font-size: 0.9rem;
  font-weight: 500;
  animation: ${fadeIn} 0.5s ease;
  backdrop-filter: blur(10px);
  z-index: 100;
  
  @media (max-width: 768px) {
    font-size: 0.8rem;
    padding: 0.6rem 1rem;
    top: 0.5rem;
    left: 1rem;
    right: 1rem;
    transform: none;
    text-align: center;
  }
`;

const ChatBubble = styled.div`
  position: absolute;
  bottom: 8rem;
  left: 2rem;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  padding: 1.5rem;
  border-radius: 20px;
  max-width: 400px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.2);
  border: 1px solid rgba(184, 115, 51, 0.3);
  animation: ${fadeIn} 0.5s ease;
  z-index: 90;

  @media (max-width: 768px) {
    left: 1rem;
    right: 1rem;
    bottom: 6rem;
    max-width: none;
    padding: 1.2rem;
  }

  p { 
    margin: 0; 
    font-size: 1rem; 
    line-height: 1.5; 
    color: #1e40af;
    
    @media (max-width: 768px) {
      font-size: 0.9rem;
    }
  }

  .close-btn {
    position: absolute;
    top: 1rem;
    right: 1rem;
    background: none;
    border: none;
    font-size: 1.2rem;
    cursor: pointer;
    color: #64748b;
    width: 30px;
    height: 30px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s ease;
    
    &:hover { 
      color: #b87333; 
      background: rgba(184, 115, 51, 0.1);
    }
  }
`;

const InteractionButton = styled.button`
  position: absolute;
  bottom: 2rem;
  left: 2rem;
  padding: 1rem 2rem;
  border-radius: 50px;
  background: ${props => props.listening ? '#b87333' : 'rgba(30, 64, 175, 0.9)'};
  color: white;
  border: 2px solid rgba(184, 115, 51, 0.3);
  backdrop-filter: blur(20px);
  cursor: pointer;
  font-size: 1rem;
  font-weight: 600;
  transition: all 0.3s ease;
  animation: ${props => props.listening ? pulse : 'none'} 1.5s infinite;
  z-index: 100;

  @media (max-width: 768px) {
    left: 50%;
    transform: translateX(-50%);
    bottom: 1rem;
    padding: 0.8rem 1.5rem;
    font-size: 0.9rem;
  }

  &:hover {
    background: ${props => props.listening ? '#92400e' : 'rgba(30, 64, 175, 1)'};
    box-shadow: 0 8px 25px rgba(0,0,0,0.2);
  }

  &:active {
    transform: scale(0.95);
  }
`;

const ContactForm = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(30px);
  padding: 2.5rem;
  border-radius: 20px;
  width: 90%;
  max-width: 500px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.3);
  border: 1px solid rgba(184, 115, 51, 0.2);
  z-index: 200;
  animation: ${fadeIn} 0.5s ease;

  @media (max-width: 768px) {
    padding: 2rem 1.5rem;
    width: 95%;
    max-height: 90vh;
    overflow-y: auto;
  }

  h3 { 
    margin: 0 0 2rem 0; 
    text-align: center; 
    color: #1e40af;
    font-size: 1.5rem;
    font-weight: 700;
    
    @media (max-width: 768px) {
      font-size: 1.3rem;
      margin-bottom: 1.5rem;
    }
  }

  input, textarea, select {
    width: 100%; 
    margin-bottom: 1.5rem; 
    padding: 1rem; 
    border: 2px solid rgba(30, 64, 175, 0.1);
    border-radius: 12px; 
    font-size: 1rem; 
    background: rgba(255, 255, 255, 0.8);
    transition: all 0.3s ease;
    
    &:focus { 
      outline: none; 
      border-color: #b87333;
      background: white;
      box-shadow: 0 0 0 3px rgba(184, 115, 51, 0.1);
    }
    
    @media (max-width: 768px) {
      padding: 0.8rem;
      font-size: 0.9rem;
      margin-bottom: 1.2rem;
    }
  }

  textarea { 
    height: 120px; 
    resize: vertical;
    font-family: inherit;
  }

  .buttons { 
    display: flex; 
    gap: 1rem; 
    justify-content: center;
    flex-wrap: wrap;
  }

  .btn {
    padding: 1rem 2rem; 
    border: none; 
    border-radius: 12px; 
    cursor: pointer; 
    font-size: 1rem;
    font-weight: 600;
    transition: all 0.3s ease;
    min-width: 120px;
    
    @media (max-width: 768px) {
      padding: 0.8rem 1.5rem;
      font-size: 0.9rem;
      min-width: 100px;
    }
    
    &.submit { 
      background: linear-gradient(45deg, #b87333, #92400e);
      color: white; 
      box-shadow: 0 4px 15px rgba(184, 115, 51, 0.3);
      
      &:hover { 
        transform: translateY(-2px);
        box-shadow: 0 6px 20px rgba(184, 115, 51, 0.4);
      }
    }
    
    &.cancel { 
      background: rgba(100, 116, 139, 0.2);
      color: #475569;
      border: 2px solid rgba(100, 116, 139, 0.3);
      
      &:hover { 
        background: rgba(100, 116, 139, 0.3);
        transform: translateY(-2px);
      }
    }
  }
`;

const HotspotInfo = styled.div`
  position: absolute;
  bottom: 12rem;
  right: 2rem;
  background: rgba(0,0,0,0.8);
  color: white;
  padding: 1rem 1.5rem;
  border-radius: 15px;
  font-size: 0.9rem;
  max-width: 300px;
  backdrop-filter: blur(10px);
  animation: ${fadeIn} 0.5s ease;
  
  @media (max-width: 768px) {
    right: 1rem;
    left: 1rem;
    bottom: 10rem;
    max-width: none;
    text-align: center;
  }
`;

export default function CharacterView({ onMessage }) {
  const container = useRef();
  const [loading, setLoading] = useState(true);
  const [aiText, setAiText] = useState("");
  const [showContactForm, setShowContactForm] = useState(false);
  const [currentMode, setCurrentMode] = useState('default');
  const [hotspotInfo, setHotspotInfo] = useState("");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [formData, setFormData] = useState({ 
    name: "", 
    email: "", 
    phone: "",
    legalArea: "corporate_law",
    urgency: "medium",
    message: "" 
  });
  const { listen, listening, stop } = useSpeechRecognition({ onResult: handleVoiceCommand });

  const hotspotPrompts = {
    services: "What comprehensive legal services does FoxMandal offer to clients in India?",
    expertise: "Tell me about Fox Man-dal's areas of legal expertise and specialization in Indian law",
    consultation: "I want to schedule a legal consultation with FoxMandal legal team"
  };

  const modeContexts = {
    services: 'corporate-mode',
    expertise: 'litigation-mode', 
    consultation: 'consultation-mode'
  };

  // Enhanced voice command handler with better TTS control
  async function handleVoiceCommand(text) {
    if (!text?.trim()) return;
    
    // Stop any ongoing speech
    stopTTS();
    stop();
    
    setAiText("Analyzing your legal query...");
    setHotspotInfo("");

    try {
      const { reply } = await sendMessage(text);
      setAiText(reply);
      onMessage?.(reply);
      
      // Determine interaction mode based on response
      const lowerReply = reply.toLowerCase();
      if (lowerReply.includes('consultation') || lowerReply.includes('legal advice') || lowerReply.includes('schedule')) {
        setCurrentMode('consultation-mode');
        setTimeout(() => setShowContactForm(true), 3000); // Wait for speech to complete
      } else if (lowerReply.includes('corporate') || lowerReply.includes('business')) {
        setCurrentMode('corporate-mode');
      } else if (lowerReply.includes('litigation') || lowerReply.includes('court') || lowerReply.includes('dispute')) {
        setCurrentMode('litigation-mode');
      }
      
      await speakAndListen(reply);
    } catch (err) {
      console.error("Legal consultation error:", err);
      const errorMessage = "I'm experiencing connectivity issues with our legal system. Please try again in a moment or use the contact form below for assistance.";
      setAiText(errorMessage);
      await speakResponse(errorMessage);
      setTimeout(() => setShowContactForm(true), 2000);
    }
  }

  // Separate function for speaking responses
  const speakResponse = useCallback(async (text) => {
    if (!text) return;
    
    setIsSpeaking(true);
    try {
      await getTTS(text);
    } catch (err) {
      console.error("TTS error:", err);
    } finally {
      setIsSpeaking(false);
    }
  }, []);

  // Enhanced speak and listen function
  const speakAndListen = useCallback(async (text) => {
    stop(); // Stop listening first
    
    // Speak the response
    await speakResponse(text);
    
    // Resume listening after speech completes, with a small delay
    setTimeout(() => {
      if (!showContactForm) { // Don't resume listening if form is shown
        listen({ interimResults: false });
      }
    }, 500);
  }, [stop, listen, showContactForm, speakResponse]);

  // Enhanced THREE.js scene (simplified for better performance)
  useEffect(() => {
    const el = container.current;
    const scene = new THREE.Scene();
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(el.clientWidth, el.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    el.appendChild(renderer.domElement);

    const camera = new THREE.PerspectiveCamera(65, el.clientWidth / el.clientHeight, 0.1, 500);
    camera.position.set(0, 0, 2.5);
    
    let mouseX = 0, mouseY = 0;
    
    const onMouseMove = (event) => {
      mouseX = (event.clientX - window.innerWidth / 2) / 100;
      mouseY = (event.clientY - window.innerHeight / 2) / 100;
    };
    window.addEventListener('mousemove', onMouseMove);

    // Lighting setup
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 5, 5);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    // Main display plane
    const geometry = new THREE.PlaneGeometry(2.5, 1.8);
    let material = new THREE.MeshLambertMaterial({ 
      color: 0x1e40af, 
      transparent: true, 
      opacity: 0.9 
    });
    const plane = new THREE.Mesh(geometry, material);
    plane.receiveShadow = true;
    scene.add(plane);

    // Try to load Fox Mandal texture
    const textureLoader = new THREE.TextureLoader();
    textureLoader.load(
      "/logo.png", // You can add this image
      (texture) => { 
        plane.material = new THREE.MeshLambertMaterial({ map: texture });
        setLoading(false);
      },
      undefined,
      () => { 
        console.log("FoxMandal texture not found - using legal blue background");
        setLoading(false);
      }
    );

    // Legal service hotspots
    const hotspotCoords = { 
      services: [0.8, 0.4, 0.01], 
      expertise: [-0.8, 0.3, 0.01], 
      consultation: [0, -0.5, 0.01] 
    };
    const hotspots = {};

    Object.entries(hotspotCoords).forEach(([key, pos]) => {
      const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(0.06, 32, 32),
        new THREE.MeshLambertMaterial({ 
          color: 0xb87333, 
          transparent: true, 
          opacity: 0.9,
          emissive: 0xb87333,
          emissiveIntensity: 0.2
        })
      );
      sphere.position.set(...pos);
      sphere.name = key;
      sphere.castShadow = true;
      scene.add(sphere);
      hotspots[key] = sphere;

      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.08, 0.12, 32),
        new THREE.MeshLambertMaterial({ 
          color: 0xb87333, 
          transparent: true, 
          opacity: 0.4 
        })
      );
      ring.position.set(...pos);
      scene.add(ring);
      hotspots[key + "_ring"] = ring;
    });

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    function onPointerDown(e) {
      if (e.target !== renderer.domElement) return;
      
      const { left, top, width, height } = el.getBoundingClientRect();
      mouse.x = ((e.clientX - left) / width) * 2 - 1;
      mouse.y = -((e.clientY - top) / height) * 2 + 1;
      
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(scene.children);
      const hit = hits.find(h => hotspotCoords[h.object.name]);
      
      if (hit) {
        const hotspotName = hit.object.name;
        setCurrentMode(modeContexts[hotspotName] || 'default');
        setHotspotInfo(`Exploring: ${hotspotName.toUpperCase()}`);
        
        handleVoiceCommand(hotspotPrompts[hotspotName] || hotspotName);
      }
    }

    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("touchstart", onPointerDown);

    function animate() {
      const time = Date.now() * 0.002;
      
      // Camera movement based on mouse
      camera.position.x += (mouseX - camera.position.x) * 0.05;
      camera.position.y += (-mouseY - camera.position.y) * 0.05;
      camera.lookAt(scene.position);
      
      // Animate hotspots
      Object.entries(hotspots).forEach(([key, obj]) => {
        if (key.includes("_ring")) {
          const scale = 1 + 0.15 * Math.sin(time * 2);
          obj.scale.setScalar(scale);
          obj.rotation.z = time * 0.5;
        } else {
          const scale = 1 + 0.1 * Math.sin(time * 1.8);
          obj.scale.setScalar(scale);
        }
      });
      
      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    }

    animate();

    const onResize = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("touchstart", onPointerDown);
      window.removeEventListener('mousemove', onMouseMove);
      if (el.contains(renderer.domElement)) {
        el.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  const handleGreetAndListen = async () => {
    // Fixed greeting with proper pronunciation
    const greeting = "Hello! I'm Advocate Arjun, your AI legal consultant from FoxMandal, one of India's premier law firms. I'm here to help you understand our legal services, discuss your legal needs, or provide guidance on Indian law. How can I assist you with your legal matters today?";
    
    setAiText(greeting);
    onMessage?.(greeting);
    
    // Speak greeting and then start listening
    await speakAndListen(greeting);
  };

  const handleStopInteraction = () => {
    stopTTS();
    stop();
    setIsSpeaking(false);
  };

  const handleFormSubmit = async () => {
    if (!formData.name?.trim() || !formData.email?.trim() || !formData.phone?.trim()) {
      alert("Please fill in your name, email, and phone number");
      return;
    }
    
    try {
      const response = await fetch('https://character-chan.onrender.com/capture-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          legalArea: formData.legalArea,
          urgency: formData.urgency,
          message: formData.message,
          sessionId: `session_${Date.now()}`,
          source: 'character_view_form'
        })
      });

      if (response.ok) {
        setShowContactForm(false);
        const successMessage = "Thank you for your interest! Our legal team will contact you within 24 hours to schedule your consultation and discuss your legal needs in detail.";
        setAiText(successMessage);
        await speakResponse(successMessage);
        
        setFormData({ 
          name: "", 
          email: "", 
          phone: "",
          legalArea: "corporate_law",
          urgency: "medium",
          message: "" 
        });
        setCurrentMode('default');
      } else {
        throw new Error('Submission failed');
      }
    } catch (error) {
      console.error('Form submission error:', error);
      alert('There was an issue submitting your request. Please try again or contact us directly.');
    }
  };


  return (
    <>
      <GlobalStyles />
      <Container ref={container} className={currentMode}>
        <Tooltip>
          {loading 
            ? "Loading FoxMandal legal consultation interface..." 
            : "Click hotspots to explore services or start a conversation with Adv. Arjun"
          }
        </Tooltip>

        <InteractionButton 
          listening={listening}
          onClick={() => listening ? stop() : handleGreetAndListen()}
        >
          {listening ? 'Stop Listening' : 'Talk to Adv. Arjun'}
        </InteractionButton>

        {aiText && (
          <ChatBubble>
            <p>{aiText}</p>
            <button className="close-btn" onClick={() => setAiText('')}>×</button>
          </ChatBubble>
        )}

        {hotspotInfo && (
          <HotspotInfo>
            {hotspotInfo}
          </HotspotInfo>
        )}

        {showContactForm && (
          <ContactForm>
            <h3>Schedule Legal Consultation</h3>
            <input 
              placeholder="Your full name" 
              value={formData.name} 
              onChange={e => setFormData({...formData, name: e.target.value})}
            />
            <input 
              placeholder="Email address" 
              type="email" 
              value={formData.email} 
              onChange={e => setFormData({...formData, email: e.target.value})}
            />
            <input 
              placeholder="Phone number" 
              type="tel" 
              value={formData.phone} 
              onChange={e => setFormData({...formData, phone: e.target.value})}
            />
            <select 
              value={formData.legalArea} 
              onChange={e => setFormData({...formData, legalArea: e.target.value})}
            >
              <option value="corporate_law">Corporate Law</option>
              <option value="litigation">Litigation & Disputes</option>
              <option value="intellectual_property">Intellectual Property</option>
              <option value="employment_law">Employment Law</option>
              <option value="real_estate">Real Estate</option>
              <option value="tax_law">Tax Law</option>
              <option value="contracts">Contract Law</option>
              <option value="consultation_request">General Legal Advice</option>
            </select>
            <select 
              value={formData.urgency} 
              onChange={e => setFormData({...formData, urgency: e.target.value})}
            >
              <option value="low">General inquiry</option>
              <option value="medium">Within a week</option>
              <option value="high">Urgent matter (ASAP)</option>
            </select>
            <textarea 
              placeholder="Briefly describe your legal matter or questions..." 
              value={formData.message} 
              onChange={e => setFormData({...formData, message: e.target.value})}
            />
            <div className="buttons">
              <button className="btn submit" onClick={handleFormSubmit}>
                Request Consultation
              </button>
              <button className="btn cancel" onClick={() => setShowContactForm(false)}>
                Cancel
              </button>
            </div>
          </ContactForm>
        )}
      </Container>
    </>
  );
}