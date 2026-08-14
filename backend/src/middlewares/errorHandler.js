import { AppError } from "../utils/AppError.js";
import { ZodError } from "zod";

export function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: err.message });
  }

  if (err instanceof ZodError) {
    return res.status(422).json({
      error: "Dados inválidos",
      issues: err.issues.map((issue) => ({
        campo: issue.path.join("."),
        mensagem: issue.message,
      })),
    });
  }

  if (err.code === "P2025") {
    return res.status(404).json({ error: "Registro não encontrado" });
  }

  if (err.code === "P2003") {
    return res
      .status(409)
      .json({ error: "Este registro está vinculado a outros dados e não pode ser removido/alterado" });
  }

  console.error(err);
  return res.status(500).json({ error: "Erro interno do servidor" });
}

export function notFoundHandler(req, res) {
  res.status(404).json({ error: `Rota ${req.method} ${req.originalUrl} não existe` });
}
