# Agente de IA de atendimento via WhatsApp — Design

## Contexto

O CRM Estetic Premium já tem um backend (Node/Express/Prisma/PostgreSQL) com módulos completos de `clientes`, `profissionais`, `servicos`, `pacotes`, `agendamentos`, `pagamentos`, `historico`, `avaliacoes`, e um frontend React usado pela equipe interna da clínica.

Este documento especifica um agente de IA que atende **clientes finais via WhatsApp**, permitindo que eles consultem horários/serviços/preços e criem, remarquem ou cancelem agendamentos sozinhos, sem depender de um humano da recepção para cada interação.

## Objetivos

- Cliente conversa em linguagem natural no WhatsApp da clínica.
- O agente consulta e altera agendamentos de verdade no banco (mesmas regras de negócio já validadas no backend, incluindo a checagem de conflito de horário por profissional).
- Cliente novo (número de telefone não cadastrado) é cadastrado automaticamente pelo próprio agente.
- Trocar o modelo de IA (ou, com mais esforço, o provedor) deve ser possível sem reescrever o resto do sistema.

## Não-objetivos (fora do escopo desta primeira versão)

- Lembretes automáticos antes do agendamento (feature futura e separada).
- Fila/roteamento real para atendimento humano — o "encaminhar para humano" é apenas uma mensagem de texto fixa nesta versão.
- Tirar dúvidas médicas sobre procedimentos (contraindicações, etc.) — o agente só lida com agenda, serviços cadastrados e preços.
- Suporte a múltiplos canais (site/webchat) — apenas WhatsApp por ora.

## Arquitetura

Novo módulo `backend/src/modules/atendimento-ia/`:

```
atendimento-ia/
  webhook.routes.js        # POST /webhook/whatsapp — recebe mensagens do Z-API
  webhook.controller.js     # orquestra o fluxo de uma mensagem recebida
  conversas.service.js      # carrega/salva histórico de conversa por telefone
  tools.js                  # ferramentas que o modelo pode chamar (casca sobre os services existentes)
  llmClient.js               # única peça que conhece a API do provedor de IA (Gemini)
  zapi.js                    # envia mensagens de volta via Z-API
```

Esta rota **não** passa pelo `requireAuth` (não há usuário logado — quem "autentica" a conversa é o número de telefone do WhatsApp, validado contra a assinatura/token do webhook do Z-API).

### `llmClient.js` — isolamento do provedor de IA

Exporta uma função:

```js
async function gerarResposta({ mensagens, ferramentas }) {
  // retorna { texto, chamadasDeFerramenta: [{ nome, argumentos, id }] }
}
```

Toda a formatação específica do provedor de IA (formato de `tools`/`function calling`, como o modelo pede pra chamar uma ferramenta, como devolvemos o resultado) fica dentro deste arquivo. O resto do módulo só conhece o formato normalizado acima.

**Provedor escolhido: Google Gemini** (modelo da família Flash — barato e com bom suporte a português e tool-calling nativo), desacoplado de qualquer plano/limite da Anthropic. Configuração via `.env`:

```
LLM_PROVIDER=google
LLM_MODEL=gemini-2.5-flash
LLM_API_KEY=...
```

Trocar de modelo Gemini (ex: pra uma versão mais nova do Flash) = mudar `LLM_MODEL`. Trocar de provedor de novo no futuro (ex: pra OpenAI) = reescrever só `llmClient.js`. O nome exato do modelo Gemini deve ser confirmado no console do Google AI no momento da implementação (a família "Flash" costuma ganhar novas versões com frequência).

## Dados novos

Nova tabela via Prisma:

```prisma
model conversas_whatsapp {
  id           Int      @id @default(autoincrement())
  cliente_id   Int
  telefone     String   @db.VarChar(30)
  mensagens    Json
  atualizado_em DateTime @default(now()) @updatedAt
  clientes     clientes @relation(fields: [cliente_id], references: [id])
}
```

`mensagens` guarda o histórico da conversa (array de `{ papel, conteudo }`) — necessário para o modelo lembrar contexto entre mensagens (ex: cliente diz o serviço numa mensagem e o horário na próxima).

## Ferramentas disponíveis para o modelo

Todas em `tools.js`, cada uma casca fina sobre um service já existente:

