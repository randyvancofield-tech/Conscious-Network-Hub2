import { Request, Response, NextFunction } from 'express';

/**
 * Input validation middleware
 */
export function validateChatInput(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const { message, conversationId, context } = req.body;

  // Validate message exists and is a string
  if (!message || typeof message !== 'string') {
    res.status(400).json({
      error: 'Invalid input: message is required and must be a string',
    });
    return;
  }

  // Validate message length (prevent excessively long inputs)
  if (message.length === 0 || message.length > 5000) {
    res.status(400).json({
      error: 'Invalid input: message must be between 1 and 5000 characters',
    });
    return;
  }

  // Validate conversationId if provided
  if (conversationId && typeof conversationId !== 'string') {
    res.status(400).json({
      error: 'Invalid input: conversationId must be a string',
    });
    return;
  }

  // Validate context if provided
  if (context && typeof context !== 'object') {
    res.status(400).json({
      error: 'Invalid input: context must be an object',
    });
    return;
  }

  // Sanitize message (basic XSS prevention)
  (req.body as any).message = sanitizeInput(message);

  next();
}

/**
 * Basic input sanitization to prevent XSS
 */
function sanitizeInput(input: string): string {
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]*>/g, '')
    .trim();
}

/**
 * Error handling middleware
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  console.error('Error:', err);

  const statusCode = (err as any).statusCode || 500;
  const message =
    process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message;

  res.status(statusCode).json({
    error: message,
    ...(process.env.NODE_ENV === 'development' && {
      stack: err.stack,
    }),
  });
}

/**
 * Request logging middleware
 */
export function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    console.log(
      `[${new Date().toISOString()}] ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`
    );
  });

  next();
}

/**
 * Health check endpoint
 */
export function healthCheck(req: Request, res: Response): void {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
}
