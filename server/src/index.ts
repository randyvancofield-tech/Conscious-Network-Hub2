import express, { Express, NextFunction, Request, Response } from 'express';
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
import adminRoutes from './routes/admin';
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
import providerCrmRoutes from './routes/providerCrm';
import consciousCareersRoutes from './routes/consciousCareers';
import identitySecurityRoutes from './routes/identitySecurity';
import integrityRoutes from './routes/integrity';
import immersiveRoutes from './routes/immersive';
import meetingRoutes from './routes/meeting';
import { coursesPublicRoutes, coursesProtectedRoutes } from './routes/courses';
import userCoursesRoutes from './routes/userCourses';
import { providersRouter, userRequestsRouter, providerRequestsRouter } from './routes/providers';
import {
  providerApplicantPublicRoutes,
  providerApplicantProtectedRoutes,
} from './routes/providerApplicants';
import { initializeVertexAI } from './services/vertexAiService';
import { ensureProviderCrmAdminFromEnv } from './services/providerCrmAdminBootstrap';
import {
  hasOpenAiApiKey,
  logDeliveryEnvironmentLoaded,
  logStripeEnvironmentLoaded,
  validateRequiredEnv,
} from './requiredEnv';

// Load environment variables with local override first.
// Use absolute paths so startup works whether launched from project root or /server.
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

try {
  validateRequiredEnv();
  logStripeEnvironmentLoaded();
  logDeliveryEnvironmentLoaded();
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
const PORT = Number(process.env.PORT || 8080);

const normalizeHostname = (value: unknown): string => {
  const raw = String(value || '').trim().toLowerCase();
  return raw.replace(/^https?:\/\//, '').split('/')[0].split(':')[0].replace(/\.+$/, '');
};

const hostnameFromUrl = (value: unknown): string | null => {
  try {
    const raw = String(value || '').trim();
    if (!raw) return null;
    return normalizeHostname(new URL(raw).hostname);
  } catch {
    return null;
  }
};

const productionHstsHosts = Array.from(
  new Set(
    [
      hostnameFromUrl(process.env.FRONTEND_BASE_URL),
      ...String(process.env.HSTS_ALLOWED_HOSTS || '')
        .split(',')
        .map(normalizeHostname),
    ].filter((host): host is string => Boolean(host))
  )
);

const isProductionRuntime = String(process.env.NODE_ENV || '').trim().toLowerCase() === 'production';
const hstsMaxAgeSeconds = Number(process.env.HSTS_MAX_AGE_SECONDS || 31536000);
const hstsHeaderValue = `max-age=${Number.isFinite(hstsMaxAgeSeconds) && hstsMaxAgeSeconds > 0 ? Math.floor(hstsMaxAgeSeconds) : 31536000}; includeSubDomains`;

const isHttpsRequest = (req: Request): boolean => {
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '')
    .split(',')[0]
    .trim()
    .toLowerCase();
  return req.secure || forwardedProto === 'https';
};

const shouldSetProductionHsts = (req: Request): boolean => {
  if (!isProductionRuntime || productionHstsHosts.length === 0 || !isHttpsRequest(req)) {
    return false;
  }

  const requestHost = normalizeHostname(req.headers.host);
  return productionHstsHosts.includes(requestHost);
};

// Initialize Vertex AI if possible; in dev we'll attempt init but allow failures
try {
  if (GOOGLE_CLOUD_PROJECT && GOOGLE_CLOUD_REGION) {
    initializeVertexAI({
      projectId: GOOGLE_CLOUD_PROJECT,
      region: GOOGLE_CLOUD_REGION,
      model: process.env.VERTEX_AI_MODEL || 'gemini-2.0-flash-001',
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

// Security middleware. HSTS is scoped below so local/dev hosts are never pinned.
app.use(helmet({ strictTransportSecurity: false }));
app.use((req: Request, res: Response, next: NextFunction) => {
  if (shouldSetProductionHsts(req)) {
    res.setHeader('Strict-Transport-Security', hstsHeaderValue);
  }
  next();
});

// Trust proxy for rate limiting (safe for local dev)
app.set('trust proxy', 1);

const configuredCorsOrigins = String(process.env.CORS_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim().replace(/\/+$/, ''))
  .filter(Boolean);

const allowedOrigins = Array.from(
  new Set([
    'https://conscious-network.org',
    'https://higherconscious.network',
    'https://www.higherconscious.network',
    'http://localhost:3000',
    'http://localhost:5173',
    ...configuredCorsOrigins,
  ])
);

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like curl, mobile apps, or server-side scripts).
      if (!origin) return callback(null, true);

      const normalizedOrigin = origin.replace(/\/+$/, '');
      if (allowedOrigins.includes(normalizedOrigin)) {
        return callback(null, true);
      }

      console.error('Blocked by CORS:', origin);
      return callback(null, false);
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Admin-Elevation-Token',
      'X-Admin-Secure-Token',
    ],
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
app.use('/api/courses', coursesPublicRoutes);
app.use('/api/providers', providersRouter);
app.use('/api/provider-applicants', providerApplicantPublicRoutes);
app.use('/api/provider/auth', providerAuthRoutes);
app.use('/api/identity-security', identitySecurityRoutes);
app.use('/api/integrity', integrityRoutes);

// Protected routes enforce canonical identity within their own routers.
// This avoids duplicate middleware execution while preserving route-level security.
app.use('/api/user', userProtectedRoutes);
app.use('/api/user', userCoursesRoutes);
app.use('/api/user/requests', userRequestsRouter);
app.use('/api/membership', membershipProtectedRoutes);
app.use('/api/courses', coursesProtectedRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/upload', uploadProtectedRoutes);
app.use('/api/reflection', reflectionRoutes);
app.use('/api/social', socialRoutes);
app.use('/api/provider/session', providerSessionRoutes);
app.use('/api/provider/crm', providerCrmRoutes);
app.use('/api/provider/requests', providerRequestsRouter);
app.use('/api/provider-applicants', providerApplicantProtectedRoutes);
app.use('/api/conscious-careers', consciousCareersRoutes);
app.use('/api/immersive', immersiveRoutes);
app.use('/api/meeting', meetingRoutes);
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
const startServer = async (): Promise<void> => {
  await ensureProviderCrmAdminFromEnv();

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Backend listening on port ${PORT}`);
  });
};

void startServer().catch((error) => {
  console.error('[STARTUP][FATAL] Failed to start backend', error);
  process.exit(1);
});

export default app;
