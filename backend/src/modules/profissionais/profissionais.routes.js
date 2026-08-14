import { Router } from "express";
import * as profissionaisController from "./profissionais.controller.js";

const router = Router();

router.get("/", profissionaisController.listar);
router.get("/:id", profissionaisController.buscarPorId);
router.post("/", profissionaisController.criar);
router.put("/:id", profissionaisController.atualizar);
router.delete("/:id", profissionaisController.remover);

export default router;
