// Salvamento da missão, histórico de notas, tela de créditos (a partir de assets/CREDITOS.md) e progresso da carga.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { serializarPartida, validarPartida, registrarNota, historicoValido, lerJson, MAX_HISTORICO } from '../src/jogo/progresso.js';
import { markdownParaHtml, inline } from '../src/interface/markdown.js';
import { grupoDoArquivo, nomeDoArquivo, fracao } from '../src/carga.js';

// decisões no formato do jogo (só o necessário): D2 tem consequência na alternativa 1
const DECS = [
  { id: 'D1', ops: [{}, {}, {}] },
  { id: 'D2', ops: [{}, { later: { titulo: 'x' } }] },
  { id: 'D3', ops: [{}, {}] }
];
const partida = () => {
  const done = { D2: { i: 1, day: 12.4 }, D1: { i: 0, day: 0.35 } };
  return serializarPartida({ ordem: ['D1', 'D2'], done, eventos: [{ seen: true }], dia: 13.1, agora: new Date('2026-10-12T15:00:00Z') });
};

describe('partida salva', () => {
  it('serializa as escolhas na ordem, as consequências vistas e o dia', () => {
    const s = partida();
    expect(s.ordem).toEqual(['D1', 'D2']);
    expect(s.escolhas).toEqual({ D1: { i: 0, dia: 0.35 }, D2: { i: 1, dia: 12.4 } });
    expect(s.vistos).toEqual([true]);
    expect(s.dia).toBe(13.1);
    expect(s.salvoEm).toBe('2026-10-12T15:00:00.000Z');
  });
  it('volta igual depois de passar pelo JSON', () => {
    const s = partida();
    expect(validarPartida(lerJson(JSON.stringify(s)), DECS)).toEqual(s);
  });
  it('recusa partida de outra versão, com decisão removida ou alternativa inexistente', () => {
    const s = partida();
    expect(validarPartida({ ...s, versao: 99 }, DECS)).toBeNull();
    expect(
      validarPartida(
        s,
        DECS.filter(d => d.id !== 'D2')
      )
    ).toBeNull();
    expect(validarPartida({ ...s, escolhas: { ...s.escolhas, D1: { i: 7, dia: 1 } } }, DECS)).toBeNull();
    expect(validarPartida({ ...s, ordem: ['D1', 'D1'] }, DECS)).toBeNull();
    expect(validarPartida(null, DECS)).toBeNull();
    expect(validarPartida(lerJson('{corrompido', null), DECS)).toBeNull();
  });
  it('ajusta a lista de consequências vistas ao número de consequências', () => {
    const s = partida();
    expect(validarPartida({ ...s, vistos: [] }, DECS).vistos).toEqual([false]);
    expect(validarPartida({ ...s, vistos: [true, true, true] }, DECS).vistos).toEqual([true]);
  });
});

describe('histórico de notas', () => {
  it('guarda a mais recente primeiro, descarta entradas inválidas e limita o tamanho', () => {
    let h = lerJson('[{"nota":"x"}, {"data":"2026-10-01T10:00:00Z","nota":7.2}]', []);
    expect(historicoValido(h)).toHaveLength(1);
    h = registrarNota(h, { data: '2026-10-12T10:00:00Z', nota: 8.4, conceito: 'Muito bom' });
    expect(h.map(x => x.nota)).toEqual([8.4, 7.2]);
    for (let i = 0; i < MAX_HISTORICO + 5; i++) h = registrarNota(h, { data: '2026-10-12T11:00:00Z', nota: i });
    expect(h).toHaveLength(MAX_HISTORICO);
    expect(h[0].nota).toBe(MAX_HISTORICO + 4);
  });
  it('histórico ausente ou corrompido vira lista vazia', () => {
    expect(historicoValido(lerJson(null, []))).toEqual([]);
    expect(historicoValido(lerJson('nada', []))).toEqual([]);
    expect(historicoValido({ nota: 3 })).toEqual([]);
  });
});

describe('tela de créditos', () => {
  const md = fs.readFileSync(new URL('../assets/CREDITOS.md', import.meta.url), 'utf8');
  const { html, titulo } = markdownParaHtml(md);
  it('mostra todas as linhas de todas as tabelas de assets/CREDITOS.md', () => {
    const linhasMd = md.split(/\r?\n/).filter(l => l.trim().startsWith('|') && !/^\|\s*:?-{3,}/.test(l.trim()));
    const linhasHtml = html.match(/<tr>/g) || [];
    expect(linhasHtml.length).toBe(linhasMd.length);
    expect(titulo).toBe('Créditos e licenças dos recursos externos');
  });
  it('tem os créditos obrigatórios e as fontes de cada grupo de recursos', () => {
    for (const t of [
      '© colaboradores do OpenStreetMap',
      'ODbL',
      'Prefeitura da Cidade do Rio de Janeiro – Instituto Pereira Passos',
      'Poly Haven',
      'CC0 1.0',
      'Freesound',
      'Tripo AI',
      'SIL Open Font License 1.1',
      'Three.js'
    ])
      expect(html).toContain(t);
  });
  it('escapa HTML e transforma endereços em links', () => {
    expect(inline('a <b> & `x<y>`')).toBe('a &lt;b&gt; &amp; <code>x&lt;y&gt;</code>');
    expect(inline('ver https://polyhaven.com/a/farm_soil (download)')).toContain(
      '<a href="https://polyhaven.com/a/farm_soil" target="_blank" rel="noopener noreferrer">'
    );
    expect(inline('fim: https://freesound.org/x/.')).toContain('href="https://freesound.org/x/"');
  });
  it('converte títulos, listas e parágrafos', () => {
    const r = markdownParaHtml('# T\n\n## Seção\n\nTexto\ncontinua.\n\n- um\n- dois\n\n### Sub').html;
    expect(r).toBe('<h3>Seção</h3>\n<p>Texto continua.</p>\n<ul><li>um</li><li>dois</li></ul>\n<h4>Sub</h4>');
  });
});

describe('progresso da carga', () => {
  it('agrupa os arquivos pela pasta e mede a fração de arquivos', () => {
    expect(grupoDoArquivo('./modelos/usina-cbuq_lod0.glb')).toBe('Modelos 3D dos equipamentos');
    expect(grupoDoArquivo('./modelos/arvores/jacaranda.glb')).toBe('Árvores');
    expect(grupoDoArquivo('./texturas/brita/1k/cor.webp')).toBe('Texturas do terreno e do pavimento');
    expect(grupoDoArquivo('./local/eixo.json')).toBe('Dados do local (OpenStreetMap e IPP)');
    expect(grupoDoArquivo('./hdri/ceu_2k.hdr')).toBe('Céu HDRI');
    expect(grupoDoArquivo('blob:http://localhost/1b2c')).toBe('Texturas dos modelos 3D');
    expect(nomeDoArquivo('./modelos/caminh%C3%A3o.glb?v=1')).toBe('caminhão.glb');
    expect(fracao(3, 4)).toBe(0.75);
    expect(fracao(0, 0)).toBe(1);
  });
});
