# 🌐 Conscious Network Hub - Full Stack Setup Guide

Complete setup guide for running both frontend and backend locally with Google Cloud Vertex AI integration.

## 📋 Prerequisites

- **Node.js** 18+ and npm/yarn
- **Google Cloud Account** with billing enabled
- **Google Cloud Project** created
- **Vertex AI API** enabled in your GCP project

## 🚀 Quick Start (5 minutes)

### 1. Clone & Setup Frontend

```bash
# Navigate to project root
cd /path/to/Conscious-Network-Hub2

# Install frontend dependencies
npm install

# Create frontend env file
cp .env.example .env.local

# Edit .env.local
# VITE_BACKEND_URL=http://localhost:3001
```

### 2. Setup Backend

```bash
# Navigate to backend
cd server

# Install backend dependencies
npm install

# Copy environment template
cp .env.example .env.local

# Edit .env.local with your GCP project details
# GOOGLE_CLOUD_PROJECT=your-project-id
# GOOGLE_CLOUD_REGION=us-central1
```

### 3. Configure Google Cloud Authentication

**Option A: Application Default Credentials (Recommended for Dev)**

```bash
# Install Google Cloud CLI
# https://cloud.google.com/sdk/docs/install

# Login and set default project
gcloud auth application-default login
gcloud config set project YOUR_PROJECT_ID
gcloud services enable aiplatform.googleapis.com
```

**Option B: Service Account (Dev/Prod)**

```bash
# Create service account
gcloud iam service-accounts create cnh-backend \
  --display-name="Conscious Network Hub Backend"

# Grant Vertex AI permissions
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:cnh-backend@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/aiplatform.user"

# Create and download key
gcloud iam service-accounts keys create ~/cnh-key.json \
  --iam-account=cnh-backend@YOUR_PROJECT_ID.iam.gserviceaccount.com

# Add to backend .env.local:
# GOOGLE_APPLICATION_CREDENTIALS=~/cnh-key.json
```

### 4. Run Development Servers

**Terminal 1 - Backend Server**
```bash
cd server
npm run dev

# Output should show:
# ✅ Vertex AI initialized
# 🚀 Conscious Network Hub Backend Started
# Listening on http://localhost:3001
```

**Terminal 2 - Frontend Dev Server**
```bash
npm run dev

# Output should show:
# ➜  local:   http://localhost:5173/
# ➜  press h to show help
```

### 5. Verify Everything Works

**Test Backend:**
```bash
# Health check
curl http://localhost:3001/health

# Test chat
curl -X POST http://localhost:3001/api/ai/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"Hello, how are you?"}'
```

**Test Frontend:**
- Open http://localhost:5173 in your browser
- Look for "ETHICAL AI INSIGHT" floating widget (bottom-right)
- Try sending a message in the Q&A view

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                     Frontend (React)                     │
│  ┌────────────────────────────────────────────────────┐ │
│  │  EthicalAIInsight Component                        │ │
│  │  - 4 Views: Insight, Q&A, Report, Analytics       │ │
│  │  - Voice input, favorites, ratings, search        │ │
│  │  - Uses backendApiService to call backend         │ │
│  └────────────────────────────────────────────────────┘ │
│                          ↓ (HTTP)                       │
│  http://localhost:5173    ↑ JSON Response              │
└─────────────────────────────────────────────────────────┘
                           |
            Backend Security Boundary
            (API keys stay on backend)
                           |
┌─────────────────────────────────────────────────────────┐
│               Backend API (Express/Node)                │
│  http://localhost:3001                                  │
│  ┌────────────────────────────────────────────────────┐ │
│  │  Express Server                                    │ │
│  │  - CORS: Whitelist origins                        │ │
│  │  - Rate Limiting: 100 req/15min                   │ │
│  │  - Helmet: Security headers                       │ │
│  │  - Input Validation: Sanitization                 │ │
│  ├────────────────────────────────────────────────────┤ │
│  │  Routes                                            │ │
│  │  - POST /api/ai/chat                              │ │
│  │  - POST /api/ai/wisdom                            │ │
│  │  - POST /api/ai/report-issue                      │ │
│  │  - GET  /api/ai/trending                          │ │
│  │  - GET  /health                                   │ │
│  ├────────────────────────────────────────────────────┤ │
│  │  Vertex AI Service                                 │ │
│  │  - Uses Application Default Credentials           │ │
│  │  - Calls Google Cloud Vertex AI / Gemini          │ │
│  │  - Confidence scoring & trending extraction       │ │
│  └────────────────────────────────────────────────────┘ │
│                          ↓                               │
│  Google Cloud Platform - Vertex AI / Gemini              │
└─────────────────────────────────────────────────────────┘
```

## 📁 Project Structure

```
Conscious-Network-Hub2/
├── components/
│   └── EthicalAIInsight.tsx    # Main UI component
├── services/
│   ├── backendApiService.ts    # ← Backend API caller (NEW)
│   ├── securityService.ts      # Input validation, rate limiting
│   ├── cacheService.ts         # Conversation persistence
│   └── analyticsService.ts     # Event tracking
├── server/                     # ← Backend API (NEW)
│   ├── src/
│   │   ├── index.ts            # Express app
│   │   ├── middleware.ts       # Validation, errors, logging
│   │   ├── services/
│   │   │   └── vertexAiService.ts  # Vertex AI integration
│   │   └── routes/
│   │       └── ai.ts           # API endpoints
│   ├── scripts/
│   │   └── test.sh             # Test suite
│   ├── package.json
│   ├── tsconfig.json
│   ├── .env.example            # Template
│   ├── .env.local              # Your config (not committed)
│   └── README.md               # Backend docs
├── .env.example                # Frontend template
├── .env.local                  # Frontend config (not committed)
└── README.md
```

## 🔐 Security Features

### Frontend → Backend
- ✅ No API keys in frontend code
- ✅ No credentials in localStorage
- ✅ Input sanitization (XSS prevention)
- ✅ CORS restricted to backend only

### Backend → Google Cloud
- ✅ Application Default Credentials (dev) / Service Account (prod)
- ✅ Credentials never sent to frontend
- ✅ Server-side validation & sanitization
- ✅ Rate limiting per IP
- ✅ Helmet security headers
- ✅ Request size limits

### Data Protection
- ✅ LocalStorage for conversation history (client-side only)
- ✅ Conversation export (MD/JSON)
- ✅ No server-side data storage
- ✅ HTTPS-ready for production

## 🧪 Testing

### Run All Tests
```bash
cd server
npm run test:curl
```

### Individual Tests
```bash
# Health check
curl http://localhost:3001/health

