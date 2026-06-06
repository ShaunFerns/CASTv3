import { Router, type IRouter } from "express";
import type { Request, Response } from "express";
import { requireAdmin } from "../../lib/auth.js";
import { auditLoginSessionCreated, auditLogoutSessionRevoked } from "../../lib/auditWriter.js";
import { db, auditLogsTable } from "@workspace/db";
import { desc } from "drizzle-orm";

const router: IRouter = Router();

const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

router.post("/auth/login", (req: Request, res: Response): void => {
  const { username, password } = req.body as { username?: string; password?: string };

  if (!ADMIN_USERNAME || !ADMIN_PASSWORD) {
    res.status(503).json({ error: "Admin credentials not configured on this server" });
    return;
  }

  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    auditLoginSessionCreated(req, { strategy: "legacy_admin" });
    res.json({ ok: true, isAdmin: true });
  } else {
    res.status(401).json({ error: "Invalid credentials" });
  }
});

router.post("/auth/logout", (req: Request, res: Response): void => {
  const sessionId = req.sessionID;
  req.session.destroy((err) => {
    if (err) {
      res.status(500).json({ error: "Logout failed" });
      return;
    }
    auditLogoutSessionRevoked(req, sessionId, { strategy: "legacy_admin" });
    res.clearCookie("cast.sid");
    res.json({ ok: true });
  });
});

router.get("/auth/me", (req: Request, res: Response): void => {
  res.json({ isAdmin: req.session?.isAdmin === true });
});

router.get("/audit-logs", requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const logs = await db
      .select()
      .from(auditLogsTable)
      .orderBy(desc(auditLogsTable.createdAt))
      .limit(200);
    res.json(logs);
  } catch (err) {
    console.error("[audit-logs]", err);
    res.status(500).json({ error: "Failed to fetch audit logs" });
  }
});

export default router;
