import { jsPDF } from 'jspdf'

const MARGEM = 16
const LARGURA_PAGINA = 210
const ALTURA_PAGINA = 297
const LARGURA_UTIL = LARGURA_PAGINA - MARGEM * 2
const RODAPE_Y = ALTURA_PAGINA - 10

// Mesma paleta usada no app (ver index.css) — mantém o PDF com a mesma identidade visual.
const COR_PRIMARIA = [15, 122, 73]
const COR_TEXTO = [28, 25, 23]
const COR_MUTED = [120, 113, 108]
const COR_BORDA = [231, 227, 222]
const COR_BRANCO = [255, 255, 255]

// Campos curtos (números, sim/não, opções de uma palavra) vão numa grade de duas colunas;
// campos de texto livre (queixas, observações etc.) ficam em largura total, um embaixo do
// outro — separa "dados rápidos" de "texto narrativo", como um relatório clínico de verdade.
const LIMITE_CAMPO_CURTO = 25

function formatarDataHora(data) {
  return new Date(data).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function paraNomeArquivo(texto) {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// Gera e baixa um PDF com uma lista de registros (anamnese, avaliação ou evolução) de um
// cliente. `registros` é uma lista de { data, campos }, onde `campos` já vem no formato de
// exibição (rótulo + valor formatado) — a mesma lógica usada pra mostrar o card na tela, pra
// não ter duas fontes de verdade sobre como cada campo é rotulado ou formatado.
export function exportarRegistrosPdf({ titulo, cliente, registros }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  let y = MARGEM

  function novaPaginaSeNecessario(alturaNecessaria) {
    if (y + alturaNecessaria > RODAPE_Y - 4) {
      doc.addPage()
      y = MARGEM
    }
  }

  function cabecalho() {
    doc.setFillColor(...COR_PRIMARIA)
    doc.rect(0, 0, LARGURA_PAGINA, 30, 'F')

    doc.setTextColor(...COR_BRANCO)
    doc.setFont(undefined, 'bold')
    doc.setFontSize(16)
    doc.text('MHI Fisio', MARGEM, 13)

    doc.setFontSize(13)
    doc.text(titulo, LARGURA_PAGINA - MARGEM, 13, { align: 'right' })

    doc.setFont(undefined, 'normal')
    doc.setFontSize(10)
    doc.text(`Cliente: ${cliente.nome}`, MARGEM, 21)
    doc.setFontSize(8.5)
    doc.text(`Exportado em ${formatarDataHora(new Date())}`, LARGURA_PAGINA - MARGEM, 21, { align: 'right' })

    doc.setTextColor(...COR_TEXTO)
    y = 40
  }

  function campoCurto(rotulo, valor, x, larguraColuna) {
    doc.setFontSize(8)
    doc.setTextColor(...COR_MUTED)
    doc.text(rotulo.toUpperCase(), x, y)
    doc.setFontSize(10.5)
    doc.setTextColor(...COR_TEXTO)
    doc.text(doc.splitTextToSize(String(valor), larguraColuna), x, y + 5)
  }

  function campoLongo(rotulo, valor) {
    doc.setFontSize(8)
    doc.setTextColor(...COR_MUTED)
    doc.text(rotulo.toUpperCase(), MARGEM, y)
    y += 5

    // A largura de quebra de linha precisa ser calculada já com o tamanho de fonte do valor
    // (splitTextToSize usa o fontSize atual do doc pra medir) — calculado antes trocar pra
    // este tamanho fazia o texto estourar a margem direita da página.
    doc.setFontSize(10.5)
    doc.setTextColor(...COR_TEXTO)
    const linhas = doc.splitTextToSize(String(valor), LARGURA_UTIL)
    novaPaginaSeNecessario(linhas.length * 5)
    doc.text(linhas, MARGEM, y)
    y += linhas.length * 5 + 5
  }

  cabecalho()

  if (registros.length === 0) {
    doc.setFontSize(11)
    doc.setTextColor(...COR_MUTED)
    doc.text('Nenhum registro cadastrado ainda.', MARGEM, y)
  }

  registros.forEach((registro, indice) => {
    novaPaginaSeNecessario(14)

    doc.setFillColor(...COR_PRIMARIA)
    doc.circle(MARGEM + 1, y - 1.3, 1.1, 'F')
    doc.setFontSize(11.5)
    doc.setFont(undefined, 'bold')
    doc.setTextColor(...COR_TEXTO)
    doc.text(`Registro de ${formatarDataHora(registro.data)}`, MARGEM + 5, y)
    doc.setFont(undefined, 'normal')
    y += 3
    doc.setDrawColor(...COR_BORDA)
    doc.line(MARGEM, y, LARGURA_PAGINA - MARGEM, y)
    y += 7

    const curtos = registro.campos.filter((c) => String(c.valor).length <= LIMITE_CAMPO_CURTO)
    const longos = registro.campos.filter((c) => String(c.valor).length > LIMITE_CAMPO_CURTO)

    const larguraColuna = LARGURA_UTIL / 2 - 6
    for (let i = 0; i < curtos.length; i += 2) {
      novaPaginaSeNecessario(11)
      campoCurto(curtos[i].rotulo, curtos[i].valor, MARGEM, larguraColuna)
      if (curtos[i + 1]) {
        campoCurto(curtos[i + 1].rotulo, curtos[i + 1].valor, MARGEM + LARGURA_UTIL / 2 + 6, larguraColuna)
      }
      y += 11
    }
    if (curtos.length > 0) y += 2

    longos.forEach((c) => campoLongo(c.rotulo, c.valor))

    if (indice < registros.length - 1) {
      y += 2
      novaPaginaSeNecessario(8)
      doc.setDrawColor(...COR_BORDA)
      doc.line(MARGEM, y, LARGURA_PAGINA - MARGEM, y)
      y += 10
    }
  })

  const totalPaginas = doc.internal.getNumberOfPages()
  for (let pagina = 1; pagina <= totalPaginas; pagina++) {
    doc.setPage(pagina)
    doc.setDrawColor(...COR_BORDA)
    doc.line(MARGEM, RODAPE_Y - 4, LARGURA_PAGINA - MARGEM, RODAPE_Y - 4)
    doc.setFontSize(8)
    doc.setTextColor(...COR_MUTED)
    doc.setFont(undefined, 'normal')
    doc.text(`MHI Fisio · ${titulo} · ${cliente.nome}`, MARGEM, RODAPE_Y)
    doc.text(`Página ${pagina} de ${totalPaginas}`, LARGURA_PAGINA - MARGEM, RODAPE_Y, { align: 'right' })
  }

  doc.save(`${paraNomeArquivo(titulo)}-${paraNomeArquivo(cliente.nome)}.pdf`)
}
