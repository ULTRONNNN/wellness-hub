# Wellness Hub – AI Healthcare Assistant

Wellness Hub is a full-stack AI-powered healthcare assistance platform integrating general healthcare guidance, symptom-based doctor recommendations, appointment management and secure medical report analysis.

The application combines cloud-based AI and local AI processing through a hybrid architecture.

## Key Features

### Patient Dashboard
- Patient registration and secure login
- AI-powered chatbot with conversation history
- Retrieval-Augmented Generation (RAG)
- Agent-based doctor search and appointment booking
- Symptom-based specialist recommendations
- Appointment booking and cancellation
- Medical report upload and analysis
- Contextual medical report follow-up conversations

### Doctor Dashboard
- Role-based doctor authentication
- Appointment management
- Availability management
- Appointment confirmation and status updates

### Admin Dashboard
- Doctor profile management
- Doctor account management
- Patient management
- Appointment monitoring
- Centralized administrative dashboard

### AI and Security
- OpenAI GPT-4o mini integration
- Ollama with Llama 3.2 3B
- Local medical report analysis
- Linux sandboxing using Bubblewrap
- PDF text extraction using Poppler
- Image text extraction using Tesseract OCR
- AES-256-GCM report encryption
- bcrypt password hashing
- JWT authentication
- Role-based access control
- API rate limiting
- File validation and appointment conflict prevention

## Technology Stack

| Component | Technology |
|---|---|
| Web frontend | React.js, Vite |
| Mobile application | Flutter, Dart |
| Backend | Node.js, Express.js |
| Database | MongoDB, Mongoose |
| Cloud AI | OpenAI |
| Local AI | Ollama, Llama 3.2 3B |
| Knowledge retrieval | Keyword-based RAG |
| Authentication | JWT, bcrypt |
| Encryption | AES-256-GCM |
| Sandboxing | WSL, Ubuntu, Bubblewrap |
| Document extraction | Poppler, Tesseract |

## Installation Guide – Windows

Docker is not required for this installation.

### 1. Install Prerequisites

Install the following software:

- Node.js 22: https://nodejs.org/
- MongoDB Community Server: https://www.mongodb.com/try/download/community
- Git: https://git-scm.com/
- Ollama: https://ollama.com/download
- Visual Studio Code: https://code.visualstudio.com/
- WSL with Ubuntu

Flutter is required only when testing the separate Flutter application.

### 2. Download the Project

Open PowerShell and execute:

```powershell
git clone -b wellness-hub-v2 https://github.com/ULTRONNNN/wellness-hub.git
cd wellness-hub
```

### 3. Configure MongoDB

Install MongoDB Community Server and start the MongoDB service.

The application uses the following local database:

```text
mongodb://127.0.0.1:27017/wellness_hub
```

MongoDB Compass can optionally be installed for database inspection.

### 4. Configure the Linux Sandbox

Open PowerShell as Administrator:

```powershell
wsl --install -d Ubuntu
```

Restart the computer if requested.

Complete Ubuntu's initial username and password configuration.

Install the required Linux packages:

```powershell
wsl -d Ubuntu -- sudo apt update
wsl -d Ubuntu -- sudo apt install -y bubblewrap poppler-utils tesseract-ocr tesseract-ocr-eng
```

Verify installation:

```powershell
wsl -d Ubuntu -- bwrap --version
wsl -d Ubuntu -- pdftotext -v
wsl -d Ubuntu -- tesseract --version
```

### 5. Configure Ollama

After installing Ollama, download the local AI model:

```powershell
ollama pull llama3.2:3b
```

Verify the downloaded model:

```powershell
ollama list
```

If the Ollama service is not already running, start it in a separate terminal:

```powershell
ollama serve
```

The local AI service uses:

```text
http://127.0.0.1:11434
```

Local medical report inference does not require paid OpenAI API credits.

### 6. Configure Backend Environment

Navigate to the backend directory:

```powershell
cd backend
```

Install dependencies:

```powershell
npm install
```

Create a `.env` file using the provided `.env.example` configuration template.

Generate unique JWT and report encryption keys using the following command. Run it twice to generate two separate keys.

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Configure the environment variables according to `.env.example`.

An OpenAI API key with available API credits is required for full cloud chatbot functionality.

Never commit the `.env` file or share personal API keys.

### 7. Initialize the Database

For a fresh demonstration database:

```powershell
npm run seed
```

This initializes the demonstration data according to the included seed script.

Use the development credentials defined by the current seed implementation. Do not use demonstration credentials in production.

Avoid rerunning the seed script on an existing database containing important records.

### 8. Start the Backend

```powershell
npm run dev
```

Backend URL:

```text
http://localhost:4000
```

Verify backend availability:

```text
http://localhost:4000/api/health
```

### 9. Start the Patient Dashboard

Open a new terminal from the project root:

```powershell
cd patient-react
npm install
npm run dev -- --port 5176 --strictPort
```

Open:

http://localhost:5176

