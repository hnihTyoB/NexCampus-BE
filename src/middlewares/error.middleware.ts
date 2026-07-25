import { Request, Response, NextFunction } from "express";
import { Prisma } from "@prisma/client";
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

  // Handle Prisma Known Request Errors
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      const target = (error.meta?.target as string[]) || [];
      const fieldName = target.join(", ");
      res.status(409).json({
        success: false,
        message: `Value already exists for field: ${fieldName}`,
        code: "DUPLICATE_ENTRY",
      });
      return;
    }
    if (error.code === "P2003") {
      const fieldName = (error.meta?.field_name as string) || "foreign key";
      res.status(400).json({
        success: false,
        message: `Cannot delete or update because it is referenced by other items (Foreign key constraint failed on: ${fieldName}).`,
        code: "DEPENDENCY_ERROR",
      });
      return;
    }
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
