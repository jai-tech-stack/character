import React, { useState } from 'react';
import CharacterView from './components/CharacterView';
import ChatAssistant from './components/ChatAssistant';
import './index.css';
import './i18n';

export default function App() {
  const [aiText, setLatestAIMessage] = useState("");

  return (
    <>
      <CharacterView onMessage={setLatestAIMessage} />
       
    </>
  );
}
