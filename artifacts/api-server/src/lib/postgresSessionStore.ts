import session, { type SessionData } from "express-session";
import { pool } from "@workspace/db";

import { logger } from "./logger";

const DEFAULT_TTL_MS = 12 * 60 * 60 * 1000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function sessionExpiry(sess: SessionData): Date {
  const maxAge = sess.cookie?.maxAge;
  return new Date(Date.now() + (typeof maxAge === "number" ? maxAge : DEFAULT_TTL_MS));
}

function sessionUserId(sess: SessionData): string | null {
  const maybeSessionWithUser = sess as SessionData & {
    castUserId?: unknown;
    userId?: unknown;
  };
  const candidate = maybeSessionWithUser.castUserId ?? maybeSessionWithUser.userId;

  return typeof candidate === "string" && UUID_PATTERN.test(candidate) ? candidate : null;
}

export class PostgresSessionStore extends session.Store {
  override get(
    sid: string,
    callback: (err: unknown, session?: SessionData | null) => void,
  ): void {
    pool
      .query<{ sess: SessionData }>(
        `
          SELECT sess
          FROM app_sessions
          WHERE sid = $1
            AND expire > now()::timestamp
            AND revoked_at IS NULL
        `,
        [sid],
      )
      .then((result) => callback(null, result.rows[0]?.sess ?? null))
      .catch((error: unknown) => {
        logger.error({ err: error }, "Failed to read session from PostgreSQL");
        callback(error);
      });
  }

  override set(sid: string, sess: SessionData, callback?: (err?: unknown) => void): void {
    const expire = sessionExpiry(sess);
    const userId = sessionUserId(sess);

    pool
      .query(
        `
          INSERT INTO app_sessions (sid, sess, expire, user_id, revoked_at, updated_at)
          VALUES ($1, $2::jsonb, $3, $4, NULL, now())
          ON CONFLICT (sid)
          DO UPDATE SET
            sess = EXCLUDED.sess,
            expire = EXCLUDED.expire,
            user_id = EXCLUDED.user_id,
            revoked_at = NULL,
            updated_at = now()
        `,
        [sid, JSON.stringify(sess), expire, userId],
      )
      .then(() => callback?.())
      .catch((error: unknown) => {
        logger.error({ err: error }, "Failed to persist session to PostgreSQL");
        callback?.(error);
      });
  }

  override destroy(sid: string, callback?: (err?: unknown) => void): void {
    pool
      .query(
        `
          UPDATE app_sessions
          SET revoked_at = now(),
              expire = LEAST(expire, now()::timestamp),
              updated_at = now()
          WHERE sid = $1
        `,
        [sid],
      )
      .then(() => callback?.())
      .catch((error: unknown) => {
        logger.error({ err: error }, "Failed to revoke session in PostgreSQL");
        callback?.(error);
      });
  }

  override touch(sid: string, sess: SessionData, callback?: (err?: unknown) => void): void {
    const expire = sessionExpiry(sess);
    const userId = sessionUserId(sess);

    pool
      .query(
        `
          UPDATE app_sessions
          SET expire = $2,
              user_id = COALESCE($3, user_id),
              updated_at = now()
          WHERE sid = $1
            AND revoked_at IS NULL
        `,
        [sid, expire, userId],
      )
      .then(() => callback?.())
      .catch((error: unknown) => {
        logger.error({ err: error }, "Failed to touch PostgreSQL session");
        callback?.(error);
      });
  }
}
