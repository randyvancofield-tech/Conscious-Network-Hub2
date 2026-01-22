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
import { initializeVertexAI } from './services/vertexAiService';

// Load environment variables
dotenv.config();

// Validate required environment variables
const requiredEnvVars = [
  'GOOGLE_CLOUD_PROJECT',
  'GOOGLE_CLOUD_REGION',
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`❌ Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

// Initialize Express app
const app: Express = express();
const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Initialize Vertex AI
try {
  initializeVertexAI({
    projectId: process.env.GOOGLE_CLOUD_PROJECT!,
    region: process.env.GOOGLE_CLOUD_REGION!,
    model: process.env.VERTEX_AI_MODEL || 'gemini-1.5-flash-001',
  });
  console.log('✅ Vertex AI initialized');
} catch (error) {
  console.error('❌ Failed to initialize Vertex AI:', error);
  process.exit(1);
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
app.use('/api/ai', aiRoutes);

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
║   Endpoints:                                              ║
║   POST   /api/ai/chat          - Send chat message        ║
║   POST   /api/ai/wisdom        - Get daily wisdom         ║
║   POST   /api/ai/report-issue  - Report platform issue    ║
║   GET    /api/ai/trending      - Get trending topics      ║
║   GET    /health               - Health check             ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
  `);
});

export default app;
