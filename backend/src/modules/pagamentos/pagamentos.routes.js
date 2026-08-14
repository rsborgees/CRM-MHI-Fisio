import { Router } from "express";
import * as pagamentosController from "./pagamentos.controller.js";

const router = Router();

router.get("/", pagamentosController.listar);
router.get("/:id", pagamentosController.buscarPorId);
router.post("/", pagamentosController.criar);
router.put("/:id", pagamentosController.atualizar);
router.delete("/:id", pagamentosController.remover);

export default router;
