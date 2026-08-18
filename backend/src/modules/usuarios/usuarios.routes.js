import { Router } from "express";
import * as usuariosController from "./usuarios.controller.js";

const router = Router();

router.get("/", usuariosController.listar);
router.post("/", usuariosController.criar);
router.put("/:id", usuariosController.atualizar);
router.delete("/:id", usuariosController.remover);

export default router;
