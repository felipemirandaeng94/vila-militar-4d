// Conversão do Markdown simples de assets/CREDITOS.md para HTML (tela de créditos): títulos, parágrafos, listas,
// tabelas, código, negrito e endereços da web como links. Função pura, sem dependências.

const escapar = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// texto de uma linha: código entre crases, negrito e links (o texto já sai escapado)
export function inline(txt) {
  return txt
    .split(/(`[^`]*`)/)
    .map(parte => {
      if (parte.startsWith('`') && parte.endsWith('`') && parte.length > 1) return `<code>${escapar(parte.slice(1, -1))}</code>`;
      return escapar(parte)
        .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
        .replace(/https?:\/\/[^\s<>()"]+[^\s<>()".,;:]/g, url => `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`);
    })
    .join('');
}

const celulas = linha =>
  linha
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map(c => c.trim());

/**
 * Converte o Markdown em HTML. nivelBase: nível do título "##" (o "#" é omitido; a tela tem o próprio título).
 * Devolve { html, titulo } com o texto do título "#".
 */
export function markdownParaHtml(md, nivelBase = 3) {
  const linhas = md.replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  let titulo = '';
  let par = [];
  const fecharPar = () => {
    if (par.length) out.push(`<p>${inline(par.join(' '))}</p>`);
    par = [];
  };
  for (let i = 0; i < linhas.length; i++) {
    const l = linhas[i];
    const t = l.trim();
    const h = /^(#{1,6})\s+(.*)$/.exec(t);
    if (!t) {
      fecharPar();
    } else if (h) {
      fecharPar();
      if (h[1].length === 1) titulo = h[2];
      else {
        const n = Math.min(6, nivelBase + h[1].length - 2);
        out.push(`<h${n}>${inline(h[2])}</h${n}>`);
      }
    } else if (t.startsWith('|')) {
      fecharPar();
      const bloco = [];
      while (i < linhas.length && linhas[i].trim().startsWith('|')) bloco.push(linhas[i++].trim());
      i--;
      const [cab, sep, ...corpo] = bloco;
      const temCab = sep && /^\|?\s*:?-{3,}/.test(sep);
      const linhasCorpo = temCab ? corpo : bloco;
      out.push(
        `<div class="tbl"><table>${
          temCab
            ? `<thead><tr>${celulas(cab)
                .map(c => `<th scope="col">${inline(c)}</th>`)
                .join('')}</tr></thead>`
            : ''
        }<tbody>${linhasCorpo
          .map(
            r =>
              `<tr>${celulas(r)
                .map(c => `<td>${inline(c)}</td>`)
                .join('')}</tr>`
          )
          .join('')}</tbody></table></div>`
      );
    } else if (/^[-*]\s+/.test(t)) {
      fecharPar();
      const itens = [];
      while (i < linhas.length && /^[-*]\s+/.test(linhas[i].trim())) itens.push(linhas[i++].trim().replace(/^[-*]\s+/, ''));
      i--;
      out.push(`<ul>${itens.map(x => `<li>${inline(x)}</li>`).join('')}</ul>`);
    } else par.push(t);
  }
  fecharPar();
  return { html: out.join('\n'), titulo };
}
