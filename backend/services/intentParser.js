const client = require('./aiClient');

const MODEL = process.env.LLM_MODEL || 'llama-3.3-70b-versatile';

const SYSTEM_PROMPT = `You convert a caller's spoken request (a speech-to-text transcript, may contain recognition errors) into a payment command.
Rules:
- action "pay": the caller wants to send money. Needs recipient_name and amount.
- action "balance": the caller asks how much money they have.
- action "add_contact": the caller wants to save a name with a phone number. Needs recipient_name and contact_phone (digits only, keep any country code they say).
- action "unknown": anything else, or you cannot tell what they want.
- amount is a plain number. Ignore currency words; all amounts are treated as USDC.
- Never invent a recipient or an amount. If one is missing, leave it out.
- recipient_name is just the name as spoken, e.g. "Ramesh".`;

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'payment_intent',
      description: 'The structured command extracted from the caller\'s request.',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['pay', 'balance', 'add_contact', 'unknown'] },
          recipient_name: { type: 'string' },
          amount: { type: 'number' },
          contact_phone: { type: 'string' },
        },
        required: ['action'],
      },
    },
  },
];




async function parseIntent(transcript) {
  if (!transcript || !transcript.trim()) {
    return { action: 'unknown' };
  }

  const response = await client.chat.completions.create({
    model: MODEL,
    temperature: 0,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: transcript },
    ],
    tools: TOOLS,
    tool_choice: { type: 'function', function: { name: 'payment_intent' } },
  });

  const call = response.choices[0].message.tool_calls?.[0];
  if (!call) return { action: 'unknown' };

  try {
    const intent = JSON.parse(call.function.arguments);

    if (intent.action === 'pay') {
      if (!intent.recipient_name || !(intent.amount > 0)) {
        return { action: 'unknown' };
      }
    }
    return intent;
  } catch {
    return { action: 'unknown' };
  }
}

module.exports = { parseIntent };