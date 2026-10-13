const crypto = require("crypto");
const { deriveWallet, hashPhone } = require("../services/walletManager");
const db = require("../db/schema");

const revealTokens = new Map();
const TOKEN_TTL_MS = 10 * 60 * 1000;

function generateRevealLink(phoneNumber) {
  const token = crypto.randomBytes(24).toString("hex");
  revealTokens.set(token, { phoneNumber, expires: Date.now() + TOKEN_TTL_MS });
  return `https://yourdomain.com/reveal/${token}`;
}

function handleReveal(req, res) {
  const { token } = req.params;
  const entry = revealTokens.get(token);

  if (!entry || Date.now() > entry.expires) {
    return res.status(410).send("This link has expired or was already used.");
  }

  revealTokens.delete(token);

  const phoneHash = hashPhone(entry.phoneNumber);
  const row = db
    .prepare("SELECT wallet_index FROM users WHERE phone_hash = ?")
    .get(phoneHash);

  if (!row) {
    return res.status(404).send("No wallet found for this user.");
  }

  const wallet = deriveWallet(row.wallet_index);

  res.send(`<html><body style="font-family: sans-serif; padding: 2rem;">
    <h2>Your Wallet Private Key</h2>
    <p>Copy this into MetaMask: Add Account &rarr; Import Account &rarr; paste below.</p>
    <code style="background:#eee; padding:1rem; display:block; word-break:break-all;">${wallet.privateKey}</code>
    <p style="color:red;">This page will not work again. Save it securely now.</p>
  </body></html>`);
}

module.exports = { generateRevealLink, handleReveal };
