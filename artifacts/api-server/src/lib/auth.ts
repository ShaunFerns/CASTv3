import type { Request, Response, NextFunction } from "express";

declare module "express-session" {
  interface SessionData {
    isAdmin: boolean;
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (req.session?.isAdmin === true) {
    next();
    return;
  }
  res.status(403).json({ error: "Admin access required" });
}
