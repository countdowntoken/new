import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

const TONCENTER_API_KEY = process.env.TONCENTER_API_KEY;
const WALLET_ADDRESS = process.env.WALLET_ADDRESS;

if (!TONCENTER_API_KEY || !WALLET_ADDRESS) {
    console.error("Missing environment variables. Set TONCENTER_API_KEY and WALLET_ADDRESS.");
    process.exit(1);
}

async function getTransactions() {
    try {
        const url = `https://toncenter.com/api/v2/getTransactions?address=${WALLET_ADDRESS}&limit=10&archival=true&api_key=${TONCENTER_API_KEY}`;
        const res = await fetch(url);
        const data = await res.json();

        if (!data.ok) {
            console.error("Error from Toncenter:", data);
            return;
        }

        console.log(`\n=== Last 10 transactions for ${WALLET_ADDRESS} ===\n`);
        data.result.forEach((tx, i) => {
            const amount = tx.in_msg?.value ? parseInt(tx.in_msg.value) / 1e9 : 0;
            const from = tx.in_msg?.source || "unknown";
            const hash = tx.transaction_id?.hash || "no-hash";
            const utime = tx.utime ? new Date(tx.utime * 1000).toLocaleString() : "no-time";

            console.log(`#${i + 1}`);
            console.log(`From: ${from}`);
            console.log(`Amount: ${amount} TON`);
            console.log(`Hash: ${hash}`);
            console.log(`Time: ${utime}`);
            console.log("-----------------------------");
        });

    } catch (err) {
        console.error("Error fetching transactions:", err);
    }
}

getTransactions();
