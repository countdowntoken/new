import fetch from "node-fetch";
import { TonClient, WalletContractV4, internal, beginCell, toNano, Address } from "@ton/ton";
import { mnemonicToPrivateKey } from "@ton/crypto";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

// load .env for local testing (in Actions we'll use Secrets)
const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
  console.log("Loaded .env for local testing (remove before public commit).");
}

const TONCENTER_API_KEY = process.env.TONCENTER_API_KEY;
const WALLET_ADDRESS = process.env.WALLET_ADDRESS;
const WALLET_MNEMONIC = process.env.WALLET_MNEMONIC; // 24 words
const CDT_CONTRACT = process.env.CDT_CONTRACT;
const FIXED_RATE_CDT_PER_TON = parseFloat(process.env.FIXED_RATE_CDT_PER_TON) || 20000; // default 20000

if (!TONCENTER_API_KEY || !WALLET_ADDRESS || (!WALLET_MNEMONIC && !process.env.WALLET_PRIVATE_KEY) || !CDT_CONTRACT) {
  console.error("Missing environment variables. Set TONCENTER_API_KEY, WALLET_ADDRESS, WALLET_MNEMONIC (or WALLET_PRIVATE_KEY), CDT_CONTRACT.");
  process.exit(1);
}

const client = new TonClient({ endpoint: "https://toncenter.com/api/v2/jsonRPC", apiKey: TONCENTER_API_KEY });

async function fetchTransactions(limit=10) {
  const url = `https://toncenter.com/api/v2/getTransactions?address=${WALLET_ADDRESS}&limit=${limit}&api_key=${TONCENTER_API_KEY}`;
  const res = await fetch(url);
  const j = await res.json();
  return j;
}

// keep an in-memory set of already-processed in this run (Actions ephemeral)
const processed = new Set();

async function sendCdts(keyPair, walletContract, toAddress, cdtAmount) {
  // CDT has 9 decimals
  const jettonAmount = BigInt(Math.floor(cdtAmount * (10 ** 9)));
  const transferBody = beginCell()
    .storeUint(0xf8a7ea5, 32) // op: transfer
    .storeUint(0, 64) // query id
    .storeCoins(jettonAmount)
    .storeAddress(Address.parse(toAddress))
    .storeAddress(Address.parse(WALLET_ADDRESS))
    .storeBit(false)
    .storeCoins(0)
    .storeBit(false)
    .endCell();

  await walletContract.sendTransfer({
    secretKey: keyPair.secretKey,
    messages: [
      internal({
        to: Address.parse(CDT_CONTRACT),
        value: toNano("0.05"),
        body: transferBody
      })
    ]
  });
}

async function main() {
  console.log("Starting TON→CDT swap checker");

  // Load keypair from mnemonic
  const mnemonic = WALLET_MNEMONIC ? WALLET_MNEMONIC.split(" ") : null;
  const keyPair = await mnemonicToPrivateKey(mnemonic);

  const wallet = WalletContractV4.create({ publicKey: keyPair.publicKey, workchain: 0 });
  const walletContract = client.open(wallet);

  const txData = await fetchTransactions(20);
  if (!txData || !txData.ok) {
    console.error("Failed to fetch transactions:", txData);
    return;
  }

  for (const tx of txData.result) {
    try {
      // Simple heuristics: consider incoming messages with value from external source
      if (!tx.in_msg || !tx.in_msg.value) continue;
      const txHash = tx.transaction_id && tx.transaction_id.hash ? tx.transaction_id.hash : JSON.stringify(tx).slice(0,40);
      if (processed.has(txHash)) continue;
      processed.add(txHash);

      const nano = Number(tx.in_msg.value);
      const tonAmount = nano / 1e9;
      if (tonAmount <= 0) continue;

      const sender = tx.in_msg.source || tx.in_message?.source || null;
      if (!sender) {
        console.log("No sender found for tx", txHash); continue;
      }

      // compute CDT amount: FIXED_RATE_CDT_PER_TON CDT per 1 TON
      const cdtAmount = tonAmount * FIXED_RATE_CDT_PER_TON;

      console.log(`Received ${tonAmount} TON from ${sender} (tx ${txHash}). Will send ${cdtAmount} CDT.`);

      // send CDT
      await sendCdts(keyPair, walletContract, sender, cdtAmount);
      console.log("Sent CDT to", sender);
    } catch (e) {
      console.error("Error processing tx:", e);
    }
  }
}

main().catch(e => { console.error("Fatal error:", e); process.exit(1); });
