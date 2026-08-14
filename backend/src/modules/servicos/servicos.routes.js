import { Router } from "express";
import * as servicosController from "./servicos.controller.js";

const router = Router();

router.get("/", servicosController.listar);
router.get("/:id", servicosController.buscarPorId);
router.post("/", servicosController.criar);
router.put("/:id", servicosController.atualizar);
router.delete("/:id", servicosController.remover);

export default router;
