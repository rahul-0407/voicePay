const { ethers } = require("ethers");
const db = require("../db/schema");

const MASTER_MNEMONIC = process.env.MASTER_MNEMONIC;

if (!MASTER_MNEMONIC) {
  throw new Error(
    "MASTER_MNEMONIC is not set in .env — run generateMasterSeed.js first.",
  );
}

function hashPhone(phoneNumber) {
  return ethers.keccak256(ethers.toUtf8Bytes(phoneNumber));
}

function deriveWallet(userIndex, provider) {
  const path = `m/44'/60'/0'/0${userIndex}`;
  const hdWallet = ethers.HDNodeWallet.fromPhrase(
    MASTER_MNEMONIC,
    undefined,
    path,
  );
  return provider ? hdWallet.connect(provider) : hdWallet;
}

function createUserWallet(phoneNumber) {
  const phoneHash = hashPhone(phoneNumber);
  const existing = db
    .prepare("SELECT * FROM users WHERE phone_hash = ?")
    .get(phoneHash);

  if (existing) {
    return { phoneHash, walletAddress: existing.wallet_address, isNew: false };
  }
  const row = db.prepare("SELECT COUNT(*) as count FROM users").get();
  const nextIndex = row.count;

  const wallet = deriveWallet(nextIndex);

  db.prepare(
    `
        INSERT INTO users (phone_hash, wallet_address, wallet_index, created_at)
        VALUES (?, ?, ?, ?)
    `,
  ).run(phoneHash, wallet.address, nextIndex, Date.now());

  return { phoneHash, walletAddress: wallet.address, isNew: true };
}

function getUserSigner(phoneNumber, provider) {
  const phoneHash = hashPhone(phoneNumber);
  const row = db
    .prepare("SELECT * FROM users WHERE phone_hash = ?")
    .get(phoneHash);
  if (!row) throw new Error("User not registered");
  return deriveWallet(row.wallet_index, provider);
}

function getWalletAddress(phoneNumber) {
  const phoneHash = hashPhone(phoneNumber);
  const row = db
    .prepare("SELECT wallet_address FROM users WHERE phone_hash = ?")
    .get(phoneHash);
  return row ? row.wallet_address : null;
}

module.exports = {
  createUserWallet,
  getUserSigner,
  getWalletAddress,
  hashPhone,
  deriveWallet,
};
