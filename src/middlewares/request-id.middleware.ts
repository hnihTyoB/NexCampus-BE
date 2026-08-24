import { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';

export const REQUEST_ID_HEADER = 'x-request-id';

/**
 * Middleware gắn correlation request ID vào req và header response (X-Request-Id)
 * giúp truy vết logs xuyên suốt các layer và services.
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incomingId = req.headers[REQUEST_ID_HEADER] as string | undefined;
  const requestId = incomingId || crypto.randomUUID();

  req.headers[REQUEST_ID_HEADER] = requestId;
  (req as any).id = requestId;
  res.setHeader('X-Request-Id', requestId);

  next();
}
