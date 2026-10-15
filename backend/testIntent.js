require('dotenv').config();
const { parseIntent } = require('./services/intentParser');

const samples = [
  'send 500 to Ramesh',
  'please transfer two hundred and fifty rupees to Suresh',
  'how much money do I have',
  'save Mahesh as nine one two three four five six seven eight nine',
  'what is the weather today',
  'send money to Ramesh',
];

(async () => {
  for (const text of samples) {
    const intent = await parseIntent(text);
    console.log(JSON.stringify(text), '->', intent);
  }
})();