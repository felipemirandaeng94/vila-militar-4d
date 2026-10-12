"""Planta de situação 2D (norte para cima) a partir de public/local/.

Lê vias.json, edificacoes.json, areas.json, eixo.json e meta.json (sistema
local da obra) e grava docs/imagens/planta-base.png (2400 x 1600 px) e
docs/imagens/planta-base.svg.

Uso: .venv\\Scripts\\python planta_base.py
"""
import json
import math
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.lines import Line2D
from matplotlib.patches import FancyArrow, Patch, Polygon as MplPolygon, Rectangle
from shapely.geometry import LineString, Polygon, box
from shapely.ops import unary_union

RAIZ = Path(__file__).resolve().parents[2]
LOCAL = RAIZ / "public" / "local"
SAIDA = RAIZ / "docs" / "imagens"

TAMANHO_FRENTE = 400.0  # dados/servicos.json: frentes.tamanho
PASSO_ESTACA = 20.0
MARCA_ESTACA = 100.0

COR = {
    "fundo": "#ffffff",
    "dados": "#f5f3ee",
    "via": "#9a9a9a",
    "via_borda": "#7d7d7d",
    "via_rapida": "#7a7a7a",
    "pedestre": "#b5b5b5",
    "edif": "#e8d6b0",
    "edif_borda": "#c9b07e",
    "verde": "#cfe8b4",
    "mata": "#b3d89a",
    "campo": "#dcefc8",
    "quadra": "#e6ead8",
    "agua": "#b9d9ef",
    "eixo": "#d7191c",
    "canteiro": "#f39c34",
    "canteiro_borda": "#c46a00",
    "acesso": "#e07b00",
    "texto": "#222222",
}

ROTULO_AREA = {
    "verde": "Áreas verdes",
    "mata": "Mata",
    "campo": "Campos",
    "quadra": "Quadras esportivas",
    "agua": "Água",
}


def ler(nome):
    return json.loads((LOCAL / nome).read_text(encoding="utf-8"))


class Norte:
    """Converte o sistema local (x ao longo do eixo, y à esquerda) em leste/norte (m)."""

    def __init__(self, meta):
        t = math.radians(meta["sistema"]["rotacao_graus"])
        self.c, self.s = math.cos(t), math.sin(t)
        self.graus = meta["sistema"]["rotacao_graus"]

    def pt(self, u, v):
        return u * self.c - v * self.s, u * self.s + v * self.c

    def pts(self, lista):
        return [self.pt(u, v) for u, v in lista]


def desenhar_geom(ax, geom, **kw):
    if geom.is_empty:
        return
    partes = getattr(geom, "geoms", [geom])
    for p in partes:
        if p.geom_type != "Polygon":
            continue
        ax.add_patch(MplPolygon(list(p.exterior.coords), closed=True, **kw))
        for anel in p.interiors:
            ax.add_patch(MplPolygon(list(anel.coords), closed=True, facecolor=COR["dados"], edgecolor="none", zorder=kw.get("zorder", 1) + 0.01))


