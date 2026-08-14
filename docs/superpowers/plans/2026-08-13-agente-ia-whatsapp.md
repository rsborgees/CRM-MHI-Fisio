# Agente de IA de Atendimento via WhatsApp — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Um agente de IA que atende clientes finais da clínica via WhatsApp, consultando serviços/preços/horários e criando, remarcando ou cancelando agendamentos de verdade no banco, reaproveitando os services já existentes do backend.

**Architecture:** Novo módulo `backend/src/modules/atendimento-ia/` com um webhook (`POST /webhook/whatsapp`, sem `requireAuth`) que resolve o cliente pelo telefone, roda um loop de tool-calling contra o Google Gemini (isolado num único arquivo `llmClient.js`), executa as ferramentas chamando os services existentes de `clientes`, `servicos` e `agendamentos`, e responde via Z-API. O `cliente_id` nunca vem do modelo — é resolvido pelo telefone antes de qualquer chamada de IA.

**Tech Stack:** Node.js + Express + Prisma + PostgreSQL (tudo JavaScript puro, sem TypeScript), `@google/genai` para o Gemini, Jest com `jest.unstable_mockModule` (ESM) para os testes.

**Spec:** `docs/superpowers/specs/2026-08-13-agente-ia-whatsapp-design.md`

## Global Constraints

- JavaScript puro em todo o backend — nenhum arquivo `.ts`.
- Toda formatação específica do provedor de IA fica isolada em `llmClient.js` — nenhum outro arquivo importa `@google/genai` diretamente.
- Nenhuma ferramenta em `tools.js` aceita `cliente_id` vindo dos argumentos do modelo — o `cliente_id` é sempre um parâmetro separado, fixado pelo código a partir do telefone de quem mandou a mensagem no WhatsApp.
- A rota `/webhook/whatsapp` não passa por `requireAuth` (não há usuário logado; a "autenticação" é o token de webhook validado por query string).
- Modelo padrão: `gemini-2.5-flash`, configurável via `LLM_MODEL` no `.env`.

---

## Task 1: Tabela `conversas_whatsapp` no banco

**Files:**
- Modify: `backend/prisma/schema.prisma`

**Interfaces:**
- Produces: modelo Prisma `conversas_whatsapp` com campos `id`, `cliente_id`, `telefone`, `mensagens` (Json), `atualizado_em`, usado pelas Tasks 4 e 8.

- [ ] **Step 1: Adicionar o modelo ao schema**

Em `backend/prisma/schema.prisma`, adicione (em ordem alfabética, entre `clientes` e `historico_clientes`, seguindo a convenção já usada no arquivo):

```prisma
model conversas_whatsapp {
  id            Int      @id @default(autoincrement())
  cliente_id    Int
  telefone      String   @db.VarChar(30)
  mensagens     Json
  atualizado_em DateTime @default(now()) @updatedAt
  clientes      clientes @relation(fields: [cliente_id], references: [id], onDelete: NoAction, onUpdate: NoAction)
}
```

E adicione a relação inversa no modelo `clientes` (junto das outras relações `agendamentos`, `avaliacoes`, etc.):

```prisma
  conversas_whatsapp conversas_whatsapp[]
```

- [ ] **Step 2: Aplicar no banco e gerar o client**

Run: `cd backend && npx prisma db push`
Expected: saída terminando em `Your database is now in sync with your Prisma schema.` seguida de `Generated Prisma Client`.

- [ ] **Step 3: Confirmar a tabela existe**

Run: `psql -U postgres -d "crm-esteticpremium" -h localhost -p 5432 -c "\d conversas_whatsapp"`
Expected: lista de colunas `id, cliente_id, telefone, mensagens, atualizado_em`.

- [ ] **Step 4: Commit**

```bash
git add backend/prisma/schema.prisma
git commit -m "feat: adiciona tabela conversas_whatsapp para o agente de IA"
```

---

## Task 2: Variáveis de ambiente e dependência do Gemini

**Files:**
- Modify: `backend/.env`
- Modify: `backend/.env.example`
- Modify: `backend/package.json`

**Interfaces:**
- Produces: variáveis de ambiente `LLM_PROVIDER`, `LLM_MODEL`, `LLM_API_KEY`, `HORARIO_ABERTURA`, `HORARIO_FECHAMENTO`, `ZAPI_INSTANCE_ID`, `ZAPI_TOKEN`, `ZAPI_WEBHOOK_TOKEN`, usadas pelas Tasks 3, 5, 7 e 9. Pacote `@google/genai` instalado, usado pela Task 5.

- [ ] **Step 1: Instalar a dependência**

Run: `cd backend && npm install @google/genai`
Expected: `added 1 package` (ou mais, por transitivas) e sem erros.

- [ ] **Step 2: Adicionar as variáveis no `.env.example`**

Edite `backend/.env.example` para o conteúdo completo:

```
DATABASE_URL="postgresql://usuario@localhost:5432/nome_do_banco?schema=public"
JWT_SECRET="troque-esta-chave-por-uma-string-aleatoria-longa"
PORT=3333

# Agente de IA (WhatsApp)
LLM_PROVIDER=google
LLM_MODEL=gemini-2.5-flash
LLM_API_KEY="sua-chave-do-google-ai-studio"
HORARIO_ABERTURA=09:00
HORARIO_FECHAMENTO=19:00
ZAPI_INSTANCE_ID="id-da-instancia-zapi"
ZAPI_TOKEN="token-da-instancia-zapi"
ZAPI_WEBHOOK_TOKEN="uma-string-aleatoria-que-so-voce-e-o-zapi-conhecem"
```

