"""Converte as texturas PBR do terreno e do pavimento para arrays KTX2 (Fase 10).

Uso:
    python scripts/assets/texturas-ktx2.py            # converte, mede a emenda e grava em public/texturas/
    python scripts/assets/texturas-ktx2.py --medir    # só mede a emenda dos KTX2 já gravados

Entradas sem perda adicional (fora do git): os originais do Poly Haven em assets/brutos/texturas/<id>/<res>/
(baixar_texturas.py) e os PNG das texturas geradas por IA em assets/brutos/texturas/preparadas/<material>/<res>/
(preparar-texturas.py). O WebP com perda não entra: ele criava uma diferença na borda e uma emenda fraca na repetição.

Saída: um array de textura por mapa, com uma camada por material na ordem de CAMADAS (a mesma de TEXTURAS em
src/motor/superficies.js) e mipmaps gerados com repetição nas bordas:
    public/texturas/1k/cor.ktx2      1024 px, ETC1S (BasisLZ)
    public/texturas/1k/normal.ktx2   1024 px, UASTC + Zstandard (normal OpenGL)
    public/texturas/1k/arm.ktx2       512 px, UASTC + Zstandard (R = oclusão, G = rugosidade, B = metal)
    public/texturas/2k/cor.ktx2      2048 px, ETC1S
A qualidade alta usa a cor de 2K com a normal e o ARM do conjunto 1k: normal e ARM de 2K em UASTC somariam cerca de
100 MB. O ARM (oclusão e rugosidade, de baixa frequência) fica com metade do lado: 4 vezes menos arquivo e memória.

Emenda: a métrica de preparar-texturas.py (razão entre a diferença média na borda e entre vizinhas no interior). Antes
da codificação, cada eixo com razão acima de ALVO recebe uma correção só junto da borda: a parte de baixa frequência do
salto entre a última e a primeira coluna (ou linha) é distribuída numa rampa de LARGURA px de cada lado, o que tira o
degrau sem apagar o grão. Depois da codificação as camadas são decodificadas pelo ktx extract e medidas de novo; a
conversão falha se alguma passar de LIMITE. A cor média (linear) de cada material sai da cor decodificada e vai para o
manifesto public/texturas/texturas.json, lida pelo app para recolorir as texturas.

Requer numpy, Pillow e o KTX-Software 4.3 ou mais novo (ktx), no PATH ou em ferramentas/ktx-software/bin.
"""
import argparse
import importlib.util
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

try:
    import numpy as np
    from PIL import Image
except ImportError:
    sys.exit("Instale numpy e Pillow: pip install numpy pillow")

RAIZ = Path(__file__).resolve().parents[2]
BRUTOS = RAIZ / "assets" / "brutos" / "texturas"
PREPARADAS = BRUTOS / "preparadas"
DESTINO = RAIZ / "public" / "texturas"
LIMITE = 1.1
ALVO = 0.95
LARGURA = 24

# ordem das camadas: igual a TEXTURAS em src/motor/superficies.js (conferida em tests/texturas.test.js)
CAMADAS = [
    "argila",
    "solo",
    "brita",
    "asfalto_novo",
    "asfalto_usado",
    "grama",
    "concreto",
    "saibro",
    "asfalto_solto",
    "solo_solto",
    "cascalho_solto",
]
# arquivo de cada mapa nos originais do Poly Haven
POLYHAVEN = {"cor": "Diffuse.jpg", "normal": "nor_gl.jpg", "arm": "arm.jpg"}
# (pasta, lado, mapa, origem 1k ou 2k, parâmetros do ktx create)
COR = ["--format", "R8G8B8_SRGB", "--assign-tf", "srgb", "--assign-primaries", "srgb", "--encode", "basis-lz", "--clevel", "2", "--qlevel", "192"]
UASTC = ["--format", "R8G8B8_UNORM", "--assign-tf", "linear", "--assign-primaries", "none", "--encode", "uastc", "--uastc-quality", "2", "--zstd", "18"]
SAIDAS = [
    ("1k", 1024, "cor", "1k", COR),
    ("1k", 1024, "normal", "1k", UASTC + ["--uastc-rdo", "--uastc-rdo-l", "0.5"]),
    # ARM é liso: o RDO deixa os limites dos blocos 4 × 4 visíveis na métrica, então fica sem ele
    ("1k", 512, "arm", "1k", UASTC),
    ("2k", 2048, "cor", "2k", COR),
]

