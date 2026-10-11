"""Gera os arquivos da cena real em public/local/:
- terreno.bin  grade de 2 m (Uint16, centímetros acima de zmin), linha a linha a partir de y0;
- vias.json    vias existentes (OSM), com largura estimada;
- areas.json   áreas verdes, matas, campos e quadras (OSM);
- edificacoes.json  contorno, altura, cota da base e uso (IPP 2019; OSM onde o IPP não cobre);
- meta.json    origem, rotação, grade do terreno, canteiro e créditos.

Área militar: não grava nomes de edificações; vias de acesso privado ficam sem nome.
"""
import json
import sys

import networkx as nx
import numpy as np
from shapely.geometry import LineString, Point, Polygon, box
from shapely.ops import nearest_points
from shapely.strtree import STRtree

from comum import BRUTOS, SAIDA, TMP, SistemaLocal, gravar_json, ler_local

LARGURA_POR_TIPO = {
    "motorway": 10.5, "motorway_link": 7.0, "trunk": 10.5, "primary": 14.0, "primary_link": 7.0,
    "secondary": 9.0, "tertiary": 8.0, "unclassified": 6.0, "residential": 6.0, "living_street": 5.0,
    "service": 4.0, "busway": 7.0, "pedestrian": 4.0, "footway": 1.5, "steps": 1.5, "bridleway": 2.0,
}
USO_IPP = {
    "A101": "edificação", "A113": "construção", "A119": "telheiro", "A121": "galpão",
    "A122": "casa de máquinas", "H805": "reservatório", "A120": "marquise",
}
AREAS = {
    ("landuse", "grass"): "verde", ("leisure", "park"): "verde", ("landuse", "recreation_ground"): "verde",
    ("leisure", "recreation_ground"): "verde", ("natural", "grassland"): "verde",
    ("natural", "wood"): "mata", ("natural", "scrub"): "mata",
    ("leisure", "pitch"): "quadra", ("leisure", "stadium"): "campo", ("leisure", "sports_centre"): "campo",
    ("natural", "water"): "agua", ("leisure", "swimming_pool"): "agua", ("amenity", "parking"): "estacionamento",
}


def r1(pts):
    return [[round(float(x), 1), round(float(y), 1)] for x, y in pts]


def largura(t):
    w = t.get("width")
    try:
        if w:
            return float(str(w).replace(",", ".").split()[0])
    except ValueError:
        pass
    if t.get("lanes", "").isdigit() and t["highway"] not in ("service", "living_street"):
        return round(int(t["lanes"]) * 3.3, 1)
    return LARGURA_POR_TIPO.get(t["highway"], 5.0)


VEICULARES = {"primary", "secondary", "tertiary", "unclassified", "residential", "living_street", "service",
              "primary_link", "secondary_link", "tertiary_link"}


def acesso_do_canteiro(osm, sl, canteiro, eixo):
    """Caminho pelas vias existentes (OSM) do lado do canteiro até a avenida do eixo (a menos de 10 m do eixo estendido)."""
    cx, cy = canteiro["centro_local"]
    comp, larg = canteiro["dimensoes_m"]
    ret = box(cx - comp / 2, cy - larg / 2, cx + comp / 2, cy + larg / 2)
    G = nx.Graph()
    segs = []
    for e in osm:
        t = e.get("tags", {})
        if e["type"] != "way" or t.get("highway") not in VEICULARES or "geometry" not in e:
            continue
        pts = [sl.geo_para_local(g["lon"], g["lat"]) for g in e["geometry"]]
        nos = [f"{g['lat']:.7f},{g['lon']:.7f}" for g in e["geometry"]]
        for k in range(len(pts) - 1):
            G.add_edge(nos[k], nos[k + 1], w=float(np.hypot(pts[k + 1][0] - pts[k][0], pts[k + 1][1] - pts[k][1])))
            G.nodes[nos[k]]["xy"], G.nodes[nos[k + 1]]["xy"] = pts[k], pts[k + 1]
            segs.append((LineString([pts[k], pts[k + 1]]), nos[k], nos[k + 1]))
    # ponto de via mais próximo do canteiro (portão)
    seg, a, b = min(segs, key=lambda x: x[0].distance(ret))
    # projeta no segmento o ponto do retângulo mais próximo dele
    pr, _ = nearest_points(ret.exterior, seg)
    q = seg.interpolate(seg.project(pr))
    G.add_edge("Q", a, w=q.distance(Point(G.nodes[a]["xy"])))
    G.add_edge("Q", b, w=q.distance(Point(G.nodes[b]["xy"])))
    G.nodes["Q"]["xy"] = (q.x, q.y)
    # alvo: início do eixo
    p0 = eixo["pontos"][0]
    t = min(G.nodes, key=lambda n: np.hypot(G.nodes[n]["xy"][0] - p0[0], G.nodes[n]["xy"][1] - p0[1]))
    cam = nx.shortest_path(G, "Q", t, weight="w")
    # eixo estendido para trás pela tangente do início
    e0, e1 = np.array(eixo["pontos"][0]), np.array(eixo["pontos"][5])
    tg = (e1 - e0) / np.linalg.norm(e1 - e0)
    ext = LineString([tuple(e0 - tg * 2000)] + [tuple(p) for p in eixo["pontos"]])
    out = [list(pr.coords[0])]
    for n in cam:
        xy = G.nodes[n]["xy"]
        out.append([xy[0], xy[1]])
        if ext.distance(Point(xy)) < 10:
            break
    return [[round(x, 1), round(y, 1)] for x, y in out]