- [ ] **Step 3: Adicionar as mesmas variáveis no `.env` real**

Edite `backend/.env` adicionando ao final (mantendo o que já existe):

```
LLM_PROVIDER=google
LLM_MODEL=gemini-2.5-flash
LLM_API_KEY="sua-chave-real-aqui"
HORARIO_ABERTURA=09:00
HORARIO_FECHAMENTO=19:00
ZAPI_INSTANCE_ID="sua-instancia-real-aqui"
ZAPI_TOKEN="seu-token-real-aqui"
ZAPI_WEBHOOK_TOKEN="gere-uma-string-aleatoria-aqui"
```

Nota: os valores reais de `LLM_API_KEY`, `ZAPI_INSTANCE_ID` e `ZAPI_TOKEN` só existirão depois que a conta no Google AI Studio e no Z-API forem criadas (Task 10). Até lá, deixe placeholders — o código das Tasks 3-9 não precisa de uma chave real pra ser escrito e testado (os testes usam mocks).

- [ ] **Step 4: Commit**

```bash
git add backend/.env.example backend/package.json backend/package-lock.json
git commit -m "chore: adiciona dependencia do Gemini e variaveis de ambiente do agente de IA"
```

(Note: `backend/.env` não é commitado — já está no `.gitignore`.)

---

## Task 3: Cálculo de horários disponíveis (função pura)

**Files:**
- Create: `backend/src/modules/agendamentos/disponibilidade.js`
- Test: `backend/src/modules/agendamentos/disponibilidade.test.js`

**Interfaces:**
- Consumes: `intervaloDoAgendamento`, `intervalosSeSobrepoem` de `backend/src/modules/agendamentos/conflito.js` (já existentes: `intervaloDoAgendamento({ data_hora, duracao_minutos }) => { inicio: Date, fim: Date }`, `intervalosSeSobrepoem(a, b) => boolean`).
- Produces: `gerarHorariosCandidatos({ data, duracaoMinutos, horarioAbertura, horarioFechamento, agendamentosExistentes }) => Date[]`, usado pela Task 4 (dentro de `agendamentos.service.js`).

- [ ] **Step 1: Escrever o teste que falha**

Crie `backend/src/modules/agendamentos/disponibilidade.test.js`:

```js
import { gerarHorariosCandidatos } from "./disponibilidade.js";

test("gera horários dentro do expediente quando não há conflito", () => {
  const candidatos = gerarHorariosCandidatos({
    data: "2026-01-10",
    duracaoMinutos: 60,
    horarioAbertura: "09:00",
    horarioFechamento: "11:00",
    agendamentosExistentes: [],
  });

  expect(candidatos).toHaveLength(2);
  expect(candidatos[0].getHours()).toBe(9);
  expect(candidatos[1].getHours()).toBe(10);
});

test("remove horário que conflita com agendamento existente", () => {
  const candidatos = gerarHorariosCandidatos({
    data: "2026-01-10",
    duracaoMinutos: 60,
    horarioAbertura: "09:00",
    horarioFechamento: "11:00",
    agendamentosExistentes: [{ data_hora: "2026-01-10T09:00:00", duracao_minutos: 60 }],
  });

  expect(candidatos).toHaveLength(1);
  expect(candidatos[0].getHours()).toBe(10);
});

test("usa 60 minutos como duração padrão quando não informada", () => {
  const candidatos = gerarHorariosCandidatos({
    data: "2026-01-10",
    horarioAbertura: "09:00",
    horarioFechamento: "10:00",
    agendamentosExistentes: [],
  });

  expect(candidatos).toHaveLength(1);
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd backend && npm test -- disponibilidade`
Expected: FAIL — `Cannot find module './disponibilidade.js'`.

- [ ] **Step 3: Implementar**

Crie `backend/src/modules/agendamentos/disponibilidade.js`:

```js
import { intervaloDoAgendamento, intervalosSeSobrepoem } from "./conflito.js";

const DURACAO_PADRAO_MINUTOS = 60;

export function gerarHorariosCandidatos({
  data,
  duracaoMinutos,
  horarioAbertura,
  horarioFechamento,
  agendamentosExistentes,
}) {
  const duracao = duracaoMinutos ?? DURACAO_PADRAO_MINUTOS;
  const [horaAbertura, minAbertura] = horarioAbertura.split(":").map(Number);
  const [horaFechamento, minFechamento] = horarioFechamento.split(":").map(Number);

  const inicioExpediente = new Date(`${data}T00:00:00`);
  inicioExpediente.setHours(horaAbertura, minAbertura, 0, 0);
  const fimExpediente = new Date(`${data}T00:00:00`);
  fimExpediente.setHours(horaFechamento, minFechamento, 0, 0);

  const ocupados = agendamentosExistentes.map((agendamento) => intervaloDoAgendamento(agendamento));

  const candidatos = [];
  let cursor = new Date(inicioExpediente);

  while (cursor.getTime() + duracao * 60000 <= fimExpediente.getTime()) {
    const candidato = intervaloDoAgendamento({ data_hora: cursor, duracao_minutos: duracao });
    const conflita = ocupados.some((ocupado) => intervalosSeSobrepoem(candidato, ocupado));

    if (!conflita) {
      candidatos.push(new Date(cursor));
    }

    cursor = new Date(cursor.getTime() + duracao * 60000);
  }

  return candidatos;
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `cd backend && npm test -- disponibilidade`
Expected: PASS — 3 testes.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/agendamentos/disponibilidade.js backend/src/modules/agendamentos/disponibilidade.test.js
git commit -m "feat: adiciona calculo puro de horarios disponiveis"
```

