import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { getAuthenticatedUserId, requireCanonicalIdentity } from '../middleware';

const router = Router();
router.use(requireCanonicalIdentity);

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

// Set up storage for uploaded files
const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const authUserId = getAuthenticatedUserId(req) || 'anonymous';
    const uploadPath = path.join(__dirname, '../../public/uploads');
    const userScopedPath = path.join(uploadPath, authUserId);
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    if (!fs.existsSync(userScopedPath)) {
      fs.mkdirSync(userScopedPath, { recursive: true });
    }
    cb(null, userScopedPath);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const originalName = path.basename(file.originalname).replace(/[^\w.\-]/g, '_');
    cb(null, uniqueSuffix + '-' + originalName);
  },
});

const upload = multer({ storage });

type MulterRequest = Request & { file?: Express.Multer.File };
type UploadCategory = 'avatar' | 'cover' | 'profile-background' | 'reflection';

function toRelativeUploadPath(filePath: string): string {
  return filePath.replace(/\\/g, '/').split('/public/')[1] || '';
}

function buildUploadResponse(
  req: Request,
  file: Express.Multer.File,
  category: UploadCategory
): {
  success: boolean;
  fileUrl: string;
  media: {
    category: UploadCategory;
    url: string;
    storageProvider: 'local';
    objectKey: string;
    mimeType: string;
    sizeBytes: number;
  };
} {
  const relativePath = toRelativeUploadPath(file.path);
  const objectKey = relativePath.replace(/^uploads\//, '');
  const fileUrl = `${getPublicBaseUrl(req)}/${relativePath}`;
  return {
    success: true,
    fileUrl,
    media: {
      category,
      url: fileUrl,
      storageProvider: 'local',
      objectKey,
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
  if (!mReq.file.mimetype.startsWith('image/')) {
    res.status(400).json({ error: 'Only image uploads are allowed for this endpoint' });
    return false;
  }
  return true;
}

// Upload endpoint for profile background video
router.post('/profile-background', upload.single('video'), (req: Request, res: Response): void => {
  const mReq = req as MulterRequest;
  if (!mReq.file) {
    res.status(400).json({ error: 'No file uploaded' });
    return;
  }
  const isVideo = mReq.file.mimetype.startsWith('video/');
  if (!isVideo) {
    res.status(400).json({ error: 'Only video uploads are allowed for profile backgrounds' });
    return;
  }
  res.json(buildUploadResponse(req, mReq.file, 'profile-background'));
});

// Upload endpoint for profile avatar image
router.post('/avatar', upload.single('image'), (req: Request, res: Response): void => {
  const mReq = req as MulterRequest;
  if (!ensureImageUpload(mReq, res)) {
    return;
  }
  res.json(buildUploadResponse(req, mReq.file, 'avatar'));
});

// Upload endpoint for profile cover image
router.post('/cover', upload.single('image'), (req: Request, res: Response): void => {
  const mReq = req as MulterRequest;
  if (!ensureImageUpload(mReq, res)) {
    return;
  }
  res.json(buildUploadResponse(req, mReq.file, 'cover'));
});

// Upload endpoint for reflection files (video/document)
router.post('/reflection', upload.single('file'), (req: Request, res: Response): void => {
  const mReq = req as MulterRequest;
  if (!mReq.file) {
    res.status(400).json({ error: 'No file uploaded' });
    return;
  }
  res.json(buildUploadResponse(req, mReq.file, 'reflection'));
});

export default router;
