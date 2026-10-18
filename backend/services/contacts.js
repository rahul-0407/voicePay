const db = require('../db/schema');
const { hashPhone, normalizePhone } = require('./walletManager');

function cleanName(name) {
  return String(name).trim().toLowerCase();
}



function addContact(ownerPhone, name, contactPhone) {
  db.prepare(`
    INSERT INTO contacts (owner_phone_hash, name, contact_phone)
    VALUES (?, ?, ?)
    ON CONFLICT(owner_phone_hash, name) DO UPDATE SET contact_phone = excluded.contact_phone
  `).run(hashPhone(ownerPhone), cleanName(name), normalizePhone(contactPhone));
}



function findContact(ownerPhone, name) {
  const owner = hashPhone(ownerPhone);
  const n = cleanName(name);

  const exact = db
    .prepare('SELECT contact_phone FROM contacts WHERE owner_phone_hash = ? AND name = ?')
    .get(owner, n);
  if (exact) return exact.contact_phone;

  const safe = n.replace(/[%_\\]/g, '');
  if (!safe) return null;
  const partial = db
    .prepare('SELECT contact_phone FROM contacts WHERE owner_phone_hash = ? AND name LIKE ?')
    .get(owner, `${safe}%`);
  return partial ? partial.contact_phone : null;
}

module.exports = { addContact, findContact };