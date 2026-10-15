const { ethers } = require("ethers");
const { getUserSigner, getWalletAddress } = require("./walletManager");

const USDC_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
];

const provider = new ethers.JsonRpcProvider(process.env.POLYGON_AMOY_RPC);
const operatorWallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const GAS_STIPEND = ethers.parseEther("0.05");

async function sponsorGas(walletAddress) {
  const tx = await operatorWallet.sendTransaction({
    to: walletAddress,
    value: GAS_STIPEND,
  });
  await tx.wait();
  return tx.hash;
}

async function executeRealPayment(senderPhone, recipientPhone, amountUSDC) {
  const senderSigner = getUserSigner(senderPhone, provider);
  const recipientAddress = getWalletAddress(recipientPhone);

  if (!recipientAddress) {
    throw new Error("Recipient not registered");
  }
  const usdc = new ethers.Contract(
    process.env.USDC_ADDRESS,
    USDC_ABI,
    senderSigner,
  );
  const amount = ethers.parseUnits(amountUSDC.toString(), 6);

  const tx = await usdc.transfer(recipientAddress, amount);
  const receipt = await tx.wait();

  return {
    txHash: receipt.hash,
    from: senderSigner.address,
    to: recipientAddress,
    amount: amountUSDC,
  };
}

module.exports = { sponsorGas, executeRealPayment };
