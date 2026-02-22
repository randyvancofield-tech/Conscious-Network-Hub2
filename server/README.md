# Conscious Network Hub - Backend API

Secure backend API for Conscious Network Hub providing server-side integration with Google Cloud Vertex AI / Gemini. This ensures API keys are never exposed to the frontend.

## 🎯 Overview

This backend provides REST API endpoints that handle all communication with Google Cloud services, protecting sensitive credentials and implementing security best practices:

- **Secure Authentication**: Uses Application Default Credentials (dev) or service accounts (prod)
- **No Frontend Exposure**: API keys stay on the backend only
- **Rate Limiting**: Prevents abuse with configurable rate limits
- **CORS Protection**: Restricted to whitelisted origins
- **Input Validation**: Sanitization and length checks on all inputs
- **Error Handling**: Secure error messages that don't expose internals

## 📋 Requirements

- Node.js 18+
- npm or yarn
- PostgreSQL 14+ (local or managed)
- `AUTH_PERSISTENCE_BACKEND=shared_db`
- `AUTH_TOKEN_SECRET` configured
- `SENSITIVE_DATA_KEY` configured
- Google Cloud Project with Vertex AI API enabled (required only for AI endpoints)
- Service account or Application Default Credentials configured (required only for AI endpoints)

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd server
npm install
```

### 2. Configure Environment Variables

```bash
# Copy the example file
cp .env.example .env.local

# Edit .env.local with required values
# DATABASE_URL=postgresql://...
# AUTH_PERSISTENCE_BACKEND=shared_db
# AUTH_TOKEN_SECRET=...
# SENSITIVE_DATA_KEY=...
# CORS_ORIGINS=http://localhost:5173,http://localhost:3000
```

Apply schema to Postgres:

```bash
npm run db:push
```

### 3. Set Up Google Cloud Authentication

#### For Local Development (Easiest)

```bash
# Install Google Cloud CLI
# https://cloud.google.com/sdk/docs/install

# Authenticate
gcloud auth application-default login

# Select your project
gcloud config set project YOUR_PROJECT_ID
```

This creates credentials that the backend will automatically use via Application Default Credentials.

#### For Production (Cloud Run / Compute Engine)

Service account credentials are automatically provided by the Google Cloud platform. No additional setup needed.

#### For Development with Service Account (Not Recommended)

```bash
# Create service account
gcloud iam service-accounts create cnh-backend \
  --display-name="Conscious Network Hub Backend"

# Grant required roles
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:cnh-backend@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/aiplatform.user"

# Create key
gcloud iam service-accounts keys create key.json \
  --iam-account=cnh-backend@YOUR_PROJECT_ID.iam.gserviceaccount.com

# Add to .env.local (DO NOT commit this file!)
# GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json
```

### 4. Enable Vertex AI API

```bash
gcloud services enable aiplatform.googleapis.com
```

### 5. Start Development Server

```bash
npm run dev
```

Server will start on `http://localhost:3001`

## Canonical Setup References

- Root setup: `../SETUP_GUIDE.md`
- Environment key matrix: `../docs/ENVIRONMENT_MATRIX.md`
- Deployment checks: `../DEPLOYMENT_RUNBOOK.md`

## 📚 API Endpoints

### POST /api/ai/chat

Send a message to the AI and get a response.

**Request:**
```json
{
  "message": "What is ethical AI?",
  "conversationId": "optional-id",
  "conversationHistory": [
    {"role": "user", "content": "Previous message"},
    {"role": "assistant", "content": "Previous response"}
  ],
  "context": {
    "category": "general",
    "userId": "user-123"
  }
}
```

**Response:**
```json
{
  "reply": "Ethical AI refers to...",
  "citations": [
    {
      "title": "Example Citation",
      "url": "https://example.com",
      "relevance": 0.95
    }
  ],
  "usage": {
    "promptTokens": 150,
    "responseTokens": 200,
    "totalTokens": 350
  },
  "confidenceScore": 92,
  "processingTimeMs": 1250,
  "conversationId": "conv_1234567890"
}
```

### POST /api/ai/wisdom

Get daily ethical wisdom.

**Request:**
```json
{}
```

**Response:**
```json
{
  "wisdom": "Wisdom text about ethical AI...",
  "confidenceScore": 85,
  "processingTimeMs": 800
}
```

### POST /api/ai/report-issue

Submit a platform issue for analysis.

**Request:**
```json
{
  "title": "Bug in authentication",
  "message": "Users cannot login with OAuth",
  "category": "bug"
}
```

**Response:**
```json
{
  "analysis": "Issue analysis and recommendations...",
  "priority": "HIGH",
  "suggestedActions": [
    "Check OAuth provider settings",
    "Review browser console for errors",
    "Test with different browsers"
  ],
  "confidenceScore": 88,
  "processingTimeMs": 1100
}
```

### GET /api/ai/trending

Get trending topics in AI, blockchain, and wellness.

**Response:**
```json
{
  "topics": [
    "AI Safety",
    "Decentralized Identity",
    "Digital Wellness",
    "Privacy-First Architecture"
  ],
  "insights": "Current trends and detailed analysis..."
}
```

### GET /health

Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-20T12:00:00Z",
  "uptime": 3600
}
```

## 🧪 Testing

### Test All Endpoints

```bash
npm run test:curl
```

Or with verbose output:

```bash
VERBOSE=true npm run test:curl
```

### Manual Testing with curl

```bash
# Health check
curl http://localhost:3001/health

# Chat message
curl -X POST http://localhost:3001/api/ai/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"Hello, how are you?"}'

