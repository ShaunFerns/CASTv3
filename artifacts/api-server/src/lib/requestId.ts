import { randomUUID } from "node:crypto";
import type { NextFunction, Request, RequestHandler, Response } from "express";

declare global {
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}

const requestIdHeaderName = "x-request-id";
const maxRequestIdLength = 128;

function headerValue(req: Request): string | undefined {
  const value = req.header(requestIdHeaderName);
  if (!value) return undefined;

  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxRequestIdLength) return undefined;

  return trimmed;
}

export function requestIdMiddleware(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    req.requestId = headerValue(req) ?? randomUUID();
    res.setHeader(requestIdHeaderName, req.requestId);
    next();
  };
}
