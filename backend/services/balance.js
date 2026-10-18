const { ethers } = require('ethers');

const provider = new ethers.JsonRpcProvider(process.env.POLYGON_AMOY_RPC);
const usdc = new ethers.Contract(
  process.env.USDC_ADDRESS,
  ['function balanceOf(address owner) view returns (uint256)'],
  provider
);

async function getUsdcBalance(address) {
  const raw = await usdc.balanceOf(address);
  return Number(ethers.formatUnits(raw, 6));
}

module.exports = { getUsdcBalance };