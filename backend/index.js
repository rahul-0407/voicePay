const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const PORT = process.env.PORT || 3000;

require('dotenv').config();

const app = express();
app.use(express.json());

app.get('/', (req, res) => res.send('VoicePay backend is alive'));


const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: '/voicebot' });

wss.on('connection', (ws) => {
  console.log('Exotel connected to WebSocket');

  ws.on('message', (data) => {
    const msg = JSON.parse(data);

    if(msg.event === 'start'){
      console.log('Stream started:', msg.start.call_sid);
    }
    if(msg.event === 'media'){
      console.log('Received audio chunk, length:', msg.media.payload.length);
      const echoMessage = {
        event: 'media',
        stream_sid: msg.stream_sid,
        media: {
          payload: msg.media.payload
        }
      }
      ws.send(JSON.stringify(echoMessage))
    }

    if (msg.event === 'stop') {
      console.log('Stream stopped');
    }

  })

  ws.on('close', () => console.log('WebSocket closed'));
})


server.listen(PORT, () => console.log(`Running on port ${PORT}`));