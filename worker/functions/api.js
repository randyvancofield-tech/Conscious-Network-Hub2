import { json, error } from "../lib/response.js";
import { withHandler } from "../lib/handler.js";

const TIER_PRICING = {
  "Free / Community Tier": { name: "Free / Community Tier", price: 0 },
  "Guided Tier": { name: "Guided Tier", price: 22 },
  "Accelerated Tier": { name: "Accelerated Tier", price: 44 }
};

const membershipStore = new Map();
const paymentStore = new Map();

function getPayments(userId) {
  if (!paymentStore.has(userId)) {
    paymentStore.set(userId, []);
  }
  return paymentStore.get(userId);
}

async function parseJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function normalizeBaseUrl(value) {
  if (!value || typeof value !== "string") return "";
  return value.endsWith("/") ? value : `${value}/`;
}

function resolveBackendBaseUrl(env) {
  return normalizeBaseUrl(
    env?.AI_BACKEND_URL || env?.BACKEND_API_URL || env?.VITE_BACKEND_URL || ""
  );
}

async function proxyApiRequest({ pathname, request, env }) {
  const baseUrl = resolveBackendBaseUrl(env);
  if (!baseUrl) return null;

  const incomingUrl = new URL(request.url);
  const targetUrl = new URL(pathname.replace(/^\//, ""), baseUrl);
  if (incomingUrl.host === targetUrl.host) {
    return null;
  }

  const headers = new Headers(request.headers);
  headers.set("x-forwarded-proto", incomingUrl.protocol.replace(":", ""));
  headers.set("x-forwarded-host", incomingUrl.host);

  const init = {
    method: request.method,
    headers
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = request.body;
  }

  const upstream = await fetch(targetUrl.toString(), init);
  const responseHeaders = new Headers(upstream.headers);
  if (!responseHeaders.get("content-type")) {
    responseHeaders.set("content-type", "application/json; charset=utf-8");
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: responseHeaders
  });
}

async function proxyAiRequest({ pathname, request, env }) {
  const baseUrl = normalizeBaseUrl(
    env?.AI_BACKEND_URL || env?.BACKEND_API_URL || env?.VITE_BACKEND_URL || ""
  );

  if (!baseUrl) {
    return null;
  }

  const targetUrl = new URL(pathname.replace(/^\//, ""), baseUrl);
  const headers = new Headers(request.headers);
  headers.set("x-forwarded-proto", "https");
  headers.set("x-forwarded-host", new URL(request.url).host);

  const init = {
    method: request.method,
    headers
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = request.body;
  }

  const upstream = await fetch(targetUrl.toString(), init);
  const responseHeaders = new Headers(upstream.headers);
  if (!responseHeaders.get("content-type")) {
    responseHeaders.set("content-type", "application/json; charset=utf-8");
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: responseHeaders
  });
}

async function generateReply(prompt, env, options = {}) {
  const openAiKey = env?.OPENAI_API_KEY;
  const geminiKey = env?.GEMINI_API_KEY;
  const temperature = options.temperature ?? 0.7;

  if (openAiKey) {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${openAiKey}`
      },
      body: JSON.stringify({
        model: env?.OPENAI_MODEL || "gpt-4o-mini",
        temperature,
        messages: [{ role: "user", content: prompt }]
      })
    });

    if (response.ok) {
      const data = await response.json();
      const text = data?.choices?.[0]?.message?.content;
      if (typeof text === "string" && text.trim()) {
        return { provider: "openai", text: text.trim() };
      }
    }
  }

  if (geminiKey) {
    const model = env?.GEMINI_MODEL || "gemini-1.5-flash";
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature }
        })
      }
    );

    if (response.ok) {
      const data = await response.json();
      const parts = data?.candidates?.[0]?.content?.parts || [];
      const text = parts.map((part) => part?.text || "").join("\n").trim();
      if (text) {
        return { provider: "gemini", text };
      }
    }
  }

  return {
    provider: "fallback",
    text: "AI provider is not configured in the Worker environment."
  };
}

function extractPriority(text) {
  if (/critical|urgent|immediate/i.test(text)) return "Critical";
  if (/high|serious|significant/i.test(text)) return "High";
  if (/low|minor|small/i.test(text)) return "Low";
  return "Medium";
}

function extractTopics(text) {
  return text
    .split("\n")
    .map((line) => line.replace(/^[-*\d.\s]+/, "").trim())
    .filter((line) => line.length > 3)
    .slice(0, 10);
}

async function handleAiRoute({ pathname, method, request, env }) {
  const proxied = await proxyAiRequest({ pathname, request, env });
  if (proxied) {
    return proxied;
  }

  const start = Date.now();

  if (pathname === "/api/ai/chat" && method === "POST") {
    const body = await parseJson(request);
    const message = body?.message;
    if (!message || typeof message !== "string") {
      return error("Message is required", 400);
    }

    const ai = await generateReply(message, env, { temperature: 0.7 });
    return json({
      provider: ai.provider,
      reply: ai.text,
      citations: [],
      confidenceScore: ai.provider === "fallback" ? 0 : 75,
      processingTimeMs: Date.now() - start
    });
  }

  if (pathname === "/api/ai/wisdom" && method === "POST") {
    const prompt =
      "Generate a short, professional daily insight on ethical AI, security, decentralization, or wellness.";
    const ai = await generateReply(prompt, env, { temperature: 0.6 });
    return json({
      provider: ai.provider,
      wisdom: ai.text,
      reply: ai.text,
      citations: [],
      confidenceScore: ai.provider === "fallback" ? 0 : 80,
      processingTimeMs: Date.now() - start
    });
  }

  if (pathname === "/api/ai/report-issue" && method === "POST") {
    const body = await parseJson(request);
    const title = body?.title || "Issue Report";
    const description = body?.message || body?.description || "";
    const category = body?.category || "other";

    if (!description) {
      return error("Issue description is required", 400);
    }

    const prompt = [
      "Analyze this platform issue and provide a concise response:",
      `Title: ${title}`,
      `Category: ${category}`,
      `Description: ${description}`,
      "Include severity and first next steps."
    ].join("\n");

    const ai = await generateReply(prompt, env, { temperature: 0.4 });
    const priority = extractPriority(ai.text);

    return json({
      ok: true,
      provider: ai.provider,
      analysis: ai.text,
      priority,
      suggestedActions: ["Issue has been recorded", "Team review is pending"],
      reply: ai.text,
      citations: [],
      confidenceScore: ai.provider === "fallback" ? 0 : 80,
      processingTimeMs: Date.now() - start,
      emailSent: false
    });
  }

  if (pathname === "/api/ai/trending" && method === "GET") {
    const prompt =
      "List five short trending topics across ethical AI, security, decentralized platforms, and wellness.";
    const ai = await generateReply(prompt, env, { temperature: 0.5 });
    const topics = extractTopics(ai.text);
    return json({
      provider: ai.provider,
      topics,
      insights: ai.text,
      reply: ai.text,
      citations: [],
      confidenceScore: ai.provider === "fallback" ? 0 : 75,
      processingTimeMs: Date.now() - start
    });
  }

  return error("Not Found", 404);
}

async function handleMembershipRoute({ pathname, method, request }) {
  if (pathname === "/api/membership/tiers" && method === "GET") {
    return json({ tiers: Object.values(TIER_PRICING) });
  }

  if (pathname === "/api/membership/select-tier" && method === "POST") {
    const body = await parseJson(request);
    const userId = body?.userId;
    const tier = body?.tier;

    if (!userId || !tier) {
      return error("Missing userId or tier", 400);
    }

    if (!TIER_PRICING[tier]) {
      return error("Invalid tier selected", 400);
    }

    const now = new Date().toISOString();
    const membership = {
      id: `mem_${userId}`,
      userId,
      tier,
      status: "active",
      startDate: now
    };
    membershipStore.set(userId, membership);

    const payment = {
      id: `pay_${Date.now()}`,
      amount: TIER_PRICING[tier].price,
      status: "completed",
      tier,
      paymentMethod: "mock",
      createdAt: now
    };
    getPayments(userId).unshift(payment);

    return json({
      success: true,
      message: `Successfully selected ${tier}`,
      membership,
      payment,
      user: {
        id: userId,
        tier,
        subscriptionStatus: "active"
      }
    });
  }

  if (pathname.startsWith("/api/membership/status/") && method === "GET") {
    const userId = pathname.split("/").pop();
    if (!userId) {
      return error("Missing userId", 400);
    }

    const membership = membershipStore.get(userId) || null;
    const paymentHistory = getPayments(userId);
    const tier = membership?.tier || "Free / Community Tier";
    const subscriptionStatus = membership ? "active" : "inactive";

    return json({
      user: {
        id: userId,
        tier,
        subscriptionStatus,
        subscriptionStartDate: membership?.startDate || null
      },
      membership,
      paymentHistory,
      hasMembership: Boolean(membership)
    });
  }

  if (pathname === "/api/membership/confirm-payment" && method === "POST") {
    const body = await parseJson(request);
    const userId = body?.userId;
    const tier = body?.tier;

    if (!userId || !tier) {
      return error("Missing required fields", 400);
    }

    if (!TIER_PRICING[tier]) {
      return error("Invalid tier selected", 400);
    }

    const now = new Date().toISOString();
    const membership = membershipStore.get(userId) || {
      id: `mem_${userId}`,
      userId,
      tier,
      status: "active",
      startDate: now
    };
    membershipStore.set(userId, membership);

    const payment = {
      id: `pay_${Date.now()}`,
      amount: TIER_PRICING[tier].price,
      status: "completed",
      tier,
      paymentMethod: "mock",
      createdAt: now
    };
    getPayments(userId).unshift(payment);

    return json({
      success: true,
      message: "Payment confirmed successfully",
      payment
    });
  }

  return error("Not Found", 404);
}

export const onRequest = withHandler(async ({ request, env }) => {
  const { pathname } = new URL(request.url);
  const method = request.method.toUpperCase();

  if (pathname.startsWith("/api/")) {
    const proxied = await proxyApiRequest({ pathname, request, env });
    if (proxied) {
      return proxied;
    }
  }

  if (method === "GET" && pathname === "/api/ping") {
    return json({ ok: true, source: "cloudflare-worker", version: "ping-001" });
  }

  if (pathname === "/api") {
    return json({ message: "API ready" });
  }

  if (pathname.startsWith("/api/ai/")) {
    return handleAiRoute({ pathname, method, request, env });
  }

  if (pathname.startsWith("/api/membership/")) {
    return handleMembershipRoute({ pathname, method, request });
  }

  return error("Not Found", 404);
});