---

## Task 4: `horariosDisponiveis` e `buscarPorTelefone` nos services existentes

**Files:**
- Modify: `backend/src/modules/agendamentos/agendamentos.service.js`
- Modify: `backend/src/modules/clientes/clientes.service.js`

**Interfaces:**
- Consumes: `gerarHorariosCandidatos` da Task 3.
- Produces: `agendamentosService.horariosDisponiveis({ servico_id, profissional_id, data }) => Promise<string[]>` (horários ISO), `clientesService.buscarPorTelefone(telefone) => Promise<cliente|null>`. Ambos usados pela Task 6 (`tools.js`) e Task 8 (`webhook.controller.js`).

- [ ] **Step 1: Adicionar `horariosDisponiveis` em `agendamentos.service.js`**

Abra `backend/src/modules/agendamentos/agendamentos.service.js`. No topo, junto do import existente de `conflito.js`, adicione o import da Task 3:

```js
import { gerarHorariosCandidatos } from "./disponibilidade.js";
```

No final do arquivo (depois da função `remover`), adicione:

```js
export async function horariosDisponiveis({ servico_id, profissional_id, data }) {
  let duracao_minutos;

  if (servico_id) {
    const servico = await prisma.servicos.findUniqueOrThrow({ where: { id: Number(servico_id) } });
    duracao_minutos = servico.duracao_minutos;
  }

  let agendamentosExistentes = [];
  if (profissional_id) {
    agendamentosExistentes = await prisma.agendamentos.findMany({
      where: {
        profissional_id: Number(profissional_id),
        status: { not: "cancelado" },
        data_hora: { gte: new Date(`${data}T00:00:00`), lte: new Date(`${data}T23:59:59`) },
      },
    });
  }

  const candidatos = gerarHorariosCandidatos({
    data,
    duracaoMinutos: duracao_minutos,
    horarioAbertura: process.env.HORARIO_ABERTURA || "09:00",
    horarioFechamento: process.env.HORARIO_FECHAMENTO || "19:00",
    agendamentosExistentes,
  });

  return candidatos.map((candidato) => candidato.toISOString());
}
```

- [ ] **Step 2: Adicionar `buscarPorTelefone` em `clientes.service.js`**

No final de `backend/src/modules/clientes/clientes.service.js`, adicione:

```js
export async function buscarPorTelefone(telefone) {
  return prisma.clientes.findFirst({
    where: { OR: [{ telefone }, { celular: telefone }] },
  });
}
```

- [ ] **Step 3: Verificar manualmente que nada quebrou**

Run: `cd backend && npm test`
Expected: todos os testes existentes (incluindo `conflito.test.js` e `disponibilidade.test.js`) continuam passando — esta task não tem teste próprio porque só adiciona funções de leitura simples sobre o Prisma, cobertas indiretamente pelas Tasks 6 e 8 (que mockam essas funções).

- [ ] **Step 4: Commit**

```bash
git add backend/src/modules/agendamentos/agendamentos.service.js backend/src/modules/clientes/clientes.service.js
git commit -m "feat: adiciona consulta de horarios disponiveis e busca de cliente por telefone"
```

---

## Task 5: `llmClient.js` — isolamento do Gemini

**Files:**
- Create: `backend/src/modules/atendimento-ia/llmClient.js`

**Interfaces:**
- Produces: `gerarResposta({ mensagens, ferramentas, chamadasAnteriores, instrucaoSistema }) => Promise<{ texto: string, chamadasDeFerramenta: Array<{ id: string, nome: string, argumentos: object }> }>`, usado pela Task 8. `mensagens` é `Array<{ papel: "usuario"|"assistente", conteudo: string }>`. `ferramentas` é `Array<{ nome: string, descricao: string, parametros: object }>` (formato de Task 6). `chamadasAnteriores` é `Array<{ chamada: { nome, argumentos }, resultado: object }>` — pares de chamada+resultado desta mesma rodada de processamento (não persistidos).

Este é o único arquivo do módulo que importa `@google/genai` — nenhum outro arquivo deve fazer esse import (ver Global Constraints).

- [ ] **Step 1: Implementar**

Crie `backend/src/modules/atendimento-ia/llmClient.js`:

```js
import { GoogleGenAI } from "@google/genai";

const cliente = new GoogleGenAI({ apiKey: process.env.LLM_API_KEY });
const MODELO = process.env.LLM_MODEL || "gemini-2.5-flash";

function montarConteudos(mensagens, chamadasAnteriores) {
  const conteudos = mensagens.map((mensagem) => ({
    role: mensagem.papel === "assistente" ? "model" : "user",
    parts: [{ text: mensagem.conteudo }],
  }));

  for (const { chamada, resultado } of chamadasAnteriores) {
    conteudos.push({
      role: "model",
      parts: [{ functionCall: { name: chamada.nome, args: chamada.argumentos } }],
    });
    conteudos.push({
      role: "function",
      parts: [{ functionResponse: { name: chamada.nome, response: resultado } }],
    });
  }

  return conteudos;
}

export async function gerarResposta({ mensagens, ferramentas, chamadasAnteriores = [], instrucaoSistema }) {
  const functionDeclarations = ferramentas.map((ferramenta) => ({
    name: ferramenta.nome,
    description: ferramenta.descricao,
    parameters: ferramenta.parametros,
  }));

  const resposta = await cliente.models.generateContent({
    model: MODELO,
    contents: montarConteudos(mensagens, chamadasAnteriores),
    config: {
      systemInstruction: instrucaoSistema,
      tools: [{ functionDeclarations }],
    },
  });

  const partes = resposta.candidates?.[0]?.content?.parts ?? [];

  const chamadasDeFerramenta = partes
    .filter((parte) => parte.functionCall)
    .map((parte, indice) => ({
      id: `${chamadasAnteriores.length}-${indice}`,
      nome: parte.functionCall.name,
      argumentos: parte.functionCall.args ?? {},
    }));

  const texto = partes
    .filter((parte) => parte.text)
    .map((parte) => parte.text)
    .join("");

  return { texto, chamadasDeFerramenta };
}
```

