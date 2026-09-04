import { Router } from "express";
import * as evolucoesController from "./evolucoes.controller.js";

const router = Router();

router.get("/", evolucoesController.listar);
router.get("/:id", evolucoesController.buscarPorId);
router.post("/", evolucoesController.criar);
router.put("/:id", evolucoesController.atualizar);
router.delete("/:id", evolucoesController.remover);

export default router;