_spec = importlib.util.spec_from_file_location("preparar", Path(__file__).with_name("preparar-texturas.py"))
preparar = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(preparar)
emenda = preparar.emenda


def emenda_blocos(rgb):
    """Razão entre a diferença na borda e a diferença média entre colunas (ou linhas) que cruzam um limite de bloco
    4 × 4 no interior. Para o ETC1S, cujos blocos criam degraus em todo o interior, é esta a medida de emenda: a borda
    da textura também é um limite de bloco."""
    g = rgb.mean(2)
    ix = np.abs(np.diff(g, axis=1))[:, 3::4].mean()
    iy = np.abs(np.diff(g, axis=0))[3::4].mean()
    return np.abs(g[:, -1] - g[:, 0]).mean() / ix, np.abs(g[-1] - g[0]).mean() / iy


def ktx():
    nome = "ktx.exe" if os.name == "nt" else "ktx"
    for c in (os.environ.get("KTX"), shutil.which("ktx"), RAIZ / "ferramentas" / "ktx-software" / "bin" / nome):
        if c and Path(c).exists():
            return str(c)
    sys.exit("KTX-Software não encontrado: instale e ponha o ktx no PATH ou em ferramentas/ktx-software/bin.")


def ler(arq):
    return np.asarray(Image.open(arq).convert("RGB")).astype(np.float64) / 255


def fonte(material, mapa, res, manifesto):
    m = manifesto["materiais"][material]
    arq = PREPARADAS / material / res / f"{mapa}.png" if m.get("ia") else BRUTOS / m["id"] / res / POLYHAVEN[mapa]
    if not arq.exists():
        sys.exit(f"Falta {arq} (rode baixar_texturas.py e preparar-texturas.py)")
    return arq


# ---------- emenda ----------
def _borrar_borda(d, sigma):
    f = np.fft.fftfreq(d.shape[0])[:, None]
    return np.real(np.fft.ifft(np.fft.fft(d, axis=0) * np.exp(-2 * (np.pi * sigma * f) ** 2), axis=0))


def _rampa_x(a, sigma):
    """Tira o degrau de baixa frequência entre a última e a primeira coluna (rampa de LARGURA px de cada lado)."""
    a = a.copy()
    d = _borrar_borda(a[:, 0] - a[:, -1], sigma)
    for j in range(LARGURA):
        t = 0.5 * (1 - j / LARGURA)
        a[:, j] -= d * t
        a[:, -1 - j] += d * t
    return a


def corrigir_emenda(a):
    """Corrige cada eixo com razão acima de ALVO, da correção mais suave (sigma grande) à mais forte."""
    for eixo in (0, 1):
        b = a if eixo == 0 else a.transpose(1, 0, 2)
        if emenda(b)[0] > ALVO:
            for sigma in (16, 8, 4, 3, 2, 1.5, 1):
                c = _rampa_x(b, sigma)
                if emenda(c)[0] <= ALVO:
                    break
            b = c
        a = b if eixo == 0 else b.transpose(1, 0, 2)
    return np.clip(a, 0, 1)


def preparar_camada(arq, lado):
    a = ler(arq)
    if a.shape[0] != lado:
        a = np.asarray(preparar.redimensionar_periodico(a, lado)).astype(np.float64) / 255
    return corrigir_emenda(a)


# ---------- KTX2 ----------
def decodificar(exe, arq, pasta):
    """Camadas do nível 0 decodificadas em RGBA8 (lista na ordem das camadas)."""
    pasta.mkdir(parents=True, exist_ok=True)
    subprocess.run([exe, "extract", "--transcode", "rgba8", "--layer", "all", str(arq), str(pasta)], check=True, capture_output=True)
    arqs = sorted(pasta.glob("*.png"), key=lambda p: int("".join(ch for ch in p.stem.split("layer")[-1] if ch.isdigit()) or 0))
    if len(arqs) != len(CAMADAS):
        sys.exit(f"{arq.name}: {len(arqs)} camadas decodificadas, esperadas {len(CAMADAS)}")
    return [ler(p) for p in arqs]


