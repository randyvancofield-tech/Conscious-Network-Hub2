import { Router, Request, Response, NextFunction } from 'express';
import multer, { MulterError } from 'multer';
import { getAuthenticatedUserId, requireCanonicalIdentity } from '../middleware';
import {
  persistUploadObject,
  resolveUploadObjectByKey,
} from '../services/uploadBlobStore';

const publicRouter = Router();
const protectedRouter = Router();
protectedRouter.use(requireCanonicalIdentity);

function getPublicBaseUrl(req: Request): string {
  const configured = process.env.PUBLIC_BASE_URL?.trim();
  if (configured) {
    return configured.replace(/\/+$/, '');
  }
  const forwardedProto = (req.headers['x-forwarded-proto'] as string | undefined)?.split(',')[0]?.trim();
  const proto = forwardedProto || req.protocol || 'https';
  const host = req.get('host');
  return `${proto}://${host}`;
}

const DEFAULT_MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const parsedMaxUploadBytes = Number(process.env.UPLOAD_MAX_BYTES);
const maxUploadBytes =
  Number.isFinite(parsedMaxUploadBytes) && parsedMaxUploadBytes > 0
    ? Math.min(parsedMaxUploadBytes, 100 * 1024 * 1024)
    : DEFAULT_MAX_UPLOAD_BYTES;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: maxUploadBytes,
  },
});

type MulterRequest = Request & { file?: Express.Multer.File };
type UploadCategory = 'avatar' | 'cover' | 'profile-background' | 'reflection';
const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/gif',
]);

async function buildUploadResponse(
  req: Request,
  authUserId: string,
  file: Express.Multer.File,
  category: UploadCategory
): Promise<{
  success: boolean;
  fileUrl: string;
  media: {
    category: UploadCategory;
    url: string;
    storageProvider: string;
    objectKey: string;
    mimeType: string;
    sizeBytes: number;
  };
}> {
  const persisted = await persistUploadObject({
    userId: authUserId,
    mimeType: file.mimetype,
    originalName: file.originalname,
    buffer: file.buffer,
  });
  const fileUrl = `${getPublicBaseUrl(req)}${persisted.publicPath}`;
  return {
    success: true,
    fileUrl,
    media: {
      category,
      url: fileUrl,
      storageProvider: persisted.storageProvider,
      objectKey: persisted.objectKey,
      mimeType: file.mimetype,
      sizeBytes: file.size,
    },
  };
}

function ensureImageUpload(mReq: MulterRequest, res: Response): mReq is MulterRequest & { file: Express.Multer.File } {
  if (!mReq.file) {
    res.status(400).json({ error: 'No file uploaded' });
    return false;
  }
  const mimeType = String(mReq.file.mimetype || '').trim().toLowerCase();
  if (!ALLOWED_IMAGE_MIME_TYPES.has(mimeType)) {
    res.status(400).json({
      error:
        'Unsupported image type. Allowed formats: .jpg, .jpeg, .png, .webp, .avif, .gif',
    });
    return false;
  }
  return true;
}

const sendStoredUpload = async (
  req: Request,
  res: Response,
  category: UploadCategory,
  file: Express.Multer.File
): Promise<void> => {
  const authUserId = getAuthenticatedUserId(req);
  if (!authUserId) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  try {
    const responseBody = await buildUploadResponse(req, authUserId, file, category);
    res.json(responseBody);
  } catch (error) {
    const code = (error as Error & { code?: string })?.code;
    if (code === 'STORE_UNAVAILABLE') {
      res.status(503).json({
        error: 'Upload storage is temporarily unavailable. Retry shortly.',
      });
      return;
    }
    console.error('[UPLOAD] Failed to persist upload object', error);
    res.status(500).json({ error: 'Failed to persist uploaded file' });
  }
};

