# VoicePay

**Send USDC with a phone call. No smartphone, no app, no internet on the caller's side.**

A caller dials a normal phone number, says *"send 5 to Ramesh"*, confirms with *"yes"*, and a real ERC-20 USDC transfer settles on Polygon. The wallet behind every phone number is a standard Ethereum wallet, so the same person can later import the key into MetaMask and see the same balance.

Built for ETHGlobal Mumbai 2026.

> **Network:** Polygon Amoy **testnet** with Circle's test USDC. Every transaction is real and verifiable on-chain, but no real money is involved.

---

## Why

Around a billion people in emerging markets hold a feature phone or a basic smartphone without reliable data. Voice calls are the one rail that works for all of them. VoicePay puts stablecoin settlement on that rail.

## How it works

```
 Caller (any phone)
        │  voice call
        ▼
 Exotel number ──WebSocket (8 kHz PCM)──►  VoicePay backend (Node.js)
                                              │
                          ┌───────────────────┼────────────────────┐
                          ▼                   ▼                    ▼
                   Speech-to-text       Intent parsing       Wallet manager
                   (Whisper, Groq)   (LLM function calling)  (HD derivation)
                                              │
                                  "send 5 to Ramesh" -> {pay, 5, ramesh}
                                              │
                                    read back, wait for "yes"
                                              │
                                              ▼
                              USDC.transfer()  on Polygon Amoy
                                              │
                          spoken confirmation (TTS) back to the caller
```

1. **Call in.** Exotel streams the call audio to `/voicebot` over a WebSocket (raw 16-bit, 8 kHz PCM).
2. **Listen.** Energy-based voice detection cuts the stream into utterances; Whisper transcribes each one.
3. **Understand.** An LLM with *forced function calling* turns the transcript into strict JSON (`pay` / `balance` / `add_contact`). It can only answer in that schema, never free text.
4. **Verify.** Amount cap, contact exists, not paying yourself, recipient registered, sufficient balance, then the system repeats the payment back and waits for an explicit "yes".
5. **Settle.** The backend re-derives the caller's wallet and signs a plain `USDC.transfer()`. No custom payment contract, no internal ledger.
6. **Speak.** The result is synthesised to 8 kHz audio and played into the call.

### Wallets

Every wallet comes from one master seed (`MASTER_MNEMONIC`) using standard BIP-44 derivation (`m/44'/60'/0'/0/index`). One seed regenerates every user wallet, even if the database is lost. A wallet is a normal Ethereum account from day one. Phone numbers are never stored in plain text: the database keeps `keccak256(normalized number)`.

New wallets receive a small POL stipend from an operator wallet so their first transfer can pay its own gas.

## Repository layout

```
voicepay/
├── backend/
│   ├── index.js                  WebSocket + HTTP gateway (Exotel and browser clients)
│   ├── public/index.html         Browser "call" page (microphone demo, no phone needed)
│   ├── services/
│   │   ├── walletManager.js      HD derivation, phone normalisation and hashing
│   │   ├── registration.js       First-call onboarding + gas sponsorship
│   │   ├── paymentExecutor.js    Signs and sends the real USDC transfer
│   │   ├── callHandler.js        Brain: transcript -> intent -> checks -> confirm -> pay
│   │   ├── intentParser.js       LLM function calling
│   │   ├── speech.js             PCM -> WAV -> Whisper
│   │   ├── tts.js                Text -> 8 kHz PCM for the phone line
│   │   ├── contacts.js           Spoken names -> phone numbers
│   │   ├── balance.js            USDC balanceOf
│   │   └── aiClient.js           One place to choose the AI provider
│   ├── db/schema.js              SQLite (no secrets stored)
│   ├── scripts/                  generateMasterSeed.js, addContact.js
│   ├── testCall.js               Run the full call logic from the terminal
│   └── testWs.js                 Fake Exotel client that streams a WAV file
└── contracts/                    Foundry: VoicePayRegistry (phone hash -> wallet) + tests
```

## Quick start

