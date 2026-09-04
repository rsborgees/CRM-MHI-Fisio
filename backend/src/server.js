import "dotenv/config";
import { app } from "./app.js";
import { iniciarAgendadorDeLembretes } from "./modules/lembretes/agendador.js";

const PORT = process.env.PORT || 3336;

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
  iniciarAgendadorDeLembretes();
});
