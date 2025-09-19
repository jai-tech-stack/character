import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { config } from 'dotenv';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';

config();
const app = express();
app.use(cors(), bodyParser.json());

const ttsClient = new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY });
const VOICE_ID = 'TNHbwIMY5QmLqZdvjhNn'; // Indian voice, e.g.

app.post('/tts', async (req, res) => {
  const { text } = req.body;
  try {
    const audioStream = await ttsClient.textToSpeech.convert(VOICE_ID, {
      text,
      modelId: 'eleven_monolingual_v1',
      voice_settings: { stability: 0.5, similarity_boost: 0.75 }
    });

    // Convert ReadableStream to Buffer
    const chunks = [];
    const reader = audioStream.getReader();
    let done, value;
    while ({ done, value } = await reader.read(), !done) {
      chunks.push(value);
    }
    const buffer = Buffer.concat(chunks);

    res.set('Content-Type', 'audio/mpeg');
    res.send(buffer);
  } catch (e) {
    console.error('❌ TTS conversion error detail:', e);
    res.status(500).json({ error: 'TTS conversion failed' });
  }
});

app.listen(3001, () => console.log('🚀 TTS Server listening on http://localhost:3001'));
