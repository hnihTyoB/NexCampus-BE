import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { AppError } from '../common/errors/app-error';
import { ERROR_CODE } from '../common/errors/error-code';

export function notFoundMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  next(new AppError(`Route ${req.method} ${req.originalUrl} not found`, 404, ERROR_CODE.NOT_FOUND));
}

export function errorMiddleware(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (error instanceof AppError) {
    const payload: Record<string, any> = {
      success: false,
      message: error.message,
      code: error.code,
    };
    if (error.data !== undefined) {
      payload.data = error.data;
    }
    res.status(error.statusCode).json(payload);
    return;
  }

  if (error instanceof SyntaxError && 'status' in error && (error as any).status === 400) {
    res.status(400).json({
      success: false,
      message: 'Invalid JSON payload format',
      code: ERROR_CODE.VALIDATION_ERROR,
    });
    return;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      res.status(409).json({
        success: false,
        message: 'Dữ liệu đã tồn tại trong hệ thống (trùng lặp giá trị duy nhất)',
        code: ERROR_CODE.DUPLICATE_ENTRY,
      });
      return;
    }

    if (error.code === 'P2025') {
      res.status(404).json({
        success: false,
        message: 'Bản ghi không tồn tại hoặc đã bị xóa',
        code: ERROR_CODE.NOT_FOUND,
      });
      return;
    }

    if (error.code === 'P2003' || error.code === 'P2014') {
      res.status(400).json({
        success: false,
        message: 'Dữ liệu liên kết hoặc ràng buộc quan hệ không hợp lệ',
        code: ERROR_CODE.VALIDATION_ERROR,
      });
      return;
    }
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    res.status(400).json({
      success: false,
      message: 'Dữ liệu truy vấn không hợp lệ',
      code: ERROR_CODE.VALIDATION_ERROR,
    });
    return;
  }

  console.error('[Unhandled Error]', error);

  res.status(500).json({
    success: false,
    message: 'Internal server error',
    code: ERROR_CODE.INTERNAL_SERVER_ERROR,
  });
}

