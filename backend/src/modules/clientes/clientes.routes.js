import { Router } from "express";
import * as clientesController from "./clientes.controller.js";

const router = Router();

router.get("/", clientesController.listar);
router.get("/:id", clientesController.buscarPorId);
router.post("/", clientesController.criar);
router.put("/:id", clientesController.atualizar);
router.delete("/:id", clientesController.remover);

export default router;
