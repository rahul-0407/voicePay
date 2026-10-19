const { transcribePcm } = require('./speech');
const { parseIntent } = require('./intentParser');
const { findContact, addContact } = require('./contacts');
const { getWalletAddress, normalizePhone } = require('./walletManager');
const { executeRealPayment } = require('./paymentExecutor');
const { getUsdcBalance } = require('./balance');

const MAX_PER_PAYMENT = Number(process.env.MAX_PER_PAYMENT || 100);


const REQUIRE_CONFIRM = process.env.REQUIRE_CONFIRM !== 'false';
const CONFIRM_TTL_MS = 60 * 1000;
const pending = new Map();

const YES = /^(yes|yeah|yep|yup|confirm|confirmed|correct|ok|okay|sure|go ahead|do it|haan|han|ha)\b/;
const NO = /^(no|nope|cancel|stop|don't|do not|nahi|nahin|nai)\b/;
const cleanSpeech = (t) => t.toLowerCase().replace(/[^a-z' ]/g, ' ').replace(/\s+/g, ' ').trim();

async function handlePay(callerPhone, intent, confirmed = false) {
  const name = intent.recipient_name;
  const amount = Math.round(Number(intent.amount) * 100) / 100;
  if (!name || !(amount >= 0.01)) {
    return 'Please say the amount and the name, for example: send 5 to Ramesh.';
  }

  if (amount > MAX_PER_PAYMENT) {
    return `Sorry, the limit is ${MAX_PER_PAYMENT} USDC per payment.`;
  }

  const contactPhone = findContact(callerPhone, name);
  if (!contactPhone) {
    return `I don't have a contact named ${name}. Say save ${name} as, followed by their phone number.`;
  }

  if (normalizePhone(contactPhone) === normalizePhone(callerPhone)) {
    return 'You cannot send money to yourself.';
  }

  if (!getWalletAddress(contactPhone)) {
    return `${name} is not registered on VoicePay yet.`;
  }

  const myAddress = getWalletAddress(callerPhone);
  const balance = await getUsdcBalance(myAddress);
  if (balance < amount) {
    return `Insufficient balance. You have ${balance} USDC.`;
  }

  if (REQUIRE_CONFIRM && !confirmed) {
    pending.set(normalizePhone(callerPhone), { intent: { ...intent, amount }, expires: Date.now() + CONFIRM_TTL_MS });
    return `Send ${amount} USDC to ${name}. Say yes to confirm, or no to cancel.`;
  }

  try {
    const result = await executeRealPayment(callerPhone, contactPhone, amount);
    console.log('PAYMENT OK:', result.txHash);
    return `Sent ${amount} USDC to ${name}.`;
  } catch (err) {
    console.error('PAYMENT FAILED:', err.shortMessage || err.message);
    return 'The payment failed. Please try again.';
  }
}

async function handleBalance(callerPhone) {
  const address = getWalletAddress(callerPhone);
  if (!address) return 'You are not registered yet.';
  const balance = await getUsdcBalance(address);
  return `You have ${balance} USDC.`;
}

function handleAddContact(callerPhone, intent) {
  if (!intent.recipient_name || !intent.contact_phone) {
    return 'Please say the name and the full phone number.';
  }
  addContact(callerPhone, intent.recipient_name, intent.contact_phone);
  return `Saved ${intent.recipient_name}.`;
}

async function handleText(callerPhone, text) {
  console.log(`[${callerPhone}] heard:`, JSON.stringify(text));


  const key = normalizePhone(callerPhone);
  const waiting = pending.get(key);
  if (waiting) {
    pending.delete(key);
    if (Date.now() <= waiting.expires) {
      const said = cleanSpeech(text);
      if (YES.test(said)) return handlePay(callerPhone, waiting.intent, true);
      if (NO.test(said)) return 'Okay, cancelled.';
    }
  }

  const intent = await parseIntent(text);
  console.log('intent:', intent);

  switch (intent.action) {
    case 'pay':
      return handlePay(callerPhone, intent);
    case 'balance':
      return handleBalance(callerPhone);
    case 'add_contact':
      return handleAddContact(callerPhone, intent);
    default:
      return "Sorry, I didn't understand. You can say: send 5 to Ramesh.";
  }
}

async function handleUtterance(callerPhone, pcm) {
  const text = await transcribePcm(pcm);
  if (!text) return null;
  return handleText(callerPhone, text);
}

module.exports = { handleText, handleUtterance };