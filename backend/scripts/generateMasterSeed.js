

const { ethers } = require('ethers');

const wallet = ethers.Wallet.createRandom();

console.log('==============================================================');
console.log('MASTER MNEMONIC — back this up immediately, in multiple places');
console.log('==============================================================');
console.log(wallet.mnemonic.phrase);
console.log('==============================================================');
console.log('==============================================================');