Nota: confirme o nome exato do modelo Gemini Flash disponível no momento (`https://ai.google.dev/gemini-api/docs/models`) antes de rodar de verdade — `gemini-2.5-flash` é o valor padrão neste código, mas a família Flash recebe novas versões com frequência; basta mudar `LLM_MODEL` no `.env`, sem tocar neste arquivo.

- [ ] **Step 2: Verificar que o arquivo carrega sem erro de sintaxe**

Run: `cd backend && node -e "import('./src/modules/atendimento-ia/llmClient.js').then(() => console.log('ok'))"`
Expected: `ok`. Sem uma `LLM_API_KEY` real ainda, o construtor do `GoogleGenAI` não faz nenhuma chamada de rede — só falha se você tentar de fato chamar `gerarResposta`, o que só acontece nos testes mockados (Task 8) ou no teste manual (Task 10).

- [ ] **Step 3: Commit**

```bash
git add backend/src/modules/atendimento-ia/llmClient.js
git commit -m "feat: adiciona cliente do Gemini isolado em llmClient.js"
```

---

## Task 6: `tools.js` — ferramentas do agente com o guard-rail de cliente_id

**Files:**
- Create: `backend/src/modules/atendimento-ia/tools.js`
- Test: `backend/src/modules/atendimento-ia/tools.test.js`

**Interfaces:**
- Consumes: `clientesService.buscarPorTelefone` (não usado aqui, usado na Task 8), `servicosService.listar`/`buscarPorId`, `agendamentosService.criar`/`atualizar`/`buscarPorId`/`listar`/`horariosDisponiveis` (todos já existentes ou da Task 4).
- Produces: `DEFINICOES_FERRAMENTAS` (array no formato consumido por `llmClient.gerarResposta`), `INSTRUCAO_SISTEMA` (string), `executarFerramenta(clienteId, nome, argumentos) => Promise<object>` — usado pela Task 8. **Nenhuma função aqui aceita `cliente_id` vindo de `argumentos`; todas usam o parâmetro `clienteId` separado.**

Nota sobre adaptação da spec: a spec menciona testar as ferramentas "com Prisma real (banco de teste)". Este projeto não tem infraestrutura de banco de teste separado (os testes existentes, como `conflito.test.js`, testam só lógica pura). Em vez de introduzir essa infraestrutura nova, este plano mocka `agendamentos.service.js` e `servicos.service.js` com `jest.unstable_mockModule` — testa exatamente a mesma regra ("nunca aceita cliente_id de fora") de forma mais precisa e sem depender de estado de banco entre execuções.

- [ ] **Step 1: Escrever o teste que falha**

Crie `backend/src/modules/atendimento-ia/tools.test.js`:

```js
import { jest } from "@jest/globals";

jest.unstable_mockModule("../agendamentos/agendamentos.service.js", () => ({
  criar: jest.fn().mockResolvedValue({ id: 1, status: "agendado", data_hora: "2026-01-10T10:00:00.000Z" }),
  atualizar: jest.fn().mockResolvedValue({ id: 10, status: "cancelado" }),
  buscarPorId: jest.fn(),
  listar: jest.fn().mockResolvedValue([]),
  horariosDisponiveis: jest.fn().mockResolvedValue([]),
}));

jest.unstable_mockModule("../servicos/servicos.service.js", () => ({
  listar: jest.fn().mockResolvedValue([]),
  buscarPorId: jest.fn().mockResolvedValue({ id: 5, duracao_minutos: 30 }),
}));

const agendamentosService = await import("../agendamentos/agendamentos.service.js");
const { executarFerramenta } = await import("./tools.js");

test("criarAgendamento ignora cliente_id vindo do modelo e usa o cliente da conversa", async () => {
  await executarFerramenta(2, "criarAgendamento", {
    cliente_id: 999,
    servico_id: 5,
    data_hora: "2026-01-10T10:00:00",
  });

  expect(agendamentosService.criar).toHaveBeenCalledWith(
    expect.objectContaining({ cliente_id: 2, duracao_minutos: 30 }),
  );
});

test("cancelarAgendamento recusa se o agendamento não pertence ao cliente da conversa", async () => {
  agendamentosService.buscarPorId.mockResolvedValueOnce({ id: 10, cliente_id: 999, status: "agendado" });

  const resultado = await executarFerramenta(2, "cancelarAgendamento", { agendamento_id: 10 });

  expect(resultado).toEqual({ erro: "Agendamento não encontrado" });
  expect(agendamentosService.atualizar).not.toHaveBeenCalled();
});

test("cancelarAgendamento funciona quando o agendamento pertence ao cliente da conversa", async () => {
  agendamentosService.buscarPorId.mockResolvedValueOnce({ id: 10, cliente_id: 2, status: "agendado" });

  const resultado = await executarFerramenta(2, "cancelarAgendamento", { agendamento_id: 10 });

  expect(resultado).toEqual({ id: 10, status: "cancelado" });
  expect(agendamentosService.atualizar).toHaveBeenCalledWith(10, { status: "cancelado" });
});

test("ferramenta desconhecida gera erro", async () => {
  await expect(executarFerramenta(2, "ferramentaQueNaoExiste", {})).rejects.toThrow(
    "Ferramenta desconhecida: ferramentaQueNaoExiste",
  );
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd backend && npm test -- tools.test`
Expected: FAIL — `Cannot find module './tools.js'`.

