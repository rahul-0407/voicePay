require('dotenv').config();
const fs = require('fs');
const { transcribeWav } = require('./services/speech');
const { parseIntent } = require('./services/intentParser');

(async () => {
  const file = process.argv[2];
  if (!file) {
    console.error('Usage: node testSpeech.js <file.wav>');
    process.exit(1);
  }

  const text = await transcribeWav(fs.readFileSync(file));
  console.log('Transcript:', text);

  const intent = await parseIntent(text);
  console.log('Intent:', intent);
})();