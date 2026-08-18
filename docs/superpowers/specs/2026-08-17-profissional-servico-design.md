# Relação profissional ↔ serviço, com resolução automática no agendamento por IA

## Contexto e objetivo

O agente de IA de agendamento (WhatsApp) hoje só atribui uma profissional a um
agendamento quando o cliente diz o nome dela explicitamente. Não existe hoje
nenhuma relação estruturada entre `profissionais` e `servicos` — o campo
`profissionais.especialidade` e `servicos.categoria` existem no schema, mas
`categoria` está vazio para os serviços cadastrados e os dois campos não são
comparados em lugar nenhum do código.

Objetivo: quando o cliente pedir um serviço sem especificar profissional, a IA
deve escolher automaticamente a profissional certa (se só uma atende aquele
serviço) ou perguntar a preferência do cliente (se mais de uma atende). Quando
o cliente pedir explicitamente uma profissional que não atende aquele serviço,
a IA deve recusar e informar quem atende.

## Modelo de dados

Relação N:N direta entre `profissionais` e `servicos` no `schema.prisma`,
usando relação implícita do Prisma (sem tabela de junção customizada — não há
necessidade de campos extras como "desde quando" ou observações):

```prisma
model profissionais {
  // ...campos existentes...
  servicosAtendidos servicos[] @relation("ProfissionalServicos")
}

model servicos {
  // ...campos existentes...
  profissionaisQueAtendem profissionais[] @relation("ProfissionalServicos")
}
```

O Prisma cria e gerencia a tabela de junção automaticamente
(`_ProfissionalServicos`). Aplicado via `npm run prisma:push` (o projeto não
usa migrations formais, só `prisma db push` contra o banco de dev — mantém a
convenção já usada no projeto).

Profissionais existentes (Larissa, Pedro) começam com a lista vazia até serem
configurados manualmente na tela.

## Backend

**`profissionais.service.js`:**
- `listar()` passa a incluir a relação: `include: { servicosAtendidos: true }`.
- `criar(dados)` e `atualizar(id, dados)` passam a aceitar um campo
  `servico_ids: number[]` (opcional) nos dados recebidos, e usam
  `servicosAtendidos: { set: servico_ids.map((id) => ({ id })) }` na chamada
  do Prisma para substituir a lista de serviços vinculados por completo a
  cada salvamento (comportamento de "checkbox list" — o que estiver marcado
  na tela é o que fica salvo). Como `servico_ids` é opcional (o schema de
  atualização é `.partial()`), a chamada só inclui `servicosAtendidos` no
  payload do Prisma quando `dados.servico_ids !== undefined` — uma
  atualização parcial que não mande esse campo (ex: só mudar `ativo`) não
  apaga os serviços já vinculados.

**`profissionais.schema.js`:**
- `criarProfissionalSchema` e `atualizarProfissionalSchema` ganham
  `servico_ids: z.array(z.number()).optional()`.

**`profissionais.controller.js`:** sem mudança de estrutura — só passa a
receber o campo novo dentro do corpo já validado pelo schema.

## Frontend (`Profissionais.jsx`)

- Busca a lista de serviços ativos (`api('/servicos')`) no `useEffect` de
  carregamento inicial, igual `Agenda.jsx` já faz para clientes/serviços.
- O formulário ganha uma seção "Serviços atendidos": uma lista de checkboxes,
  uma por serviço ativo, controlada por um novo estado `servicoIds` (array de
  ids). Ao editar uma profissional existente, os checkboxes já vêm marcados
  conforme `profissional.servicosAtendidos`.
- `handleSubmit` envia `servico_ids: servicoIds` junto com `nome`/`especialidade`.
- A tabela de listagem ganha uma coluna "Serviços", mostrando os nomes dos
  serviços atendidos separados por vírgula (ou "—" se nenhum).

## Lógica da IA (`tools.js`, só em `criarAgendamento`)

Não mexe em `consultarHorariosDisponiveis` — a checagem de disponibilidade
continua conservadora (olha todos os agendamentos do horário,
independentemente de profissional), como já foi corrigido antes nesta sessão.
A resolução por especialidade entra só na hora de **criar** o agendamento,
que é o momento que a instrução do usuário se refere ("agenda direto com
ela").

**Nova função `profissionaisQueAtendemServico(servicoId)`:**
```js
async function profissionaisQueAtendemServico(servicoId) {
  const todos = await profissionaisService.listar({ ativo: "true" });
  return todos.filter((p) => p.servicosAtendidos?.some((s) => s.id === servicoId));
}
```

**Mudança em `criarAgendamento`:**
1. Resolve o serviço por nome (como já faz hoje).
2. Se `argumentos.nome_profissional` foi informado:
   - Resolve a profissional por nome (como já faz hoje).
   - Verifica se essa profissional atende o serviço resolvido
     (`profissional.servicosAtendidos.some(s => s.id === servico.id)`).
     Se não atender, lança `AppError` listando quem atende esse serviço,
     recusando o agendamento.
3. Se `nome_profissional` não foi informado:
   - Busca `profissionaisQueAtendemServico(servico.id)`.
   - 1 resultado → usa essa profissional automaticamente.
   - Mais de 1 → lança `AppError` pedindo pra perguntar a preferência do
     cliente, listando os nomes (mesmo padrão de erro recuperável já usado
     em `resolverServicoPorNome`/`resolverAgendamentoDoClientePorServico`).
   - 0 resultados → segue sem profissional definida (comportamento atual,
     tratado como recurso compartilhado da clínica).

## Tratamento de erro

Segue o padrão já estabelecido no arquivo: erros de resolução viram
`AppError` com mensagem que já lista as opções válidas, capturados por
`executarFerramenta` e devolvidos como `{ erro: "..." }` — a IA vê o erro e
decide como responder ao cliente (perguntar preferência, avisar que a
profissional pedida não atende aquele serviço, etc.), sem derrubar a
conversa.

## Testes

- `tools.test.js`: casos novos para `criarAgendamento` —
  auto-atribuição com 1 profissional compatível, erro pedindo preferência
  com 2+, recusa quando a profissional nomeada não atende o serviço, segue
  sem profissional quando nenhuma está vinculada.
- Sem teste automatizado para o CRUD de `profissionais.service.js`
  (mesma cobertura que já existe hoje pro resto do arquivo — nenhuma).
- Validação manual do fluxo real (como já foi feito nas correções anteriores
  desta sessão): reproduzir uma conversa pedindo o serviço sem nomear
  profissional, com 1 e com 2 profissionais vinculadas.

## Fora de escopo

- Não altera `consultarHorariosDisponiveis` nem `remarcarAgendamento`.
- Não adiciona UI para gerenciar a relação pelo lado de Serviços (só pela
  tela de Profissionais, conforme decidido).
- Não usa o campo `servicos.categoria` nem `profissionais.especialidade`
  como parte dessa lógica — ficam como estão, sem uso automatizado.
