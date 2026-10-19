require('dotenv').config();
const path = require('path');
const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const { registerNewUser } = require('./services/registration');
const { handleUtterance } = require('./services/callHandler');
const { normalizePhone } = require('./services/walletManager');
const { synthesize } = require('./services/tts');


const SPEECH_RMS = Number(process.env.SPEECH_RMS || 500); 
const END_SILENCE_MS = 1000; 
const MIN_UTTERANCE_BYTES = 8000; 
const MAX_UTTERANCE_BYTES = 8000 * 2 * 15; 
const PRE_ROLL_CHUNKS = 5; 
const OUT_CHUNK = 3200; 


const ALLOWED = new Set(
  (process.env.ALLOWED_CALLERS || '')
    .split(',')
    .map((n) => n.trim())
    .filter(Boolean)
    .map(normalizePhone)
);

const ALLOW_BROWSER = process.env.ALLOW_BROWSER !== 'false';

if (ALLOWED.size === 0) {
  console.warn('WARNING: ALLOWED_CALLERS is empty. Every caller gets a wallet + gas sponsorship.');
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function rms(buf) {
  const n = Math.floor(buf.length / 2);
  if (!n) return 0;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const s = buf.readInt16LE(i * 2);
    sum += s * s;
  }
  return Math.sqrt(sum / n);
}


const app = express();
app.use(express.json());
app.get('/health', (req, res) => res.send('VoicePay backend is alive'));
if (ALLOW_BROWSER) app.use(express.static(path.join(__dirname, 'public')));


const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: '/voicebot' });


wss.on('connection', (ws) => {
  console.log('Client connected to /voicebot');

  let callerPhone = null;
  let isBrowser = false;
  let streamSid = null; 
  let ready = Promise.resolve();
  let preRoll = [];
  let chunks = [];
  let chunkBytes = 0;
  let speaking = false; 
  let lastVoiceAt = 0;
  let busy = false; 
  let closed = false;

  const sendJson = (obj) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
  };


  async function sayToPhone(text) {
    const pcm = await synthesize(text);
    if (!pcm) return;
    for (let i = 0; i < pcm.length && !closed; i += OUT_CHUNK) {
      const slice = pcm.subarray(i, Math.min(i + OUT_CHUNK, pcm.length));
     
      const whole = slice.subarray(0, slice.length - (slice.length % 320));
      if (!whole.length) continue;
      sendJson({ event: 'media', stream_sid: streamSid, media: { payload: whole.toString('base64') } });
      await sleep(150);
    }
    await sleep(400); 
  }

  async function reply(text) {
    console.log('REPLY:', text);
    if (isBrowser) sendJson({ event: 'reply', text });
    else await sayToPhone(text);
  }

  function resetAudio() {
    chunks = [];
    chunkBytes = 0;
    preRoll = [];
    speaking = false;
  }

  function finishUtterance() {
    const pcm = Buffer.concat(chunks);
    resetAudio();
    if (pcm.length < MIN_UTTERANCE_BYTES) return;

    busy = true;
    (async () => {
      try {
        await ready;
        const text = await handleUtterance(callerPhone, pcm);
        if (text) await reply(text);
      } catch (err) {
        console.error('Error handling utterance:', err.message);
        try {
          await reply('Sorry, something went wrong. Please try again.');
        } catch {}
      } finally {
        resetAudio(); 
        busy = false;
      }
    })();
  }


  const timer = setInterval(() => {
    if (speaking && !busy && Date.now() - lastVoiceAt > END_SILENCE_MS) finishUtterance();
  }, 250);

  async function onStart(msg) {
    const start = msg.start || {};
    console.log('START payload:', JSON.stringify(start));

    streamSid = msg.stream_sid || start.stream_sid || null;
    isBrowser = start.source === 'browser';

    if (isBrowser && !ALLOW_BROWSER) {
      ws.close();
      return;
    }

   
    const demo = process.env.NODE_ENV !== 'production' ? process.env.DEMO_CALLER : null;
    const raw = isBrowser ? start.from : demo || start.from;
    if (!raw) {
      console.warn('No caller number in start payload. Set DEMO_CALLER in .env to test.');
      return;
    }

    const phone = normalizePhone(raw);
    if (ALLOWED.size && !ALLOWED.has(phone)) {
      console.warn('Caller not in ALLOWED_CALLERS, rejecting:', phone);
      busy = true; 
      if (isBrowser) sendJson({ event: 'reply', text: 'This number is not enabled for VoicePay.' });
      else await sayToPhone('Sorry, this number is not enabled for Voice Pay.');
      return;
    }

    callerPhone = phone;
    console.log('Caller:', callerPhone);

    
    ready = registerNewUser(callerPhone)
      .then(async (r) => {
        console.log('Wallet ready:', r.walletAddress, r.isNew ? '(new)' : '');
        if (isBrowser) sendJson({ event: 'ready', wallet: r.walletAddress });
        else {
          busy = true;
          try {
            await sayToPhone('Welcome to Voice Pay. Say, send five to Ramesh, or ask for your balance.');
          } finally {
            resetAudio();
            busy = false;
          }
        }
      })
      .catch((err) => {
        console.error('Registration failed:', err.message);
        busy = true; 
      });
  }

  ws.on('message', (data) => {
    let msg;
    try {
      msg = JSON.parse(data);
    } catch {
      return; 
    }

    if (msg.event === 'start') {
      onStart(msg).catch((err) => console.error('start handler error:', err.message));
      return;
    }

    if (msg.event === 'media') {
      if (!callerPhone || busy || !msg.media?.payload) return;

      const buf = Buffer.from(msg.media.payload, 'base64');
      const now = Date.now();

      if (rms(buf) >= SPEECH_RMS) {
        if (!speaking) {
          speaking = true;
          chunks = [...preRoll];
          chunkBytes = chunks.reduce((n, c) => n + c.length, 0);
        }
        lastVoiceAt = now;
      }

      if (speaking) {
        chunks.push(buf);
        chunkBytes += buf.length;
        if (chunkBytes >= MAX_UTTERANCE_BYTES) finishUtterance();
      } else {
        preRoll.push(buf);
        if (preRoll.length > PRE_ROLL_CHUNKS) preRoll.shift();
      }
      return;
    }

    if (msg.event === 'stop') {
      console.log('Stream stopped');
    }
  });

  ws.on('error', (err) => console.error('WebSocket error:', err.message));
  ws.on('close', () => {
    closed = true;
    clearInterval(timer);
    console.log('WebSocket closed');
  });
});

process.on('unhandledRejection', (err) => console.error('Unhandled rejection:', err));

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`VoicePay running on port ${PORT}`));