const OpenAI = require('openai');
const client = require('./aiClient');

const STT_MODEL = process.env.STT_MODEL || 'whisper-large-v3-turbo';

const PROMPT_HINT = 'Payment commands such as: send 500 to Ramesh. check my balance. save Suresh as a contact.';


function pcmToWav(pcm, sampleRate = 8000) {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;

  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); 
  header.writeUInt16LE(1, 20); 
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);

  return Buffer.concat([header, pcm]);
}


async function transcribeWav(wavBuffer) {
  const file = await OpenAI.toFile(wavBuffer, 'audio.wav', { type: 'audio/wav' });

  const result = await client.audio.transcriptions.create({
    file,
    model: STT_MODEL,
    prompt: PROMPT_HINT,
  });

  return result.text.trim();
}

async function transcribePcm(pcmBuffer, sampleRate = 8000) {
  return transcribeWav(pcmToWav(pcmBuffer, sampleRate));
}

module.exports = { transcribePcm, transcribeWav, pcmToWav };