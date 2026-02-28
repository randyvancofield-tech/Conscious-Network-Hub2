import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';
import {
  requestLogger,
  errorHandler,
  healthCheck,
} from './middleware';
import aiRoutes from './routes/ai';
import {
  handleStripeWebhook,
  membershipPublicRoutes,
  membershipProtectedRoutes,
} from './routes/membership';
import {
  userPublicRoutes,
  userProtectedRoutes,
} from './routes/user';
import { uploadPublicRoutes, uploadProtectedRoutes } from './routes/upload';
import reflectionRoutes from './routes/reflection';
import socialRoutes from './routes/social';
import providerAuthRoutes from './routes/providerAuth';
import providerSessionRoutes from './routes/providerSession';
import identitySecurityRoutes from './routes/identitySecurity';
import integrityRoutes from './routes/integrity';
import { initializeVertexAI } from './services/vertexAiService';
import { hasOpenAiApiKey, logStripeEnvironmentLoaded, validateRequiredEnv } from './requiredEnv';

// Load environment variables with local override first.
// Use absolute paths so startup works whether launched from project root or /server.
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

try {
  validateRequiredEnv();
  logStripeEnvironmentLoaded();
} catch (error) {
  const message =
    error instanceof Error ? error.message : 'Missing required secrets/environment variables';
  console.error(message);
  process.exit(1);
}

if (!hasOpenAiApiKey()) {
  console.warn(
    '[STARTUP][WARN] OPENAI_API_KEY is not set. Authentication/profile routes remain available, but /api/ai routes will return 503 until configured.'
  );
}
const GOOGLE_CLOUD_PROJECT =
  process.env.GOOGLE_CLOUD_PROJECT ||
  process.env.GCLOUD_PROJECT ||
  process.env.GCP_PROJECT;
const GOOGLE_CLOUD_REGION = process.env.GOOGLE_CLOUD_REGION;

// Initialize Express app
const app: Express = express();
const parsedPort = Number(process.env.PORT);
const PORT = Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : 3001;

// Initialize Vertex AI if possible; in dev we'll attempt init but allow failures
try {
  if (GOOGLE_CLOUD_PROJECT && GOOGLE_CLOUD_REGION) {
    initializeVertexAI({
      projectId: GOOGLE_CLOUD_PROJECT,
      region: GOOGLE_CLOUD_REGION,
      model: process.env.VERTEX_AI_MODEL || 'gemini-1.5-flash-001',
    });
    console.log('Vertex AI initialized');
  } else {
    console.warn(
      'Vertex AI not initialized - missing GOOGLE_CLOUD_PROJECT/GOOGLE_CLOUD_REGION; server will continue without Vertex AI'
    );
  }
} catch (error) {
  console.error('Failed to initialize Vertex AI:', error);
}

// Security middleware
app.use(helmet());

// Trust proxy for rate limiting (safe for local dev)
app.set('trust proxy', 1);

// CORS configuration
const configuredCorsOrigins = (process.env.CORS_ORIGINS || '')
  .split(/[,\n\r\t ]+/)
  .map((origin) => origin.trim())
  .filter(Boolean);

const localDevCorsOrigins = ['http://localhost:3000', 'http://127.0.0.1:3000'];
const corsOriginCandidates = [...new Set([...configuredCorsOrigins, ...localDevCorsOrigins])];

const normalizeOrigin = (origin: string): string => {
  try {
    return new URL(origin).origin;
  } catch {
    return origin.replace(/\/+$/, '');
  }
};

const isLocalHost = (hostname: string): boolean =>
  hostname === 'localhost' ||
  hostname === '127.0.0.1' ||
  hostname === '::1' ||
  hostname.endsWith('.localhost');

const corsOrigins = new Set<string>();
for (const rawOrigin of corsOriginCandidates) {
  const normalized = normalizeOrigin(rawOrigin);
  corsOrigins.add(normalized);

  // If a root domain is configured, allow the "www" variant as well (and vice versa).
  try {
    const parsed = new URL(normalized);
    const host = parsed.hostname;
    if (!isLocalHost(host) && !/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
      if (host.startsWith('www.')) {
        const bare = host.slice(4);
        corsOrigins.add(`${parsed.protocol}//${bare}${parsed.port ? `:${parsed.port}` : ''}`);
      } else {
        corsOrigins.add(`${parsed.protocol}//www.${host}${parsed.port ? `:${parsed.port}` : ''}`);
      }
    }
  } catch {
    // Ignore invalid entries; exact string check above still applies.
  }
}

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like curl or server-side scripts)
      if (!origin) return callback(null, true);

      const normalizedOrigin = normalizeOrigin(origin);
      if (corsOrigins.has(normalizedOrigin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: 86400, // 24 hours
  })
);

// Stripe webhooks require the raw request body for signature validation.
app.post(
  '/api/membership/stripe/webhook',
  express.raw({ type: 'application/json' }),
  handleStripeWebhook
);

// Body parser middleware
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ limit: '10kb', extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.RATE_LIMIT_MAX ? parseInt(process.env.RATE_LIMIT_MAX) : 100, // requests per window
  message: 'Too many requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for health check
    return req.path === '/health';
  },
});

app.use(limiter);

// Request logging
app.use(requestLogger);

// Health check endpoint (before routes for quick response)
app.get('/health', healthCheck);

// API routes
// Public routes are mounted first.
app.use('/api/user', userPublicRoutes);
app.use('/api/membership', membershipPublicRoutes);
app.use('/api/provider/auth', providerAuthRoutes);
app.use('/api/identity-security', identitySecurityRoutes);
app.use('/api/integrity', integrityRoutes);

// Protected routes enforce canonical identity within their own routers.
// This avoids duplicate middleware execution while preserving route-level security.
app.use('/api/user', userProtectedRoutes);
app.use('/api/membership', membershipProtectedRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/upload', uploadProtectedRoutes);
app.use('/api/reflection', reflectionRoutes);
app.use('/api/social', socialRoutes);
app.use('/api/provider/session', providerSessionRoutes);
app.use('/uploads', uploadPublicRoutes);

// Catch-all 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    path: req.path,
    method: req.method,
  });
});

// Error handling middleware (must be last)
app.use(errorHandler);

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend listening on port ${PORT}`);
});

export default app;
