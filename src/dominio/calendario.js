// Calendário da obra em dias úteis e formatação de datas, horas e estacas.
import { P } from './geometria.js';

const CAL = { ano: 2027, mes: 4, dia: 3, horaInicio: 7, horasPorDia: 10 };
export function configurarCalendario(obra) {
  const [a, m, d] = obra.calendario.inicio.split('-').map(Number);
  Object.assign(CAL, { ano: a, mes: m - 1, dia: d, horaInicio: obra.calendario.horaInicio, horasPorDia: obra.calendario.horasPorDia });
}

const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
// dia útil 0 = data de início; sábados e domingos são pulados
export function dateOf(d) {
  const w = Math.floor(d);
  const dt = new Date(CAL.ano, CAL.mes, CAL.dia);
  let n = 0;
  while (n < w) {
    dt.setDate(dt.getDate() + 1);
    const k = dt.getDay();
    if (k !== 0 && k !== 6) n++;
  }
  return dt;
}
export function fmtDate(d, wd = true) {
  const dt = dateOf(d);
  const s = String(dt.getDate()).padStart(2, '0') + '/' + String(dt.getMonth() + 1).padStart(2, '0') + '/' + dt.getFullYear();
  return wd ? DIAS[dt.getDay()] + ' ' + s : s;
}
export function fmtHourM(d) {
  const f = d - Math.floor(d);
  const m = Math.round((CAL.horaInicio + f * CAL.horasPorDia) * 60);
  return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
}
export function fmtHour(d) {
  const f = d - Math.floor(d);
  const h = CAL.horaInicio + f * CAL.horasPorDia;
  const hh = Math.floor(h),
    mm = Math.round(((h - hh) * 60) / 15) * 15;
  return String(hh + (mm === 60 ? 1 : 0)).padStart(2, '0') + ':' + String(mm % 60).padStart(2, '0');
}
export const estStr = s => {
  const e = Math.floor(s / P.EST + 1e-9),
    r = s - e * P.EST;
  return e + '+' + r.toFixed(r % 1 ? 1 : 0).padStart(2, '0');
};
