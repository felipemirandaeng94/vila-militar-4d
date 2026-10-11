"""Procura áreas livres para o canteiro e a usina perto do início do trecho.

Livre = sem edificações (IPP 2019 e OSM), sem vias (com folga de 3 m), sem
quadras, piscinas, água ou mata no OSM. O retângulo fica alinhado ao eixo.

Uso:
  python canteiro.py                     # lista as opções e gera geo/tmp/canteiro_opcoes.png
  python canteiro.py --fixar 1           # grava a opção em geo/tmp/canteiro.json (lido por gerar_cena.py)
"""
import argparse
import json
import sys

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from shapely.geometry import LineString, Polygon, box
from shapely.ops import unary_union
from shapely.strtree import STRtree

from comum import BRUTOS, SAIDA, TMP, SistemaLocal

COMPRIMENTO, LARGURA = 135.0, 72.0  # área do canteiro da Fase 2B (9.720 m²)
BLOQUEIOS_OSM = {("leisure", "pitch"), ("leisure", "swimming_pool"), ("leisure", "stadium"),
                 ("natural", "water"), ("leisure", "sports_centre")}
# mata ou campo não bloqueiam: exigem limpeza (DNIT 104/2009-ES, restrita às áreas do canteiro)
FORMATOS = [(135.0, 72.0), (72.0, 135.0), (110.0, 90.0), (90.0, 110.0)]


def obstaculos(sl):
    obs, rot = [], []
    d = json.loads((BRUTOS / "osm.json").read_text(encoding="utf-8"))
    for e in d["elements"]:
        t = e.get("tags", {})
        if e["type"] != "way" or "geometry" not in e:
            continue
        pts = [sl.geo_para_local(g["lon"], g["lat"]) for g in e["geometry"]]
        if "building" in t and len(pts) >= 4:
            obs.append(Polygon(pts).buffer(2))
            rot.append("edificação (OSM)")
        elif "highway" in t and t["highway"] not in ("footway", "steps", "bridleway", "path"):
            obs.append(LineString(pts).buffer(3 + (6 if t["highway"] in ("primary", "motorway", "busway") else 3)))
            rot.append("via")
        elif "railway" in t and t["railway"] != "abandoned":
            obs.append(LineString(pts).buffer(8))
            rot.append("ferrovia")
        elif any((k, t.get(k)) in BLOQUEIOS_OSM for k in ("leisure", "natural")) and len(pts) >= 4:
            obs.append(Polygon(pts).buffer(0))
            rot.append("quadra, água ou mata")
    f = BRUTOS / "ipp_edificacoes.json"
    if f.exists():
        for ft in json.loads(f.read_text(encoding="utf-8"))["features"]:
            anel = [sl.utm_para_local(x, y) for x, y in ft["geometry"]["rings"][0]]
            if len(anel) >= 4:
                obs.append(Polygon(anel).buffer(2))
                rot.append("edificação (IPP)")
    return obs, rot


