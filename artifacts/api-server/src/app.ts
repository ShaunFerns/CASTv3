import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import session from "express-session";
import path from "path";
import { existsSync } from "fs";
import { fileURLToPath } from "url";
import router from "./routes";
import { logger } from "./lib/logger";
import { PostgresSessionStore } from "./lib/postgresSessionStore";
import { requestIdMiddleware } from "./lib/requestId";

const app: Express = express();

app.use(requestIdMiddleware());
app.use(
  pinoHttp({
    logger,
    genReqId: (req) => req.requestId,
    serializers: {
      req(req) {
        return {
          id: req.requestId,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors({ origin: true, credentials: true }));
app.use(
  session({
    name: "cast.sid",
    store: new PostgresSessionStore(),
    secret: process.env.SESSION_SECRET ?? "cast-dev-secret-change-in-production",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 12 * 60 * 60 * 1000,
    },
  }),
);
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// The Express server also hosts the built React frontend whenever the
// production build exists (detected by the presence of index.html).
// Static assets are served first so JS/CSS/images bypass the API router.
// The SPA catch-all is registered AFTER the API router so /api/* requests
// that don't match any route still return an API 404, not index.html.
// Resolve relative to the bundle location so the path is correct regardless of cwd.
// Built bundle:   artifacts/api-server/dist/index.mjs
//   → __dirname: artifacts/api-server/dist
//   → ../..    : artifacts/
//   → ../../sar-review/dist/public : artifacts/sar-review/dist/public ✓
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDistPath = path.resolve(__dirname, "..", "..", "sar-review", "dist", "public");
const publicDir = existsSync(path.join(clientDistPath, "index.html")) ? clientDistPath : null;

if (publicDir) {
  app.use(express.static(publicDir, { index: false }));
}

app.use("/api", router);

if (publicDir) {
  app.use((req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    res.sendFile(path.join(publicDir, "index.html"));
  });
}

export default app;
