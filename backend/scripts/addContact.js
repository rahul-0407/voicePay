
require('dotenv').config();
const { addContact } = require('../services/contacts');



const [owner, name, phone] = process.argv.slice(2);


if (!owner || !name || !phone) {
  console.error('Usage: node scripts/addContact.js <your number> <name> <their number>');
  process.exit(1);
}



addContact(owner, name, phone);
console.log(`Saved: ${owner} -> "${name}" = ${phone}`);