def usos_osm(sl, poly):
    usos = set()
    d = json.loads((BRUTOS / "osm.json").read_text(encoding="utf-8"))
    for e in d["elements"]:
        t = e.get("tags", {})
        if e["type"] == "way" and "geometry" in e and ("landuse" in t or "leisure" in t or "natural" in t):
            pts = [sl.geo_para_local(g["lon"], g["lat"]) for g in e["geometry"]]
            if len(pts) >= 4 and Polygon(pts).buffer(0).intersects(poly):
                usos.add(t.get("landuse") or t.get("leisure") or t.get("natural"))
    return sorted(usos)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--fixar", type=int, default=0)
    args = ap.parse_args()
    sl = SistemaLocal()
    eixo = json.loads((SAIDA / "eixo.json").read_text(encoding="utf-8"))
    p0 = np.array(eixo["pontos"][0])
    obs, rot = obstaculos(sl)
    arvore = STRtree(obs)
    cands = []
    for comp, larg in FORMATOS:
        for cx in np.arange(-280, 420, 5.0):
            for cy in np.arange(-300, 300, 5.0):
                r = box(cx - comp / 2, cy - larg / 2, cx + comp / 2, cy + larg / 2)
                if len(arvore.query(r, predicate="intersects")):
                    continue
                # distância da borda do retângulo ao início do eixo
                d = r.distance(LineString([p0, p0 + [0.01, 0]]))
                cands.append((d, cx, cy, r, comp, larg))
    cands.sort(key=lambda c: c[0])
    escolhidas = []
    for c in cands:
        if all(not c[3].buffer(30).intersects(e[3]) for e in escolhidas):
            escolhidas.append(c)
        if len(escolhidas) == 3:
            break
    opcoes = []
    for i, (d, cx, cy, r, comp, larg) in enumerate(escolhidas):
        lado = "esquerda (norte)" if cy > p0[1] else "direita (sul)"
        lon, lat = sl.local_para_geo(cx, cy)
        o = {"opcao": i + 1, "centro_local": [float(cx), float(cy)], "dimensoes_m": [comp, larg],
             "rotacao_graus": 0.0, "distancia_ao_inicio_m": round(float(d), 0), "lado": lado,
             "centro_geo": [round(lat, 6), round(lon, 6)], "uso_osm": usos_osm(sl, r)}
        opcoes.append(o)
        print(f"Opção {i + 1}: {comp:.0f} x {larg:.0f} m, centro local ({cx:.0f}, {cy:.0f}) m, {lado} do eixo, borda a {d:.0f} m do início; "
              f"centro {lat:.6f}, {lon:.6f}; uso no OSM: {', '.join(o['uso_osm']) or 'sem classificação'}")
    fig, ax = plt.subplots(figsize=(12, 8), dpi=110)
    for g, rr in zip(obs, rot):
        if g.intersects(box(-300, -320, 500, 320)):
            polys = [g] if g.geom_type == "Polygon" else list(g.geoms)
            for pg in polys:
                xs, ys = pg.exterior.xy
                ax.fill(xs, ys, color="#c9a27a" if "edifica" in rr else "#bbbbbb" if rr == "via" else "#9fc59a",
                        alpha=0.8, lw=0)
    e = np.array(eixo["pontos"])
    ax.plot(e[:, 0], e[:, 1], "r-", lw=2, label="eixo (Av. Duque de Caxias)")
    ax.plot(*p0, "ko")
    for o, c in zip(opcoes, ["#1f77b4", "#2ca02c", "#9467bd"]):
        cx, cy = o["centro_local"]
        comp, larg = o["dimensoes_m"]
        ax.add_patch(plt.Rectangle((cx - comp / 2, cy - larg / 2), comp, larg,
                                   fill=False, ec=c, lw=2.5, label=f"Opção {o['opcao']}"))
        ax.text(cx, cy, str(o["opcao"]), color=c, fontsize=16, weight="bold", ha="center", va="center")
    for e in json.loads((BRUTOS / "osm.json").read_text(encoding="utf-8"))["elements"]:
        t = e.get("tags", {})
        if e["type"] == "way" and "geometry" in e and t.get("natural") == "wood":
            q = np.array([sl.geo_para_local(g["lon"], g["lat"]) for g in e["geometry"]])
            ax.fill(q[:, 0], q[:, 1], color="#6a9a5b", alpha=0.35, lw=0)
    ax.set_xlim(-300, 500)
    ax.set_ylim(-320, 320)
    ax.set_aspect("equal")
    ax.grid(alpha=0.3)
    ax.legend(loc="lower right")
    ax.set_title("Áreas livres para canteiro e usina (cerca de 9.700 m²) · OSM (ODbL) e IPP")
    fig.tight_layout()
    fig.savefig(TMP / "canteiro_opcoes.png")
    print(f"Mapa: geo/tmp/canteiro_opcoes.png")
    if args.fixar:
        o = opcoes[args.fixar - 1]
        (TMP / "canteiro.json").write_text(json.dumps(o, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"Canteiro fixado: opção {args.fixar} -> geo/tmp/canteiro.json")
    return 0


if __name__ == "__main__":
    sys.exit(main())
