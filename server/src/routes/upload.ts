import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { requireCanonicalIdentity } from '../middleware';

const router = Router();

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
  destination: (_req, _file, cb) => {
    const uploadPath = path.join(__dirname, '../../public/uploads');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  },
});

const upload = multer({ storage });

type MulterRequest = Request & { file?: Express.Multer.File };

// Upload endpoint for profile background video
router.post('/profile-background', requireCanonicalIdentity, upload.single('video'), (req: Request, res: Response): void => {
  const mReq = req as MulterRequest;
  if (!mReq.file) {
    res.status(400).json({ error: 'No file uploaded' });
    return;
  }
  const fileUrl = `${getPublicBaseUrl(req)}/uploads/${mReq.file.filename}`;
  res.json({ success: true, fileUrl });
});

// Upload endpoint for reflection files (video/document)
router.post('/reflection', requireCanonicalIdentity, upload.single('file'), (req: Request, res: Response): void => {
  const mReq = req as MulterRequest;
  if (!mReq.file) {
    res.status(400).json({ error: 'No file uploaded' });
    return;
  }
  const fileUrl = `${getPublicBaseUrl(req)}/uploads/${mReq.file.filename}`;
  res.json({ success: true, fileUrl });
});

export default router;
