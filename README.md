# Wellness Hub — Full-stack healthcare assistant

A working starter with a Flutter patient app, React doctor/admin dashboard, Express API, MongoDB, and OpenAI-powered grounded chat.

## Requirements
- Node.js 20+, npm, MongoDB 7+ (or Docker), Flutter 3.24+
- Optional: OpenAI API key for AI responses. Without it, chat returns a safe offline guidance message.

## Quick start
1. Start MongoDB: `docker compose up -d`
2. Backend:
   ```bash
   cd backend
   cp .env.example .env
   npm install
   npm run seed
   npm run dev
   ```
3. Dashboard (new terminal):
   ```bash
   cd dashboard
   npm install
   npm run dev
   ```
   Open http://localhost:5173
4. Flutter patient app:
   ```bash
   cd patient_flutter
   flutter create --platforms=android,ios,web .
   flutter pub get
   flutter run --dart-define=API_BASE_URL=http://10.0.2.2:4000
   ```
   `10.0.2.2` is the Android emulator's localhost bridge. For Flutter web use `http://localhost:4000`; for a physical phone use your computer's LAN IP and ensure both are on the same network.

## Features
- Patient registration and login using bcrypt + JWT
- Patient chat UI with persistent, multi-turn conversations
- Small local medical knowledge retrieval corpus; relevant passages are attached to AI prompts
- Safety guardrails and emergency escalation messages
- Specialty-based doctor matching
- Appointment slots, booking and cancellation with conflict prevention
- Doctor/admin React dashboard with role-based login and appointment management
- Seeded doctor and admin accounts (development only)

## Demo accounts (created by `npm run seed`)
- admin@wellness.test / Admin123!
- doctor@wellness.test / Doctor123!

## Environment
Copy `backend/.env.example` to `backend/.env` and add `OPENAI_API_KEY`. Never put the key in Flutter or React.

## Architecture
- `backend/src` — Express REST API, Mongoose models, middleware, AI/RAG, seed data
- `dashboard/src` — React + Vite UI for doctor/admin
- `patient_flutter/lib` — Flutter patient app

## Important
This is an educational prototype, **not a medical device**. RAG uses a small illustrative, locally stored knowledge set, not clinically validated guidelines. Medical content must be reviewed and kept current before deployment. Never use the AI for diagnosis or emergency triage decisions. For production, add audit logging, encrypted storage, consent, rate limiting, security reviews, jurisdiction-specific privacy compliance, clinician verification, secure password reset, and clinical governance. No payment integration is included.

## API
- `POST /api/auth/register` `{name,email,password}`
- `POST /api/auth/login` `{email,password}`
- `GET /api/auth/me`
- `GET /api/chat/conversations`
- `POST /api/chat` `{conversationId?, message}`
- `GET /api/doctors?specialty=...`
- `GET /api/doctors/match?query=...`
- `GET /api/doctors/:id/slots?date=YYYY-MM-DD`
- `GET /api/appointments`
- `POST /api/appointments` `{doctorId,slot}`
- `PATCH /api/appointments/:id/cancel`
- `GET /api/dashboard/summary` (doctor/admin)
- `GET /api/health`


---

## 👨‍💻 Project Contributors

**Project Name:** Wellness Hub – AI Healthcare Assistant

**Team Members:**
`
1. **Shaik Ashraf Gani**
2. **Rahul Topinkatti**
3. **Yamuna K K**

**Institution:** Presidency University, Bengaluru

**Program:** Master of Computer Applications (MCA)
