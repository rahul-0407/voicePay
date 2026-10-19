const client = require('./aiClient');

const TTS_MODEL = process.env.TTS_MODEL || 'canopylabs/orpheus-v1-english';
const TTS_VOICE = process.env.TTS_VOICE || 'autumn';
const TARGET_RATE = 8000;



function parseWav(buf) {
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('TTS did not return a WAV file');
  }
  let pos = 12;
  let channels = 1;
  let rate = 24000;
  let bits = 16;
  let data = null;

  while (pos + 8 <= buf.length) {
    const id = buf.toString('ascii', pos, pos + 4);
    let size = buf.readUInt32LE(pos + 4);
    const start = pos + 8;
    if (id === 'fmt ') {
      channels = buf.readUInt16LE(start + 2);
      rate = buf.readUInt32LE(start + 4);
      bits = buf.readUInt16LE(start + 14);
    } else if (id === 'data') {
      if (size === 0 || size === 0xffffffff || start + size > buf.length) size = buf.length - start;
      data = buf.subarray(start, start + size);
      break;
    }
    pos = start + size + (size % 2);
  }
  if (!data) throw new Error('WAV has no data chunk');
  if (bits !== 16) throw new Error(`Unsupported WAV bit depth: ${bits}`);

  const frames = Math.floor(data.length / (2 * channels));
  const samples = new Float32Array(frames);
  for (let i = 0; i < frames; i++) {
    let sum = 0;
    for (let c = 0; c < channels; c++) sum += data.readInt16LE((i * channels + c) * 2);
    samples[i] = sum / channels / 32768;
  }
  return { samples, rate };
}



function resample(samples, inRate, outRate) {
  if (inRate === outRate) return samples;
  const ratio = inRate / outRate;
  const n = Math.floor(samples.length / ratio);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = Math.floor(i * ratio);
    const b = Math.max(a + 1, Math.min(samples.length, Math.floor((i + 1) * ratio)));
    let sum = 0;
    for (let j = a; j < b; j++) sum += samples[j];
    out[i] = sum / (b - a);
  }
  return out;
}



function wavToPcm8k(wavBuf) {
  const { samples, rate } = parseWav(wavBuf);
  const mono = resample(samples, rate, TARGET_RATE);
  const padded = Math.ceil(mono.length / 160) * 160; 
  const pcm = Buffer.alloc(padded * 2);
  for (let i = 0; i < mono.length; i++) {
    const v = Math.max(-1, Math.min(1, mono[i]));
    pcm.writeInt16LE(Math.round(v < 0 ? v * 32768 : v * 32767), i * 2);
  }
  return pcm;
}

async function synthesize(text) {
  if (process.env.TTS_ENABLED === 'false' || !text) return null;
  try {
    const res = await client.audio.speech.create({
      model: TTS_MODEL,
      voice: TTS_VOICE,
      input: text.slice(0, 200), 
      response_format: 'wav',
    });
    return wavToPcm8k(Buffer.from(await res.arrayBuffer()));
  } catch (err) {
    console.error('TTS failed (caller will hear nothing):', err.message);
    return null;
  }
}

module.exports = { synthesize, wavToPcm8k };