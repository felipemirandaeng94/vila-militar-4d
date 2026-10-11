"""Identifica a via existente entre o início e o fim do trecho e gera o eixo.

Uso:
  python tracado.py                 # lista os caminhos plausíveis e gera o mapa
  python tracado.py --opcao 1 --confirmar
                                    # grava public/local/eixo.json e atualiza dados/local.json

O ajuste de cada ponto ao segmento de via mais próximo é relatado; acima de
15 m o script para e pede confirmação (--aceitar-ajuste).
"""
import argparse
import json
import math
import sys

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import networkx as nx
import numpy as np
from shapely.geometry import LineString, Point

from comum import BRUTOS, LOCAL_JSON, SAIDA, TMP, SistemaLocal, gravar_json, ler_local

VEICULARES = {
    "motorway", "motorway_link", "trunk", "trunk_link", "primary", "primary_link",
    "secondary", "secondary_link", "tertiary", "tertiary_link", "unclassified",
    "residential", "living_street", "service", "road",
}
LIMITE_AJUSTE_M = 15.0
PASSO_EIXO_M = 2.0
ESTACA_M = 20.0
SUAVIZACAO_M = 12.0  # meia janela da média móvel (concordância das esquinas)


def carregar_vias(sl):
    d = json.loads((BRUTOS / "osm.json").read_text(encoding="utf-8"))
    vias = []
    for e in d["elements"]:
        t = e.get("tags", {})
        if e["type"] != "way" or t.get("highway") not in VEICULARES or "geometry" not in e:
            continue
        pts = [sl.geo_para_local(g["lon"], g["lat"]) for g in e["geometry"]]
        # nós compartilhados têm coordenadas idênticas; a chave é a coordenada
        nos = e.get("nodes") or [f"{g['lat']:.7f},{g['lon']:.7f}" for g in e["geometry"]]
        vias.append({"id": e["id"], "nos": nos, "pts": pts, "tags": t})
    return vias


def montar_grafo(vias):
    G = nx.Graph()
    for v in vias:
        for k in range(len(v["pts"]) - 1):
            a, b = v["nos"][k], v["nos"][k + 1]
            pa, pb = v["pts"][k], v["pts"][k + 1]
            G.add_node(a, xy=pa)
            G.add_node(b, xy=pb)
            G.add_edge(a, b, w=math.dist(pa, pb), via=v["id"])
    return G


def ajustar(G, vias, p, rotulo):
    """Projeta o ponto no segmento mais próximo e insere um nó virtual."""
    melhor = None
    for v in vias:
        for k in range(len(v["pts"]) - 1):
            seg = LineString([v["pts"][k], v["pts"][k + 1]])
            d = seg.distance(Point(p))
            if melhor is None or d < melhor[0]:
                melhor = (d, v, k, seg)
    d, v, k, seg = melhor
    q = seg.interpolate(seg.project(Point(p)))
    no = f"P_{rotulo}"
    a, b = v["nos"][k], v["nos"][k + 1]
    G.add_node(no, xy=(q.x, q.y))
    G.add_edge(no, a, w=math.dist((q.x, q.y), v["pts"][k]), via=v["id"])
    G.add_edge(no, b, w=math.dist((q.x, q.y), v["pts"][k + 1]), via=v["id"])
    return no, d, v


def comprimento(G, cam):
    return sum(math.dist(G.nodes[a]["xy"], G.nodes[b]["xy"]) for a, b in zip(cam, cam[1:]))


def caminhos(G, s, t, n=5, fator=1.35):
    """Caminho mais curto e alternativas distintas até `fator` vezes a extensão."""
    res = []
    vistos = 0
    for cam in nx.shortest_simple_paths(G, s, t, weight="w"):
        vistos += 1
        L = comprimento(G, cam)
        if res and L > res[0]["L"] * fator:
            break
        arestas = set(frozenset(e) for e in zip(cam, cam[1:]))
        # descarta variações quase idênticas (>80 % das arestas em comum)
        if any(len(arestas & r["arestas"]) / max(len(arestas), 1) > 0.8 for r in res):
            if vistos > 400:
                break
            continue
        res.append({"nos": cam, "L": L, "arestas": arestas})
        if len(res) >= n:
            break
    return res


