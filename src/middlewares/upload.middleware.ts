import multer, { FileFilterCallback } from "multer";
import { Request } from "express";
import { supabaseConfig } from "../config/supabase.config";

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/zip",
  "application/x-zip-compressed",
  "application/x-rar-compressed",
  "application/x-7z-compressed",
  "video/mp4",
  "video/webm",
  // Excel files
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
  "application/vnd.ms-excel",                                           // .xls
];

const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  callback: FileFilterCallback,
) => {
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

import { Response, NextFunction } from "express";
import { systemSettingService } from "../modules/system-settings/system-setting.service";

const getMaxFileSize = () => supabaseConfig.maxFileSizeMb * 1024 * 1024;

export const uploadSingle = (
  fieldName: string,
  category?: "avatar" | "report" | "submission" | "task" | "application",
) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    let limitBytes = getMaxFileSize();

    try {
      if (category === "avatar") {
        limitBytes = 2 * 1024 * 1024; // Khóa cứng 2MB cho Avatar
      } else if (category === "report") {
        limitBytes = 5 * 1024 * 1024; // Khóa cứng 5MB cho Báo cáo
      } else if (category === "application") {
        limitBytes = 10 * 1024 * 1024; // Khóa cứng 10MB cho Tài liệu ứng tuyển
      } else if (category === "submission") {
        const mb = await systemSettingService.getSubmissionLimitMb();
        limitBytes = mb * 1024 * 1024;
      }
    } catch (err) {
      console.error(`[UploadMiddleware] Error resolving upload limit:`, err);
    }

    const upload = multer({
      storage,
      fileFilter,
      limits: { fileSize: limitBytes },
    }).single(fieldName);

    upload(req, res, (err) => {
      if (err) {
        return next(err);
      }
      next();
    });
  };
};

export const uploadMultiple = (
  fieldName: string,
  maxCount = 5,
  category?: "avatar" | "report" | "submission" | "task" | "application",
) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    let limitBytes = getMaxFileSize();

    try {
      if (category === "avatar") {
        limitBytes = 2 * 1024 * 1024;
      } else if (category === "report") {
        limitBytes = 5 * 1024 * 1024;
      } else if (category === "application") {
        limitBytes = 10 * 1024 * 1024; // Khóa cứng 10MB cho Tài liệu ứng tuyển
      } else if (category === "submission") {
        const mb = await systemSettingService.getSubmissionLimitMb();
        limitBytes = mb * 1024 * 1024;
      }
    } catch (err) {
      console.error(`[UploadMiddleware] Error resolving upload limit:`, err);
    }

    const upload = multer({
      storage,
      fileFilter,
      limits: { fileSize: limitBytes },
    }).array(fieldName, maxCount);

    upload(req, res, (err) => {
      if (err) {
        return next(err);
      }
      next();
    });
  };
};
