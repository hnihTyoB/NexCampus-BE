import multer, { FileFilterCallback } from "multer";
import { Request } from "express";
import { AppError } from "../common/errors/app-error";
import { ERROR_CODE } from "../common/errors/error-code";

const EXCEL_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/octet-stream",
]);

const excelFileFilter = (
  _req: Request,
  file: Express.Multer.File,
  callback: FileFilterCallback,
) => {
  const isExcelMime = EXCEL_MIME_TYPES.has(file.mimetype);
  const isExcelExt =
    file.originalname.toLowerCase().endsWith(".xlsx") ||
    file.originalname.toLowerCase().endsWith(".xls");

  if (isExcelMime || isExcelExt) {
    callback(null, true);
  } else {
    callback(
      new AppError(
        `Định dạng file không hợp lệ: "${file.mimetype}". Chỉ chấp nhận file Excel (.xlsx, .xls)`,
        400,
        ERROR_CODE.VALIDATION_ERROR,
      ),
    );
  }
};

const memoryStorage = multer.memoryStorage();

export const uploadExcelSingle = (fieldName = "file") =>
  multer({
    storage: memoryStorage,
    fileFilter: excelFileFilter,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  }).single(fieldName);