def main():
    meta, vias, edifs, areas, eixo = (ler(n) for n in ("meta.json", "vias.json", "edificacoes.json", "areas.json", "eixo.json"))
    T = Norte(meta)
    g = meta["terreno"]
    u0, v0 = g["x0"], g["y0"]
    u1, v1 = u0 + (g["nx"] - 1) * g["passo"], v0 + (g["ny"] - 1) * g["passo"]
    limite = Polygon(T.pts([(u0, v0), (u1, v0), (u1, v1), (u0, v1)]))

    plt.rcParams.update({"font.family": "DejaVu Sans", "svg.fonttype": "none"})
    fig = plt.figure(figsize=(12, 8), dpi=200, facecolor=COR["fundo"])
    ax = fig.add_axes([0, 0, 1, 1])
    ax.set_aspect("equal")
    ax.axis("off")

    # enquadramento: eixo e canteiro com folga, proporção 3:2
    E0, E1 = -640.0, 1640.0
    N0 = -300.0
    N1 = N0 + (E1 - E0) / 1.5
    ax.set_xlim(E0, E1)
    ax.set_ylim(N0, N1)

    desenhar_geom(ax, limite, facecolor=COR["dados"], edgecolor="#cfcabd", linewidth=0.8, zorder=0)

    # áreas (verdes, mata, campos, quadras, água)
    ordem = ["campo", "verde", "mata", "quadra", "agua"]
    tipos_presentes = set()
    for tipo in ordem:
        polys = [Polygon(T.pts(a["pts"])).buffer(0) for a in areas if a["tipo"] == tipo and len(a["pts"]) >= 3]
        if not polys:
            continue
        tipos_presentes.add(tipo)
        desenhar_geom(ax, unary_union(polys).intersection(limite), facecolor=COR[tipo], edgecolor="none", zorder=1)

    # vias existentes com a largura do OSM
    finas = {"footway", "steps", "bridleway", "pedestrian"}
    faixas = []
    for v in vias:
        if len(v["pts"]) < 2:
            continue
        linha = LineString(T.pts(v["pts"]))
        if v["tipo"] in finas:
            xs, ys = zip(*linha.coords)
            ax.plot(xs, ys, color=COR["pedestre"], linewidth=0.5, linestyle=(0, (3, 2)), zorder=2)
            continue
        faixas.append(linha.buffer(max(v.get("largura") or 4.0, 2.0) / 2, cap_style="flat", join_style="round"))
    pistas = unary_union(faixas).intersection(limite)
    desenhar_geom(ax, pistas, facecolor=COR["via"], edgecolor=COR["via_borda"], linewidth=0.3, zorder=2)

    # edificações (IPP 2019 e complementos OSM)
    for e in edifs:
        if len(e["c"]) < 3:
            continue
        ax.add_patch(MplPolygon(T.pts(e["c"]), closed=True, facecolor=COR["edif"], edgecolor=COR["edif_borda"], linewidth=0.25, zorder=3))

    # canteiro e usina
    cant = meta["canteiro"]
    cu, cv = cant["centro"]
    du, dv = cant["dimensoes_m"]
    canteiro = Polygon(T.pts([(cu - du / 2, cv - dv / 2), (cu + du / 2, cv - dv / 2), (cu + du / 2, cv + dv / 2), (cu - du / 2, cv + dv / 2)]))
    acesso = LineString(T.pts(cant["acesso_pts"]))
    ax.add_patch(MplPolygon(list(acesso.buffer(4.0, cap_style="flat").exterior.coords), closed=True, facecolor=COR["acesso"], edgecolor="none", alpha=0.85, zorder=4))
    xs, ys = zip(*acesso.coords)
    ax.plot(xs, ys, color="white", linewidth=0.6, linestyle=(0, (4, 3)), zorder=4.1)
    ax.add_patch(MplPolygon(list(canteiro.exterior.coords), closed=True, facecolor=COR["canteiro"], edgecolor=COR["canteiro_borda"], linewidth=1.0, alpha=0.9, zorder=5))
    ce, cn = canteiro.centroid.coords[0]
    ax.text(ce, cn, "Canteiro e usina de CBUQ\n135 × 72 m", ha="center", va="center", fontsize=6.5, color="#3a2000", weight="bold", rotation=T.graus, rotation_mode="anchor", zorder=6)
    # rótulo do acesso
    meio = acesso.interpolate(0.45, normalized=True)
    ax.annotate("Acesso pela via local\naté a Av. Duque de Caxias", xy=(meio.x, meio.y), xytext=(meio.x - 150, meio.y - 175),
                fontsize=6.5, color="#7a3e00", ha="center", va="center",
                arrowprops=dict(arrowstyle="-", color="#7a3e00", linewidth=0.6), zorder=9,
                bbox=dict(boxstyle="round,pad=0.25", facecolor="white", edgecolor="none", alpha=0.85))

    # eixo da obra
    linha_eixo = LineString(T.pts(eixo["pontos"]))
    L = eixo["extensao_m"]
    k = linha_eixo.length / L
    xs, ys = zip(*linha_eixo.coords)
    ax.plot(xs, ys, color="white", linewidth=4.2, solid_capstyle="butt", zorder=6)
    ax.plot(xs, ys, color=COR["eixo"], linewidth=2.6, solid_capstyle="butt", zorder=7)

    def ponto_e_normal(s):
        s = min(max(s, 0.0), L)
        p = linha_eixo.interpolate(s * k)
        a = linha_eixo.interpolate(max(s - 2, 0) * k)
        b = linha_eixo.interpolate(min(s + 2, L) * k)
        dx, dy = b.x - a.x, b.y - a.y
        n = math.hypot(dx, dy) or 1.0
        return p.x, p.y, -dy / n, dx / n, math.degrees(math.atan2(dy, dx))  # normal à esquerda (norte)

    # estacas a cada 100 m (estacas de 20 m)
    s = 0.0
    while s <= L + 1e-6:
        x, y, nx, ny, ang = ponto_e_normal(s)
        ax.plot([x - nx * 9, x + nx * 9], [y - ny * 9, y + ny * 9], color=COR["eixo"], linewidth=1.0, zorder=8)
        est = int(round(s / PASSO_ESTACA))
        ax.text(x + nx * 16, y + ny * 16, f"E{est}", ha="center", va="bottom", fontsize=5.5, color="#8b0000",
                rotation=ang, rotation_mode="anchor", zorder=9)
        s += MARCA_ESTACA
    x, y, nx, ny, ang = ponto_e_normal(L)
    ax.plot([x - nx * 9, x + nx * 9], [y - ny * 9, y + ny * 9], color=COR["eixo"], linewidth=1.0, zorder=8)
    ax.text(x + nx * 16, y + ny * 16, f"E{int(L // PASSO_ESTACA)}+{L % PASSO_ESTACA:.1f}".replace(".", ","), ha="center", va="bottom",
            fontsize=5.5, color="#8b0000", rotation=ang, rotation_mode="anchor", zorder=9)

    # frentes de serviço (ao sul do eixo)
    n_frentes = max(1, math.ceil(L / TAMANHO_FRENTE - 1e-9))
    for i in range(n_frentes + 1):
        sf = min(i * TAMANHO_FRENTE, L)
        x, y, nx, ny, _ = ponto_e_normal(sf)
        ax.plot([x, x - nx * 70], [y, y - ny * 70], color="#5a0000", linewidth=0.9, linestyle=(0, (2, 1.5)), zorder=8)
    for i in range(n_frentes):
        sa, sb = i * TAMANHO_FRENTE, min((i + 1) * TAMANHO_FRENTE, L)
        x, y, nx, ny, ang = ponto_e_normal((sa + sb) / 2)
        ax.text(x - nx * 52, y - ny * 52, f"F{i + 1}", ha="center", va="center", fontsize=9, weight="bold", color="white",
                rotation=ang, rotation_mode="anchor", zorder=9,
                bbox=dict(boxstyle="round,pad=0.3", facecolor="#8b0000", edgecolor="none"))
        ax.text(x - nx * 80, y - ny * 80, f"{sa:.0f} a {sb:.0f} m".replace(".", ","), ha="center", va="center", fontsize=5.5,
                color="#5a0000", rotation=ang, rotation_mode="anchor", zorder=9)

    # nome da avenida
    x, y, nx, ny, ang = ponto_e_normal(1000)
    ax.text(x + nx * 75, y + ny * 75, "AVENIDA DUQUE DE CAXIAS", ha="center", va="center", fontsize=8, weight="bold",
            color="#333333", rotation=ang, rotation_mode="anchor", zorder=9,
            bbox=dict(boxstyle="round,pad=0.2", facecolor="white", edgecolor="none", alpha=0.75))
    x, y, *_ = ponto_e_normal(0)
    ax.annotate("Início", xy=(x, y), xytext=(x - 60, y - 70), fontsize=6.5, color="#8b0000", ha="center",
                arrowprops=dict(arrowstyle="-", color="#8b0000", linewidth=0.6), zorder=9)
    x, y, *_ = ponto_e_normal(L)
    ax.annotate("Fim", xy=(x, y), xytext=(x + 40, y + 70), fontsize=6.5, color="#8b0000", ha="center",
                arrowprops=dict(arrowstyle="-", color="#8b0000", linewidth=0.6), zorder=9)

    # título (canto noroeste, fora da área de dados)
    ax.text(E0 + 25, N1 - 25, "Planta de situação", fontsize=15, weight="bold", color=COR["texto"], va="top", zorder=10)
    ax.text(E0 + 25, N1 - 85,
            "Terraplenagem e pavimentação em CBUQ da Av. Duque de Caxias\n"
            "Vila Militar, Deodoro, Rio de Janeiro/RJ · extensão " + f"{L:.1f} m".replace(".", ","),
            fontsize=7.5, color="#444444", va="top", linespacing=1.4, zorder=10)

    # seta de norte
    xa, ya = E0 + 70, N1 - 330
    ax.add_patch(MplPolygon([(xa, ya + 90), (xa - 22, ya), (xa, ya + 18)], closed=True, facecolor="#222222", edgecolor="#222222", linewidth=0.6, zorder=10))
    ax.add_patch(MplPolygon([(xa, ya + 90), (xa + 22, ya), (xa, ya + 18)], closed=True, facecolor="white", edgecolor="#222222", linewidth=0.6, zorder=10))
    ax.text(xa, ya + 100, "N", ha="center", va="bottom", fontsize=11, weight="bold", zorder=10)

    # escala gráfica
    xe, ye = E0 + 30, N0 + 45
    ax.add_patch(Rectangle((xe - 18, ye - 42), 375, 95, facecolor="white", edgecolor="none", alpha=0.85, zorder=9.5))
    trechos = [0, 50, 100, 200, 300]
    for i in range(len(trechos) - 1):
        ax.add_patch(Rectangle((xe + trechos[i], ye), trechos[i + 1] - trechos[i], 10,
                               facecolor="#222222" if i % 2 == 0 else "white", edgecolor="#222222", linewidth=0.6, zorder=10))
    for t in trechos:
        ax.text(xe + t, ye + 16, f"{t}", ha="center", va="bottom", fontsize=6, zorder=10)
    ax.text(xe + trechos[-1] + 22, ye + 5, "m", ha="left", va="center", fontsize=6.5, zorder=10)
    ax.text(xe, ye - 14, "Escala gráfica · SIRGAS 2000 / UTM 23S", ha="left", va="top", fontsize=5.5, color="#555555", zorder=10)

    # legenda (canto sudeste)
    itens = [
        Line2D([0], [0], color=COR["eixo"], linewidth=2.6, label="Eixo da obra (estacas de 20 m, marcadas a cada 100 m)"),
        Patch(facecolor="#8b0000", edgecolor="none", label="Frentes de serviço F1 a F4 (400 m)"),
        Patch(facecolor=COR["via"], edgecolor=COR["via_borda"], label="Vias existentes (largura OSM)"),
        Line2D([0], [0], color=COR["pedestre"], linewidth=0.8, linestyle=(0, (3, 2)), label="Caminhos de pedestres"),
        Patch(facecolor=COR["edif"], edgecolor=COR["edif_borda"], label="Edificações (IPP 2019)"),
    ]
    itens += [Patch(facecolor=COR[t], edgecolor="none", label=ROTULO_AREA[t]) for t in ordem if t in tipos_presentes]
    itens += [
        Patch(facecolor=COR["canteiro"], edgecolor=COR["canteiro_borda"], label="Canteiro e usina de CBUQ (135 × 72 m)"),
        Line2D([0], [0], color=COR["acesso"], linewidth=3, label="Acesso ao canteiro"),
        Patch(facecolor=COR["dados"], edgecolor="#cfcabd", label="Limite dos dados"),
    ]
    leg = ax.legend(handles=itens, loc="lower right", bbox_to_anchor=(0.995, 0.085), fontsize=6.5, frameon=True,
                    title="Legenda", title_fontsize=7.5, alignment="left", borderpad=0.8, labelspacing=0.55)
    leg.get_frame().set_edgecolor("#bbbbbb")
    leg.get_frame().set_linewidth(0.6)
    leg.set_zorder(11)

    creditos = [c["texto"] for c in meta["creditos"]]
    ax.text(0.995, 0.012,
            "Dados: " + creditos[0] + " · Prefeitura da Cidade do Rio de Janeiro – IPP (Edificações 2019)\n"
            "Ilustrativo: eixo, estacas, frentes e canteiro são do modelo didático; não é documento de projeto.",
            transform=ax.transAxes, ha="right", va="bottom", fontsize=5.5, color="#555555", linespacing=1.4, zorder=11)

    SAIDA.mkdir(parents=True, exist_ok=True)
    fig.savefig(SAIDA / "planta-base.png", dpi=200, facecolor=COR["fundo"])
    fig.savefig(SAIDA / "planta-base.svg", facecolor=COR["fundo"])
    plt.close(fig)
    for nome in ("planta-base.png", "planta-base.svg"):
        p = SAIDA / nome
        print(f"{p.relative_to(RAIZ)}: {p.stat().st_size / 1e6:.2f} MB")


if __name__ == "__main__":
    main()