// Public read endpoint for durable upload objects.
publicRouter.get('/object/:objectKey', async (req: Request, res: Response): Promise<void> => {
  const objectKey = String(req.params.objectKey || '').trim();
  if (!objectKey) {
    res.status(400).json({ error: 'objectKey is required' });
    return;
  }

  try {
    const resolved = await resolveUploadObjectByKey(objectKey);
    if (!resolved) {
      res.status(404).json({ error: 'Upload object not found' });
      return;
    }

    const mimeType = resolved.mimeType || 'application/octet-stream';
    const totalSize = resolved.sizeBytes;
    const rangeHeader = String(req.headers.range || '').trim();

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('ETag', `"upload-${objectKey}"`);
    // Allow media embedding from frontend origins hosted on a different domain.
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Accept-Ranges', 'bytes');

    if (!rangeHeader) {
      res.setHeader('Content-Length', String(totalSize));
      res.send(resolved.buffer);
      return;
    }

    const rangeMatch = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader);
    if (!rangeMatch) {
      res.status(416);
      res.setHeader('Content-Range', `bytes */${totalSize}`);
      res.end();
      return;
    }

    const startText = rangeMatch[1];
    const endText = rangeMatch[2];
    const start = startText ? Number(startText) : 0;
    const end = endText ? Number(endText) : totalSize - 1;
    if (
      !Number.isFinite(start) ||
      !Number.isFinite(end) ||
      start < 0 ||
      end < start ||
      start >= totalSize
    ) {
      res.status(416);
      res.setHeader('Content-Range', `bytes */${totalSize}`);
      res.end();
      return;
    }

    const boundedEnd = Math.min(end, totalSize - 1);
    const chunk = resolved.buffer.subarray(start, boundedEnd + 1);
    res.status(206);
    res.setHeader('Content-Range', `bytes ${start}-${boundedEnd}/${totalSize}`);
    res.setHeader('Content-Length', String(chunk.length));
    res.send(chunk);
  } catch (error) {
    const code = (error as Error & { code?: string })?.code;
    if (code === 'STORE_UNAVAILABLE') {
      res.status(503).json({
        error: 'Upload storage is temporarily unavailable. Retry shortly.',
      });
      return;
    }
    console.error('[UPLOAD] Failed to resolve upload object', error);
    res.status(500).json({ error: 'Failed to resolve upload object' });
  }
});

// Upload endpoint for profile background video
protectedRouter.post('/profile-background', upload.single('video'), async (req: Request, res: Response): Promise<void> => {
  const mReq = req as MulterRequest;
  if (!mReq.file) {
    res.status(400).json({ error: 'No file uploaded' });
    return;
  }
  if (!mReq.file.mimetype.startsWith('video/')) {
    res.status(400).json({ error: 'Only video uploads are allowed for profile backgrounds' });
    return;
  }
  await sendStoredUpload(req, res, 'profile-background', mReq.file);
});

// Upload endpoint for profile avatar image
protectedRouter.post('/avatar', upload.single('image'), async (req: Request, res: Response): Promise<void> => {
  const mReq = req as MulterRequest;
  if (!ensureImageUpload(mReq, res)) {
    return;
  }
  await sendStoredUpload(req, res, 'avatar', mReq.file);
});

// Upload endpoint for profile cover image
protectedRouter.post('/cover', upload.single('image'), async (req: Request, res: Response): Promise<void> => {
  const mReq = req as MulterRequest;
  if (!ensureImageUpload(mReq, res)) {
    return;
  }
  await sendStoredUpload(req, res, 'cover', mReq.file);
});

// Upload endpoint for reflection files (video/document)
protectedRouter.post('/reflection', upload.single('file'), async (req: Request, res: Response): Promise<void> => {
  const mReq = req as MulterRequest;
  if (!mReq.file) {
    res.status(400).json({ error: 'No file uploaded' });
    return;
  }
  await sendStoredUpload(req, res, 'reflection', mReq.file);
});

const handleUploadMiddlewareError = (
  err: unknown,
  _req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (err instanceof MulterError && err.code === 'LIMIT_FILE_SIZE') {
    res.status(413).json({
      error: `Uploaded file exceeds maximum size of ${maxUploadBytes} bytes`,
    });
    return;
  }
  if (err instanceof Error) {
    res.status(400).json({ error: err.message });
    return;
  }
  next(err);
};

protectedRouter.use(handleUploadMiddlewareError);

const router = Router();
router.use(protectedRouter);

export { publicRouter as uploadPublicRoutes, protectedRouter as uploadProtectedRoutes };
export default router;
