// src/components/CharacterView.jsx
import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import styled, { keyframes } from "styled-components";
import { useSpeechRecognition } from "react-speech-kit";
import { sendMessage, getTTS } from "../api/chatApi";
import useTTS from "../hooks/useTTS";

const fadeIn = keyframes`from { opacity:0 } to { opacity:1 }`;

const Tooltip = styled.div`
  position: absolute;
  top: 1rem;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0,0,0,0.6);
  color: white;
  padding: 0.4rem 0.8rem;
  border-radius: 4px;
  font-size: 0.9rem;
  animation: ${fadeIn} 0.5s ease;
`;

const ChatBubble = styled.div`
  position: absolute;
  bottom: 6rem;
  left: 1rem;
  background: #fff;
  padding: 1rem;
  border-radius: 12px;
  max-width: 300px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  border-left: 4px solid #e74c3c;

  p { margin: 0; font-size: 0.9rem; line-height: 1.4; }

  button {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
    background: none;
    border: none;
    font-size: 1rem;
    cursor: pointer;
    color: #999;
    &:hover { color: #e74c3c; }
  }
`;

const ContactForm = styled.div`
  position: absolute;
  top: 10%;
  left: 50%;
  transform: translateX(-50%);
  background: #fff;
  padding: 2rem;
  border-radius: 12px;
  width: 90%;
  max-width: 400px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.2);

  h3 { margin-top:0; text-align:center; color:#333; }

  input, textarea {
    width: 100%; margin-bottom:1rem; padding:0.75rem; border:2px solid #eee;
    border-radius:6px; font-size:0.9rem; box-sizing:border-box;
    &:focus { outline:none; border-color:#e74c3c; }
  }

  textarea { height:80px; resize: vertical; }

  .buttons { display:flex; gap:1rem; justify-content:center; }

  button {
    padding:0.75rem 1.5rem; border:none; border-radius:6px; cursor:pointer; font-size:0.9rem;
    &.submit { background:#e74c3c; color:white; &:hover{ background:#c0392b; } }
    &.cancel { background:#95a5a6; color:white; &:hover{ background:#7f8c8d; } }
  }
`;