- [ ] **Step 3: Implementar**

Crie `backend/src/modules/atendimento-ia/tools.js`:

```js
import * as servicosService from "../servicos/servicos.service.js";
import * as agendamentosService from "../agendamentos/agendamentos.service.js";
import { AppError } from "../../utils/AppError.js";

export const INSTRUCAO_SISTEMA =
  "Você é o assistente virtual de atendimento da Clínica Estetic Premium, conversando com um cliente pelo WhatsApp. " +
  "Seu único trabalho é: informar serviços e preços cadastrados, consultar horários disponíveis, e criar, remarcar ou " +
  "cancelar agendamentos usando as ferramentas disponíveis. Nunca invente preços, horários, nomes de serviços ou " +
  "status de agendamento — sempre use uma ferramenta para obter esses dados, nunca responda de memória. " +
  "Seja breve, cordial e direto, em português do Brasil.";

export const DEFINICOES_FERRAMENTAS = [
  {
    nome: "consultarServicosPrecos",
    descricao: "Lista os serviços ativos oferecidos pela clínica, com nome, duração e preço.",
    parametros: { type: "object", properties: {} },
  },
  {
    nome: "consultarHorariosDisponiveis",
    descricao: "Lista horários disponíveis numa data específica, opcionalmente filtrando por serviço e profissional.",
    parametros: {
      type: "object",
      properties: {
        data: { type: "string", description: "data no formato AAAA-MM-DD" },
        servico_id: { type: "number", description: "id do serviço desejado, se já escolhido" },
        profissional_id: { type: "number", description: "id do profissional desejado, se já escolhido" },
      },
      required: ["data"],
    },
  },
  {
    nome: "criarAgendamento",
    descricao: "Cria um novo agendamento para o cliente desta conversa.",
    parametros: {
      type: "object",
      properties: {
        servico_id: { type: "number" },
        profissional_id: { type: "number" },
        data_hora: { type: "string", description: "data e hora no formato AAAA-MM-DDTHH:mm:00" },
      },
      required: ["data_hora"],
    },
  },
  {
    nome: "remarcarAgendamento",
    descricao: "Muda a data/hora de um agendamento existente do cliente desta conversa.",
    parametros: {
      type: "object",
      properties: {
        agendamento_id: { type: "number" },
        data_hora: { type: "string" },
      },
      required: ["agendamento_id", "data_hora"],
    },
  },
  {
    nome: "cancelarAgendamento",
    descricao: "Cancela um agendamento existente do cliente desta conversa.",
    parametros: {
      type: "object",
      properties: { agendamento_id: { type: "number" } },
      required: ["agendamento_id"],
    },
  },
  {
    nome: "consultarMeusAgendamentos",
    descricao: "Lista os agendamentos (não cancelados) do cliente desta conversa.",
    parametros: { type: "object", properties: {} },
  },
];

async function consultarServicosPrecos() {
  const servicos = await servicosService.listar({ ativo: "true" });
  return {
    servicos: servicos.map((servico) => ({
      id: servico.id,
      nome: servico.nome,
      preco: servico.preco,
      duracao_minutos: servico.duracao_minutos,
    })),
  };
}

async function consultarHorariosDisponiveis(clienteId, argumentos) {
  const horarios = await agendamentosService.horariosDisponiveis({
    servico_id: argumentos.servico_id,
    profissional_id: argumentos.profissional_id,
    data: argumentos.data,
  });
  return { horarios };
}

async function criarAgendamento(clienteId, argumentos) {
  let duracao_minutos;
  if (argumentos.servico_id) {
    const servico = await servicosService.buscarPorId(Number(argumentos.servico_id));
    duracao_minutos = servico.duracao_minutos;
  }

  const agendamento = await agendamentosService.criar({
    cliente_id: clienteId,
    servico_id: argumentos.servico_id,
    profissional_id: argumentos.profissional_id,
    data_hora: new Date(argumentos.data_hora),
    duracao_minutos,
  });

  return { id: agendamento.id, status: agendamento.status, data_hora: agendamento.data_hora };
}

async function buscarAgendamentoDoCliente(clienteId, agendamentoId) {
  const agendamento = await agendamentosService.buscarPorId(Number(agendamentoId));
  if (agendamento.cliente_id !== clienteId) {
    throw new AppError("Agendamento não encontrado", 404);
  }
  return agendamento;
}

async function remarcarAgendamento(clienteId, argumentos) {
  const atual = await buscarAgendamentoDoCliente(clienteId, argumentos.agendamento_id);
  const agendamento = await agendamentosService.atualizar(atual.id, {
    data_hora: new Date(argumentos.data_hora),
  });
  return { id: agendamento.id, status: agendamento.status, data_hora: agendamento.data_hora };
}

async function cancelarAgendamento(clienteId, argumentos) {
  const atual = await buscarAgendamentoDoCliente(clienteId, argumentos.agendamento_id);
  const agendamento = await agendamentosService.atualizar(atual.id, { status: "cancelado" });
  return { id: agendamento.id, status: agendamento.status };
}

async function consultarMeusAgendamentos(clienteId) {
  const agendamentos = await agendamentosService.listar({ cliente_id: clienteId });
  return {
    agendamentos: agendamentos
      .filter((agendamento) => agendamento.status !== "cancelado")
      .map((agendamento) => ({
        id: agendamento.id,
        data_hora: agendamento.data_hora,
        status: agendamento.status,
        servico: agendamento.servicos?.nome ?? null,
      })),
  };
}

const EXECUTORES = {
  consultarServicosPrecos,
  consultarHorariosDisponiveis,
  criarAgendamento,
  remarcarAgendamento,
  cancelarAgendamento,
  consultarMeusAgendamentos,
};

export async function executarFerramenta(clienteId, nome, argumentos) {
  const executor = EXECUTORES[nome];
  if (!executor) {
    throw new AppError(`Ferramenta desconhecida: ${nome}`, 400);
  }

  try {
    return await executor(clienteId, argumentos ?? {});
  } catch (erro) {
    if (erro instanceof AppError) {
      return { erro: erro.message };
    }
    throw erro;
  }
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `cd backend && npm test -- tools.test`
Expected: PASS — 4 testes.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/atendimento-ia/tools.js backend/src/modules/atendimento-ia/tools.test.js
git commit -m "feat: adiciona ferramentas do agente de IA com guard-rail de cliente_id"
```

