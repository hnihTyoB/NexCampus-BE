import { NextFunction, Request, Response } from "express";
import multer, { FileFilterCallback } from "multer";
import { AppError } from "../common/errors/app-error";
import { ERROR_CODE } from "../common/errors/error-code";
import { storageConfig } from "../config/storage.config";
import { systemSettingService } from "../modules/system-settings/system-setting.service";

export type UploadCategory =
  | "avatar"
  | "reportAttachment"
  | "reportVideo"
  | "submissionAttachment"
  | "submissionVideo"
  | "taskAttachment"
  | "application"
  | "taskImport";

const MIME_TYPES = {
  images: ["image/jpeg", "image/png", "image/webp", "image/gif"],
  documents: [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
  archives: [
    "application/zip",
    "application/x-zip-compressed",
    "application/x-rar-compressed",
    "application/vnd.rar",
    "application/x-7z-compressed",
  ],
  videos: [
    "video/mp4",
    "video/webm",
    "video/quicktime",
    "video/x-matroska",
    "video/x-msvideo",
  ],
  spreadsheets: [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
  ],
} as const;

interface UploadPolicy {
  maxFileSizeMb: number | "submissionSetting";
  allowedMimeTypes: readonly string[];
  maxTotalSizeMb?: number;
}

export const UPLOAD_POLICIES: Record<UploadCategory, UploadPolicy> = {
  avatar: {
    maxFileSizeMb: 5,
    allowedMimeTypes: MIME_TYPES.images,
  },
  reportAttachment: {
    maxFileSizeMb: 10,
    allowedMimeTypes: [
      ...MIME_TYPES.images,
      ...MIME_TYPES.documents,
      ...MIME_TYPES.archives,
    ],
  },
  reportVideo: {
    maxFileSizeMb: 50,
    allowedMimeTypes: MIME_TYPES.videos,
  },
  submissionAttachment: {
    maxFileSizeMb: 25,
    allowedMimeTypes: [
      ...MIME_TYPES.images,
      ...MIME_TYPES.documents,
      ...MIME_TYPES.archives,
    ],
  },
  submissionVideo: {
    maxFileSizeMb: "submissionSetting",
    allowedMimeTypes: MIME_TYPES.videos,
  },
  taskAttachment: {
    maxFileSizeMb: 25,
    maxTotalSizeMb: 75,
    allowedMimeTypes: [
      ...MIME_TYPES.images,
      ...MIME_TYPES.documents,
      ...MIME_TYPES.archives,
      ...MIME_TYPES.videos,
      ...MIME_TYPES.spreadsheets,
    ],
  },
  application: {
    maxFileSizeMb: 10,
    maxTotalSizeMb: 50,
    allowedMimeTypes: [
      ...MIME_TYPES.images,
      ...MIME_TYPES.documents,
      "application/zip",
      "application/x-zip-compressed",
    ],
  },
  taskImport: {
    maxFileSizeMb: 10,
    allowedMimeTypes: [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/octet-stream",
    ],
  },
};

const storage = multer.memoryStorage();

function startsWithBytes(
  buffer: Buffer,
  signature: readonly number[],
): boolean {
  return signature.every((byte, index) => buffer[index] === byte);
}

function hasZipSignature(buffer: Buffer): boolean {
  return (
    startsWithBytes(buffer, [0x50, 0x4b, 0x03, 0x04]) ||
    startsWithBytes(buffer, [0x50, 0x4b, 0x05, 0x06]) ||
    startsWithBytes(buffer, [0x50, 0x4b, 0x07, 0x08])
  );
}

function hasExpectedSignature(file: Express.Multer.File): boolean {
  const { buffer, mimetype } = file;
  if (buffer.length < 4) return false;

  switch (mimetype) {
    case "image/jpeg":
      return startsWithBytes(buffer, [0xff, 0xd8, 0xff]);
    case "image/png":
      return startsWithBytes(
        buffer,
        [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
      );
    case "image/gif":
      return (
        buffer.subarray(0, 6).toString("ascii") === "GIF87a" ||
        buffer.subarray(0, 6).toString("ascii") === "GIF89a"
      );
    case "image/webp":
      return (
        buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
        buffer.subarray(8, 12).toString("ascii") === "WEBP"
      );
    case "application/pdf":
      return buffer.subarray(0, 5).toString("ascii") === "%PDF-";
    case "application/msword":
    case "application/vnd.ms-excel":
      return startsWithBytes(
        buffer,
        [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1],
      );
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
    case "application/octet-stream":
    case "application/zip":
    case "application/x-zip-compressed":
      return hasZipSignature(buffer);
    case "application/x-rar-compressed":
    case "application/vnd.rar":
      return startsWithBytes(buffer, [0x52, 0x61, 0x72, 0x21, 0x1a, 0x07]);
    case "application/x-7z-compressed":
      return startsWithBytes(buffer, [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c]);
    case "video/mp4":
    case "video/quicktime":
      return buffer.subarray(4, 8).toString("ascii") === "ftyp";
    case "video/webm":
    case "video/x-matroska":
      return startsWithBytes(buffer, [0x1a, 0x45, 0xdf, 0xa3]);
    case "video/x-msvideo":
      return (
        buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
        buffer.subarray(8, 12).toString("ascii") === "AVI "
      );
    default:
      return false;
  }
}

function createFileFilter(category: UploadCategory) {
  const allowedMimeTypes = UPLOAD_POLICIES[category].allowedMimeTypes;

  return (
    _req: Request,
    file: Express.Multer.File,
    callback: FileFilterCallback,
  ) => {
    if (allowedMimeTypes.includes(file.mimetype)) {
      callback(null, true);
      return;
    }

    callback(
      new AppError(
        `Invalid file type "${file.mimetype}" for ${category}`,
        400,
        ERROR_CODE.VALIDATION_ERROR,
      ),
    );
  };
}

async function resolveMaxFileSizeBytes(
  category: UploadCategory,
): Promise<number> {
  const configuredLimit = UPLOAD_POLICIES[category].maxFileSizeMb;
  const maxFileSizeMb =
    configuredLimit === "submissionSetting"
      ? await systemSettingService.getSubmissionLimitMb()
      : configuredLimit;
  return Math.min(maxFileSizeMb, storageConfig.maxFileSizeMb) * 1024 * 1024;
}

function validateUploadedFiles(
  files: Express.Multer.File[],
  category: UploadCategory,
): void {
  const invalidFile = files.find((file) => !hasExpectedSignature(file));
  if (invalidFile) {
    throw new AppError(
      `File content does not match declared type: ${invalidFile.originalname}`,
      400,
      ERROR_CODE.VALIDATION_ERROR,
    );
  }

  const maxTotalSizeMb = UPLOAD_POLICIES[category].maxTotalSizeMb;
  if (maxTotalSizeMb !== undefined) {
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    if (totalSize > maxTotalSizeMb * 1024 * 1024) {
      throw new AppError(
        `Total upload size exceeds ${maxTotalSizeMb} MB`,
        400,
        ERROR_CODE.VALIDATION_ERROR,
      );
    }
  }
}

export const uploadSingle =
  (fieldName: string, category: UploadCategory) =>
  async (req: Request, res: Response, next: NextFunction) => {
    let limitBytes: number;
    try {
      limitBytes = await resolveMaxFileSizeBytes(category);
    } catch (error) {
      console.error("[UploadMiddleware] Error resolving upload limit:", error);
      return next(error);
    }

    const upload = multer({
      storage,
      fileFilter: createFileFilter(category),
      limits: { fileSize: limitBytes, files: 1 },
    }).single(fieldName);

    upload(req, res, (error) => {
      if (error) return next(error);
      try {
        validateUploadedFiles(req.file ? [req.file] : [], category);
        next();
      } catch (validationError) {
        next(validationError);
      }
    });
  };

export const uploadMultiple =
  (fieldName: string, maxCount: number, category: UploadCategory) =>
  async (req: Request, res: Response, next: NextFunction) => {
    let limitBytes: number;
    try {
      limitBytes = await resolveMaxFileSizeBytes(category);
    } catch (error) {
      console.error("[UploadMiddleware] Error resolving upload limit:", error);
      return next(error);
    }

    const upload = multer({
      storage,
      fileFilter: createFileFilter(category),
      limits: { fileSize: limitBytes, files: maxCount },
    }).array(fieldName, maxCount);

    upload(req, res, (error) => {
      if (error) return next(error);
      try {
        validateUploadedFiles(
          (req.files as Express.Multer.File[] | undefined) ?? [],
          category,
        );
        next();
      } catch (validationError) {
        next(validationError);
      }
    });
  };