export default function CharacterView({ onMessage }) {
  const container = useRef();
  const [loading, setLoading] = useState(true);
  const [aiText, setAiText] = useState("");
  const [showContactForm, setShowContactForm] = useState(false);
  const [formData, setFormData] = useState({ name: "", email: "", message: "" });
  const { speak } = useTTS();
  const { listen, listening, stop } = useSpeechRecognition({ onResult: handleVoiceCommand });

  const hotspotPrompts = {
    history: "Tell me about Origami Creative's history",
    services: "What services does Origami Creative offer?",
    contact: "I want to get in touch with Origami Creative team"
  };

  async function handleVoiceCommand(text) {
    if (!text) return;
    setAiText("Thinking...");

    try {
      const { reply } = await sendMessage(text);
      setAiText(reply);
      onMessage?.(reply);
      await speakAndListen(reply);

      if (reply.toLowerCase().includes("contact") ||
          reply.toLowerCase().includes("reach out")) {
        setTimeout(() => setShowContactForm(true), 1000);
      }
    } catch (err) {
      console.error("❌ Chat error:", err);
      setAiText("I'm having trouble connecting right now. Please try again later.");
    }
  }

  const speakAndListen = async (text) => {
    stop();
    window.speechSynthesis.cancel();

    try {
      const audioBuffer = await getTTS(text);
      const audioBlob = new Blob([audioBuffer], { type: "audio/mp3" });
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      await audio.play();
    } catch (err) {
      console.error("❌ TTS error:", err);
    }

    setTimeout(() => listen({ interimResults:false }), 500);
  };

  // THREE.js scene setup remains unchanged
  useEffect(() => {
    const el = container.current;
    const scene = new THREE.Scene();
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(el.clientWidth, el.clientHeight);
    el.appendChild(renderer.domElement);

    const camera = new THREE.PerspectiveCamera(65, el.clientWidth / el.clientHeight, 0.1, 500);
    camera.position.set(0,0,2);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    const geometry = new THREE.PlaneGeometry(2,1.5);
    let material = new THREE.MeshBasicMaterial({ color:0x2c3e50, transparent:true, opacity:0.8 });
    const plane = new THREE.Mesh(geometry, material);
    scene.add(plane);

    const textureLoader = new THREE.TextureLoader();
    textureLoader.load(
      "/origami-screenshot.jpg",
      (texture) => { plane.material = new THREE.MeshBasicMaterial({ map: texture }); setLoading(false); animate(); },
      undefined,
      () => { console.log("Texture load failed"); setLoading(false); animate(); }
    );

    const hotspotCoords = { history:[0.6,0.3,0.01], services:[-0.6,0.2,0.01], contact:[0,-0.4,0.01] };
    const hotspots = {};

    Object.entries(hotspotCoords).forEach(([key, pos]) => {
      const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(0.04,32,32),
        new THREE.MeshBasicMaterial({ color:0xe74c3c, transparent:true, opacity:0.8 })
      );
      sphere.position.set(...pos); sphere.name=key; scene.add(sphere); hotspots[key]=sphere;

      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.06,0.08,32),
        new THREE.MeshBasicMaterial({ color:0xe74c3c, transparent:true, opacity:0.3 })
      );
      ring.position.set(...pos); scene.add(ring); hotspots[key+"_ring"]=ring;
    });

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    function onPointerDown(e) {
      if(e.target!==renderer.domElement) return;
      const {left, top, width, height} = el.getBoundingClientRect();
      mouse.x=((e.clientX-left)/width)*2-1;
      mouse.y=-((e.clientY-top)/height)*2+1;
      raycaster.setFromCamera(mouse,camera);
      const hits = raycaster.intersectObjects(scene.children);
      const hit = hits.find(h=>hotspotCoords[h.object.name]);
      if(hit){ handleVoiceCommand(hotspotPrompts[hit.object.name]||hit.object.name); controls.target.copy(hit.object.position); camera.position.z=1.5; controls.update(); }
    }

    window.addEventListener("pointerdown", onPointerDown);

    function animate(){
      const time = Date.now()*0.003;
      Object.entries(hotspots).forEach(([key,obj])=>{
        const scale = key.includes("_ring") ? 1+0.1*Math.sin(time*2) : 1+0.15*Math.sin(time*1.5);
        obj.scale.setScalar(scale);
      });
      controls.update();
      renderer.render(scene,camera);
      requestAnimationFrame(animate);
    }

    const onResize=()=>{ const w=el.clientWidth,h=el.clientHeight; renderer.setSize(w,h); camera.aspect=w/h; camera.updateProjectionMatrix(); };
    window.addEventListener("resize",onResize);

    return () => {
      window.removeEventListener("resize",onResize);
      window.removeEventListener("pointerdown",onPointerDown);
      if(el.contains(renderer.domElement)) el.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, []);

  const handleGreetAndListen = async () => {
    const greeting = "Hi, I'm Rakesh — the AI brand strategist. What would you like to know?";
    setAiText(greeting); onMessage?.(greeting); await speakAndListen(greeting);
  };

  const handleFormSubmit = () => {
    if(!formData.name || !formData.email){ alert("Please fill in name & email"); return; }
    console.log("Form submitted:", formData);
    setShowContactForm(false);
    setAiText("Thank you! We will get back to you soon.");
    setFormData({name:"",email:"",message:""});
  };

  return (
    <div ref={container} style={{ position:'relative', width:'100%', height:'100vh' }}>
      <Tooltip>{loading ? "Loading..." : "Click hotspots or talk to Rakesh"}</Tooltip>

      <button
        onClick={()=>{ listening?stop():handleGreetAndListen(); }}
        style={{
          position:'absolute', bottom:'1rem', left:'1rem',
          padding:'0.8rem 1.2rem', borderRadius:'25px',
          backgroundColor:listening?'#e74c3c':'#2c3e50', color:'#fff', border:'none',
          boxShadow:'0 4px 12px rgba(0,0,0,0.3)', cursor:'pointer', fontSize:'0.9rem'
        }}
      >
        {listening?'🛑 Stop Listening':'🤖 Talk to Rakesh'}
      </button>

      {aiText && (
        <ChatBubble>
          <p>{aiText}</p>
          <button onClick={()=>setAiText('')}>✖</button>
        </ChatBubble>
      )}

      {showContactForm && (
        <ContactForm>
          <h3>Connect with Origami Creative</h3>
          <input placeholder="Your name" value={formData.name} onChange={e=>setFormData({...formData,name:e.target.value})}/>
          <input placeholder="Email address" type="email" value={formData.email} onChange={e=>setFormData({...formData,email:e.target.value})}/>
          <textarea placeholder="Tell us..." value={formData.message} onChange={e=>setFormData({...formData,message:e.target.value})}/>
          <div className="buttons">
            <button className="submit" onClick={handleFormSubmit}>Send Message</button>
            <button className="cancel" onClick={()=>setShowContactForm(false)}>Cancel</button>
          </div>
        </ContactForm>
      )}
    </div>
  );
}
