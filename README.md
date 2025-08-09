TON ↔ CDT Swap (GitHub Actions)
==================================

IMPORTANT SECURITY NOTE
-----------------------
This repository **must not** be made public while it contains any secret (mnemonic or private key).
It's strongly recommended to add secrets via GitHub Actions Secrets (Settings → Secrets and variables → Actions)
and **remove** the included `.env` before pushing to a public repository.

Quick steps:
1. Create a private GitHub repo and upload this project.
2. In GitHub repo settings → Secrets and variables → Actions add these secrets:
   - TONCENTER_API_KEY
   - WALLET_ADDRESS
   - WALLET_MNEMONIC (24 words) OR WALLET_PRIVATE_KEY (hex)
   - CDT_CONTRACT (jetton contract address)
   - FIXED_RATE_CDT_PER_TON (e.g. 20000)
3. Run the workflow from Actions → swap.yml → Run workflow (or wait for schedule if enabled).

Local test:
  - Install dependencies: npm install
  - Create a .env with keys (if you want to test locally)
  - Run: node src/swap.js

Files included:
  - src/swap.js       : main script (checks transactions and sends CDT)
  - .github/workflows/swap.yml : GitHub Actions workflow
  - package.json
  - .env (OPTIONAL; REMOVE before pushing public)
