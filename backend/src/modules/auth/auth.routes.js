import { Router } from "express";
import * as authController from "./auth.controller.js";
import { requireAuth } from "../../middlewares/auth.middleware.js";

const router = Router();

router.post("/login", authController.login);
router.get("/perfil", requireAuth, authController.perfil);
router.put("/perfil", requireAuth, authController.atualizarPerfil);
router.put("/senha", requireAuth, authController.alterarSenha);

export default router;
