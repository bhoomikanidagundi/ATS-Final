import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

// ─── Extend Express Request ────────────────────────────────────────────────────
// Augments the default Express Request so downstream handlers get full type safety
// when accessing req.userId and req.role.
declare global {
  namespace Express {
    interface Request {
      userId?: string;
      role?: "candidate" | "recruiter";
    }
  }
}

// ─── Types ─────────────────────────────────────────────────────────────────────
export type UserRole = "candidate" | "recruiter";

interface JwtPayload {
  userId: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

// ─── Auth Middleware ────────────────────────────────────────────────────────────
/**
 * Verifies the Bearer JWT in the Authorization header.
 * On success, attaches `req.userId` and `req.role` then calls next().
 * On failure, responds with 401 Unauthorized.
 */
export const authMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized: no token provided" });
    return;
  }

  const token = authHeader.split(" ")[1];
  const secret = process.env.JWT_SECRET || "fallback-secret-for-dev";

  try {
    const decoded = jwt.verify(token, secret) as JwtPayload;

    req.userId = decoded.userId;
    req.role   = decoded.role;

    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      res.status(401).json({ error: "Unauthorized: token has expired" });
    } else if (err instanceof jwt.JsonWebTokenError) {
      res.status(401).json({ error: "Unauthorized: invalid token" });
    } else {
      res.status(401).json({ error: "Unauthorized" });
    }
  }
};

// ─── Role Middleware ────────────────────────────────────────────────────────────
/**
 * Role-based access control middleware factory.
 *
 * Usage:
 *   router.get("/recruiter-only", authMiddleware, allowRoles("recruiter"), handler)
 *   router.get("/candidate-only", authMiddleware, allowRoles("candidate"), handler)
 *   router.get("/either",         authMiddleware, allowRoles("recruiter", "candidate"), handler)
 *
 * Must be placed AFTER authMiddleware so that req.role is already populated.
 */
export const allowRoles = (...roles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.role) {
      // authMiddleware wasn't applied before this — misconfigured route
      res.status(401).json({ error: "Unauthorized: authentication required" });
      return;
    }

    if (!roles.includes(req.role)) {
      res
        .status(403)
        .json({
          error: `Forbidden: requires ${roles.join(" or ")} role, but got "${req.role}"`,
        });
      return;
    }

    next();
  };
};
