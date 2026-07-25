import { Request, Response, NextFunction } from "express";
import multer from "multer";
import { AppError } from "../common/errors/app-error";
import { ERROR_CODE } from "../common/errors/error-code";

export function notFoundMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  next(
    new AppError(
      `Route ${req.method} ${req.originalUrl} not found`,
      404,
      ERROR_CODE.NOT_FOUND,
    ),
  );
}

export function errorMiddleware(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      success: false,
      message: error.message,
      code: error.code,
    });
    return;
  }

  // Handle Multer upload errors
  if (error instanceof multer.MulterError) {
    res.status(400).json({
      success: false,
      message: `Lỗi tải lên tệp: ${error.message} (Mã lỗi: ${error.code})`,
      code: "FILE_UPLOAD_ERROR",
    });
    return;
  }

  console.error("[Unhandled Error]", error);

  res.status(500).json({
    success: false,
    message: "Internal server error",
    code: "INTERNAL_SERVER_ERROR",
  });
}