# Daily wisdom
curl -X POST http://localhost:3001/api/ai/wisdom \
  -H "Content-Type: application/json"

# Report issue
curl -X POST http://localhost:3001/api/ai/report-issue \
  -H "Content-Type: application/json" \
  -d '{
    "title":"Slow performance",
    "message":"App takes 10 seconds to load",
    "category":"performance"
  }'

# Trending topics
curl http://localhost:3001/api/ai/trending
```

## 🔐 Security Features

### Rate Limiting
- 100 requests per 15 minutes per IP (configurable)
- Health check endpoint excluded from rate limiting
- Returns `429 Too Many Requests` when exceeded

### Input Validation
- Message length: 1-5000 characters
- Automatic XSS sanitization (HTML tag removal)
- Type checking for all inputs
- Context validation for object types

### CORS Configuration
- Whitelist specific origins (default: localhost)
- Options: `/server/.env.local` - `CORS_ORIGINS`
- Prevents unauthorized cross-origin requests

### Environment Variables
- All secrets via `.env.local` (never committed)
- Example file: `.env.example`
- Required vars validated on startup

### Error Handling
- Secure error messages (no internals in production)
- Console logging in development
- Helmet security headers
- Request size limits (10KB)

## 📁 Project Structure

```
server/
├── src/
│   ├── index.ts              # Express app entry point
│   ├── middleware.ts         # Validation, logging, error handling
│   ├── services/
│   │   └── vertexAiService.ts    # Vertex AI integration
│   └── routes/
│       └── ai.ts             # API endpoints
├── scripts/
│   └── test.sh              # Test suite
├── package.json             # Dependencies
├── tsconfig.json            # TypeScript config
├── .env.example             # Example environment variables
├── .env.local               # Local development env (not committed)
└── README.md               # This file
```

## 🌐 Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GOOGLE_CLOUD_PROJECT` | ✅ Yes | - | GCP Project ID |
| `GOOGLE_CLOUD_REGION` | ✅ Yes | - | Vertex AI region |
| `PORT` | ❌ No | `3001` | Server port |
| `NODE_ENV` | ❌ No | `development` | Environment |
| `CORS_ORIGINS` | ❌ No | `http://localhost:5173,http://localhost:3000` | Allowed origins |
| `RATE_LIMIT_MAX` | ❌ No | `100` | Rate limit per window |
| `VERTEX_AI_MODEL` | ❌ No | `gemini-1.5-flash-001` | Vertex AI model |
| `GOOGLE_APPLICATION_CREDENTIALS` | ❌ No | - | Path to service account JSON (dev only) |

## 🔄 Frontend Integration

The frontend (`EthicalAIInsight` component) calls this backend instead of direct Vertex AI:

### Before (Direct API)
```typescript
// ❌ NOT SECURE - API key exposed to frontend
const response = await askEthicalAI(message);
```

### After (Backend)
```typescript
// ✅ SECURE - All API calls go through backend
const response = await fetch('http://localhost:3001/api/ai/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ message })
});
```

## 📈 Deployment

### Local Development

```bash
# Terminal 1 - Backend
cd server
npm install
npm run dev

# Terminal 2 - Frontend
npm run dev
```

### Google Cloud Run (Recommended)

```bash
# Build Docker image
docker build -t gcr.io/YOUR_PROJECT_ID/cnh-backend .

# Push to Registry
docker push gcr.io/YOUR_PROJECT_ID/cnh-backend

# Deploy to Cloud Run
gcloud run deploy cnh-backend \
  --image gcr.io/YOUR_PROJECT_ID/cnh-backend \
  --region us-central1 \
  --set-env-vars GOOGLE_CLOUD_PROJECT=YOUR_PROJECT_ID,GOOGLE_CLOUD_REGION=us-central1 \
  --allow-unauthenticated
```

### Environment Setup

Update frontend `.env` with production backend URL:

```env
VITE_BACKEND_URL=https://cnh-backend-xxxxx.run.app
```

## 🐛 Troubleshooting

### "Missing required environment variable"

**Problem**: `GOOGLE_CLOUD_PROJECT` not set

**Solution**:
```bash
# Add to .env.local
GOOGLE_CLOUD_PROJECT=your-project-id
```

### "Permission denied" errors

**Problem**: Service account lacks Vertex AI permissions

**Solution**:
```bash
# Grant aiplatform.user role
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:cnh-backend@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/aiplatform.user"
```

### "CORS error" from frontend

**Problem**: Frontend origin not whitelisted

**Solution**: Add to `server/.env.local`:
```env
CORS_ORIGINS=http://localhost:5173,http://localhost:3000,https://yourdomain.com
```

### "Rate limited" errors

**Problem**: Too many requests from same IP

**Solution**: Wait 15 minutes or adjust `RATE_LIMIT_MAX` in `.env.local`

## 📚 Additional Resources

- [Vertex AI Documentation](https://cloud.google.com/vertex-ai/docs)
- [Gemini API Guide](https://cloud.google.com/vertex-ai/docs/generative-ai/model-reference/gemini)
- [Application Default Credentials](https://cloud.google.com/docs/authentication/application-default-credentials)
- [Express.js Documentation](https://expressjs.com/)
- [Google Cloud SDK](https://cloud.google.com/sdk/docs)

## 📝 Contributing

When adding new endpoints:

1. Add route handler in `src/routes/ai.ts`
2. Implement service method in `src/services/vertexAiService.ts`
3. Add input validation in middleware
4. Test with `npm run test:curl`
5. Update this README

## 📄 License

Part of Conscious Network Hub project.

---

**Last Updated**: January 20, 2024  
**Status**: ✅ Production Ready
