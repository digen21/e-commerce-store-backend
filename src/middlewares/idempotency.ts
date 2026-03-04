import { Request, Response, NextFunction } from "express";
import { createHash } from "crypto";
import { catchAsync, ServerError } from "@utils";
import httpStatus from "http-status";

/**
 * Idempotency Middleware
 *
 * CURRENT IMPLEMENTATION: Uses in-memory Map storage.
 * - Data is lost on server restart
 * - Does not work across multiple server instances (load balancing)
 * - Memory growth is managed by TTL cleanup (24 hours)
 *
 * TODO (Production): Migrate to Redis or MongoDB for persistence:
 * - Create an IdempotencyKey model/collection
 * - Store: { key: string, hash: string, response: object, createdAt: Date, userId?: string }
 * - Add unique index on hash for deduplication
 * - Use Redis for better performance in distributed systems
 */

interface IdempotencyRecord {
  response?: Record<string, unknown>;
  createdAt: Date;
}

const idempotencyStore = new Map<string, IdempotencyRecord>();

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

const cleanExpiredRecords = () => {
  const now = Date.now();
  for (const [key, record] of idempotencyStore.entries()) {
    if (now - record.createdAt.getTime() > IDEMPOTENCY_TTL_MS) {
      idempotencyStore.delete(key);
    }
  }
};

setInterval(cleanExpiredRecords, IDEMPOTENCY_TTL_MS);

export const idempotencyMiddleware = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const idempotencyKey = req.headers["x-idempotency-key"] as
      | string
      | undefined;

    if (!idempotencyKey) {
      return next(
        new ServerError({
          message: "X-Idempotency-Key header is required",
          status: httpStatus.BAD_REQUEST,
        }),
      );
    }

    const userId = (req.user as { _id: string })?._id;
    const keyHash = createHash("sha256")
      .update(`${userId || "anonymous"}:${idempotencyKey}`)
      .digest("hex");

    const existingRecord = idempotencyStore.get(keyHash);

    if (existingRecord) {
      if (existingRecord.response) {
        return res.status(httpStatus.OK).json(existingRecord.response);
      }
    }

    const originalJson = res.json.bind(res);
    res.json = (body: Record<string, unknown>) => {
      if (res.statusCode < 300) {
        idempotencyStore.set(keyHash, {
          response: body,
          createdAt: new Date(),
        });
      }
      return originalJson(body);
    };

    next();
  },
);
