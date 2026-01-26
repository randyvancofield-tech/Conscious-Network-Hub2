import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import {
  requestLogger,
  errorHandler,
  healthCheck,
} from './middleware';
import aiRoutes from './routes/ai';
import membershipRoutes from './routes/membership';
import { initializeVertexAI } from './services/vertexAiService';

// Load environment variables
dotenv.config();

// Validate required environment variables (only enforce in production)
const requiredEnvVars = [
  'GOOGLE_CLOUD_PROJECT',
  'GOOGLE_CLOUD_REGION',
];

const NODE_ENV = process.env.NODE_ENV || 'development';

if (NODE_ENV === 'production') {
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      console.error(`❌ Missing required environment variable: ${envVar}`);
      process.exit(1);
    }
  }
} else {
  // In development, warn but don't exit so local debugging is possible
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      console.warn(`⚠️ Dev: Environment variable not set: ${envVar} (continuing in dev mode)`);
    }
  }
}

// Initialize Express app
const app: Express = express();
const PORT = process.env.PORT || 3001;

// Initialize Vertex AI if possible; in dev we'll attempt init but allow failures
try {
  if (process.env.GOOGLE_CLOUD_PROJECT && process.env.GOOGLE_CLOUD_REGION) {
    initializeVertexAI({
      projectId: process.env.GOOGLE_CLOUD_PROJECT!,
      region: process.env.GOOGLE_CLOUD_REGION!,
      model: process.env.VERTEX_AI_MODEL || 'gemini-1.5-flash-001',
    });
    console.log('✅ Vertex AI initialized');
  } else {
    console.warn('⚠️ Vertex AI not initialized - missing project/region; running in mock/dev mode');
  }
} catch (error) {
  console.error('❌ Failed to initialize Vertex AI:', error);
  if (NODE_ENV === 'production') process.exit(1);
}

// Security middleware
app.use(helmet());

// Trust proxy for rate limiting (safe for local dev)
app.set('trust proxy', 1);

// CORS configuration
const corsOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:3000').split(',');
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);

      if (corsOrigins.includes(origin) || NODE_ENV === 'development') {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    credentials: true,
    maxAge: 86400, // 24 hours
  })
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
import userRoutes from './routes/user';
import uploadRoutes from './routes/upload';
import reflectionRoutes from './routes/reflection';
app.use('/api/ai', aiRoutes);
app.use('/api/membership', membershipRoutes);
app.use('/api/user', userRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/reflection', reflectionRoutes);
app.use('/uploads', express.static('public/uploads'));

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
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   🚀 Conscious Network Hub Backend Started                ║
║                                                            ║
║   Environment: ${NODE_ENV.padEnd(41)} ║
║   Port: ${PORT.toString().padEnd(50)} ║
║   CORS Origins: ${corsOrigins.length.toString().padEnd(42)} ║
║                                                            ║
║   Endpoints:
║   POST   /api/ai/chat              - Send chat message        ║
║   POST   /api/ai/wisdom            - Get daily wisdom         ║
║   POST   /api/ai/report-issue      - Report platform issue    ║
║   GET    /api/ai/trending          - Get trending topics      ║
║   POST   /api/membership/select-tier    - Select membership tier ║
║   GET    /api/membership/status/:id     - Check membership status ║
║   POST   /api/membership/confirm-payment - Confirm fake payment ║
║   GET    /api/membership/tiers         - Get available tiers ║
║   GET    /health               - Health check             ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
  `);
});

export default app;
