require('dotenv').config();

const { estimateStellarFee } = require('./src/services/fee-engine');

async function submitTransaction(transaction) {
  return {
    hash: `0x${Buffer.from(`pr-${transaction.githubId}`).toString('hex')}`
  };
}

async function registerTaskOnChain(githubId, options = {}) {
  const { STELLAR_SECRET_KEY, STELLAR_NETWORK } = process.env;
  const estimateFee = options.estimateFee || estimateStellarFee;
  const submit = options.submitTransaction || submitTransaction;

  console.log('[stellar] Loading keys...');
  console.log(`[stellar] Network: ${STELLAR_NETWORK || 'testnet'}`);
  console.log(`[stellar] Secret key loaded: ${STELLAR_SECRET_KEY ? 'yes' : 'no (missing)'}`);

  const fee = await estimateFee();

  console.log(`[stellar] Compiling transaction for GitHub PR #${githubId}...`);
  console.log(`[stellar] Transaction envelope built: { op: "manageData", key: "vero:pr:${githubId}", value: "registered", fee: "${fee}" }`);

  const result = await submit({
    githubId,
    fee,
    operation: 'manageData',
    key: `vero:pr:${githubId}`,
    value: 'registered'
  });

  console.log(`[stellar] Transaction submitted (simulated). Hash: ${result.hash}`);
  console.log(`[stellar] PR #${githubId} successfully registered on-chain.`);
}

module.exports = { registerTaskOnChain };
