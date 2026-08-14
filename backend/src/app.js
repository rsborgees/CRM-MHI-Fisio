import "express-async-errors";
import express from "express";
import cors from "cors";

import authRoutes from "./modules/auth/auth.routes.js";
import dashboardRoutes from "./modules/dashboard/dashboard.routes.js";
import webhookWhatsappRoutes from "./modules/atendimento-ia/webhook.routes.js";
import conversasWhatsappRoutes from "./modules/atendimento-ia/conversas.routes.js";
import configuracaoAgenteRoutes from "./modules/atendimento-ia/configuracao.routes.js";
import clientesRoutes from "./modules/clientes/clientes.routes.js";
import profissionaisRoutes from "./modules/profissionais/profissionais.routes.js";
import servicosRoutes from "./modules/servicos/servicos.routes.js";
import pacotesRoutes from "./modules/pacotes/pacotes.routes.js";
import agendamentosRoutes from "./modules/agendamentos/agendamentos.routes.js";
import pagamentosRoutes from "./modules/pagamentos/pagamentos.routes.js";
import historicoRoutes from "./modules/historico/historico.routes.js";
import avaliacoesRoutes from "./modules/avaliacoes/avaliacoes.routes.js";

import { requireAuth } from "./middlewares/auth.middleware.js";
import { errorHandler, notFoundHandler } from "./middlewares/errorHandler.js";

export const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => res.json({ status: "ok" }));

app.use("/auth", authRoutes);
app.use("/webhook/whatsapp", webhookWhatsappRoutes);

app.use("/conversas-whatsapp", requireAuth, conversasWhatsappRoutes);
app.use("/configuracao-agente", requireAuth, configuracaoAgenteRoutes);
app.use("/dashboard", requireAuth, dashboardRoutes);
app.use("/clientes", requireAuth, clientesRoutes);
app.use("/profissionais", requireAuth, profissionaisRoutes);
app.use("/servicos", requireAuth, servicosRoutes);
app.use("/pacotes", requireAuth, pacotesRoutes);
app.use("/agendamentos", requireAuth, agendamentosRoutes);
app.use("/pagamentos", requireAuth, pagamentosRoutes);
app.use("/historico", requireAuth, historicoRoutes);
app.use("/avaliacoes", requireAuth, avaliacoesRoutes);

app.use(notFoundHandler);
app.use(errorHandler);