| Ferramenta | Service reaproveitado | Parâmetros vindos do modelo |
|---|---|---|
| `consultarServicosPrecos` | `servicos.service.js` → `listar` | nenhum (ou filtro por nome) |
| `consultarHorariosDisponiveis` | `agendamentos.service.js` (nova função de leitura) | data, serviço/profissional desejado |
| `criarAgendamento` | `agendamentos.service.js` → `criar` | servico_id, profissional_id (opcional), data_hora |
| `remarcarAgendamento` | `agendamentos.service.js` → `atualizar` | agendamento_id, nova data_hora |
| `cancelarAgendamento` | `agendamentos.service.js` → `atualizar` (status) | agendamento_id |
| `consultarMeusAgendamentos` | `agendamentos.service.js` → `listar` | nenhum |

### Cálculo de horários disponíveis

`consultarHorariosDisponiveis` gera os horários candidatos a partir de um horário de funcionamento configurável (`HORARIO_ABERTURA`/`HORARIO_FECHAMENTO` no `.env`, padrão `09:00`–`19:00`), em intervalos do tamanho da duração do serviço pedido (ou 60 min se não houver serviço definido ainda na conversa), e descarta os que conflitam com agendamentos existentes daquele profissional — reaproveitando a mesma função pura `intervalosSeSobrepoem` de `agendamentos/conflito.js` já usada (e testada) pela validação de conflito no cadastro manual.

**Guard-rail central:** nenhuma dessas ferramentas recebe `cliente_id` como parâmetro do modelo. O `webhook.controller.js` resolve o `cliente_id` a partir do telefone de quem mandou a mensagem **antes** de chamar o modelo, e esse valor é injetado por código em toda ferramenta que precisa dele (`criarAgendamento`, `remarcarAgendamento`, `cancelarAgendamento`, `consultarMeusAgendamentos`). O modelo nunca vê nem escolhe de quem são os dados.

## Fluxo de uma mensagem

1. Z-API envia `POST /webhook/whatsapp` com `{ telefone, mensagem }`.
2. `webhook.controller.js` busca cliente por telefone (`clientes.service.js`); se não existir, cadastra automaticamente (nome vem da primeira troca de mensagens, status `ativo`, `origem: "whatsapp"`).
3. Carrega histórico da conversa (`conversas.service.js`, por `cliente_id`).
4. Chama `llmClient.gerarResposta` com o histórico + a lista de ferramentas.
5. Se o modelo pedir uma ferramenta: executa a função correspondente em `tools.js` (com `cliente_id` já fixado), devolve o resultado ao modelo, repete até o modelo devolver texto final (loop de tool-calling).
6. Salva a mensagem do cliente + a resposta final na tabela `conversas_whatsapp`.
7. Envia a resposta final via `zapi.js`.

## Erros e limites

- Erro de negócio (ex: conflito de horário) → a ferramenta devolve uma mensagem de erro estruturada pro modelo, que reformula e sugere alternativa — não é um erro fatal da conversa.
- Erro técnico (ex: API da Anthropic fora do ar, Z-API fora do ar) → mensagem fixa de fallback ("Estou com dificuldade técnica agora, por favor tente novamente em alguns minutos ou fale com a recepção") e log do erro.
- Loop de ferramentas tem um limite máximo de iterações (ex: 5) por mensagem recebida, pra nunca girar infinitamente.

## Segurança

- Endpoint de webhook valida um token/assinatura do Z-API antes de processar (evita que qualquer um mande requisições fake pro webhook fingindo ser um cliente).
- `cliente_id` sempre resolvido por código a partir do telefone verificado pelo provedor — nunca aceito como texto livre do modelo.
- Chaves (`LLM_API_KEY`, credenciais do Z-API) só em `.env`, nunca commitadas.

## Configuração necessária (setup, fora do código)

- Conta no Z-API (ou provedor equivalente) conectada ao número de WhatsApp da clínica via QR code.
- Chave de API do Google AI Studio / Gemini (`LLM_API_KEY`).
- Para desenvolvimento local: um túnel público (ex: ngrok) apontando pro backend local, porque o Z-API precisa alcançar `POST /webhook/whatsapp` pela internet.

## Testes

- Testes unitários das ferramentas em `tools.js` com Prisma real (banco de teste) — principalmente a regra "nunca aceita cliente_id de fora".
- Teste do loop de tool-calling com `llmClient` mockado (sem gastar chamada de API real).
- Teste manual ponta-a-ponta via ngrok + WhatsApp real antes de considerar pronto.
