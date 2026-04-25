import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthRequest extends Request {
  userId?:      number;
  role?:        string;
  assistantId?: string;
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return res.status(401).json({ error: "Unauthorized" });
  try {
    const token   = header.slice(7);
    const payload = jwt.verify(token, process.env.JWT_SECRET || "dev_secret") as {
      userId: number; role?: string; assistantId?: string;
    };
    req.userId      = payload.userId;
    req.role        = payload.role;
    req.assistantId = payload.assistantId;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

export function requireGuardian(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.role !== "guardian") return res.status(403).json({ error: "Guardian access required" });
  next();
}

export function requireAssistant(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.role !== "assistant") return res.status(403).json({ error: "Assistant access required" });
  next();
}

/**
 * Allows both assistants AND guardians who have linked an assistant record.
 * Used for clock-in/out and assistant self-service routes.
 * The individual route handlers use getAssistantId(userId) to resolve the
 * assistant record from the DB — so no JWT re-issue is needed.
 */
export function requireAssistantAccess(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.role === "assistant" || req.role === "guardian") return next();
  return res.status(403).json({ error: "Authentication required" });
}
