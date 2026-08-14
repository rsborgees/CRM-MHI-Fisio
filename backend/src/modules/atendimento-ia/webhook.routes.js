import { Router } from "express";
import { handleWebhook } from "./webhook.controller.js";
import { AppError } from "../../utils/AppError.js";

const router = Router();

function validarToken(req, res, next) {
  if (req.query.token !== process.env.ZAPI_WEBHOOK_TOKEN) {
    throw new AppError("Token inválido", 401);
  }
  next();
}

router.post("/", validarToken, handleWebhook);

export default router;
