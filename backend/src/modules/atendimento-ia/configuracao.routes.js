import { Router } from "express";
import * as configuracaoController from "./configuracao.controller.js";

const router = Router();

router.get("/", configuracaoController.obter);
router.put("/", configuracaoController.atualizar);

export default router;
