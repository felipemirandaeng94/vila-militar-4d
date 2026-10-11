"""Relevo do entorno em grade de 2 m no sistema local.

Fonte preferida: MDT Lidar 2019 do IPP (5 m, amostrado por baixar_ipp.py),
completado com a cota da base das edificações IPP 2019. Sem o IPP, usa o
Copernicus GLO-30 (30 m, modelo de superfície; precisão vertical da ordem de
alguns metros), lido diretamente do bucket público na AWS.

Saída: geo/tmp/relevo.npz (z em metros, grade local) com a descrição da fonte.
"""
import json
import sys

import numpy as np
from scipy.interpolate import griddata
from scipy.ndimage import gaussian_filter

from comum import BRUTOS, TMP, SistemaLocal, bbox_geo

PASSO = 2.0
# retângulo local da cena (x ao longo do eixo, y transversal)
X0, X1 = -260.0, 1850.0
Y0, Y1 = -450.0, 450.0
SUAVIZACAO_M = 4.0


def amostras_ipp(sl):
    pts = []
    f = BRUTOS / "ipp_mdt_amostras.json"
    if f.exists():
        for x, y, z in json.loads(f.read_text(encoding="utf-8"))["pontos"]:
            pts.append((*sl.utm_para_local(x, y), z))
    n_mdt = len(pts)
    f = BRUTOS / "ipp_edificacoes.json"
    if f.exists() and pts:
        for ft in json.loads(f.read_text(encoding="utf-8"))["features"]:
            a = ft["attributes"]
            if a.get("base") and a.get("tipo", "").startswith("A101"):
                anel = np.array(ft["geometry"]["rings"][0])
                cx, cy = anel.mean(axis=0)
                pts.append((*sl.utm_para_local(cx, cy), a["base"]))
    return np.array(pts), n_mdt


def amostras_copernicus(sl):
    import rasterio
    from rasterio.warp import transform

    url = ("https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_S23_00_W044_00_DEM/"
           "Copernicus_DSM_COG_10_S23_00_W044_00_DEM.tif")
    s, w, n, e, _ = bbox_geo(400)
    with rasterio.open(url) as src:
        janela = src.window(w, s, e, n)
        z = src.read(1, window=janela)
        tr = src.window_transform(janela)
    linhas, colunas = np.indices(z.shape)
    lon, lat = rasterio.transform.xy(tr, linhas.ravel(), colunas.ravel())
    xs, ys = transform("EPSG:4326", "EPSG:31983", lon, lat)
    loc = np.array([sl.utm_para_local(x, y) for x, y in zip(xs, ys)])
    return np.column_stack([loc, z.ravel()])


def main():
    sl = SistemaLocal()
    pts, n_mdt = amostras_ipp(sl)
    if len(pts):
        fonte = (f"IPP, Modelo Digital de Terreno Lidar 2019 (5 m), {n_mdt} amostras a cada 25 m "
                 "(10 m na faixa do eixo), mais a cota da base das edificações IPP 2019")
        precisao = "MDT Lidar reamostrado a 5 m, escala 1:10.000; amostragem a cada 10 a 25 m (precisão da ordem de 0,5 m na faixa do eixo)"
    else:
        print("Sem amostras do IPP: usando Copernicus GLO-30.")
        pts = amostras_copernicus(sl)
        fonte = "Copernicus GLO-30 (ESA, 30 m)"
        precisao = "30 m de resolução horizontal; erro vertical de alguns metros (modelo de superfície)"
    xs = np.arange(X0, X1 + PASSO / 2, PASSO)
    ys = np.arange(Y0, Y1 + PASSO / 2, PASSO)
    gx, gy = np.meshgrid(xs, ys)
    z = griddata(pts[:, :2], pts[:, 2], (gx, gy), method="linear")
    vazio = np.isnan(z)
    if vazio.any():
        z[vazio] = griddata(pts[:, :2], pts[:, 2], (gx[vazio], gy[vazio]), method="nearest")
    z = gaussian_filter(z, SUAVIZACAO_M / PASSO)
    TMP.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(TMP / "relevo.npz", z=z.astype(np.float32), x0=X0, y0=Y0, passo=PASSO,
                        fonte=fonte, precisao=precisao)
    print(f"Relevo: {z.shape[1]} x {z.shape[0]} nós de {PASSO:.0f} m, cota {z.min():.1f} a {z.max():.1f} m")
    print(f"Fonte: {fonte}")
    print(f"Precisão esperada: {precisao}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
