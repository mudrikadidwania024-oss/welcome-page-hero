# 🎙️ VaaniPay — Voice-First Banking for the Visually Impaired

> **"Your Bank, Your Voice"** — A 100% voice-driven banking interface built for India's 78M+ visually impaired citizens.

Built at **36-Hour Hackathon | Ideation Round** · Track: **FinTech** · Team: **TEAM TRONIX**

---

## 🔥 The Problem

Over 78 million visually impaired Indians cannot independently use banking apps — that's roughly the combined population of UP and Maharashtra. 96% of bank apps are incompatible with screen readers, and a simple money transfer can take 30+ minutes with assistance. VaaniPay changes that.

---

## 💡 What is VaaniPay?

VaaniPay is a **Progressive Web App (PWA)** that replaces every tap and swipe with a natural voice conversation. Users can check balances, send money via UPI, pay bills, scan QR codes, and review transaction history — all without ever touching a screen.

---

## ✨ Key Features

- **100% Voice-First** — Every flow is navigable by voice alone; no screen required
- **Natural Language Understanding** — Context-aware AI via SARVAM.ai processes conversational commands (e.g. *"Send ₹500 to my daughter"*)
- **Dual-Layer Security** — Voice biometrics + WebAuthn fingerprint/face authentication before every transaction
- **Real-Time Audio Feedback** — Sarvam AI TTS (with browser TTS fallback) confirms every action aloud
- **UPI Payments** — Send money by contact, phone number, bank transfer, or QR scan
- **Multi-language Ready** — Hindi and Gujarati supported; regional expansion planned
- **Works Offline (PWA)** — Service Worker caching keeps core features available without a network

---

## 🛠️ Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 18, TypeScript, Vite, TailwindCSS, shadcn/ui |
| **Voice (STT)** | Web Speech API + SARVAM.ai Edge Function |
| **Voice (TTS)** | SARVAM.ai (primary) · Browser `speechSynthesis` (fallback) |
| **Auth** | Supabase Auth (OTP/phone) + WebAuthn (biometric) |
| **Backend / Edge** | Supabase Edge Functions (Deno/TypeScript) |
| **Database** | Supabase (PostgreSQL) |
| **Payments** | UPI Integration |
| **Deployment** | Netlify (frontend) · Supabase (backend + DB) |
| **Testing** | Vitest (unit) · Playwright (e2e) |

---

## 🏗️ Project Structure

```
src/
├── components/
│   ├── VoiceAssistant.tsx    # Core voice interaction component
│   ├── PaymentSuccess.tsx    # Audio-confirmed payment result
│   ├── BottomNav.tsx         # Accessible navigation bar
│   └── ui/                   # shadcn/ui primitives
├── pages/
│   ├── Auth.tsx              # OTP phone login
│   ├── Index.tsx             # Home dashboard
│   ├── Balance.tsx           # Voice balance check
│   ├── PayContact.tsx        # Pay by contact
│   ├── PayPhone.tsx          # Pay by phone number
│   ├── BankTransfer.tsx      # Bank-to-bank transfer
│   ├── UPIPayment.tsx        # UPI ID payment
│   ├── ScanQR.tsx            # QR code scanner
│   ├── PayViaQR.tsx          # Generate & pay via QR
│   ├── PayBills.tsx          # Bill payments
│   ├── Recharge.tsx          # Mobile recharge
│   ├── History.tsx           # Transaction history
│   └── Profile.tsx           # User profile
├── lib/
│   ├── voice.ts              # TTS + STT helpers (Sarvam + browser fallback)
│   └── biometric.ts          # WebAuthn fingerprint authentication
├── contexts/
│   └── AuthContext.tsx       # Global auth state
└── integrations/
    └── supabase/             # Supabase client + generated types

supabase/
├── functions/
│   ├── sarvam-stt/           # Speech-to-text via SARVAM.ai
│   ├── sarvam-tts/           # Text-to-speech via SARVAM.ai
│   ├── voice-command/        # NLU intent processing
│   ├── process-payment/      # Payment execution
│   ├── send-otp/             # OTP dispatch
│   ├── verify-otp/           # OTP verification
│   └── login-phone/          # Phone login handler
└── migrations/               # Database schema migrations
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js ≥ 18 (or [Bun](https://bun.sh))
- A [Supabase](https://supabase.com) project
- A [SARVAM.ai](https://sarvam.ai) API key

### 1. Clone the repository

```bash
git clone https://github.com/your-username/vaanipay.git
cd vaanipay
```

### 2. Install dependencies

```bash
npm install
# or
bun install
```

### 3. Configure environment variables

Copy `.env` and fill in your keys:

```bash
cp .env .env.local
```

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Add `SARVAM_API_KEY` to your Supabase project's Edge Function secrets.

### 4. Run locally

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### 5. Deploy Edge Functions

```bash
supabase functions deploy
```

---

## 🔒 Security

- All payments require **biometric confirmation** (WebAuthn fingerprint/face, with a confirm-dialog fallback)
- Authentication is OTP-based via Supabase Auth — no passwords stored
- Sensitive operations run server-side in Supabase Edge Functions, never in the browser

---

## 🗺️ How It Works (Flow)

```
User Speaks → Speech-to-Text (Sarvam AI) → NLU Intent Detection
    → Decision (balance / send / history / bills)
        → [If payment] Biometric Auth → Banking API → Execute
    → Text-to-Speech Confirmation → User Hears Result
        → Continue? → Yes: repeat | No: end session
```

---

## 🔮 Roadmap

- [ ] Expand language support beyond Hindi & Gujarati
- [ ] Wearable device integration (smartwatch, earbuds)
- [ ] NPCI / government banking API integration
- [ ] AI-powered voice financial advisor (savings & budgeting tips)
- [ ] Haptic feedback patterns for payment confirmation

---

## 👥 Team TRONIX

| Name | Role |
|---|---|
| Anuj Goyal | Team Lead |
| Mudrika Didwania | Member |
| Kathan Shah | Member |
| Unnati Thakur | Member |
| Shreenarth Pillai | Member |
| Aryan Kumar | Member |
| Unnati Thakur | Member |


---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

---

<p align="center">Built with ❤️ at the 36-Hour Hackathon · Track: FinTech</p>