---

## Task 7: `conversas.service.js` e `zapi.js`

**Files:**
- Create: `backend/src/modules/atendimento-ia/conversas.service.js`
- Create: `backend/src/modules/atendimento-ia/zapi.js`

**Interfaces:**
- Consumes: `prisma` de `backend/src/lib/prisma.js` (já existente).
- Produces: `carregarHistorico(clienteId) => Promise<Array<{papel, conteudo}>>`, `salvarHistorico(clienteId, telefone, mensagens) => Promise<void>`, `enviarMensagem(telefone, mensagem) => Promise<object>` — todos usados pela Task 8.

- [ ] **Step 1: Implementar `conversas.service.js`**

Crie `backend/src/modules/atendimento-ia/conversas.service.js`:

```js
import { prisma } from "../../lib/prisma.js";

export async function carregarHistorico(clienteId) {
  const conversa = await prisma.conversas_whatsapp.findFirst({ where: { cliente_id: clienteId } });
  return conversa?.mensagens ?? [];
}

export async function salvarHistorico(clienteId, telefone, mensagens) {
  const conversa = await prisma.conversas_whatsapp.findFirst({ where: { cliente_id: clienteId } });

  if (conversa) {
    return prisma.conversas_whatsapp.update({ where: { id: conversa.id }, data: { mensagens } });
  }

  return prisma.conversas_whatsapp.create({ data: { cliente_id: clienteId, telefone, mensagens } });
}
```

- [ ] **Step 2: Implementar `zapi.js`**

Crie `backend/src/modules/atendimento-ia/zapi.js`:

```js
function baseUrl() {
  return `https://api.z-api.io/instances/${process.env.ZAPI_INSTANCE_ID}/token/${process.env.ZAPI_TOKEN}`;
}

export async function enviarMensagem(telefone, mensagem) {
  const resposta = await fetch(`${baseUrl()}/send-text`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone: telefone, message: mensagem }),
  });

  if (!resposta.ok) {
    throw new Error(`Falha ao enviar mensagem via Z-API: ${resposta.status}`);
  }

  return resposta.json();
}
```

- [ ] **Step 3: Verificar que ambos carregam sem erro de sintaxe**

Run: `cd backend && node -e "Promise.all([import('./src/modules/atendimento-ia/conversas.service.js'), import('./src/modules/atendimento-ia/zapi.js')]).then(() => console.log('ok'))"`
Expected: `ok`

- [ ] **Step 4: Commit**

```bash
git add backend/src/modules/atendimento-ia/conversas.service.js backend/src/modules/atendimento-ia/zapi.js
git commit -m "feat: adiciona persistencia de conversa e envio de mensagem via Z-API"
```

---

## Task 8: `webhook.controller.js` — orquestração e loop de tool-calling

**Files:**
- Create: `backend/src/modules/atendimento-ia/webhook.controller.js`
- Test: `backend/src/modules/atendimento-ia/webhook.controller.test.js`

**Interfaces:**
- Consumes: `clientesService.buscarPorTelefone`/`criar` (Task 4/existente), `conversasService.carregarHistorico`/`salvarHistorico` (Task 7), `llmClient.gerarResposta` (Task 5), `DEFINICOES_FERRAMENTAS`/`INSTRUCAO_SISTEMA`/`executarFerramenta` (Task 6), `zapi.enviarMensagem` (Task 7).
- Produces: `processarMensagemRecebida({ telefone, mensagem }) => Promise<string>` (retorna o texto final enviado — usado nos testes), `handleWebhook(req, res)` — usado pela Task 9 (rota Express).

- [ ] **Step 1: Escrever o teste que falha**

Crie `backend/src/modules/atendimento-ia/webhook.controller.test.js`:

```js
import { jest } from "@jest/globals";

jest.unstable_mockModule("../clientes/clientes.service.js", () => ({
  buscarPorTelefone: jest.fn().mockResolvedValue({ id: 3, nome: "Ana" }),
  criar: jest.fn(),
}));

jest.unstable_mockModule("./conversas.service.js", () => ({
  carregarHistorico: jest.fn().mockResolvedValue([]),
  salvarHistorico: jest.fn().mockResolvedValue({}),
}));

jest.unstable_mockModule("./zapi.js", () => ({
  enviarMensagem: jest.fn().mockResolvedValue({}),
}));

jest.unstable_mockModule("./tools.js", () => ({
  DEFINICOES_FERRAMENTAS: [],
  INSTRUCAO_SISTEMA: "instrucao de teste",
  executarFerramenta: jest.fn().mockResolvedValue({ ok: true }),
}));