def nomes_do_caminho(G, cam, por_id):
    trechos = []
    for a, b in zip(cam["nos"], cam["nos"][1:]):
        v = por_id[G[a][b]["via"]]
        nome = v["tags"].get("name") or f"sem nome ({v['tags']['highway']})"
        L = math.dist(G.nodes[a]["xy"], G.nodes[b]["xy"])
        if trechos and trechos[-1]["nome"] == nome:
            trechos[-1]["m"] += L
            trechos[-1]["ids"].add(v["id"])
        else:
            trechos.append({"nome": nome, "m": L, "ids": {v["id"]},
                            "tipo": v["tags"]["highway"], "superficie": v["tags"].get("surface"),
                            "acesso": v["tags"].get("access")})
    return trechos


def reamostrar(pts, passo):
    ls = LineString(pts)
    n = max(2, int(round(ls.length / passo)) + 1)
    return np.array([ls.interpolate(s).coords[0] for s in np.linspace(0, ls.length, n)])


def suavizar(xy, passo, meia_janela_m, passes=3):
    """Média móvel repetida (aproxima concordâncias circulares nas esquinas)."""
    k = max(1, int(round(meia_janela_m / passo)))
    out = xy.copy()
    for _ in range(passes):
        pad = np.vstack([np.repeat(out[:1], k, 0), out, np.repeat(out[-1:], k, 0)])
        ker = np.ones(2 * k + 1) / (2 * k + 1)
        out = np.column_stack([np.convolve(pad[:, 0], ker, "valid"), np.convolve(pad[:, 1], ker, "valid")])
        out[0], out[-1] = xy[0], xy[-1]
    return out


def curvas(xy, limiar_graus_por_20m=1.0):
    """Trechos em curva: variação de rumo acima do limiar. Raio ≈ desenvolvimento / deflexão."""
    d = np.diff(xy, axis=0)
    seg = np.hypot(d[:, 0], d[:, 1])
    s = np.concatenate([[0], np.cumsum(seg)])
    rumo = np.unwrap(np.arctan2(d[:, 1], d[:, 0]))
    passo = seg.mean()
    w = max(1, int(round(10 / passo)))
    taxa = np.zeros_like(rumo)
    for i in range(len(rumo)):
        a, b = max(0, i - w), min(len(rumo) - 1, i + w)
        taxa[i] = (rumo[b] - rumo[a]) / max(s[b] - s[a], 1e-6)
    lim = math.radians(limiar_graus_por_20m) / 20
    res, i = [], 0
    while i < len(taxa):
        if abs(taxa[i]) > lim:
            j = i
            while j + 1 < len(taxa) and abs(taxa[j + 1]) > lim and np.sign(taxa[j + 1]) == np.sign(taxa[i]):
                j += 1
            deflexao = rumo[j] - rumo[i]
            dev = s[j + 1] - s[i]
            if abs(math.degrees(deflexao)) >= 2 and dev > 0:
                res.append({
                    "ini_m": round(float(s[i]), 1), "fim_m": round(float(s[j + 1]), 1),
                    "deflexao_graus": round(math.degrees(deflexao), 1),
                    "lado": "esquerda" if deflexao > 0 else "direita",
                    "raio_aprox_m": round(float(dev / abs(deflexao)), 0),
                })
            i = j + 1
        else:
            i += 1
    return res, s