### 10. Start the Doctor Dashboard

Open another terminal from the project root:

```powershell
cd doctor_dashboard
npm install
npm run dev -- --port 5175 --strictPort
```

Open:

http://localhost:5175

### 11. Start the Admin Dashboard

Open another terminal from the project root:

```powershell
cd dashboard
npm install
npm run dev -- --port 5173 --strictPort
```

Open:

http://localhost:5173

## Application Access

| Service | URL |
|---|---|
| Patient Dashboard | http://localhost:5176 |
| Doctor Dashboard | http://localhost:5175 |
| Admin Dashboard | http://localhost:5173 |
| Backend API | http://localhost:4000 |
| Backend Health Check | http://localhost:4000/api/health |
| Ollama | http://127.0.0.1:11434 |

Keep the backend, MongoDB, Ollama and required frontend services running during testing.

## Testing Guide

### Patient Module

1. Register a new patient account.
2. Log in using the registered credentials.
3. Open the AI chatbot.
4. Ask a general healthcare question.
5. Search for a doctor using symptoms.
6. Select an available appointment slot.
7. Book an appointment.
8. View the appointment status.
9. Test appointment cancellation.

### Agent-Based AI

Example prompts:

- What is diabetes?
- Which specialist should I consult for a skin rash?
- Find a dermatologist from Wellness Hub.
- Show available appointment slots for this doctor.
- Show my appointments.

Confirm the proposed appointment when requested.

### Medical Report Assistant

1. Open the patient AI chatbot.
2. Click the report attachment option.
3. Upload a fictional PDF, JPG or PNG medical report.
4. Confirm the report date and provide consent.
5. Start report analysis.
6. Review the generated explanation.
7. Ask follow-up questions.

Example questions:

- Which values are abnormal in my report?
- Explain my cholesterol levels.
- Which specialist should I consult?
- What questions should I ask my doctor?

The medical report module supports PDF text extraction and image OCR. The maximum supported upload size is 5 MB. PDF processing is limited to the first 15 pages.

Image-only scanned PDFs may not be supported by the current extraction pipeline.

Use fictional medical reports only.

### Doctor Module

1. Log in using a configured doctor account.
2. View patient appointments.
3. Manage available appointment slots.
4. Confirm or update appointment statuses.
5. Verify the updated status from the patient dashboard.

### Admin Module

1. Log in using the configured administrator account.
2. View dashboard statistics.
3. Manage doctor profiles and login accounts.
4. View registered patients.
5. Monitor appointment records.

## System Architecture

```text
Patient / Doctor / Admin Dashboards
                 |
          REST API Requests
                 |
        Node.js + Express.js
                 |
     Authentication and Validation
                 |
    +------------+-------------+
    |            |             |
 MongoDB      OpenAI        Ollama
 Database     Cloud AI      Local AI
```

## Medical Report Processing Architecture

```text
Medical Report Upload
         |
File Validation
         |
WSL / Ubuntu / Bubblewrap Sandbox
         |
Poppler PDF Extraction / Tesseract OCR
         |
Encrypted Report Storage
         |
Ollama + Llama 3.2 3B
         |
Report Analysis and Follow-up
```

## Project Structure

```text
wellness-hub/
├── backend/
│   ├── src/
│   │   ├── reports/
│   │   ├── security/
│   │   ├── ai.js
│   │   ├── knowledge.js
│   │   ├── models.js
│   │   └── server.js
│   ├── package.json
│   └── .env.example
├── patient-react/
├── doctor_dashboard/
├── dashboard/
├── patient_flutter/
├── .gitignore
└── README.md
```

## Troubleshooting

| Issue | Suggested Solution |
|---|---|
| Failed to fetch | Verify that the backend is running on port 4000 |
| MongoDB connection error | Start the MongoDB service |
| OpenAI authentication error | Check API key configuration |
| OpenAI quota error | Verify API billing and available credits |
| Ollama connection error | Check whether Ollama is running |
| Model not found | Run `ollama pull llama3.2:3b` |
| Sandbox execution failure | Verify Ubuntu and Linux package installation |
| Port already in use | Stop the conflicting process |
| Slow report analysis | Close unnecessary applications and allow processing time |
| Login failure | Verify database initialization and configured credentials |

## Limitations and Disclaimer

Wellness Hub is an educational healthcare prototype and is not a certified medical device.

AI-generated information may contain inaccuracies. The application must not be used as a replacement for professional medical diagnosis, treatment or emergency care.

The current implementation uses a lightweight keyword-based RAG knowledge base and a locally running language model for medical report analysis.

Production deployment requires further clinical validation, security auditing, privacy compliance, HTTPS configuration and operational testing.

## Project Contributors

**Project Name:** Wellness Hub – AI Healthcare Assistant

**Team Members:**

1. Shaik Ashraf Gani
2. Rahul Topinkatti
3. Yamuna K K

**Institution:** Presidency University, Bengaluru

**Program:** Master of Computer Applications (MCA)