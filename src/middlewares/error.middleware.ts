import { Request, Response, NextFunction } from 'express';
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

  console.error('[Unhandled Error]', error);

  res.status(500).json({
    success: false,
    message: 'Internal server error',
    code: 'INTERNAL_SERVER_ERROR',
  });
}
