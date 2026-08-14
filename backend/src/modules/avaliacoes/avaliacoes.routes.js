import { Router } from "express";
import * as avaliacoesController from "./avaliacoes.controller.js";

const router = Router();

router.get("/", avaliacoesController.listar);
router.get("/:id", avaliacoesController.buscarPorId);
router.post("/", avaliacoesController.criar);
router.put("/:id", avaliacoesController.atualizar);
router.delete("/:id", avaliacoesController.remover);

export default router;
