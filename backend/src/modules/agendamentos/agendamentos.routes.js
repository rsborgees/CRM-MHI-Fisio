import { Router } from "express";
import * as agendamentosController from "./agendamentos.controller.js";

const router = Router();

router.get("/", agendamentosController.listar);
router.get("/:id", agendamentosController.buscarPorId);
router.post("/", agendamentosController.criar);
router.put("/:id", agendamentosController.atualizar);
router.delete("/:id", agendamentosController.remover);

export default router;
