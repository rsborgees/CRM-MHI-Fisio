import jwt from "jsonwebtoken";
import { AppError } from "../utils/AppError.js";

export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    throw new AppError("Token de autenticação ausente", 401);
  }

  const token = authHeader.slice("Bearer ".length);

  try {
    req.usuario = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    throw new AppError("Token inválido ou expirado", 401);
  }
}
