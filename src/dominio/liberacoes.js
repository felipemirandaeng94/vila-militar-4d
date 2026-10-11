// Liberações de camada (BLC) por frente: cada uma é emitida depois do último ensaio e do fim dos serviços vinculados
// naquela frente (incluindo a cura, quando houver).

export function montarLiberacoes(lista, svc, T, frentes) {
  const out = [];
  for (const l of lista) {
    const grupos = l.porFrente ? frentes.map(f => f.i) : [null];
    for (const f of grupos) {
      const ts = T.filter(t => l.servicos.includes(t.svc) && (f == null || t.f === f));
      const jans = svc.filter(s => l.servicos.includes(s.id)).flatMap(s => s.jan.filter(w => f == null || w.f === f));
      if (!jans.length) continue;
      out.push({
        id: f == null ? l.id : `${l.id}-F${f + 1}`,
        tipo: l.id,
        nome: l.nome,
        f,
        svc: l.servicos,
        day: Math.max(...ts.map(t => t.day), ...jans.map(w => (w.cura ? w.cura[1] : w.b))) + 0.04,
        n: ts.length
      });
    }
  }
  return out;
}

const doGate = g => t => g.svc.includes(t.svc) && (g.f == null || t.f === g.f);

// situação de uma liberação no dia d: emitida, em ensaio, com não conformidade aberta ou pendente
export function gateStatus(g, T, d) {
  const done = T.filter(t => doGate(g)(t) && t.day <= d);
  const last = {};
  for (const t of done) last[t.nome + '|' + (t.s ?? '') + '|' + (t.z ?? '')] = t;
  const open = Object.values(last).filter(t => !t.ok).length;
  if (d >= g.day) return { k: 'ok', txt: 'emitido', done: done.length, open };
  if (done.length) return { k: open ? 'bad' : 'run', txt: open ? 'não conformidade aberta' : 'em ensaio', done: done.length, open };
  return { k: 'pend', txt: 'pendente', done: 0, open };
}
