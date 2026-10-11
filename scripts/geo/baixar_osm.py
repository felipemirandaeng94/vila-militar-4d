"""Baixa do OpenStreetMap (API Overpass) vias, edificações, áreas verdes,
campos e quadras no retângulo do trecho com folga de cerca de 250 m.

Saída: geo/brutos/osm.json (resposta Overpass com geometria).
Dados © colaboradores do OpenStreetMap (ODbL).
"""
import sys
import time

import requests

from comum import BRUTOS, bbox_geo

SERVIDORES = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
    "https://overpass.osm.jp/api/interpreter",
]


def consulta(s, w, n, e):
    b = f"({s:.6f},{w:.6f},{n:.6f},{e:.6f})"
    return f"""
[out:json][timeout:120];
(
  way["highway"]{b};
  way["building"]{b};
  relation["building"]{b};
  way["landuse"]{b};
  relation["landuse"]{b};
  way["leisure"]{b};
  way["natural"]{b};
  way["amenity"="parking"]{b};
  way["railway"]{b};
  way["waterway"]{b};
);
out body geom;
"""


def main():
    s, w, n, e, utm = bbox_geo(250)
    largura, altura = utm[2] - utm[0], utm[3] - utm[1]
    print(f"Retângulo: S {s:.5f} O {w:.5f} N {n:.5f} L {e:.5f} ({largura:.0f} x {altura:.0f} m)")
    q = consulta(s, w, n, e)
    for url in SERVIDORES * 2:
        try:
            r = requests.post(url, data={"data": q}, timeout=180,
                              headers={"User-Agent": "vila-militar-4d/0.1 (modelo educacional)"})
            if r.status_code == 200 and r.text.lstrip().startswith("{"):
                BRUTOS.mkdir(parents=True, exist_ok=True)
                (BRUTOS / "osm.json").write_text(r.text, encoding="utf-8")
                n_el = r.text.count('"type"')
                print(f"OK: {url} -> geo/brutos/osm.json (~{n_el} elementos)")
                return 0
            print(f"Falha {r.status_code} em {url}")
        except requests.RequestException as ex:
            print(f"Erro em {url}: {ex}")
        time.sleep(3)
    print("Nenhum servidor Overpass respondeu.")
    return 1


if __name__ == "__main__":
    sys.exit(main())
