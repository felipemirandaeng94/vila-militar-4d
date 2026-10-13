"""Baixa do Poly Haven (API pública, licença CC0) as texturas PBR do terreno e
do pavimento em 1K e 2K para assets/brutos/texturas/ (fora do git).

Uso:
    python scripts/assets/baixar_texturas.py
    python scripts/assets/texturas-ktx2.py      # depois: arrays KTX2 em public/texturas/

Para cada material e resolução grava assets/brutos/texturas/<id>/<res>/
Diffuse.jpg (cor, sRGB), nor_gl.jpg (normais, convenção OpenGL) e arm.jpg
(R = oclusão de ambiente, G = rugosidade, B = metal) e atualiza o manifesto
public/texturas/texturas.json (id, nome, autores, tamanho real em metros,
licença e origem de cada material). Até a Fase 9 este script também gravava
WebP com perda em public/texturas/; desde a Fase 10 o app lê só o KTX2, gerado
dos originais por texturas-ktx2.py.

Materiais marcados com "ia": true no manifesto (texturas geradas por IA e
preparadas por scripts/assets/preparar-texturas.py) não são sobrescritos.
"""
import argparse
import datetime
import hashlib
import json
import sys
import urllib.request
from pathlib import Path


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
    "solo_solto": "farm_soil",  # solo solto ou revolvido: leiras, monte da vala, camada espalhada sem compactar
    "cascalho_solto": "gravel_floor_02",  # brita e solo-brita soltos; o fresado usa a mesma, recolorida
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
    argparse.ArgumentParser(description=__doc__.splitlines()[0]).parse_args()
    manifesto = {"licenca": "CC0 1.0 (domínio público)", "download": datetime.date.today().isoformat(), "materiais": {}}
    arq_man = DESTINO / "texturas.json"
    antigo = json.loads(arq_man.read_text(encoding="utf-8")) if arq_man.exists() else {}
    anterior = antigo.get("materiais", {})
    ia = {nome: m for nome, m in anterior.items() if m.get("ia")}
    for nome, ident in MATERIAIS.items():
        if nome in ia:
            manifesto["materiais"][nome] = ia.pop(nome)
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
        # preserva a cor média e a emenda medidas por texturas-ktx2.py
        for k in ("media", "emenda_ktx2"):
            if k in anterior.get(nome, {}):
                manifesto["materiais"][nome][k] = anterior[nome][k]
        for res in RESOLUCOES:
            for mapa in MAPAS.values():
                f = arquivos[mapa][res]["jpg"]
                baixar(f["url"], BRUTOS / ident / res / f"{mapa}.jpg", f.get("md5"))
            print(f"{nome:14s} {ident:22s} {res}  baixado")
    # as geradas por IA sem textura do Poly Haven correspondente (CBUQ solto) vão no fim, na ordem anterior
    manifesto["materiais"].update(ia)
    if "ktx2" in antigo:
        manifesto["ktx2"] = antigo["ktx2"]
    arq_man.write_bytes(json.dumps(manifesto, ensure_ascii=False, indent=2).encode("utf-8"))
    print(f"Pronto: {BRUTOS}. Agora rode python scripts/assets/texturas-ktx2.py. Licença CC0; créditos em assets/CREDITOS.md.")


if __name__ == "__main__":
    main()