def main():
    local = ler_local()
    sl = SistemaLocal(local)
    rel = np.load(TMP / "relevo.npz")
    z = rel["z"]
    x0, y0, passo = float(rel["x0"]), float(rel["y0"]), float(rel["passo"])
    ny, nx = z.shape
    cena = box(x0, y0, x0 + (nx - 1) * passo, y0 + (ny - 1) * passo)
    zmin = float(np.floor(z.min()))
    cm = np.round((z - zmin) * 100).astype(np.uint16)
    SAIDA.mkdir(parents=True, exist_ok=True)
    (SAIDA / "terreno.bin").write_bytes(cm.tobytes())

    eixo = json.loads((SAIDA / "eixo.json").read_text(encoding="utf-8"))
    faixa_eixo = LineString(eixo["pontos"]).buffer(6)

    osm = json.loads((BRUTOS / "osm.json").read_text(encoding="utf-8"))["elements"]
    vias, areas, edif_osm = [], [], []
    for e in osm:
        t = e.get("tags", {})
        if e["type"] != "way" or "geometry" not in e:
            continue
        pts = [sl.geo_para_local(g["lon"], g["lat"]) for g in e["geometry"]]
        if "highway" in t and t["highway"] in LARGURA_POR_TIPO:
            g = LineString(pts).intersection(cena)
            if g.is_empty:
                continue
            partes = [g] if g.geom_type == "LineString" else [p for p in getattr(g, "geoms", []) if p.geom_type == "LineString"]
            privado = t.get("access") in ("private", "no")
            for p in partes:
                vias.append({
                    "nome": None if privado else t.get("name"),
                    "tipo": t["highway"], "largura": largura(t), "superficie": t.get("surface"),
                    "eixo_obra": e["id"] in {i for tr in eixo["trechos"] for i in tr["osm_ids"]},
                    "pts": r1(p.coords),
                })
        elif "building" in t and len(pts) >= 4:
            pg = Polygon(pts).buffer(0)
            if pg.is_valid and pg.area > 4 and pg.intersects(cena):
                niveis = t.get("building:levels")
                altura = float(t["height"]) if str(t.get("height", "")).replace(".", "").isdigit() else None
                if altura is None and str(niveis or "").isdigit():
                    altura = int(niveis) * 3.0
                edif_osm.append((pg, altura, niveis))
        else:
            tipo = next((v for (k, val), v in AREAS.items() if t.get(k) == val), None)
            if tipo and len(pts) >= 4:
                pg = Polygon(pts).buffer(0).intersection(cena)
                if not pg.is_empty and pg.area > 20:
                    for q in ([pg] if pg.geom_type == "Polygon" else [g for g in pg.geoms if g.geom_type == "Polygon"]):
                        areas.append({"tipo": tipo, "pts": r1(q.simplify(0.5).exterior.coords[:-1])})

    # edificações: IPP primeiro; OSM só onde não há IPP
    edif, polys_ipp = [], []
    f = BRUTOS / "ipp_edificacoes.json"
    for ft in (json.loads(f.read_text(encoding="utf-8"))["features"] if f.exists() else []):
        a = ft["attributes"]
        cod = (a.get("tipo") or "")[:4]
        if cod not in USO_IPP:
            continue  # projeções de pavimentos superiores, ruínas e fundações
        anel = [sl.utm_para_local(x, y) for x, y in ft["geometry"]["rings"][0]]
        pg = Polygon(anel).buffer(0)
        if not pg.is_valid or pg.area < 4 or not pg.intersects(cena) or pg.intersects(faixa_eixo):
            continue
        if pg.geom_type != "Polygon":
            pg = max(pg.geoms, key=lambda g: g.area)
        polys_ipp.append(pg)
        edif.append({"c": r1(pg.simplify(0.3).exterior.coords[:-1]), "h": round(max(a.get("altura") or 3.0, 2.5), 1),
                     "base": round(a["base"], 2) if a.get("base") else None, "uso": USO_IPP[cod], "fonte": "IPP"})
    arv = STRtree(polys_ipp) if polys_ipp else None
    n_osm = 0
    for pg, altura, niveis in edif_osm:
        if pg.intersects(faixa_eixo):
            continue
        if arv is not None and any(pg.intersection(polys_ipp[i]).area > 0.3 * pg.area for i in arv.query(pg)):
            continue
        if pg.geom_type != "Polygon":
            pg = max(pg.geoms, key=lambda g: g.area)
        edif.append({"c": r1(pg.simplify(0.3).exterior.coords[:-1]), "h": round(altura or 6.0, 1), "base": None,
                     "pav": int(niveis) if str(niveis or "").isdigit() else None, "uso": "edificação", "fonte": "OSM"})
        n_osm += 1

    # largura da pista existente no eixo (OSM: largura ou nº de faixas da via principal do traçado)
    ids_eixo = {i for tr in eixo["trechos"] for i in tr["osm_ids"]}
    tags_eixo = [e["tags"] for e in osm if e["type"] == "way" and e["id"] in ids_eixo]
    via_existente = {"nome": local["via"], "largura_m": max(largura(t) for t in tags_eixo),
                     "faixas": max(int(t.get("lanes", "0")) for t in tags_eixo if t.get("lanes", "0").isdigit()),
                     "superficie": tags_eixo[0].get("surface"), "fonte": "OSM (largura estimada pelo número de faixas)"}
    canteiro = json.loads((TMP / "canteiro.json").read_text(encoding="utf-8"))
    acesso = acesso_do_canteiro(osm, sl, canteiro, eixo)
    meta = {
        "aviso": "Entorno a partir de dados abertos (OSM e IPP). Terreno, quantidades e ensaios da obra são ilustrativos.",
        "sistema": sl.meta(),
        "inicio": local["inicio"], "fim": local["fim"],
        "via": local["via"], "extensao_medida_m": eixo["extensao_m"],
        "via_existente": via_existente,
        "terreno": {"arquivo": "terreno.bin", "formato": "Uint16 LE, cm acima de zmin, linhas de y0 para cima",
                    "nx": nx, "ny": ny, "x0": x0, "y0": y0, "passo": passo, "zmin": zmin,
                    "fonte": str(rel["fonte"]), "precisao": str(rel["precisao"])},
        "canteiro": {
            "centro": canteiro["centro_local"], "dimensoes_m": canteiro["dimensoes_m"],
            "rotacao_graus": canteiro["rotacao_graus"], "centro_geo": canteiro["centro_geo"],
            "acesso": "pela via local ao lado do canteiro até a Av. Duque de Caxias",
            "acesso_pts": acesso,
            "confirmado": "opção 2 (noroeste), confirmada pelo usuário na Fase 3",
        },
        "ortofoto": "Não usada: a licença dos mosaicos de ortofoto do IPP não está declarada no serviço. Terreno com cores por uso do solo.",
        "creditos": [
            {"fonte": "OpenStreetMap", "texto": "© colaboradores do OpenStreetMap (ODbL)", "uso": "vias, áreas verdes, quadras, edificações complementares e traçado do eixo",
             "url": "https://www.openstreetmap.org/copyright"},
            {"fonte": "IPP", "texto": "Prefeitura da Cidade do Rio de Janeiro – Instituto Pereira Passos",
             "uso": "Edificações 2019 (contorno, altura) e Modelo Digital de Terreno Lidar 2019",
             "url": "https://pgeo3.rio.rj.gov.br/arcgis/rest/services"},
        ],
        "contagens": {"vias": len(vias), "areas": len(areas), "edificacoes_ipp": len(edif) - n_osm, "edificacoes_osm": n_osm},
    }
    gravar_json(SAIDA / "vias.json", vias)
    gravar_json(SAIDA / "areas.json", areas)
    gravar_json(SAIDA / "edificacoes.json", edif)
    (SAIDA / "meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"terreno.bin: {nx} x {ny} ({(SAIDA / 'terreno.bin').stat().st_size / 1e6:.2f} MB), zmin {zmin}")
    print(f"vias: {len(vias)}, áreas: {len(areas)}, edificações: {len(edif) - n_osm} IPP + {n_osm} OSM")
    return 0


if __name__ == "__main__":
    sys.exit(main())
