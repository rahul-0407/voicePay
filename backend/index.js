require("dotenv").config();
const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const PORT = process.env.PORT || 3000;

const { registerNewUser } = require("./services/registration");
const { handleUtterance } = require("./services/callHandler");

const SPEECH_RMS = Number(process.env.SPEECH_RMS || 500);
const END_SILENCE_MS = 1000;
const MIN_UTTERANCE_BYTES = 8000;
const MAX_UTTERANCE_BYTES = 8000 * 2 * 15;
const PRE_ROLL_CHUNKS = 5;

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
app.get("/", (req, res) => res.send("VoicePay backend is alive"));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: "/voicebot" });

wss.on("connection", (ws) => {
  console.log("Exotel connected to WebSocket");

  let callerPhone = null;
  let ready = Promise.resolve();
  let preRoll = [];
  let chunks = [];
  let chunkBytes = 0;
  let speaking = false;
  let lastVoiceAt = 0;
  let busy = false;


  function finishUtterance() {
    const pcm = Buffer.concat(chunks);
    chunks = [];
    chunkBytes = 0;
    speaking = false;
    if (pcm.length < MIN_UTTERANCE_BYTES) return;
 
    busy = true;
    (async () => {
      try {
        await ready;
        const reply = await handleUtterance(callerPhone, pcm);
        console.log('REPLY:', reply);
      } catch (err) {
        console.error('Error handling utterance:', err.message);
      } finally {
        busy = false;
      }
    })();
  }




  const timer = setInterval(() => {
    if (speaking && !busy && Date.now() - lastVoiceAt > END_SILENCE_MS) {
      finishUtterance();
    }
  }, 250);


  ws.on('message', (data) => {
    const msg = JSON.parse(data);
 
    if (msg.event === 'start') {
      console.log('START payload:', JSON.stringify(msg.start));
 
      callerPhone = process.env.DEMO_CALLER || msg.start.from;
      if (!callerPhone) {
        console.warn('No caller number in start payload. Set DEMO_CALLER in .env.');
        return;
      }
      console.log('Caller:', callerPhone);
      ready = registerNewUser(callerPhone)
        .then((r) => console.log('Wallet ready:', r.walletAddress, r.isNew ? '(new)' : ''))
        .catch((err) => console.error('Registration failed:', err.message));
    }
 
    if (msg.event === 'media') {
      if (!callerPhone || busy) return;
 
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
    }
 
    if (msg.event === 'stop') {
      console.log('Stream stopped');
    }
  });

  ws.on('close', () => {
    clearInterval(timer);
    console.log('WebSocket closed');
  });
});

server.listen(PORT, () => console.log(`Running on port ${PORT}`));