def mapa(G, vias, cams, ini, fim, arquivo):
    fig, ax = plt.subplots(figsize=(13, 8), dpi=110)
    for v in vias:
        p = np.array(v["pts"])
        ax.plot(p[:, 0], p[:, 1], color="#bbb", lw=0.8, zorder=1)
        nome = v["tags"].get("name")
        if nome and len(p) > 1:
            m = p[len(p) // 2]
            ax.text(m[0], m[1], nome, fontsize=5.5, color="#777", zorder=2)
    cores = ["#d62728", "#1f77b4", "#2ca02c", "#9467bd", "#ff7f0e"]
    for i, c in enumerate(cams):
        p = np.array([G.nodes[n]["xy"] for n in c["nos"]])
        ax.plot(p[:, 0], p[:, 1], color=cores[i % 5], lw=max(1.2, 5 - i), alpha=0.8, zorder=8 - i,
                label=f"Opção {i + 1}: {c['L']:.0f} m")
    ax.plot(*ini, "ko", ms=8, zorder=10)
    ax.annotate("INÍCIO", ini, xytext=(8, -14), textcoords="offset points", weight="bold")
    ax.plot(*fim, "ks", ms=8, zorder=10)
    ax.annotate("FIM", fim, xytext=(8, 6), textcoords="offset points", weight="bold")
    ax.set_aspect("equal")
    ax.set_xlabel("x local (m), direção início → fim")
    ax.set_ylabel("y local (m)")
    ax.legend(loc="lower right")
    ax.set_title("Traçado candidato · vias © colaboradores do OpenStreetMap (ODbL)")
    ax.grid(alpha=0.3)
    fig.tight_layout()
    fig.savefig(arquivo)
    plt.close(fig)


def mapa_faixa(G, vias, cams, ini, fim, arquivo, painel=420, meia=90):
    """Faixa do traçado em painéis de `painel` m, com edificações, para conferir o lado da via."""
    import json as _j
    from comum import BRUTOS as _B
    sl = SistemaLocal()
    predios = []
    for e in _j.loads((_B / "osm.json").read_text(encoding="utf-8"))["elements"]:
        if e["type"] == "way" and "building" in e.get("tags", {}) and "geometry" in e:
            predios.append(np.array([sl.geo_para_local(g["lon"], g["lat"]) for g in e["geometry"]]))
    n = int(math.ceil((fim[0] + 60) / painel))
    fig, axs = plt.subplots(n, 1, figsize=(14, 3.2 * n), dpi=100)
    cores = ["#d62728", "#1f77b4", "#2ca02c", "#9467bd", "#ff7f0e"]
    for k, ax in enumerate(axs):
        x0 = -40 + k * painel
        for p in predios:
            ax.fill(p[:, 0], p[:, 1], color="#e5c9a8", ec="#a07850", lw=0.5)
        for v in vias:
            p = np.array(v["pts"])
            ax.plot(p[:, 0], p[:, 1], color="#999", lw=1)
            nome = v["tags"].get("name") or f"({v['tags']['highway']}, id {v['id']})"
            dentro = [q for q in p if x0 < q[0] < x0 + painel and -meia < q[1] < meia]
            if dentro:
                q = dentro[len(dentro) // 2]
                ax.text(q[0], q[1] + 2, nome, fontsize=6, color="#555")
        for i, c in enumerate(cams):
            p = np.array([G.nodes[m]["xy"] for m in c["nos"]])
            ax.plot(p[:, 0], p[:, 1], color=cores[i % 5], lw=max(1.2, 4 - i), alpha=0.8, label=f"Opção {i + 1}")
        ax.plot(*ini, "ko")
        ax.plot(*fim, "ks")
        ax.set_xlim(x0, x0 + painel)
        ax.set_ylim(-meia, meia)
        ax.set_aspect("equal")
        ax.grid(alpha=0.3)
        if k == 0:
            ax.legend(loc="upper left", fontsize=7)
    axs[0].set_title("Faixa do traçado (x local, m) · © colaboradores do OpenStreetMap (ODbL)")
    fig.tight_layout()
    fig.savefig(arquivo)
    plt.close(fig)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--opcao", type=int, default=1)
    ap.add_argument("--confirmar", action="store_true")
    ap.add_argument("--aceitar-ajuste", action="store_true")
    ap.add_argument("--preferir", default="", help="ids OSM das vias do corredor; as demais ficam penalizadas")
    ap.add_argument("--rotulo", default="opcoes")
    args = ap.parse_args()

    local = ler_local()
    sl = SistemaLocal(local)
    vias = carregar_vias(sl)
    preferidas = {int(x) for x in args.preferir.split(",") if x}
    por_id = {v["id"]: v for v in vias}
    G = montar_grafo(vias)
    ini = sl.geo_para_local(local["inicio"]["lon"], local["inicio"]["lat"])
    fim = sl.geo_para_local(local["fim"]["lon"], local["fim"]["lat"])
    print(f"Sistema local: azimute do eixo X {sl.azimute_graus:.1f}°, distância reta {sl.distancia_reta:.0f} m")

    alvo = [v for v in vias if v["id"] in preferidas] or vias
    s, ds, vs = ajustar(G, alvo, ini, "ini")
    t, dt, vt = ajustar(G, alvo, fim, "fim")
    if preferidas:
        # conectores curtos (cruzamentos) entram sem penalidade; o resto custa 20 vezes mais
        for a, b, dd in G.edges(data=True):
            if dd["via"] not in preferidas and len(por_id[dd["via"]]["pts"]) and                     LineString(por_id[dd["via"]]["pts"]).length > 40:
                dd["w"] *= 20
    print(f"Ajuste do início: {ds:.1f} m até {vs['tags'].get('name', 'via sem nome')} ({vs['tags']['highway']})")
    print(f"Ajuste do fim:    {dt:.1f} m até {vt['tags'].get('name', 'via sem nome')} ({vt['tags']['highway']})")
    if max(ds, dt) > LIMITE_AJUSTE_M and not args.aceitar_ajuste:
        print(f"Ajuste acima de {LIMITE_AJUSTE_M:.0f} m: confirme com o usuário e rode com --aceitar-ajuste.")
        return 2

    cams = caminhos(G, s, t)
    TMP.mkdir(parents=True, exist_ok=True)
    for i, c in enumerate(cams):
        print(f"\nOpção {i + 1}: {c['L']:.0f} m")
        for tr in nomes_do_caminho(G, c, por_id):
            extra = ", ".join(x for x in [tr["tipo"], tr["superficie"] or "", f"acesso {tr['acesso']}" if tr["acesso"] else ""] if x)
            print(f"   {tr['m']:7.0f} m  {tr['nome']}  [{extra}]")
    mapa(G, vias, cams, ini, fim, TMP / f"tracado_{args.rotulo}.png")
    mapa_faixa(G, vias, cams[:1], ini, fim, TMP / f"tracado_{args.rotulo}_faixa.png")
    print(f"\nMapas: geo/tmp/tracado_{args.rotulo}.png e tracado_{args.rotulo}_faixa.png")

    if not args.confirmar:
        return 0
    c = cams[args.opcao - 1]
    bruto = [G.nodes[n]["xy"] for n in c["nos"]]
    xy = suavizar(reamostrar(bruto, PASSO_EIXO_M), PASSO_EIXO_M, SUAVIZACAO_M)
    xy = reamostrar(xy, PASSO_EIXO_M)
    cv, s_acum = curvas(xy)
    L = float(s_acum[-1])
    desvio = max(LineString(bruto).distance(Point(p)) for p in xy)
    trechos = nomes_do_caminho(G, c, por_id)
    nomes = []
    for tr in trechos:
        if tr["nome"] not in nomes:
            nomes.append(tr["nome"])
    ls = LineString(xy)
    estacas = []
    for k in range(int(L // ESTACA_M) + 1):
        p = ls.interpolate(k * ESTACA_M)
        estacas.append({"estaca": k, "s": k * ESTACA_M, "x": round(p.x, 2), "y": round(p.y, 2)})
    eixo = {
        "descricao": "Eixo da obra sobre o traçado da via existente (OpenStreetMap), suavizado nas esquinas.",
        "sistema": sl.meta(),
        "extensao_m": round(L, 1),
        "passo_m": PASSO_EIXO_M,
        "vias": nomes,
        "trechos": [{"nome": tr["nome"], "extensao_m": round(tr["m"], 1), "tipo": tr["tipo"],
                     "osm_ids": sorted(tr["ids"])} for tr in trechos],
        "ajuste_m": {"inicio": round(ds, 1), "fim": round(dt, 1)},
        "desvio_max_suavizacao_m": round(desvio, 2),
        "pontos": [[round(float(x), 2), round(float(y), 2)] for x, y in xy],
        "estacas": estacas,
        "curvas": cv,
        "fonte": "© colaboradores do OpenStreetMap (ODbL)",
    }
    gravar_json(SAIDA / "eixo.json", eixo)
    local["via"] = " / ".join(nomes)
    local["extensao_medida_m"] = round(L, 1)
    local["observacoes"] = (local["observacoes"].split(" A extensão real")[0].split(" Extensão medida")[0] +
                            f" Extensão medida sobre o eixo da via existente (OpenStreetMap, Fase 3): {L:.1f} m.")
    LOCAL_JSON.write_text(json.dumps(local, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"\nGravado public/local/eixo.json: {L:.1f} m, {len(xy)} pontos, {len(cv)} curvas, "
          f"desvio máx. da suavização {desvio:.1f} m")
    for k in cv:
        print(f"   curva {k['ini_m']:.0f}-{k['fim_m']:.0f} m: {k['deflexao_graus']}° à {k['lado']}, "
              f"R ≈ {k['raio_aprox_m']:.0f} m")
    return 0


if __name__ == "__main__":
    sys.exit(main())
