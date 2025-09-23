// src/components/CharacterView.jsx
import React, { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import styled, { keyframes, createGlobalStyle } from "styled-components";
import { useSpeechRecognition } from "react-speech-kit";
import { sendMessage, getTTS } from "../api/chatApi";

const fadeIn = keyframes`from { opacity:0 } to { opacity:1 }`;
const pulse = keyframes`
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.1); }
`;
const glow = keyframes`
  0%, 100% { box-shadow: 0 0 20px rgba(231, 76, 60, 0.3); }
  50% { box-shadow: 0 0 30px rgba(231, 76, 60, 0.8); }
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
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  transition: background 0.8s ease;
  
  &.branding-mode { background: linear-gradient(135deg, #ff7e5f 0%, #feb47b 100%); }
  &.strategy-mode { background: linear-gradient(135deg, #2c3e50 0%, #4a6741 100%); }
  &.creative-mode { background: linear-gradient(135deg, #8360c3 0%, #2ebf91 100%); }
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
  border: 1px solid rgba(255, 255, 255, 0.2);
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
    color: #2c3e50;
    
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
    color: #95a5a6;
    width: 30px;
    height: 30px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s ease;
    
    &:hover { 
      color: #e74c3c; 
      background: rgba(231, 76, 60, 0.1);
    }
  }
`;

const InteractionButton = styled.button`
  position: absolute;
  bottom: 2rem;
  left: 2rem;
  padding: 1rem 2rem;
  border-radius: 50px;
  background: ${props => props.listening ? '#e74c3c' : 'rgba(255, 255, 255, 0.2)'};
  color: white;
  border: 2px solid rgba(255, 255, 255, 0.3);
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
    background: ${props => props.listening ? '#c0392b' : 'rgba(255, 255, 255, 0.3)'};
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
  border: 1px solid rgba(255, 255, 255, 0.2);
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
    color: #2c3e50;
    font-size: 1.5rem;
    font-weight: 700;
    
    @media (max-width: 768px) {
      font-size: 1.3rem;
      margin-bottom: 1.5rem;
    }
  }

  input, textarea {
    width: 100%; 
    margin-bottom: 1.5rem; 
    padding: 1rem; 
    border: 2px solid rgba(0,0,0,0.1);
    border-radius: 12px; 
    font-size: 1rem; 
    background: rgba(255, 255, 255, 0.8);
    transition: all 0.3s ease;
    
    &:focus { 
      outline: none; 
      border-color: #e74c3c;
      background: white;
      box-shadow: 0 0 0 3px rgba(231, 76, 60, 0.1);
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
      background: linear-gradient(45deg, #e74c3c, #c0392b);
      color: white; 
      box-shadow: 0 4px 15px rgba(231, 76, 60, 0.3);
      
      &:hover { 
        transform: translateY(-2px);
        box-shadow: 0 6px 20px rgba(231, 76, 60, 0.4);
      }
    }
    
    &.cancel { 
      background: rgba(149, 165, 166, 0.2);
      color: #7f8c8d;
      border: 2px solid rgba(149, 165, 166, 0.3);
      
      &:hover { 
        background: rgba(149, 165, 166, 0.3);
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
  const [formData, setFormData] = useState({ name: "", email: "", message: "" });
  const { listen, listening, stop } = useSpeechRecognition({ onResult: handleVoiceCommand });

  const hotspotPrompts = {
    history: "Tell me about Origami Creative's history and background",
    services: "What comprehensive services does Origami Creative offer to clients?",
    contact: "I want to connect with the Origami Creative team for my project"
  };

  const modeContexts = {
    history: 'strategy-mode',
    services: 'creative-mode', 
    contact: 'branding-mode'
  };

  async function handleVoiceCommand(text) {
    if (!text?.trim()) return;
    setAiText("Processing your request...");
    setHotspotInfo("");

    try {
      const { reply } = await sendMessage(text);
      setAiText(reply);
      onMessage?.(reply);
      
      // Determine interaction mode based on response
      const lowerReply = reply.toLowerCase();
      if (lowerReply.includes('contact') || lowerReply.includes('reach out')) {
        setCurrentMode('branding-mode');
        setTimeout(() => setShowContactForm(true), 2000);
      } else if (lowerReply.includes('service') || lowerReply.includes('creative')) {
        setCurrentMode('creative-mode');
      } else if (lowerReply.includes('strategy') || lowerReply.includes('brand')) {
        setCurrentMode('strategy-mode');
      }
      
      await speakAndListen(reply);
    } catch (err) {
      console.error("Chat error:", err);
      setAiText("I'm experiencing connectivity issues. Please try again in a moment.");
    }
  }

  const speakAndListen = useCallback(async (text) => {
    stop();
    window.speechSynthesis.cancel();

    try {
      await getTTS(text);
    } catch (err) {
      console.error("TTS error:", err);
    }

    setTimeout(() => listen({ interimResults: false }), 1000);
  }, [stop, listen]);

  // Enhanced THREE.js scene with better lighting and effects
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
    
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxDistance = 5;
    controls.minDistance = 1;

    // Enhanced lighting setup
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 5, 5);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    const geometry = new THREE.PlaneGeometry(2.5, 1.8);
    let material = new THREE.MeshLambertMaterial({ 
      color: 0x2c3e50, 
      transparent: true, 
      opacity: 0.9 
    });
    const plane = new THREE.Mesh(geometry, material);
    plane.receiveShadow = true;
    scene.add(plane);

    const textureLoader = new THREE.TextureLoader();
    textureLoader.load(
      "/origami-screenshot.jpg",
      (texture) => { 
        plane.material = new THREE.MeshLambertMaterial({ map: texture });
        setLoading(false);
        animate();
      },
      undefined,
      () => { 
        console.log("Texture load failed - using fallback");
        setLoading(false);
        animate();
      }
    );

    // Enhanced hotspots with better positioning for mobile
    const hotspotCoords = { 
      history: [0.8, 0.4, 0.01], 
      services: [-0.8, 0.3, 0.01], 
      contact: [0, -0.5, 0.01] 
    };
    const hotspots = {};

    Object.entries(hotspotCoords).forEach(([key, pos]) => {
      // Main hotspot sphere
      const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(0.06, 32, 32),
        new THREE.MeshLambertMaterial({ 
          color: 0xe74c3c, 
          transparent: true, 
          opacity: 0.9,
          emissive: 0xe74c3c,
          emissiveIntensity: 0.2
        })
      );
      sphere.position.set(...pos);
      sphere.name = key;
      sphere.castShadow = true;
      scene.add(sphere);
      hotspots[key] = sphere;

      // Animated ring
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.08, 0.12, 32),
        new THREE.MeshLambertMaterial({ 
          color: 0xe74c3c, 
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
        
        // Smooth camera animation to hotspot
        controls.target.copy(hit.object.position);
        camera.position.z = 2;
        controls.update();
      }
    }

    // Touch and mouse events
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("touchstart", onPointerDown);

    function animate() {
      const time = Date.now() * 0.002;
      
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
      
      controls.update();
      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    }

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
      if (el.contains(renderer.domElement)) {
        el.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  const handleGreetAndListen = async () => {
    const greeting = "Hello! I'm Rakesh, your AI brand strategist from Origami Creative. I'm here to help you explore our services, discuss your branding needs, or answer any questions. What would you like to know?";
    setAiText(greeting);
    onMessage?.(greeting);
    await speakAndListen(greeting);
  };

  const handleFormSubmit = () => {
    if (!formData.name?.trim() || !formData.email?.trim()) {
      alert("Please fill in your name and email address");
      return;
    }
    
    console.log("Lead captured:", formData);
    setShowContactForm(false);
    setAiText("Thank you for your interest! Our team will reach out to you within 24 hours to discuss your project.");
    setFormData({ name: "", email: "", message: "" });
    setCurrentMode('default');
  };

  return (
    <>
      <GlobalStyles />
      <Container ref={container} className={currentMode}>
        <Tooltip>
          {loading 
            ? "Loading interactive experience..." 
            : "Click hotspots to explore or start a conversation with Rakesh"
          }
        </Tooltip>

        <InteractionButton 
          listening={listening}
          onClick={() => listening ? stop() : handleGreetAndListen()}
        >
          {listening ? '🛑 Stop Listening' : '🤖 Talk to Rakesh'}
        </InteractionButton>

        {aiText && (
          <ChatBubble>
            <p>{aiText}</p>
            <button className="close-btn" onClick={() => setAiText('')}>✕</button>
          </ChatBubble>
        )}

        {hotspotInfo && (
          <HotspotInfo>
            {hotspotInfo}
          </HotspotInfo>
        )}

        {showContactForm && (
          <ContactForm>
            <h3>Connect with Origami Creative</h3>
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
            <textarea 
              placeholder="Tell us about your project or branding needs..." 
              value={formData.message} 
              onChange={e => setFormData({...formData, message: e.target.value})}
            />
            <div className="buttons">
              <button className="btn submit" onClick={handleFormSubmit}>
                Send Message
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