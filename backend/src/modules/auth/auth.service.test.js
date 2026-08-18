import { jest } from "@jest/globals";

const mockFindUniqueOrThrow = jest.fn();
const mockFindUnique = jest.fn();
const mockUpdate = jest.fn();
const mockCompare = jest.fn();
const mockHash = jest.fn();

jest.unstable_mockModule("../../lib/prisma.js", () => ({
  prisma: {
    usuarios: {
      findUniqueOrThrow: mockFindUniqueOrThrow,
      findUnique: mockFindUnique,
      update: mockUpdate,
    },
  },
}));

jest.unstable_mockModule("bcryptjs", () => ({
  default: { compare: mockCompare, hash: mockHash },
}));

const { buscarPerfil, atualizarPerfil, alterarSenha } = await import("./auth.service.js");

beforeEach(() => {
  jest.clearAllMocks();
});

test("buscarPerfil devolve nome e email sem o hash da senha", async () => {
  mockFindUniqueOrThrow.mockResolvedValueOnce({ id: 2, nome: "Admin", email: "admin@teste.com", senha_hash: "hash-secreto" });

  const perfil = await buscarPerfil(2);

  expect(perfil).toEqual({ id: 2, nome: "Admin", email: "admin@teste.com" });
});

test("atualizarPerfil recusa quando o email já está em uso por outro usuário", async () => {
  mockFindUnique.mockResolvedValueOnce({ id: 9, email: "outro@teste.com" });

  await expect(atualizarPerfil(2, { nome: "Admin", email: "outro@teste.com" })).rejects.toThrow(/já existe/i);

  expect(mockUpdate).not.toHaveBeenCalled();
});

test("atualizarPerfil permite manter o próprio email do usuário", async () => {
  mockFindUnique.mockResolvedValueOnce({ id: 2, email: "admin@teste.com" });
  mockUpdate.mockResolvedValueOnce({ id: 2, nome: "Admin Novo", email: "admin@teste.com" });

  const perfil = await atualizarPerfil(2, { nome: "Admin Novo", email: "admin@teste.com" });

  expect(perfil).toEqual({ id: 2, nome: "Admin Novo", email: "admin@teste.com" });
});

test("alterarSenha recusa quando a senha atual informada está errada", async () => {
  mockFindUniqueOrThrow.mockResolvedValueOnce({ id: 2, senha_hash: "hash-antigo" });
  mockCompare.mockResolvedValueOnce(false);

  await expect(alterarSenha(2, { senhaAtual: "errada", novaSenha: "novaSenha123" })).rejects.toThrow(/senha atual/i);

  expect(mockUpdate).not.toHaveBeenCalled();
});

test("alterarSenha salva o novo hash quando a senha atual está correta", async () => {
  mockFindUniqueOrThrow.mockResolvedValueOnce({ id: 2, senha_hash: "hash-antigo" });
  mockCompare.mockResolvedValueOnce(true);
  mockHash.mockResolvedValueOnce("hash-novo");

  await alterarSenha(2, { senhaAtual: "certa", novaSenha: "novaSenha123" });

  expect(mockUpdate).toHaveBeenCalledWith({ where: { id: 2 }, data: { senha_hash: "hash-novo" } });
});
