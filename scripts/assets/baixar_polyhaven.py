"""Baixa do Poly Haven (API pública, licença CC0) um HDRI de céu diurno
parcialmente nublado em 2K e 4K para public/hdri/.

Uso:
    python scripts/assets/baixar_polyhaven.py            # HDRI padrão
    python scripts/assets/baixar_polyhaven.py --id <id>  # outro HDRI do Poly Haven

Saída: public/hdri/ceu_2k.hdr, public/hdri/ceu_4k.hdr e public/hdri/ceu.json
(id, nome, autores, licença, URL de origem e data do download).

Só usa a biblioteca padrão do Python. A API do Poly Haven não exige conta nem
chave; o HDRI é CC0 (domínio público), e o crédito fica em assets/CREDITOS.md.
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
DESTINO = RAIZ / "public" / "hdri"
# céu puro (sem chão fotografado), sol alto e nuvens esparsas: o chão é o terreno do modelo
PADRAO = "kloofendal_48d_partly_cloudy_puresky"
RESOLUCOES = ["2k", "4k"]
CABECALHO = {"User-Agent": "vila-militar-4d/0.1 (modelo didatico; scripts/assets/baixar_polyhaven.py)"}


def obter_json(url):
    req = urllib.request.Request(url, headers=CABECALHO)
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)


def baixar(url, arq, md5=None):
    req = urllib.request.Request(url, headers=CABECALHO)
    h = hashlib.md5()
    tmp = arq.with_suffix(arq.suffix + ".parcial")
    with urllib.request.urlopen(req, timeout=300) as r, open(tmp, "wb") as f:
        while True:
            bloco = r.read(1 << 20)
            if not bloco:
                break
            h.update(bloco)
            f.write(bloco)
    if md5 and h.hexdigest() != md5:
        tmp.unlink()
        raise RuntimeError(f"{arq.name}: md5 diferente do informado pela API")
    tmp.replace(arq)


def escolher(id_pedido):
    """Confere o id pedido; sem ele, procura um céu parcialmente nublado de dia."""
    hdris = obter_json(f"{API}/assets?t=hdris")
    if id_pedido:
        if id_pedido not in hdris:
            sys.exit(f"HDRI '{id_pedido}' não encontrado no Poly Haven.")
        return id_pedido, hdris[id_pedido]
    if PADRAO in hdris:
        return PADRAO, hdris[PADRAO]
    # reserva: o primeiro céu puro, parcialmente nublado e diurno
    for i, a in sorted(hdris.items(), key=lambda x: -x[1].get("download_count", 0)):
        cats = set(a.get("categories", []))
        if {"skies", "partly cloudy"} <= cats and "night" not in cats and "sunrise-sunset" not in cats:
            return i, a
    sys.exit("Nenhum HDRI de céu parcialmente nublado encontrado.")


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--id", help="id do HDRI no Poly Haven")
    args = ap.parse_args()
    ident, ativo = escolher(args.id)
    arquivos = obter_json(f"{API}/files/{ident}")["hdri"]
    DESTINO.mkdir(parents=True, exist_ok=True)
    meta = {
        "id": ident,
        "nome": ativo.get("name", ident),
        "autores": list(ativo.get("authors", {}).keys()),
        "licenca": "CC0 1.0 (domínio público)",
        "origem": f"https://polyhaven.com/a/{ident}",
        "download": datetime.date.today().isoformat(),
        "arquivos": {},
    }
    for res in RESOLUCOES:
        info = arquivos[res]["hdr"]
        arq = DESTINO / f"ceu_{res}.hdr"
        print(f"Baixando {ident} {res} ({info['size'] / 1e6:.1f} MB)...")
        baixar(info["url"], arq, info.get("md5"))
        meta["arquivos"][res] = arq.name
    (DESTINO / "ceu.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Pronto: {DESTINO}. Autores: {', '.join(meta['autores'])}. Licença CC0.")


if __name__ == "__main__":
    main()
