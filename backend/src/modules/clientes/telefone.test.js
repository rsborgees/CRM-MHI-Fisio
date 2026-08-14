import { variantesTelefoneBR } from "./telefone.js";

test("gera a variante com o 9 quando o número vem sem ele", () => {
  const variantes = variantesTelefoneBR("557181433121");
  expect(variantes).toContain("557181433121");
  expect(variantes).toContain("5571981433121");
});

test("gera a variante sem o 9 quando o número vem com ele", () => {
  const variantes = variantesTelefoneBR("5571981433121");
  expect(variantes).toContain("5571981433121");
  expect(variantes).toContain("557181433121");
});

test("remove caracteres não numéricos antes de comparar", () => {
  const variantes = variantesTelefoneBR("+55 (71) 98143-3121");
  expect(variantes).toContain("5571981433121");
  expect(variantes).toContain("557181433121");
});

test("não gera variante para números fora do padrão brasileiro de 12/13 dígitos", () => {
  const variantes = variantesTelefoneBR("12345");
  expect(variantes).toEqual(["12345"]);
});
