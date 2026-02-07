import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = Router();

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
router.post('/profile-background', upload.single('video'), (req: Request, res: Response): void => {
  const mReq = req as MulterRequest;
  if (!mReq.file) {
    res.status(400).json({ error: 'No file uploaded' });
    return;
  }
  const fileUrl = `/uploads/${mReq.file.filename}`;
  res.json({ success: true, fileUrl });
});

// Upload endpoint for reflection files (video/document)
router.post('/reflection', upload.single('file'), (req: Request, res: Response): void => {
  const mReq = req as MulterRequest;
  if (!mReq.file) {
    res.status(400).json({ error: 'No file uploaded' });
    return;
  }
  const fileUrl = `/uploads/${mReq.file.filename}`;
  res.json({ success: true, fileUrl });
});

export default router;
