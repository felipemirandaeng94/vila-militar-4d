"""Baixa do IPP (Prefeitura da Cidade do Rio de Janeiro - Instituto Pereira Passos):
- edificações 2019 (contorno, altura, cota da base e do topo, Lidar 2019);
- amostras do Modelo Digital de Terreno Lidar 2019 (5 m), por consulta pontual
  (identify) numa grade de 25 m e de 10 m na faixa do eixo.

Saídas em geo/brutos/: ipp_edificacoes.json e ipp_mdt_amostras.json.

Se o serviço estiver fora do ar, baixe manualmente:
  1. Abra https://www.data.rio e procure "Edificações 2019" (ou o serviço
     https://pgeo3.rio.rj.gov.br/arcgis/rest/services/CadLog/Edificacoes_2019/FeatureServer).
  2. Exporte em GeoJSON (ou shapefile) recortado no retângulo do trecho.
  3. Salve em geo/brutos/ipp_edificacoes.geojson (ou .shp com os arquivos auxiliares).
gerar_cena.py aceita qualquer um desses formatos.
"""
import json
import sys
from concurrent.futures import ThreadPoolExecutor

import numpy as np
import requests

from comum import BRUTOS, bbox_geo

SERV = "https://pgeo3.rio.rj.gov.br/arcgis/rest/services"
EDIF = f"{SERV}/CadLog/Edificacoes_2019/FeatureServer/0/query"
MDT = f"{SERV}/Cartografia/Modelo_Digital_de_Terreno__Lidar_2019__escala_1_10_000_/MapServer/identify"
UA = {"User-Agent": "vila-militar-4d/0.1 (modelo educacional)"}


def baixar_edificacoes(env):
    xmin, ymin, xmax, ymax = env
    feats, offset = [], 0
    while True:
        r = requests.get(EDIF, params={
            "where": "1=1", "geometry": f"{xmin},{ymin},{xmax},{ymax}", "geometryType": "esriGeometryEnvelope",
            "inSR": 31983, "outSR": 31983, "spatialRel": "esriSpatialRelIntersects",
            "outFields": "altura,base,topo,tipo", "returnGeometry": "true",
            "resultOffset": offset, "resultRecordCount": 2000, "f": "json",
        }, headers=UA, timeout=120)
        r.raise_for_status()
        d = r.json()
        if "error" in d:
            raise RuntimeError(d["error"])
        feats += d.get("features", [])
        if not d.get("exceededTransferLimit"):
            break
        offset += len(d["features"])
    return feats


def cota(ponto):
    x, y = ponto
    for _ in range(3):
        try:
            r = requests.get(MDT, params={
                "geometry": f"{x},{y}", "geometryType": "esriGeometryPoint", "sr": 31983, "layers": "all",
                "tolerance": 0, "mapExtent": f"{x - 500},{y - 500},{x + 500},{y + 500}",
                "imageDisplay": "1000,1000,96", "returnGeometry": "false", "f": "json",
            }, headers=UA, timeout=60)
            v = r.json()["results"][0]["attributes"]["Classify.Pixel Value"]
            return [round(x, 1), round(y, 1), round(float(v), 2)]
        except (requests.RequestException, KeyError, IndexError, ValueError):
            continue
    return None


def pontos_mdt(env, eixo_utm):
    xmin, ymin, xmax, ymax = env
    pts = {(round(x, 1), round(y, 1)) for x in np.arange(xmin, xmax + 1, 25) for y in np.arange(ymin, ymax + 1, 25)}
    # faixa de ±40 m do eixo a cada 10 m
    a, b = np.array(eixo_utm[0]), np.array(eixo_utm[1])
    u = (b - a) / np.linalg.norm(b - a)
    n = np.array([-u[1], u[0]])
    for s in np.arange(-40, np.linalg.norm(b - a) + 40, 10):
        for t in np.arange(-40, 41, 10):
            p = a + u * s + n * t
            pts.add((round(p[0], 1), round(p[1], 1)))
    return sorted(pts)


def main():
    from comum import SistemaLocal
    s, w, n, e, env = bbox_geo(250)
    BRUTOS.mkdir(parents=True, exist_ok=True)
    try:
        feats = baixar_edificacoes(env)
        (BRUTOS / "ipp_edificacoes.json").write_text(json.dumps({"features": feats}), encoding="utf-8")
        print(f"Edificações IPP 2019: {len(feats)} -> geo/brutos/ipp_edificacoes.json")
    except Exception as ex:  # noqa: BLE001
        print(f"Serviço de edificações do IPP indisponível ({ex}). Veja as instruções no topo deste arquivo.")

    destino = BRUTOS / "ipp_mdt_amostras.json"
    if destino.exists() and "--refazer" not in sys.argv:
        print("Amostras do MDT já baixadas (use --refazer para baixar de novo).")
        return 0
    sl = SistemaLocal()
    eixo = [sl.local_para_utm(0, 0), sl.local_para_utm(sl.distancia_reta, 0)]
    pts = pontos_mdt(env, eixo)
    print(f"Consultando {len(pts)} pontos do MDT Lidar 2019 (IPP)...")
    with ThreadPoolExecutor(6) as ex:
        res = [r for r in ex.map(cota, pts) if r]
    destino.write_text(json.dumps({"crs": "EPSG:31983", "fonte": "IPP, MDT Lidar 2019 (5 m)", "pontos": res}),
                       encoding="utf-8")
    print(f"MDT: {len(res)} de {len(pts)} pontos -> {destino.name}")
    return 0 if res else 1


if __name__ == "__main__":
    sys.exit(main())
