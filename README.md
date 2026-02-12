<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Conscious Network Hub - Full Stack Platform

A community-centered decentralized social learning infrastructure powered by ethical AI.

**âš¡ Now with Secure Backend API for Google Cloud Vertex AI Integration!**

## ðŸš€ Quick Start

### Prerequisites
- Node.js 18+
- Google Cloud Project with Vertex AI API enabled
- Google Cloud Application Default Credentials

### Setup (5 minutes)

**1. Frontend Setup**
```bash
npm install
cp .env.example .env.local
# Edit .env.local with VITE_BACKEND_URL=http://localhost:3001
npm run dev
```

**2. Backend Setup**
```bash
cd server
npm install
cp .env.example .env.local
# Edit .env.local with your GCP credentials:
# GOOGLE_CLOUD_PROJECT=your-project-id
# GOOGLE_CLOUD_REGION=us-central1

# Setup Google Cloud authentication:
gcloud auth application-default login
gcloud services enable aiplatform.googleapis.com

npm run dev
```

**3. Access**
- Frontend: http://localhost:5173
- Backend API: http://localhost:3001
- Health Check: http://localhost:3001/health

## ðŸ“š Documentation

- **[Full Setup Guide](./SETUP_GUIDE.md)** - Complete setup instructions for local development
- **[Backend README](./server/README.md)** - Backend API documentation and architecture
- **[API Testing Guide](./server/TESTING.md)** - Comprehensive testing guide with curl examples
- **[Enhancement Proposal](./ETHICAL_AI_ENHANCEMENT_PROPOSAL.md)** - Feature roadmap
- **[Implementation Details](./ETHICAL_AI_IMPLEMENTATION_COMPLETE.md)** - Technical implementation

## ðŸ—ï¸ Architecture

```
Frontend (React/TypeScript)
  â†“ HTTPS (secure, no API keys)
Backend API (Express/Node)
  â†“ (API keys stay on backend)
Google Cloud Vertex AI / Gemini
```

### Key Features

**Frontend:**
- âœ… EthicalAIInsight Component (4-view system)
- âœ… Voice input support
- âœ… Message reactions, favorites, ratings
- âœ… Conversation history & search
- âœ… Export conversations (MD/JSON)

**Backend:**
- âœ… Secure Vertex AI integration
- âœ… Rate limiting (100 req/15min)
- âœ… Input validation & sanitization
- âœ… CORS protection
- âœ… Error handling & logging
- âœ… Health checks

**API Endpoints:**
- `POST /api/ai/chat` - Send chat message
- `POST /api/ai/wisdom` - Get daily wisdom
- `POST /api/ai/report-issue` - Report platform issues
- `GET /api/ai/trending` - Get trending topics
- `GET /health` - Health check

## ðŸ” Security

- âœ… **No API keys in frontend** - All auth server-side
- âœ… **Application Default Credentials** - For development
- âœ… **Service Accounts** - For production deployment
- âœ… **CORS restricted** - Whitelist your origins
- âœ… **Rate limiting** - Prevent abuse
- âœ… **Input validation** - XSS/injection prevention
- âœ… **Helmet headers** - Security headers enabled
- âœ… **HTTPS-ready** - Deploy to Cloud Run

## ðŸ§ª Testing

```bash
# Test backend with curl
cd server
npm run test:curl

# Or manually:
curl -X POST http://localhost:3001/api/ai/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"Hello"}'
```

See [TESTING.md](./server/TESTING.md) for more examples.

## ðŸŒ Deployment

### Google Cloud Run (Recommended)
```bash
cd server
gcloud run deploy cnh-backend \
  --source . \
  --platform managed \
  --region us-central1 \
  --set-env-vars GOOGLE_CLOUD_PROJECT=YOUR_PROJECT_ID
```

### Update Frontend for Production
```bash
# .env.local or .env.production
VITE_BACKEND_URL=https://cnh-backend-xxxxx.run.app
```

## ðŸ“ Project Structure

```
Conscious-Network-Hub2/
â”œâ”€â”€ components/
â”‚   â””â”€â”€ EthicalAIInsight.tsx    # Main UI component
â”œâ”€â”€ services/
â”‚   â”œâ”€â”€ backendApiService.ts    # Backend API client
â”‚   â”œâ”€â”€ securityService.ts      # Input validation
â”‚   â”œâ”€â”€ cacheService.ts         # Persistence
â”‚   â””â”€â”€ analyticsService.ts     # Event tracking
â”œâ”€â”€ server/                     # Backend API
â”‚   â”œâ”€â”€ src/
â”‚   â”‚   â”œâ”€â”€ index.ts            # Express app
â”‚   â”‚   â”œâ”€â”€ services/vertexAiService.ts
â”‚   â”‚   â””â”€â”€ routes/ai.ts        # API endpoints
â”‚   â”œâ”€â”€ .env.example
â”‚   â”œâ”€â”€ README.md
â”‚   â””â”€â”€ TESTING.md
â”œâ”€â”€ SETUP_GUIDE.md              # Complete setup guide
â””â”€â”€ README.md                   # This file
```

## ðŸ“¦ Key Technologies

**Frontend:**
- React 17+
- TypeScript
- Tailwind CSS
- Vite

**Backend:**
- Node.js + Express
- TypeScript
- Google Cloud Vertex AI
- Application Default Credentials

## ðŸŽ¯ Next Steps

1. Follow [SETUP_GUIDE.md](./SETUP_GUIDE.md) for complete local setup
2. Test endpoints using [TESTING.md](./server/TESTING.md)
3. Deploy to Google Cloud Run
4. Update frontend with production URL

## ðŸ› Troubleshooting

**"Cannot connect to backend"**
- Ensure backend is running: `curl http://localhost:3001/health`
- Check `VITE_BACKEND_URL` in frontend `.env.local`
- Verify `CORS_ORIGINS` in backend `.env.local`

**"Permission denied" from Vertex AI**
- Run: `gcloud auth application-default login`
- Verify: `gcloud config set project YOUR_PROJECT_ID`
- Enable API: `gcloud services enable aiplatform.googleapis.com`

See [SETUP_GUIDE.md](./SETUP_GUIDE.md) for more troubleshooting.

## ðŸ“ž Support

- Backend docs: [server/README.md](./server/README.md)
- Testing guide: [server/TESTING.md](./server/TESTING.md)
- Setup guide: [SETUP_GUIDE.md](./SETUP_GUIDE.md)

## ðŸ“„ License

Part of Conscious Network Hub project.

---

**Status**: âœ… Production Ready  
**Backend**: âœ… Vertex AI Integrated  
**Frontend**: âœ… Backend API Client  
**Last Updated**: January 20, 2024
## Environment Setup

- See **[Environment Matrix](./docs/ENVIRONMENT_MATRIX.md)** for the final frontend/backend environment values and safe defaults.
- Keep secrets only in server/.env.local.
- Never place provider keys in frontend env files.

