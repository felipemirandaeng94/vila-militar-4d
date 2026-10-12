"""Baixa do Poly Haven (API pública, licença CC0) as texturas PBR do terreno e
do pavimento em 1K e 2K e converte para WebP em public/texturas/.

Uso:
    python scripts/assets/baixar_texturas.py
    python scripts/assets/baixar_texturas.py --qualidade 85   # WebP mais leve

Para cada material e resolução grava public/texturas/<material>/<res>/:
    cor.webp     cor de base (sRGB)
    normal.webp  mapa de normais (convenção OpenGL, nor_gl)
    arm.webp     R = oclusão de ambiente, G = rugosidade, B = metal (linear)
e o manifesto public/texturas/texturas.json (id, nome, autores, tamanho real
em metros, licença e origem de cada material).

Os JPG originais ficam em assets/brutos/texturas/ (fora do git). Requer
Pillow com suporte a WebP (pip install pillow).

Materiais marcados com "ia": true no manifesto (texturas geradas por IA e
preparadas por scripts/assets/preparar-texturas.py) não são sobrescritos.
"""
import argparse
import datetime
import hashlib
import io
import json
import sys
import urllib.request
from pathlib import Path

try:
    from PIL import Image, features
except ImportError:
    sys.exit("Instale o Pillow: pip install pillow")

API = "https://api.polyhaven.com"
RAIZ = Path(__file__).resolve().parents[2]
BRUTOS = RAIZ / "assets" / "brutos" / "texturas"
DESTINO = RAIZ / "public" / "texturas"
RESOLUCOES = ["1k", "2k"]
MAPAS = {"cor": "Diffuse", "normal": "nor_gl", "arm": "arm"}
CABECALHO = {"User-Agent": "vila-militar-4d/0.1 (modelo didatico; scripts/assets/baixar_texturas.py)"}

# material do app -> textura do Poly Haven
MATERIAIS = {
    "argila": "cracked_red_ground",  # subleito e vala (substituída pela textura gerada por IA, mantida)
    "solo": "dry_mud_field_001",  # solo compactado (reaterro, regularização, pátio)
    "brita": "gravel_floor_04",  # cascalho e brita graduada
    "asfalto_novo": "asphalt_pit_lane",  # CBUQ novo
    "asfalto_usado": "asphalt_02",  # revestimento existente e vias do entorno
    "grama": "leafy_grass",
    "concreto": "concrete_floor_03",  # passeios, sarjeta e meio-fio
    "saibro": "cracked_red_ground",  # quadras de saibro do entorno
}


def obter(url):
    req = urllib.request.Request(url, headers=CABECALHO)
    with urllib.request.urlopen(req, timeout=300) as r:
        return r.read()


def baixar(url, arq, md5=None):
    if arq.exists() and (not md5 or hashlib.md5(arq.read_bytes()).hexdigest() == md5):
        return arq.read_bytes()
    dados = obter(url)
    if md5 and hashlib.md5(dados).hexdigest() != md5:
        raise RuntimeError(f"{arq.name}: md5 diferente do informado pela API")
    arq.parent.mkdir(parents=True, exist_ok=True)
    arq.write_bytes(dados)
    return dados


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--qualidade", type=int, default=88, help="qualidade do WebP (0 a 100)")
    args = ap.parse_args()
    if not features.check("webp"):
        sys.exit("O Pillow instalado não grava WebP.")
    manifesto = {"licenca": "CC0 1.0 (domínio público)", "download": datetime.date.today().isoformat(), "materiais": {}}
    arq_man = DESTINO / "texturas.json"
    anterior = json.loads(arq_man.read_text(encoding="utf-8")).get("materiais", {}) if arq_man.exists() else {}
    for nome, m in anterior.items():
        if m.get("ia"):
            manifesto["materiais"][nome] = m
    for nome, ident in MATERIAIS.items():
        if nome in manifesto["materiais"]:
            print(f"{nome:14s} gerada por IA (preparar-texturas.py), mantida")
            continue
        info = json.loads(obter(f"{API}/info/{ident}"))
        arquivos = json.loads(obter(f"{API}/files/{ident}"))
        dim = info.get("dimensions") or [1000, 1000]
        manifesto["materiais"][nome] = {
            "id": ident,
            "nome": info.get("name", ident),
            "autores": list(info.get("authors", {}).keys()),
            "tamanho_m": round(max(dim) / 1000, 2),
            "origem": f"https://polyhaven.com/a/{ident}",
        }
        for res in RESOLUCOES:
            pasta = DESTINO / nome / res
            pasta.mkdir(parents=True, exist_ok=True)
            for saida, mapa in MAPAS.items():
                f = arquivos[mapa][res]["jpg"]
                dados = baixar(f["url"], BRUTOS / ident / res / f"{mapa}.jpg", f.get("md5"))
                img = Image.open(io.BytesIO(dados)).convert("RGB")
                img.save(pasta / f"{saida}.webp", "WEBP", quality=args.qualidade, method=6)
            tam = sum(p.stat().st_size for p in pasta.glob("*.webp")) / 1e6
            print(f"{nome:14s} {ident:22s} {res}  {tam:5.1f} MB")
    arq_man.write_text(json.dumps(manifesto, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Pronto: {DESTINO}. Licença CC0; créditos em assets/CREDITOS.md.")


if __name__ == "__main__":
    main()