def linear(c):
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def medir(exe, tmp):
    """Emenda (máximo dos dois eixos) de cada camada de cada arquivo gravado e cor média linear da cor de 1K."""
    res, medias = {}, {}
    for pasta, _, mapa, _, _ in SAIDAS:
        arq = DESTINO / pasta / f"{mapa}.ktx2"
        camadas = decodificar(exe, arq, tmp / f"medir_{pasta}_{mapa}")
        for nome, img in zip(CAMADAS, camadas):
            res[(pasta, mapa, nome)] = max(emenda_blocos(img) if mapa == "cor" else emenda(img))
            if pasta == "1k" and mapa == "cor":
                medias[nome] = [round(float(v), 5) for v in linear(img).reshape(-1, 3).mean(0)]
    return res, medias


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--medir", action="store_true", help="só mede a emenda dos KTX2 já gravados")
    args = ap.parse_args()
    exe = ktx()
    arq_man = DESTINO / "texturas.json"
    manifesto = json.loads(arq_man.read_text(encoding="utf-8"))
    faltam = [n for n in CAMADAS if n not in manifesto["materiais"]]
    if faltam:
        sys.exit(f"Materiais fora do manifesto: {', '.join(faltam)}")
    with tempfile.TemporaryDirectory() as t:
        tmp = Path(t)
        antes = {}
        if not args.medir:
            for pasta, lado, mapa, res, opcoes in SAIDAS:
                entradas = []
                for nome in CAMADAS:
                    arq = fonte(nome, mapa, res, manifesto)
                    antes[(pasta, mapa, nome)] = max(emenda(ler(arq)))
                    png = tmp / f"{pasta}_{mapa}_{CAMADAS.index(nome):02d}.png"
                    Image.fromarray(np.clip(preparar_camada(arq, lado) * 255 + 0.5, 0, 255).astype(np.uint8)).save(png)
                    entradas.append(str(png))
                saida = DESTINO / pasta / f"{mapa}.ktx2"
                saida.parent.mkdir(parents=True, exist_ok=True)
                cmd = [exe, "create", *opcoes, "--layers", str(len(CAMADAS)), "--generate-mipmap", "--mipmap-wrap", "wrap"]
                subprocess.run([*cmd, *entradas, str(saida)], check=True, capture_output=True)
                print(f"{pasta}/{mapa}.ktx2  {lado} px  {saida.stat().st_size / 1e6:5.1f} MB")
        emendas, medias = medir(exe, tmp)
    reprovadas = [k for k, v in emendas.items() if v >= LIMITE]
    print(f"\n{'material':15s} " + "  ".join(f"{p}/{m:6s}" for p, _, m, _, _ in SAIDAS) + "   (emenda depois; antes entre parênteses)")
    for nome in CAMADAS:
        cols = []
        for pasta, _, mapa, _, _ in SAIDAS:
            a = antes.get((pasta, mapa, nome))
            cols.append(f"{emendas[(pasta, mapa, nome)]:.2f}" + (f" ({a:.2f})" if a is not None else ""))
        print(f"{nome:15s} " + "  ".join(f"{c:11s}" for c in cols))
    for nome in CAMADAS:
        m = manifesto["materiais"][nome]
        m["media"] = medias[nome]
        m["emenda_ktx2"] = {f"{p}/{mp}": round(emendas[(p, mp, nome)], 2) for p, _, mp, _, _ in SAIDAS}
    manifesto["ktx2"] = {
        "camadas": CAMADAS,
        "arquivos": {f"{p}/{m}.ktx2": {"lado": lado, "codificacao": "ETC1S" if o is COR else "UASTC + Zstandard"} for p, lado, m, _, o in SAIDAS},
        "limite_emenda": LIMITE,
    }
    arq_man.write_text(json.dumps(manifesto, ensure_ascii=False, indent=2), encoding="utf-8")
    if reprovadas:
        sys.exit("Emenda acima de %.1f: %s" % (LIMITE, ", ".join("/".join(k) for k in reprovadas)))
    total = sum(p.stat().st_size for p in DESTINO.rglob("*.ktx2")) / 1e6
    print(f"\nPronto: {total:.1f} MB em KTX2; emenda abaixo de {LIMITE} em todas as camadas.")


if __name__ == "__main__":
    main()