jest.unstable_mockModule("./llmClient.js", () => ({
  gerarResposta: jest.fn(),
}));

const llmClient = await import("./llmClient.js");
const { enviarMensagem } = await import("./zapi.js");
const { processarMensagemRecebida } = await import("./webhook.controller.js");

test("responde direto quando o modelo não pede nenhuma ferramenta", async () => {
  llmClient.gerarResposta.mockResolvedValueOnce({ texto: "Olá! Como posso ajudar?", chamadasDeFerramenta: [] });

  const resultado = await processarMensagemRecebida({ telefone: "5511999999999", mensagem: "oi" });

  expect(resultado).toBe("Olá! Como posso ajudar?");
  expect(enviarMensagem).toHaveBeenCalledWith("5511999999999", "Olá! Como posso ajudar?");
});

test("executa a ferramenta pedida e volta pro modelo antes de responder", async () => {
  llmClient.gerarResposta
    .mockResolvedValueOnce({
      texto: "",
      chamadasDeFerramenta: [{ id: "1", nome: "consultarServicosPrecos", argumentos: {} }],
    })
    .mockResolvedValueOnce({ texto: "Temos limpeza de pele por R$150.", chamadasDeFerramenta: [] });

  const resultado = await processarMensagemRecebida({ telefone: "5511999999999", mensagem: "quais servicos?" });

  expect(resultado).toBe("Temos limpeza de pele por R$150.");
  expect(llmClient.gerarResposta).toHaveBeenCalledTimes(2);
});

