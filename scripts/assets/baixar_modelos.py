"""Baixa do Poly Haven (API pública, licença CC0) o modelo "Jacaranda Tree" e
prepara as texturas usadas pelas árvores do entorno (Fase 6).

Uso:
    pip install pillow
    python scripts/assets/baixar_modelos.py
    node scripts/assets/arvores.mjs      # depois: reduz a malha e grava o GLB

Saída:
- assets/brutos/modelos/jacaranda_tree/ (fora do git): glTF 1K original
  (3,8 milhões de triângulos), binário e texturas JPG/PNG;
- public/modelos/arvores/: casca.webp (tronco), galhos.webp, folhas.webp
  (cor com o recorte das folhas no canal alfa) e modelos.json (manifesto com
  autores, licença, URL de origem e data do download).

Só usa a biblioteca padrão do Python e o Pillow. A API do Poly Haven não exige
conta nem chave; o modelo é CC0 (domínio público), e o crédito fica em
assets/CREDITOS.md e na aba "Contexto e normas".
"""
import datetime
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from baixar_polyhaven import API, obter_json, baixar  # noqa: E402

try:
    from PIL import Image
except ImportError:
    sys.exit("Instale o Pillow: pip install pillow")

RAIZ = Path(__file__).resolve().parents[2]
ID = "jacaranda_tree"
BRUTOS = RAIZ / "assets" / "brutos" / "modelos" / ID
DESTINO = RAIZ / "public" / "modelos" / "arvores"
# texturas do modelo: (chave da API, formato) -> arquivo em BRUTOS/textures
TEXTURAS = [("trunk_diff", "jpg"), ("branches_diff", "jpg"), ("leaves_diff", "jpg"), ("leaves_alpha", "png")]
# lado das texturas no app (px): casca e galhos aparecem pequenos; as folhas pedem mais detalhe
LADO = {"casca": 512, "galhos": 512, "folhas": 1024}


def baixar_modelo():
    arquivos = obter_json(f"{API}/files/{ID}")
    g = arquivos["gltf"]["1k"]["gltf"]
    BRUTOS.mkdir(parents=True, exist_ok=True)
    (BRUTOS / "textures").mkdir(exist_ok=True)
    gltf = BRUTOS / f"{ID}_1k.gltf"
    if not gltf.exists():
        print("baixando", gltf.name)
        baixar(g["url"], gltf, g.get("md5"))
    # o binário (208 MB) é comum a todas as resoluções; das texturas, só as do glTF 1K que o app usa
    for nome, item in g["include"].items():
        arq = BRUTOS / nome
        if arq.exists() or not (nome.endswith(".bin") or "_diff_" in nome):
            continue
        print("baixando", nome, f"({item['size'] / 1e6:.1f} MB)")
        baixar(item["url"], arq, item.get("md5"))
    for chave, fmt in TEXTURAS:
        arq = BRUTOS / "textures" / f"{ID}_{chave}_1k.{fmt}"
        if arq.exists():
            continue
        item = arquivos[chave]["1k"][fmt]
        print("baixando", arq.name)
        baixar(item["url"], arq, item.get("md5"))


def converter():
    DESTINO.mkdir(parents=True, exist_ok=True)
    t = lambda chave, fmt="jpg": BRUTOS / "textures" / f"{ID}_{chave}_1k.{fmt}"  # noqa: E731
    for saida, chave in (("casca", "trunk_diff"), ("galhos", "branches_diff")):
        img = Image.open(t(chave)).convert("RGB").resize((LADO[saida],) * 2, Image.LANCZOS)
        img.save(DESTINO / f"{saida}.webp", quality=88, method=6)
    cor = Image.open(t("leaves_diff")).convert("RGB")
    alfa = Image.open(t("leaves_alpha", "png")).convert("L")
    folhas = Image.merge("RGBA", (*cor.split(), alfa)).resize((LADO["folhas"],) * 2, Image.LANCZOS)
    # sem perdas no alfa: o recorte das folhas (alphaTest) não pode ganhar ruído de compressão
    folhas.save(DESTINO / "folhas.webp", quality=90, alpha_quality=100, method=6)


def manifesto():
    info = obter_json(f"{API}/info/{ID}")
    dados = {
        "modelos": [
            {
                "id": ID,
                "nome": info.get("name"),
                "autores": list(info.get("authors", {}).keys()),
                "licenca": "CC0 1.0 (domínio público)",
                "url": f"https://polyhaven.com/a/{ID}",
                "baixado_em": datetime.date.today().isoformat(),
                "arquivos": ["jacaranda.glb", "casca.webp", "galhos.webp", "folhas.webp"],
                "observacao": "Malha reduzida por scripts/assets/arvores.mjs (tronco e galhos simplificados, folhas desbastadas)",
            }
        ]
    }
    (DESTINO / "modelos.json").write_text(json.dumps(dados, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    baixar_modelo()
    converter()
    manifesto()
    print("pronto:", DESTINO.relative_to(RAIZ))