# Chat endpoint
curl -X POST http://localhost:3001/api/ai/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What is ethical AI?",
    "context": {"category": "general"}
  }'

# Daily wisdom
curl -X POST http://localhost:3001/api/ai/wisdom

# Report issue
curl -X POST http://localhost:3001/api/ai/report-issue \
  -H "Content-Type: application/json" \
  -d '{
    "title": "App crashes on login",
    "message": "Getting 500 error when clicking Google OAuth button",
    "category": "bug"
  }'

# Trending topics
curl http://localhost:3001/api/ai/trending

# Test with verbose output
BASE_URL=http://localhost:3001 VERBOSE=true npm run test:curl
```

## 🌍 Environment Setup

### Frontend (.env.local)
```env
# Backend API URL
VITE_BACKEND_URL=http://localhost:3001
```

### Backend (server/.env.local)
```env
# Required
GOOGLE_CLOUD_PROJECT=your-project-id
GOOGLE_CLOUD_REGION=us-central1

# Optional
PORT=3001
NODE_ENV=development
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
RATE_LIMIT_MAX=100
VERTEX_AI_MODEL=gemini-1.5-flash-001
```

## 🚢 Deployment

### Deploy to Google Cloud Run

```bash
# From server/ directory
gcloud run deploy cnh-backend \
  --source . \
  --platform managed \
  --region us-central1 \
  --set-env-vars GOOGLE_CLOUD_PROJECT=YOUR_PROJECT_ID,GOOGLE_CLOUD_REGION=us-central1 \
  --allow-unauthenticated

# Get the URL and update frontend .env
# VITE_BACKEND_URL=https://cnh-backend-xxxxx.run.app
```

### Deploy Frontend (Firebase Hosting, Vercel, Netlify, etc.)

```bash
npm run build

# Then upload dist/ to your hosting provider
# Update environment variables with production backend URL
```

## 🔧 Troubleshooting

### "Failed to connect to backend"
- Check backend is running: `curl http://localhost:3001/health`
- Check `VITE_BACKEND_URL` in frontend `.env.local`
- Check browser console for CORS errors
- Verify `CORS_ORIGINS` in backend `.env.local`

### "Permission denied" from Vertex AI
- Ensure service account has `roles/aiplatform.user` role
- Check `GOOGLE_CLOUD_PROJECT` matches your project
- Verify Vertex AI API is enabled: `gcloud services enable aiplatform.googleapis.com`

### "Rate limited" errors
- Wait 15 minutes or adjust `RATE_LIMIT_MAX` in backend `.env.local`
- In production, use distributed rate limiting (Redis)

### Backend doesn't start
- Check Node.js version: `node --version` (need 18+)
- Check all required env vars: `grep "require" server/src/index.ts`
- Check logs for specific errors

### Frontend can't find backend
- Ensure backend is running on port 3001
- Check `VITE_BACKEND_URL` environment variable
- Try: `curl http://localhost:3001/health`

## 📚 Documentation

- **Backend API**: `/server/README.md`
- **Frontend Components**: See inline comments in components/
- **Security Services**: See inline comments in services/

## 🎯 Next Steps

1. ✅ Backend running locally
2. ✅ Frontend connecting to backend
3. Test all API endpoints with provided curl commands
4. Deploy backend to Cloud Run
5. Deploy frontend to hosting provider
6. Update production URLs
7. Monitor and scale as needed

## 📞 Support

Check documentation in:
- `server/README.md` - Backend API docs
- `server/.env.example` - Environment variables
- `components/EthicalAIInsight.tsx` - UI implementation
- `services/backendApiService.ts` - API integration

---

**Status**: ✅ Ready for Local Development  
**Last Updated**: January 20, 2024
