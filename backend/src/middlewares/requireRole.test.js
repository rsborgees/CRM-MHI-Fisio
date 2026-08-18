import { jest } from "@jest/globals";
import { requireRole } from "./requireRole.js";
import { AppError } from "../utils/AppError.js";

function criarReq(papel) {
  return { usuario: { id: 1, papel } };
}

test("deixa passar quando o papel do usuário está na lista permitida", () => {
  const next = jest.fn();
  const middleware = requireRole("administrador", "desenvolvedor");

  middleware(criarReq("desenvolvedor"), {}, next);

  expect(next).toHaveBeenCalledWith();
});

test("lança AppError 403 quando o papel do usuário não está na lista permitida", () => {
  const next = jest.fn();
  const middleware = requireRole("administrador");

  expect(() => middleware(criarReq("usuario"), {}, next)).toThrow(AppError);
  expect(next).not.toHaveBeenCalled();

  try {
    middleware(criarReq("usuario"), {}, next);
  } catch (erro) {
    expect(erro.statusCode).toBe(403);
  }
});
