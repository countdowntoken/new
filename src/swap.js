import 'dotenv/config';
import fetch from 'node-fetch';
import { Address } from '@ton/core';

// Normalize TON address to bounceable, URL-safe format
function normalizeAddress(addr) {
    try {
        return Address.parse(addr).toString({ bounceable: true, urlSafe: true });
    } catch (e) {
        console.error("Invalid address:", addr);
        return addr;
    }
}

// Environment variables
const API_KEY = process.env.TONCENTER_API_KEY;
const PROJECT_WALLET = normalizeAddress(process.env.WALLET_ADDRESS);
const CDT_CONTRACT = process.env.CDT_CONTRACT;
const RATE = parseFloat(process.env.FIXED_RATE) || 20000;

// Fetch recent transactions for the project wallet
async function fetchTransactions() {
    const url = `https://toncenter.com/api/v2/getTransactions?address=${PROJECT_WALLET}&limit=10&api_key=${API_KEY}`;
    const res = await fetch(url);
    const data = await res.json();

    if (!data.ok) {
        console.error("Error fetching transactions:", data);
        return [];
    }

    return data.result;
}

// Process each transaction
async function processTransactions() {
    const transactions = await fetchTransactions();
    console.log(`\n--- Checking last ${transactions.length} transactions ---\n`);

    for (const tx of transactions) {
        const sender = normalizeAddress(tx.in_msg.source);
        const amountTon = tx.in_msg.value / 1e9;
        const hash = tx.transaction_id.hash;
        const time = new Date(tx.utime * 1000).toLocaleString();

        console.log(`From: ${sender}`);
        console.log(`Amount: ${amountTon} TON`);
        console.log(`Hash: ${hash}`);
        console.log(`Time: ${time}`);

        if (sender === PROJECT_WALLET) {
            console.log("✅ Transaction is from the project wallet.");
        } else {
            console.log("⛔ Transaction is NOT from the project wallet.");
        }

        console.log("-----------------------------");
    }
}

// Start process
processTransactions().catch(console.error);
