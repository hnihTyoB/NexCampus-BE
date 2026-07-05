import multer, { FileFilterCallback } from 'multer';
import { Request } from 'express';
import { envConfig } from '../config/env.config';

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/zip',
  'application/x-zip-compressed',
  'application/x-rar-compressed',
  'application/x-7z-compressed',
  'video/mp4',
  'video/webm',
];

const fileFilter = (_req: Request, file: Express.Multer.File, callback: FileFilterCallback) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    callback(null, true);
  } else {
    callback(
      new Error(
        `Invalid file type "${file.mimetype}". Allowed types: images, PDF, DOCX, ZIP, RAR, 7z, MP4, WEBM.`,
      ),
    );
  }
};

const storage = multer.memoryStorage();

const getMaxFileSize = () => envConfig.supabase.maxFileSizeMb * 1024 * 1024;

export const uploadSingle = (fieldName: string) =>
  multer({
    storage,
    fileFilter,
    limits: { fileSize: getMaxFileSize() },
  }).single(fieldName);

export const uploadMultiple = (fieldName: string, maxCount = 5) =>
  multer({
    storage,
    fileFilter,
    limits: { fileSize: getMaxFileSize() },
  }).array(fieldName, maxCount);
