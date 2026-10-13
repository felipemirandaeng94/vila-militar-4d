// Utilitários de DOM e acesso aos dados de apresentação.
import { M, D } from '../estado.js';

export const $ = id => document.getElementById(id);
export const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
export const svcById = id => M.svc.find(s => s.id === id);
// nome curto do serviço (rótulos, abas e decisões)
export const curto = id => {
  const s = svcById(id);
  return s && s.meta ? s.meta.curto : undefined;
};
export const corGrupo = g => D.servicos.grupos[g].cor;

// armazenamento local tolerante a bloqueio (janela privada, navegador restrito)
export const lsGet = k => {
  try {
    return localStorage.getItem(k);
  } catch (e) {
    return null;
  }
};
export const lsSet = (k, v) => {
  try {
    localStorage.setItem(k, v);
  } catch (e) {}
};
export const lsDel = k => {
  try {
    localStorage.removeItem(k);
  } catch (e) {}
};
// data e hora locais de um instante ISO (histórico de notas, partida salva)
export const dataHora = iso => {
  const d = new Date(iso);
  return isNaN(d) ? '—' : d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
};
