import { Router } from "express";
import * as anamnesesController from "./anamneses.controller.js";

const router = Router();

router.get("/", anamnesesController.listar);
router.get("/:id", anamnesesController.buscarPorId);
router.post("/", anamnesesController.criar);
router.put("/:id", anamnesesController.atualizar);
router.delete("/:id", anamnesesController.remover);

export default router;
