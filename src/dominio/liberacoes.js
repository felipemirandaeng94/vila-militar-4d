// Liberações de camada (BLC): cada uma é emitida depois do último ensaio e do fim dos serviços vinculados.

export function montarLiberacoes(lista, svc, T) {
  return lista.map(l => {
    const ts = T.filter(t => l.servicos.includes(t.svc));
    const sv = l.servicos.map(id => svc.find(s => s.id === id)).filter(Boolean);
    return {
      id: l.id,
      nome: l.nome,
      svc: l.servicos,
      day: Math.max(...ts.map(t => t.day), ...sv.map(s => (s.cura ? s.cura[1] : s.b))) + 0.04,
      n: ts.length,
      svcs: sv
    };
  });
}

// situação de uma liberação no dia d: emitida, em ensaio, com não conformidade aberta ou pendente
export function gateStatus(g, T, d) {
  const done = T.filter(t => g.svc.includes(t.svc) && t.day <= d);
  const last = {};
  for (const t of done) last[t.nome + '|' + (t.s ?? '') + '|' + (t.z ?? '')] = t;
  const open = Object.values(last).filter(t => !t.ok).length;
  if (d >= g.day) return { k: 'ok', txt: 'emitido', done: done.length, open };
  if (done.length) return { k: open ? 'bad' : 'run', txt: open ? 'não conformidade aberta' : 'em ensaio', done: done.length, open };
  return { k: 'pend', txt: 'pendente', done: 0, open };
}
