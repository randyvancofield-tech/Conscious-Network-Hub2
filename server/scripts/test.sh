#!/bin/bash

# Test script for Conscious Network Hub Backend API
# Provides curl commands to test all endpoints

echo "╔════════════════════════════════════════════════════════════╗"
echo "║   Conscious Network Hub Backend - API Test Suite          ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Configuration
BASE_URL="${BASE_URL:-http://localhost:3001}"
VERBOSE="${VERBOSE:-false}"

# Color codes
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Function to print test header
test_header() {
  echo -e "${BLUE}▶ Testing: $1${NC}"
}

# Function to print success
test_success() {
  echo -e "${GREEN}✓ $1${NC}"
  ((TESTS_PASSED++))
}

# Function to print error
test_error() {
  echo -e "${RED}✗ $1${NC}"
  ((TESTS_FAILED++))
}

# Test 1: Health Check
test_header "Health Check"
echo "GET $BASE_URL/health"
RESPONSE=$(curl -s "$BASE_URL/health")
if echo "$RESPONSE" | grep -q "healthy"; then
  test_success "Health check passed"
else
  test_error "Health check failed"
fi
echo ""

# Test 2: Chat - Basic Message
test_header "Chat - Basic Message"
echo "POST $BASE_URL/api/ai/chat"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/ai/chat" \
  -H "Content-Type: application/json" \
  -d '{"message":"Hello, what is ethical AI?"}')

if echo "$RESPONSE" | grep -q "reply"; then
  test_success "Chat endpoint returned response"
  if [ "$VERBOSE" = "true" ]; then
    echo "Response: $RESPONSE" | head -c 200
    echo "..."
  fi
else
  test_error "Chat endpoint failed"
  echo "Response: $RESPONSE"
fi
echo ""

# Test 3: Chat - With Context
test_header "Chat - With Context"
echo "POST $BASE_URL/api/ai/chat (with context)"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/ai/chat" \
  -H "Content-Type: application/json" \
  -d '{
    "message":"Explain blockchain security",
    "context":{"category":"technology","language":"en"}
  }')

if echo "$RESPONSE" | grep -q "reply"; then
  test_success "Chat with context passed"
else
  test_error "Chat with context failed"
fi
echo ""

# Test 4: Daily Wisdom
test_header "Daily Wisdom"
echo "POST $BASE_URL/api/ai/wisdom"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/ai/wisdom" \
  -H "Content-Type: application/json")

if echo "$RESPONSE" | grep -q "wisdom"; then
  test_success "Wisdom endpoint returned response"
else
  test_error "Wisdom endpoint failed"
fi
echo ""

# Test 5: Report Issue
test_header "Report Platform Issue"
echo "POST $BASE_URL/api/ai/report-issue"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/ai/report-issue" \
  -H "Content-Type: application/json" \
  -d '{
    "title":"Bug in user authentication",
    "message":"Users cannot login with Google OAuth on Firefox",
    "category":"bug"
  }')

if echo "$RESPONSE" | grep -q "analysis"; then
  test_success "Issue report endpoint passed"
else
  test_error "Issue report endpoint failed"
fi
echo ""

# Test 6: Trending Topics
test_header "Trending Topics"
echo "GET $BASE_URL/api/ai/trending"
RESPONSE=$(curl -s "$BASE_URL/api/ai/trending")

if echo "$RESPONSE" | grep -q "topics"; then
  test_success "Trending topics endpoint passed"
else
  test_error "Trending topics endpoint failed"
fi
echo ""

# Test 7: Invalid Input - Missing Message
test_header "Validation - Missing Message"
echo "POST $BASE_URL/api/ai/chat (invalid: no message)"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/ai/chat" \
  -H "Content-Type: application/json" \
  -d '{}')

if echo "$RESPONSE" | grep -q "error"; then
  test_success "Validation correctly rejected invalid input"
else
  test_error "Validation did not catch missing message"
fi
echo ""

# Test 8: Invalid Input - Message Too Long
test_header "Validation - Message Too Long"
LONG_MESSAGE=$(python3 -c "print('x' * 5001)")
echo "POST $BASE_URL/api/ai/chat (invalid: message > 5000 chars)"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/ai/chat" \
  -H "Content-Type: application/json" \
  -d "{\"message\":\"$LONG_MESSAGE\"}")

if echo "$RESPONSE" | grep -q "error"; then
  test_success "Validation correctly rejected too-long message"
else
  test_error "Validation did not catch message length"
fi
echo ""

# Test 9: CORS Preflight
test_header "CORS - Preflight Request"
echo "OPTIONS $BASE_URL/api/ai/chat"
RESPONSE=$(curl -s -X OPTIONS "$BASE_URL/api/ai/chat" \
  -H "Origin: http://localhost:5173" \
  -v 2>&1 | grep -i "access-control")

if [ ! -z "$RESPONSE" ]; then
  test_success "CORS headers present in preflight response"
else
  test_error "CORS headers not found in response"
fi
echo ""

# Print summary
echo "╔════════════════════════════════════════════════════════════╗"
echo "║   Test Summary                                             ║"
echo "╠════════════════════════════════════════════════════════════╣"
echo -e "║   ${GREEN}Passed: $TESTS_PASSED${NC}${NC}                                                 ║"
echo -e "║   ${RED}Failed: $TESTS_FAILED${NC}${NC}                                                 ║"
echo "╚════════════════════════════════════════════════════════════╝"

# Exit with appropriate code
if [ $TESTS_FAILED -eq 0 ]; then
  exit 0
else
  exit 1
fi
