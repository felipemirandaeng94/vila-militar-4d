// Aba "Contexto e normas": obra militar, cadeia de liberação e normas utilizadas.
import { D } from '../../estado.js';
import { esc } from '../dom.js';

export function tabCtx() {
  const OBRA = D.obra.obra;
  const flow = [
    'Execução da camada',
    'Ensaios de campo (laboratório)',
    'Análise do engenheiro residente',
    'Não conformidade? Retrabalho e reensaio',
    'Fiscalização assina o BLC',
    'Próxima camada liberada'
  ];
  return `<div class="pane-head"><h2>Contexto da obra militar</h2><p>${esc(OBRA.local)}. A via interna liga duas ruas existentes da Vila Militar e foi projetada para o tráfego de ${esc(OBRA.trafego)}.</p></div>
  <div class="flow">${flow.map((f, i) => `<div class="fstep${i === 3 ? ' warn' : ''}"><b>${i + 1}</b>${esc(f)}</div>`).join('<span class="farr">→</span>')}</div>
  <div class="masonry">${D.obra.contexto.map(c => `<div class="ccard"><h4>${esc(c.titulo)}</h4><p class="csub">${esc(c.texto)}</p></div>`).join('')}</div>
  <h3 class="h3">Normas utilizadas</h3><div class="tbl"><table><thead><tr><th>Norma</th><th>Título</th><th>Aplicação no modelo</th></tr></thead><tbody>${D.normas.referencias.map(n => `<tr><td class="m">${n.norma}</td><td>${esc(n.titulo)}</td><td>${esc(n.aplicacao)}</td></tr>`).join('')}</tbody></table></div>
  <p class="note">Modelo didático. Terreno, quantidades e resultados de ensaio são ilustrativos, gerados de forma coerente com os critérios das especificações citadas. Não substituem o projeto executivo nem o plano de controle da obra real. Confirme sempre a revisão vigente de cada norma na coletânea do DNIT.</p>`;
}
