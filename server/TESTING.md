# 🧪 Backend API Testing Guide

Quick reference for testing all Conscious Network Hub backend endpoints using curl.

## Prerequisites

- Backend running on `http://localhost:3001`
- Google Cloud credentials configured
- Environment variables set (.env.local)

## 🏥 Health Check

```bash
# Simple health check
curl http://localhost:3001/health

# Expected response:
# {
#   "status": "healthy",
#   "timestamp": "2024-01-20T12:00:00.000Z",
#   "uptime": 3600
# }
```

## 💬 Chat Endpoint

### Basic Chat
```bash
curl -X POST http://localhost:3001/api/ai/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"Hello, what is ethical AI?"}'
```

### Chat with Context
```bash
curl -X POST http://localhost:3001/api/ai/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Explain blockchain security",
    "context": {
      "category": "technology",
      "userId": "user123"
    }
  }'
```

### Chat with Conversation History
```bash
curl -X POST http://localhost:3001/api/ai/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Can you summarize what we discussed?",
    "conversationHistory": [
      {
        "role": "user",
        "content": "What is blockchain?"
      },
      {
        "role": "assistant",
        "content": "Blockchain is a distributed ledger..."
      }
    ]
  }'
```

**Response:**
```json
{
  "reply": "AI response text here...",
  "citations": [
    {
      "title": "Citation title",
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

## 🌟 Daily Wisdom Endpoint

```bash
# Get daily wisdom
curl -X POST http://localhost:3001/api/ai/wisdom \
  -H "Content-Type: application/json"
```

**Response:**
```json
{
  "wisdom": "Wisdom text about ethical AI...",
  "confidenceScore": 85,
  "processingTimeMs": 800
}
```

## ⚠️ Report Issue Endpoint

### Report a Bug
```bash
curl -X POST http://localhost:3001/api/ai/report-issue \
  -H "Content-Type: application/json" \
  -d '{
    "title": "App crashes on login",
    "message": "Getting 500 error when clicking Google OAuth button",
    "category": "bug"
  }'
```

### Report a Feature Request
```bash
curl -X POST http://localhost:3001/api/ai/report-issue \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Add dark mode",
    "message": "Would like to enable dark mode in settings",
    "category": "feature"
  }'
```

### Report Performance Issue
```bash
curl -X POST http://localhost:3001/api/ai/report-issue \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Slow page load",
    "message": "Dashboard takes 10+ seconds to load",
    "category": "performance"
  }'
```

### Categories
- `bug` - Bug report
- `feature` - Feature request
- `performance` - Performance issue
- `usability` - Usability problem
- `security` - Security issue
- `other` - Other

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

## 📈 Trending Topics Endpoint

```bash
# Get trending topics
curl http://localhost:3001/api/ai/trending
```

**Response:**
```json
{
  "topics": [
    "AI Safety",
    "Decentralized Identity",
    "Digital Wellness"
  ],
  "insights": "Detailed analysis of trending topics..."
}
```

## 🔒 Error Testing

### Missing Message (Should Fail)
```bash
curl -X POST http://localhost:3001/api/ai/chat \
  -H "Content-Type: application/json" \
  -d '{}'

# Response: 400 Bad Request
# {
#   "error": "Invalid input: message is required and must be a string"
# }
```

### Message Too Long (Should Fail)
```bash
# Generate 5001-character string
LONG_MSG=$(python3 -c "print('x' * 5001)")

curl -X POST http://localhost:3001/api/ai/chat \
  -H "Content-Type: application/json" \
  -d "{\"message\":\"$LONG_MSG\"}"

# Response: 400 Bad Request
# {
#   "error": "Invalid input: message must be between 1 and 5000 characters"
# }
```

### Invalid JSON (Should Fail)
```bash
curl -X POST http://localhost:3001/api/ai/chat \
  -H "Content-Type: application/json" \
  -d 'invalid json'

# Response: 400 Bad Request
```

## ⏱️ Rate Limiting Test

```bash
# Send multiple requests rapidly to hit rate limit
for i in {1..101}; do
  curl -X POST http://localhost:3001/api/ai/chat \
    -H "Content-Type: application/json" \
    -d '{"message":"test"}' 2>/dev/null | grep -o "error" || echo "Request $i: OK"
done

# After 100 requests in 15 minutes, you'll get:
# 429 Too Many Requests
# {
#   "error": "Too many requests, please try again later"
# }
```

## 🌐 CORS Testing

### Preflight Request
```bash
curl -X OPTIONS http://localhost:3001/api/ai/chat \
  -H "Origin: http://localhost:5173" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -v

# Look for response headers:
# Access-Control-Allow-Origin: http://localhost:5173
# Access-Control-Allow-Methods: GET,POST,OPTIONS
# Access-Control-Allow-Headers: Content-Type
```

### Invalid Origin (Should Fail in Prod)
```bash
curl -X POST http://localhost:3001/api/ai/chat \
  -H "Origin: https://evil.com" \
  -H "Content-Type: application/json" \
  -d '{"message":"test"}'

# In production, this would be rejected
# In development, it's allowed for testing
```

## 📊 Response Format Reference

All successful responses follow this format:

```json
{
  "reply": "string - The AI response",
  "citations": [
    {
      "title": "Citation title",
      "url": "Optional URL",
      "relevance": "Number 0-1"
    }
  ],
  "usage": {
    "promptTokens": "Number",
    "responseTokens": "Number",
    "totalTokens": "Number"
  },
  "confidenceScore": "Number 0-100",
  "processingTimeMs": "Number",
  "conversationId": "String"
}
```

## 🔄 Batch Testing Script

Save as `test-all.sh`:

```bash
#!/bin/bash

BASE_URL="http://localhost:3001"

echo "🧪 Testing Conscious Network Hub Backend"
echo "=========================================="
echo ""

# Test 1: Health
echo "✓ Health Check"
curl -s "$BASE_URL/health" | jq .

# Test 2: Chat
echo ""
echo "✓ Chat Endpoint"
curl -s -X POST "$BASE_URL/api/ai/chat" \
  -H "Content-Type: application/json" \
  -d '{"message":"Hello"}' | jq .

# Test 3: Wisdom
echo ""
echo "✓ Daily Wisdom"
curl -s -X POST "$BASE_URL/api/ai/wisdom" \
  -H "Content-Type: application/json" | jq .

# Test 4: Report Issue
echo ""
echo "✓ Report Issue"
curl -s -X POST "$BASE_URL/api/ai/report-issue" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test","message":"Test issue","category":"bug"}' | jq .

# Test 5: Trending
echo ""
echo "✓ Trending Topics"
curl -s "$BASE_URL/api/ai/trending" | jq .

echo ""
echo "=========================================="
echo "✅ All tests completed!"
```

Run with:
```bash
chmod +x test-all.sh
./test-all.sh
```

## 🛠️ Using with Different Tools

### Using httpie
```bash
http POST http://localhost:3001/api/ai/chat message="Hello"
```

### Using Postman
1. Create new POST request
2. URL: `http://localhost:3001/api/ai/chat`
3. Headers: `Content-Type: application/json`
4. Body (raw JSON):
```json
{"message":"Hello"}
```

### Using Python
```python
import requests

response = requests.post(
  'http://localhost:3001/api/ai/chat',
  json={'message': 'Hello'}
)
print(response.json())
```

### Using JavaScript/Node
```javascript
fetch('http://localhost:3001/api/ai/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ message: 'Hello' })
})
.then(r => r.json())
.then(console.log)
```

---

**Status**: ✅ Ready for Testing  
**Last Updated**: January 20, 2024