Requirements: Node 18+, a funded Polygon Amoy wallet, a free [Groq](https://console.groq.com) API key.

```bash
git clone https://github.com/rahul-0407/voicePay && cd voicePay/backend
npm install
cp .env.example .env            # fill in the values
npm run generate-seed           # paste the 12 words into MASTER_MNEMONIC
node index.js
```

Fund the **operator wallet** (the address of `PRIVATE_KEY`) with Amoy POL from the [Polygon faucet](https://faucet.polygon.technology/). Fund a **caller's wallet** with test USDC from [Circle's faucet](https://faucet.circle.com/). The caller's address is printed as `Wallet ready:` the first time that number connects.

### Try it without a phone

1. Save a contact: `node scripts/addContact.js +91YOURNUMBER Ramesh +91THEIRNUMBER`
2. Open <http://localhost:3000>, enter your number, click **Start call**.
3. Say *"how much money do I have"*, then *"send 2 to Ramesh"*, then *"yes"*.

Or from the terminal: `REQUIRE_CONFIRM=false node testCall.js +91YOURNUMBER "send 2 to Ramesh"`.

### Connect a real phone number (Exotel)

1. Create a flow with a **Voicebot** applet and set its URL to `wss://YOUR_HOST/voicebot`.
2. Attach the flow to your ExoPhone.
3. For local development expose the server with a tunnel, for example `ngrok http 3000`, and use the `wss://` form of that URL.
4. Call the number. The server logs the `START payload`, the caller, the transcript, the intent and the transaction hash.

### Deploying

Run it anywhere that gives you a public `wss://` endpoint and a **persistent disk**. The disk matters: the SQLite file holds each phone number's wallet index, and a wiped file means new numbers would be assigned wallets that already belong to someone else. Set `DB_PATH` to the mounted volume, `NODE_ENV=production`, `ALLOWED_CALLERS`, and `ALLOW_BROWSER=false`.

## Configuration

| Variable | Purpose |
|---|---|
| `PRIVATE_KEY` | Operator wallet, pays gas stipends |
| `MASTER_MNEMONIC` | Root of all user wallets |
| `POLYGON_AMOY_RPC` / `USDC_ADDRESS` | Chain and token |
| `GROQ_API_KEY`, `LLM_MODEL` | Speech, intent and voice models |
| `MAX_PER_PAYMENT` | Hard cap per payment (default 100 USDC) |
| `REQUIRE_CONFIRM` | Read the payment back and wait for "yes" (default on) |
| `ALLOWED_CALLERS` | Allow-list of phone numbers; empty means anyone |
| `ALLOW_BROWSER` | Serve the browser demo page |
| `DB_PATH` | Location of the SQLite file |

## Safety design

- Spoken payments are read back and require an explicit "yes" (it expires after 60 seconds).
- Per-payment cap, self-payment block, recipient-registered check, balance check before signing.
- The LLM can only emit a fixed JSON schema, and the backend re-validates every field.
- Phone numbers are hashed; the database contains no keys.
- Optional caller allow-list controls who can get a wallet and a gas stipend.

## Honest limitations

- **Custodial by design.** The backend signs on the user's behalf. That is what makes a phone-only flow possible, and it also means the server holds signing power. A production version would add a voice PIN or OTP, spending limits per day, and HSM or MPC key custody.
- **Caller ID is not authentication.** Phone numbers can be spoofed. Today's protection is the confirmation step, caps and the allow-list.
- **Testnet only.** Amoy USDC has no monetary value.
- The browser demo trusts whatever number is typed in; disable it for public use.

## Roadmap

- Voice PIN / OTP before transfers, daily limits
- Hindi and regional-language commands
- On-chain `VoicePayRegistry` writes from the backend
- Deposit watcher (notify users when funds arrive) and a key-export flow for MetaMask
- Mainnet with a regulated on/off-ramp partner

## Stack

Node.js, Express, `ws`, ethers v6, SQLite (better-sqlite3), Groq (Whisper, `gpt-oss`, Orpheus TTS), Exotel Voicebot, Foundry, Polygon Amoy.