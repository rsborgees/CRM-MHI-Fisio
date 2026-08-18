import { jest } from "@jest/globals";

const mockFindMany = jest.fn();
const mockFindUnique = jest.fn();
const mockCreate = jest.fn();
const mockUpdate = jest.fn();
const mockDelete = jest.fn();
const mockHash = jest.fn();

jest.unstable_mockModule("../../lib/prisma.js", () => ({
  prisma: {
    usuarios: {
      findMany: mockFindMany,
      findUnique: mockFindUnique,
      create: mockCreate,
      update: mockUpdate,
      delete: mockDelete,
    },
  },
}));

jest.unstable_mockModule("bcryptjs", () => ({
  default: { hash: mockHash },
}));

const { listar, criar, atualizar, remover } = await import("./usuarios.service.js");

beforeEach(() => {
  jest.clearAllMocks();
});

test("listar devolve os usuários sem o hash da senha", async () => {
  mockFindMany.mockResolvedValueOnce([
    { id: 1, nome: "Ana", email: "ana@teste.com", papel: "usuario", ativo: true },
  ]);

  const usuarios = await listar();

  expect(usuarios).toEqual([{ id: 1, nome: "Ana", email: "ana@teste.com", papel: "usuario", ativo: true }]);
  expect(mockFindMany.mock.calls[0][0].select).not.toHaveProperty("senha_hash");
});

test("criar recusa quando já existe um usuário com o mesmo email", async () => {
  mockFindUnique.mockResolvedValueOnce({ id: 5, email: "ana@teste.com" });

  await expect(
    criar({ nome: "Ana", email: "ana@teste.com", senha: "123456", papel: "usuario" }),
  ).rejects.toThrow(/já existe/i);

  expect(mockCreate).not.toHaveBeenCalled();
});

test("criar cria o usuário com a senha já criptografada e o papel escolhido", async () => {
  mockFindUnique.mockResolvedValueOnce(null);
  mockHash.mockResolvedValueOnce("hash-da-senha");
  mockCreate.mockResolvedValueOnce({ id: 2, nome: "Ana", email: "ana@teste.com", papel: "desenvolvedor", ativo: true });

  const usuario = await criar({ nome: "Ana", email: "ana@teste.com", senha: "123456", papel: "desenvolvedor" });

  expect(mockCreate).toHaveBeenCalledWith({
    data: { nome: "Ana", email: "ana@teste.com", senha_hash: "hash-da-senha", papel: "desenvolvedor" },
  });
  expect(usuario).toEqual({ id: 2, nome: "Ana", email: "ana@teste.com", papel: "desenvolvedor", ativo: true });
});

test("atualizar recusa quando o novo email já está em uso por outro usuário", async () => {
  mockFindUnique.mockResolvedValueOnce({ id: 9, email: "outro@teste.com" });

  await expect(atualizar(2, { email: "outro@teste.com" })).rejects.toThrow(/já existe/i);

  expect(mockUpdate).not.toHaveBeenCalled();
});

test("remover recusa quando o administrador tenta excluir a própria conta", async () => {
  await expect(remover(2, 2)).rejects.toThrow(/próprio usuário/i);

  expect(mockDelete).not.toHaveBeenCalled();
});

test("remover exclui normalmente quando é outro usuário, não o próprio administrador logado", async () => {
  await remover(5, 2);

  expect(mockDelete).toHaveBeenCalledWith({ where: { id: 5 } });
});
