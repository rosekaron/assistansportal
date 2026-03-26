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
