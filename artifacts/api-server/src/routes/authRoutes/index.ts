import { Router, type IRouter } from "express";
import type { Request, Response } from "express";
import { requireAdmin } from "../../lib/auth.js";
import {
  auditBootstrapAdminSessionCreated,
  auditLoginSessionCreated,
  auditLogoutSessionRevoked,
} from "../../lib/auditWriter.js";
import {
  authenticateBootstrapAdmin,
  createBootstrapAdminSession,
} from "../../lib/bootstrapAdmin.js";
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
    req.session.isAdmin = true;
    auditLoginSessionCreated(req, {
      strategy: "legacy_admin",
      castV3SessionCreated: false,
    });
    res.json({
      ok: true,
      isAdmin: true,
      castV3SessionCreated: false,
    });
  } else {
    res.status(401).json({ error: "Invalid credentials" });
  }
});

router.post("/cast-v3/auth/bootstrap-login", async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body as { email?: string; password?: string };

  try {
    const config = authenticateBootstrapAdmin(email, password);
    const bootstrapSession = await createBootstrapAdminSession(req, config);
    auditLoginSessionCreated(req, {
      strategy: "bootstrap_admin",
      userId: bootstrapSession.userId,
      institutionId: bootstrapSession.institutionId,
      roleKey: bootstrapSession.roleKey,
    });
    auditBootstrapAdminSessionCreated(req, bootstrapSession);
    res.json({
      ok: true,
      userId: bootstrapSession.userId,
      selectedInstitutionId: bootstrapSession.institutionId,
      roleKey: bootstrapSession.roleKey,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "CAST v3 bootstrap login failed";
    const status = message.includes("configuration is missing") ? 503 : 401;
    res.status(status).json({ error: status === 503 ? "Bootstrap admin is not configured" : "Invalid credentials" });
  }
});

router.post("/cast-v3/auth/logout", (req: Request, res: Response): void => {
  const sessionId = req.sessionID;
  req.session.destroy((err) => {
    if (err) {
      res.status(500).json({ error: "Logout failed" });
      return;
    }
    auditLogoutSessionRevoked(req, sessionId, { strategy: "bootstrap_admin" });
    res.clearCookie("cast.sid");
    res.json({ ok: true });
  });
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
