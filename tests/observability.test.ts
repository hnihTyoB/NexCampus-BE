import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { requestIdMiddleware, REQUEST_ID_HEADER } from '../src/middlewares/request-id.middleware';

describe('Observability: Request ID Correlation Middleware', () => {
  it('should generate a new UUID Request-ID if none is provided in headers', () => {
    const req: any = { headers: {} };
    let setHeaderKey = '';
    let setHeaderValue = '';
    const res: any = {
      setHeader: (key: string, val: string) => {
        setHeaderKey = key;
        setHeaderValue = val;
      },
    };

    let nextCalled = false;
    requestIdMiddleware(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, true);
    assert.ok(req.headers[REQUEST_ID_HEADER]);
    assert.equal(req.headers[REQUEST_ID_HEADER], req.id);
    assert.equal(setHeaderKey, 'X-Request-Id');
    assert.equal(setHeaderValue, req.id);
  });

  it('should preserve incoming X-Request-Id header across the request context', () => {
    const incomingId = 'client-custom-req-id-12345';
    const req: any = { headers: { [REQUEST_ID_HEADER]: incomingId } };
    let setHeaderValue = '';
    const res: any = {
      setHeader: (_key: string, val: string) => {
        setHeaderValue = val;
      },
    };

    requestIdMiddleware(req, res, () => {});

    assert.equal(req.headers[REQUEST_ID_HEADER], incomingId);
    assert.equal(req.id, incomingId);
    assert.equal(setHeaderValue, incomingId);
  });
});