test("usa mensagem de fallback quando o modelo nunca conclui dentro do limite de iterações", async () => {
  llmClient.gerarResposta.mockResolvedValue({
    texto: "",
    chamadasDeFerramenta: [{ id: "1", nome: "consultarServicosPrecos", argumentos: {} }],
  });

  const resultado = await processarMensagemRecebida({ telefone: "5511999999999", mensagem: "oi" });

  expect(resultado).toBe(
    "Não consegui concluir sua solicitação agora, vou chamar alguém da recepção para te ajudar.",
  );
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd backend && npm test -- webhook.controller.test`
Expected: FAIL — `Cannot find module './webhook.controller.js'`.

- [ ] **Step 3: Implementar**

Crie `backend/src/modules/atendimento-ia/webhook.controller.js`:

```js
import * as clientesService from "../clientes/clientes.service.js";
import * as conversasService from "./conversas.service.js";
import * as llmClient from "./llmClient.js";
import { DEFINICOES_FERRAMENTAS, INSTRUCAO_SISTEMA, executarFerramenta } from "./tools.js";
import { enviarMensagem } from "./zapi.js";

const MAX_ITERACOES_FERRAMENTA = 5;
const MENSAGEM_FALLBACK_ERRO =
  "Estou com dificuldade técnica agora, por favor tente novamente em alguns minutos ou fale com a recepção.";
const MENSAGEM_FALLBACK_LIMITE =
  "Não consegui concluir sua solicitação agora, vou chamar alguém da recepção para te ajudar.";

async function resolverCliente(telefone) {
  const existente = await clientesService.buscarPorTelefone(telefone);
  if (existente) return existente;

  return clientesService.criar({
    nome: `Cliente WhatsApp ${telefone}`,
    celular: telefone,
    origem: "whatsapp",
    status: "ativo",
  });
}

export async function processarMensagemRecebida({ telefone, mensagem }) {
  const cliente = await resolverCliente(telefone);

  const historico = await conversasService.carregarHistorico(cliente.id);
  historico.push({ papel: "usuario", conteudo: mensagem });

  let chamadasAnteriores = [];
  let textoFinal = null;

  for (let iteracao = 0; iteracao < MAX_ITERACOES_FERRAMENTA; iteracao++) {
    const resposta = await llmClient.gerarResposta({
      mensagens: historico,
      ferramentas: DEFINICOES_FERRAMENTAS,
      chamadasAnteriores,
      instrucaoSistema: INSTRUCAO_SISTEMA,
    });

    if (resposta.chamadasDeFerramenta.length === 0) {
      textoFinal = resposta.texto;
      break;
    }

    for (const chamada of resposta.chamadasDeFerramenta) {
      const resultado = await executarFerramenta(cliente.id, chamada.nome, chamada.argumentos);
      chamadasAnteriores.push({ chamada, resultado });
    }
  }

  if (!textoFinal) {
    textoFinal = MENSAGEM_FALLBACK_LIMITE;
  }

  historico.push({ papel: "assistente", conteudo: textoFinal });
  await conversasService.salvarHistorico(cliente.id, telefone, historico);
  await enviarMensagem(telefone, textoFinal);

  return textoFinal;
}

export async function handleWebhook(req, res) {
  const { telefone, mensagem } = req.body;

  if (!telefone || !mensagem) {
    return res.status(400).json({ error: "telefone e mensagem são obrigatórios" });
  }

  try {
    await processarMensagemRecebida({ telefone, mensagem });
  } catch (erro) {
    console.error("Erro ao processar mensagem do WhatsApp:", erro);
    await enviarMensagem(telefone, MENSAGEM_FALLBACK_ERRO).catch(() => {});
  }

  res.status(200).json({ status: "ok" });
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `cd backend && npm test -- webhook.controller.test`
Expected: PASS — 3 testes.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/atendimento-ia/webhook.controller.js backend/src/modules/atendimento-ia/webhook.controller.test.js
git commit -m "feat: adiciona orquestracao do agente de IA com loop de tool-calling"
```

---

## Task 9: Rota do webhook e registro no `app.js`

**Files:**
- Create: `backend/src/modules/atendimento-ia/webhook.routes.js`
- Modify: `backend/src/app.js`

**Interfaces:**
- Consumes: `handleWebhook` da Task 8.
- Produces: rota Express `POST /webhook/whatsapp?token=...`.

- [ ] **Step 1: Criar a rota com validação de token**

Crie `backend/src/modules/atendimento-ia/webhook.routes.js`:

```js
import { Router } from "express";
import { handleWebhook } from "./webhook.controller.js";
import { AppError } from "../../utils/AppError.js";

const router = Router();

function validarToken(req, res, next) {
  if (req.query.token !== process.env.ZAPI_WEBHOOK_TOKEN) {
    throw new AppError("Token inválido", 401);
  }
  next();
}

router.post("/", validarToken, handleWebhook);

export default router;
```

- [ ] **Step 2: Registrar no `app.js`**

Abra `backend/src/app.js`. Adicione o import junto dos outros (depois de `dashboardRoutes`):

```js
import webhookWhatsappRoutes from "./modules/atendimento-ia/webhook.routes.js";
```

E registre a rota **fora** do bloco protegido por `requireAuth` (adicione logo depois de `app.use("/auth", authRoutes);`):

```js
app.use("/webhook/whatsapp", webhookWhatsappRoutes);
```

- [ ] **Step 3: Testar manualmente sem token (deve rejeitar)**

Run:
```bash
cd backend && npm run dev &
sleep 1.5
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3333/webhook/whatsapp -H "Content-Type: application/json" -d '{"telefone":"5511999999999","mensagem":"oi"}'
```
Expected: `401`

- [ ] **Step 4: Testar manualmente com token correto (deve aceitar o formato, mesmo sem Gemini/Z-API configurados de verdade)**

Run (usando o valor que você colocou em `ZAPI_WEBHOOK_TOKEN` no `.env`):
```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST "http://localhost:3333/webhook/whatsapp?token=SEU_ZAPI_WEBHOOK_TOKEN" -H "Content-Type: application/json" -d '{"telefone":"5511999999999","mensagem":"oi"}'
```
Expected: `200` (a mensagem pode falhar internamente por falta de chave real da Gemini/Z-API — isso é esperado até a Task 10; o importante aqui é confirmar que o token é validado e a rota responde).

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/atendimento-ia/webhook.routes.js backend/src/app.js
git commit -m "feat: registra rota do webhook do whatsapp com validacao de token"
```

---

## Task 10: Configuração externa e teste manual ponta-a-ponta

Esta task é majoritariamente manual (contas em serviços externos) — não há código de produto pra escrever, mas é o que efetivamente liga o agente a um WhatsApp real.

**Files:** nenhum (configuração externa + `.env`)

- [ ] **Step 1: Criar a chave da API do Gemini**

No [Google AI Studio](https://aistudio.google.com/apikey), crie uma chave de API. Cole o valor em `backend/.env`, na variável `LLM_API_KEY`.

- [ ] **Step 2: Criar a instância no Z-API**

Crie uma conta em [Z-API](https://www.z-api.io/), crie uma instância e conecte o WhatsApp da clínica escaneando o QR code exibido no painel. Copie o `ID da instância` e o `Token` exibidos no painel para `ZAPI_INSTANCE_ID` e `ZAPI_TOKEN` em `backend/.env`.

- [ ] **Step 3: Gerar o token de webhook**

Gere uma string aleatória (ex: `openssl rand -hex 16`) e cole em `ZAPI_WEBHOOK_TOKEN` no `.env`.

- [ ] **Step 4: Expor o backend local com ngrok**

Run: `ngrok http 3333`
Expected: uma URL pública tipo `https://algumacoisa.ngrok-free.app`.

- [ ] **Step 5: Configurar o webhook no painel do Z-API**

No painel do Z-API, em "Webhooks" → "Ao receber mensagem", cole:
```
https://algumacoisa.ngrok-free.app/webhook/whatsapp?token=SEU_ZAPI_WEBHOOK_TOKEN
```

Nota: o corpo exato que o Z-API envia no webhook pode ter um formato diferente de `{ telefone, mensagem }` (varia por versão da API do Z-API) — confira a documentação de "webhook ao receber" do Z-API no momento do teste e, se os nomes dos campos forem diferentes, ajuste o `req.body` lido em `handleWebhook` (Task 8, `webhook.controller.js`) para os nomes reais.

- [ ] **Step 6: Reiniciar o backend e enviar uma mensagem de teste real**

Run: `cd backend && npm run dev`

Do seu celular, mande uma mensagem de WhatsApp pro número conectado no Z-API (ex: "Oi, quais serviços vocês têm?"). Expected: você recebe uma resposta do agente listando os serviços cadastrados (dados reais do banco).

- [ ] **Step 7: Testar o fluxo completo de agendamento**

Continue a conversa pedindo pra marcar um horário (ex: "quero marcar uma limpeza de pele pra amanhã de manhã"). Expected: o agente consulta horários disponíveis, confirma um horário, cria o agendamento — e você consegue ver esse agendamento aparecer na tela de Agenda do CRM (`http://localhost:5173/agenda`).

- [ ] **Step 8: Commit final (sem segredos)**

Confirme que `backend/.env` **não** está sendo commitado (`git status` não deve listá-lo). Se houver algum ajuste feito no Step 5 em `webhook.controller.js`, comite-o:

```bash
git status
git add -A
git commit -m "docs: finaliza configuracao do agente de IA via whatsapp"
```
