import { Router, type IRouter } from "express";
import type { Request, Response } from "express";
import { requireAdmin } from "../../lib/auth.js";
import {
  auditLoginSessionCreated,
  auditLogoutSessionRevoked,
  auditPreviewBridgeSessionCreated,
} from "../../lib/auditWriter.js";
import { applyPreviewBridgeSession } from "../../lib/previewBridge.js";
import { db, auditLogsTable } from "@workspace/db";
import { desc } from "drizzle-orm";

const router: IRouter = Router();

const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

router.post("/auth/login", async (req: Request, res: Response): Promise<void> => {
  const { username, password } = req.body as { username?: string; password?: string };

  if (!ADMIN_USERNAME || !ADMIN_PASSWORD) {
    res.status(503).json({ error: "Admin credentials not configured on this server" });
    return;
  }

  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    try {
      req.session.isAdmin = true;
      const previewBridge = await applyPreviewBridgeSession(req);
      auditLoginSessionCreated(req, {
        strategy: "legacy_admin",
        previewBridgeEnabled: previewBridge?.enabled === true,
      });
      if (previewBridge) {
        auditPreviewBridgeSessionCreated(req, previewBridge);
      }
      res.json({
        ok: true,
        isAdmin: true,
        previewBridge: previewBridge
          ? {
              enabled: true,
              userId: previewBridge.userId,
              institutionId: previewBridge.institutionId,
              roleKey: previewBridge.roleKey,
            }
          : { enabled: false },
      });
    } catch (error) {
      console.error("[preview-bridge]", error);
      res.status(500).json({ error: "Failed to initialise CAST v3 preview session" });
    }
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
