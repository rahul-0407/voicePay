

const { createUserWallet } = require('./walletManager');
const { sponsorGas } = require('./paymentExecutor');

async function registerNewUser(phoneNumber) {
  const { walletAddress, isNew } = createUserWallet(phoneNumber);

  if (isNew) {
    await sponsorGas(walletAddress);
  }

  return { walletAddress, isNew };
}

module.exports = { registerNewUser };