"""Sistema local da obra e caminhos comuns do pipeline geo.

Sistema local: SIRGAS 2000 / UTM 23S (EPSG:31983), origem no ponto de
início do trecho, eixo X alinhado à direção geral início -> fim, eixo Y à
esquerda (sentido anti-horário). No app (Three.js), X local = x, Z = -y.
"""
import json
import math
from pathlib import Path

from pyproj import Transformer

RAIZ = Path(__file__).resolve().parents[2]
BRUTOS = RAIZ / "geo" / "brutos"
TMP = RAIZ / "geo" / "tmp"
SAIDA = RAIZ / "public" / "local"
LOCAL_JSON = RAIZ / "dados" / "local.json"

EPSG_UTM = 31983
_para_utm = Transformer.from_crs(4326, EPSG_UTM, always_xy=True)
_para_geo = Transformer.from_crs(EPSG_UTM, 4326, always_xy=True)


def ler_local():
    return json.loads(LOCAL_JSON.read_text(encoding="utf-8"))


def gravar_json(caminho, obj, casas=None):
    caminho = Path(caminho)
    caminho.parent.mkdir(parents=True, exist_ok=True)
    caminho.write_text(json.dumps(obj, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


class SistemaLocal:
    def __init__(self, local=None):
        local = local or ler_local()
        i, f = local["inicio"], local["fim"]
        self.x0, self.y0 = _para_utm.transform(i["lon"], i["lat"])
        x1, y1 = _para_utm.transform(f["lon"], f["lat"])
        dx, dy = x1 - self.x0, y1 - self.y0
        self.theta = math.atan2(dy, dx)  # ângulo de X local a partir do leste UTM
        self.azimute_graus = (90 - math.degrees(self.theta)) % 360
        self.distancia_reta = math.hypot(dx, dy)
        self._c, self._s = math.cos(self.theta), math.sin(self.theta)

    def utm_para_local(self, x, y):
        dx, dy = x - self.x0, y - self.y0
        return dx * self._c + dy * self._s, -dx * self._s + dy * self._c

    def local_para_utm(self, u, v):
        return self.x0 + u * self._c - v * self._s, self.y0 + u * self._s + v * self._c

    def geo_para_local(self, lon, lat):
        return self.utm_para_local(*_para_utm.transform(lon, lat))

    def local_para_geo(self, u, v):
        return _para_geo.transform(*self.local_para_utm(u, v))

    def meta(self):
        return {
            "crs": f"EPSG:{EPSG_UTM}",
            "origem_utm": [round(self.x0, 3), round(self.y0, 3)],
            "rotacao_graus": round(math.degrees(self.theta), 4),
            "azimute_eixo_x_graus": round(self.azimute_graus, 2),
            "convencao": "x local na direção início->fim; y local à esquerda; no app x=x, z=-y, y=cota",
        }


def bbox_geo(folga_m=250, local=None):
    """Retângulo (sul, oeste, norte, leste) que envolve início e fim com folga."""
    local = local or ler_local()
    pts = [_para_utm.transform(p["lon"], p["lat"]) for p in (local["inicio"], local["fim"])]
    xs, ys = [p[0] for p in pts], [p[1] for p in pts]
    xmin, xmax, ymin, ymax = min(xs) - folga_m, max(xs) + folga_m, min(ys) - folga_m, max(ys) + folga_m
    lon0, lat0 = _para_geo.transform(xmin, ymin)
    lon1, lat1 = _para_geo.transform(xmax, ymax)
    return lat0, lon0, lat1, lon1, (xmin, ymin, xmax, ymax)
