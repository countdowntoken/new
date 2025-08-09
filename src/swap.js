import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { mnemonicToWalletKey } from '@ton/crypto';
import { TonClient, WalletContractV4, beginCell, toNano, Address } from '@ton/ton';

dotenv.config();

const API_KEY = process.env.TONCENTER_API_KEY;
const WALLET_MNEMONIC = process.env.WALLET_MNEMONIC;
const CDT_CONTRACT = process.env.CDT_CONTRACT;
const FIXED_RATE = parseFloat(process.env.FIXED_RATE || '20000'); // 1 TON = FIXED_RATE CDT

if (!API_KEY || !WALLET_MNEMONIC || !CDT_CONTRACT) {
    console.error('Missing environment variables.');
    process.exit(1);
}

const client = new TonClient({
    endpoint: 'https://toncenter.com/api/v2/jsonRPC',
    apiKey: API_KEY
});

async function sendCDT(toAddress, tonAmount) {
    const key = await mnemonicToWalletKey(WALLET_MNEMONIC.split(' '));
    const wallet = WalletContractV4.create({ publicKey: key.publicKey, workchain: 0 });
    const contract = client.open(wallet);

    const amountCDT = toNano((tonAmount * FIXED_RATE).toString());

    const jettonPayload = beginCell()
        .storeUint(0x0f8a7ea5, 32)
        .storeUint(0, 64)
        .storeCoins(amountCDT)
        .storeAddress(Address.parse(toAddress))
        .storeAddress(Address.parse(WALLET_MNEMONIC)) // response destination
        .storeUint(0, 1)
        .storeCoins(toNano('0.05'))
        .storeUint(0, 1)
        .endCell();

    await contract.sendTransfer(key.secretKey, {
        to: Address.parse(CDT_CONTRACT),
        value: toNano('0.1'),
        body: jettonPayload
    });

    console.log(`Sent ${tonAmount * FIXED_RATE} CDT to ${toAddress}`);
}

async function checkTransactions() {
    const walletAddress = (await mnemonicToWalletKey(WALLET_MNEMONIC.split(' '))).publicKey;
    const wallet = WalletContractV4.create({ publicKey: walletAddress, workchain: 0 });
    const address = wallet.address.toString({ bounceable: true });

    console.log(`Listening for new transactions on: ${address}`);

    const res = await fetch(`https://toncenter.com/api/v2/getTransactions?address=${address}&limit=5&api_key=${API_KEY}`);
    const data = await res.json();

    if (!data.result) {
        console.error('No transactions found.');
        return;
    }

    for (const tx of data.result) {
        if (tx.in_msg && parseFloat(tx.in_msg.value) > 0) {
            const sender = Address.parse(tx.in_msg.source).toString({ bounceable: true });
            const tonAmount = parseFloat(tx.in_msg.value) / 1e9;
            console.log(`Incoming: ${tonAmount} TON from ${sender}`);

            await sendCDT(sender, tonAmount);
        }
    }
}

checkTransactions();
