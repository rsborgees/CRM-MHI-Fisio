import { Router } from "express";
import * as pacotesController from "./pacotes.controller.js";

const router = Router();

router.get("/", pacotesController.listar);
router.get("/:id", pacotesController.buscarPorId);
router.post("/", pacotesController.criar);
router.put("/:id", pacotesController.atualizar);
router.delete("/:id", pacotesController.remover);

export default router;
