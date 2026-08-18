import { AppError } from "../utils/AppError.js";

// Use depois de requireAuth (que preenche req.usuario a partir do JWT). O papel vem do token —
// se o papel do usuário mudar, só passa a valer no próximo login (mesma limitação que nome/email).
export function requireRole(...papeisPermitidos) {
  return function (req, res, next) {
    if (!papeisPermitidos.includes(req.usuario.papel)) {
      throw new AppError("Você não tem permissão para acessar este recurso", 403);
    }
    next();
  };
}
