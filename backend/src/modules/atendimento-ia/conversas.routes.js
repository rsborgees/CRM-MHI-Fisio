import { Router } from "express";
import * as conversasController from "./conversas.controller.js";

const router = Router();

router.get("/", conversasController.listar);
router.get("/:clienteId", conversasController.buscarPorCliente);
router.put("/:clienteId/pausa", conversasController.definirPausa);
router.post("/:clienteId/mensagens", conversasController.enviarMensagem);

export default router;
