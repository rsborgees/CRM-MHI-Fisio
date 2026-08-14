import { Router } from "express";
import * as historicoController from "./historico.controller.js";

const router = Router();

router.get("/", historicoController.listar);
router.post("/", historicoController.criar);
router.delete("/:id", historicoController.remover);

export default router;
