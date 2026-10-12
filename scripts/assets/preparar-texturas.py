"""Prepara as texturas geradas por IA (assets/brutos/texturas/*.png) no formato das texturas do Poly Haven do projeto.

Uso:
    python scripts/assets/preparar-texturas.py               # processa e grava em public/texturas/
    python scripts/assets/preparar-texturas.py --so-medir    # só mede a emenda dos originais
    python scripts/assets/preparar-texturas.py --previas DIR # grava também prévias repetidas (antes e depois)

Para cada textura listada em TEXTURAS:
  1. elimina a emenda por sobreposição das bordas opostas (direita sobre esquerda, base sobre topo) com corte de erro
     mínimo e caminho cíclico, sem repetir conteúdo dentro da textura (perde a largura da faixa de sobreposição);
  2. atenua a variação de brilho de grande escala (o que mais denuncia a repetição vista de longe), aplica o ajuste
     de cor do material (subleito: menos saturação, tom vermelho-amarronzado, faixas horizontais de rolo atenuadas) e
     leva o contraste em espaço linear (desvio / média) ao valor do material. O shader recolore a textura pela razão
     entre o pixel e a média, em linear: com o contraste da foto gerada (CBUQ: 1,4), o agregado fica quase branco;
  3. gera o mapa de normais (convenção OpenGL, como o nor_gl do Poly Haven) a partir da altura estimada pelo brilho e
     o ARM (R = oclusão, G = rugosidade, B = metal) com parâmetros por material;
  4. grava public/texturas/<material>/1k/ em 1024 px e 2k/ na resolução útil do original (sem ampliar: o navegador
     redimensiona), em WebP, e atualiza o manifesto public/texturas/texturas.json.

A métrica de emenda é a razão entre a diferença média na borda (última e primeira coluna ou linha) e a diferença média
entre vizinhas no interior; perto de 1,0 não há emenda. A textura só é gravada se a razão final ficar abaixo de 1,1.
Requer numpy e Pillow com WebP.
"""
import argparse
import datetime
import json
import sys
from pathlib import Path

try:
    import numpy as np
    from PIL import Image, features
except ImportError:
    sys.exit("Instale numpy e Pillow: pip install numpy pillow")

RAIZ = Path(__file__).resolve().parents[2]
BRUTOS = RAIZ / "assets" / "brutos" / "texturas"
DESTINO = RAIZ / "public" / "texturas"
LIMITE = 1.1
AUTORIA = "Geradas pelo autor com ChatGPT (OpenAI); pelos termos da OpenAI, o conteúdo gerado pertence ao usuário."

# material do app -> arquivo bruto e parâmetros. tamanho_m: lado real da textura (m), pedido no prompt de geração.
# relevo: intensidade do mapa de normais; rug: rugosidade média e quanto o brilho a altera (grão claro mais áspero);
# achatar: fração da variação de brilho de grande escala removida; cor: ajuste do material (ver ajustar_cor);
# cv: contraste em linear (desvio / média da luminância); as texturas do Poly Haven do projeto ficam entre 0,15 e 0,6
TEXTURAS = {
    "argila": {
        "arquivo": "Textura de Terra Vermelha Compactada.png",
        "nome": "Subleito argiloso compactado",
        # gerada para 1 m; aplicada com 2 m de lado (entre 1,5, 1,75 e 2 m, a que menos repete de longe)
        "tamanho_m": 2.0,
        "relevo": 5.0,
        "rug": (0.93, 0.05),
        "achatar": 0.7,
        "cor": "subleito",
        "cv": 0.32,
    },
    "asfalto_novo": {
        "arquivo": "Textura Asfáltica Escura e Granular.png",
        "nome": "CBUQ compactado",
        "tamanho_m": 1.0,
        "relevo": 4.0,
        "rug": (0.84, 0.10),
        "achatar": 0.75,
        "cor": None,
        "cv": 0.55,
    },
    "asfalto_solto": {
        "arquivo": "Textura de Asfalto Fresco e Brilhante.png",
        "nome": "CBUQ solto (antes da rolagem)",
        "tamanho_m": 1.0,
        "relevo": 5.0,
        "rug": (0.42, 0.30),
        "achatar": 0.75,
        "cor": None,
        "cv": 0.65,
    },
}


# ---------- utilidades periódicas ----------
def borrar(a, sigma):
    """Desfoque gaussiano periódico (FFT) de uma imagem 2D ou 3D (canais no último eixo)."""
    h, w = a.shape[:2]
    fy = np.fft.fftfreq(h)[:, None]
    fx = np.fft.fftfreq(w)[None, :]
    g = np.exp(-2 * (np.pi * sigma) ** 2 * (fx**2 + fy**2))
    if a.ndim == 3:
        g = g[..., None]
    return np.real(np.fft.ifft2(np.fft.fft2(a, axes=(0, 1)) * g, axes=(0, 1)))


def luminancia(rgb):
    return rgb @ np.array([0.2126, 0.7152, 0.0722])


def emenda(rgb):
    """Razão borda/interior nos eixos x e y (1,0 = sem emenda)."""
    g = rgb.mean(2) if rgb.ndim == 3 else rgb
    ix = np.abs(np.diff(g, axis=1)).mean()
    iy = np.abs(np.diff(g, axis=0)).mean()
    return np.abs(g[:, -1] - g[:, 0]).mean() / ix, np.abs(g[-1] - g[0]).mean() / iy


# ---------- emenda: sobreposição com corte de erro mínimo ----------
def corte_ciclico(custo):
    """Caminho vertical de custo mínimo em custo (linhas x colunas da faixa), com a coluna final igual à inicial.
    Testa algumas colunas de partida e devolve a coluna do corte em cada linha."""
    h, w = custo.shape
    melhor = None
    for c0 in np.linspace(w * 0.2, w * 0.8, 9).astype(int):
        acc = np.full(w, np.inf)
        acc[c0] = custo[0, c0]
        volta = np.zeros((h, w), dtype=np.int8)
        for y in range(1, h):
            esq = np.concatenate(([np.inf], acc[:-1]))
            dir_ = np.concatenate((acc[1:], [np.inf]))
            pilha = np.stack((esq, acc, dir_))
            k = pilha.argmin(0)
            volta[y] = k - 1
            acc = pilha[k, np.arange(w)] + custo[y]
        if melhor is None or acc[c0] < melhor[0]:
            caminho = np.empty(h, dtype=int)
            caminho[-1] = c0
            for y in range(h - 1, 0, -1):
                caminho[y - 1] = caminho[y] + volta[y, caminho[y]]
            melhor = (acc[c0], caminho)
    return melhor[1]


def costurar_x(rgb, sobra):
    """Torna a imagem periódica em x: a faixa direita (sobra px) é sobreposta à esquerda e as duas se encontram no
    corte de menor diferença. Saída com largura w - sobra; a coluna final continua na primeira sem salto."""
    h, w, _ = rgb.shape
    R = rgb[:, w - sobra :]
    L = rgb[:, :sobra]
    custo = ((R - L) ** 2).sum(2)
    custo = borrar(custo, 1.5)
    cut = corte_ciclico(custo)
    # máscara: 1 (usa R) à esquerda do corte, 0 (usa L) à direita, com transição de ~3 px
    col = np.arange(sobra)[None, :]
    m = 1.0 / (1.0 + np.exp((col - cut[:, None]) / 1.2))
    faixa = R * m[..., None] + L * (1 - m[..., None])
    return np.concatenate((faixa, rgb[:, sobra : w - sobra]), axis=1)


def costurar(rgb, sobra):
    a = costurar_x(rgb, sobra)
    a = costurar_x(a.transpose(1, 0, 2), sobra).transpose(1, 0, 2)
    return a


# ---------- cor e tom ----------
def achatar(rgb, frac):
    """Remove frac da variação de brilho de grande escala (sigma de 1/12 do lado), preservando a cor média."""
    lum = luminancia(rgb)
    baixa = borrar(lum, rgb.shape[0] / 12)
    fator = (lum.mean() / np.maximum(baixa, 1e-3)) ** frac
    return rgb * fator[..., None]


def rgb_hsv(rgb):
    mx, mn = rgb.max(2), rgb.min(2)
    d = mx - mn
    h = np.zeros_like(mx)
    nz = d > 1e-6
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    i = nz & (mx == r)
    h[i] = ((g - b)[i] / d[i]) % 6
    i = nz & (mx == g) & (mx != r)
    h[i] = (b - r)[i] / d[i] + 2
    i = nz & (mx == b) & (mx != r) & (mx != g)
    h[i] = (r - g)[i] / d[i] + 4
    s = np.where(mx > 1e-6, d / np.maximum(mx, 1e-6), 0)
    return h / 6, s, mx


def hsv_rgb(h, s, v):
    h6 = (h % 1) * 6
    i = np.floor(h6).astype(int) % 6
    f = h6 - np.floor(h6)
    p, q, t = v * (1 - s), v * (1 - s * f), v * (1 - s * (1 - f))
    sel = [(v, t, p), (q, v, p), (p, v, t), (p, q, v), (t, p, v), (v, p, q)]
    out = np.zeros(h.shape + (3,))
    for k, (r, g, b) in enumerate(sel):
        m = i == k
        out[m] = np.stack((r[m], g[m], b[m]), -1)
    return out


def ajustar_cor(rgb, tipo):
    if tipo != "subleito":
        return rgb
    # faixas horizontais de rolo: perfil por linha da variação de brilho, atenuado em 75 %
    lum = luminancia(rgb)
    perfil = lum.mean(1)
    perfil = perfil / perfil.mean()
    perfil = borrar(perfil[:, None] * np.ones((1, 8)), 2.0)[:, 0]
    rgb = rgb / (perfil[:, None, None] ** 0.75)
    # argila do RJ: vermelho-amarronzado. Menos saturação, matiz puxado do laranja para o vermelho, um pouco mais escura
    h, s, v = rgb_hsv(np.clip(rgb, 0, 1))
    h = h - 0.006  # cerca de 2 graus para o vermelho
    s = s * 0.78
    v = v * 0.74
    return hsv_rgb(h, s, v)


def linear(c):
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def srgb(c):
    c = np.clip(c, 0, 1)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * c ** (1 / 2.4) - 0.055)


def contraste(rgb, cv):
    """Escala os desvios em torno da média (em linear) até o contraste cv; nunca aumenta o contraste."""
    lin = linear(rgb)
    lum = luminancia(lin)
    atual = lum.std() / lum.mean()
    k = min(1.0, cv / atual)
    media = lin.reshape(-1, 3).mean(0)
    return srgb(media + (lin - media) * k), atual


# ---------- normal e ARM ----------
def mapas(rgb, relevo, rug):
    lum = luminancia(rgb)
    # altura: grão claro é alto, ligante escuro é baixo; tira a grande escala e suaviza o ruído de pixel
    alt = lum - borrar(lum, 24)
    alt = borrar(alt, 0.8)
    alt = alt / max(alt.std(), 1e-6)
    dx = (np.roll(alt, -1, 1) - np.roll(alt, 1, 1)) / 2
    dy = (np.roll(alt, -1, 0) - np.roll(alt, 1, 0)) / 2
    # OpenGL: verde para cima (v cresce para o topo da imagem, as linhas crescem para baixo)
    k = relevo / 10
    n = np.stack((-dx * k, dy * k, np.ones_like(dx)), -1)
    n /= np.linalg.norm(n, axis=2, keepdims=True)
    normal = (n + 1) / 2
    # oclusão: cavidades (abaixo da média local) escurecem
    cav = borrar(alt, 6) - alt
    ao = np.clip(1 - 0.12 * np.maximum(cav, 0), 0.55, 1) * 0.92
    # rugosidade: média do material, mais áspera no grão claro
    r0, kr = rug
    lr = (lum - lum.mean()) / max(lum.std(), 1e-6)
    g = np.clip(r0 + kr * 0.35 * lr, 0.05, 1)
    arm = np.stack((ao, g, np.zeros_like(g)), -1)
    return normal, arm


# ---------- saída ----------
def redimensionar_periodico(a, lado):
    """Redimensiona mantendo a periodicidade (margem copiada do lado oposto antes do filtro)."""
    h = a.shape[0]
    p = 16
    big = np.pad(a, ((p, p), (p, p), (0, 0)), mode="wrap")
    img = Image.fromarray(np.clip(big * 255 + 0.5, 0, 255).astype(np.uint8))
    # box: o período de h px vira exatamente lado px; o filtro lê a margem fora da caixa
    return img.resize((lado, lado), Image.LANCZOS, box=(p, p, p + h, p + h))


def gravar(pasta, lado, mapas_rgb, qualidade):
    pasta.mkdir(parents=True, exist_ok=True)
    for nome, a in mapas_rgb.items():
        redimensionar_periodico(a, lado).save(pasta / f"{nome}.webp", "WEBP", quality=qualidade, method=6)


def previa(a, arq, n=3, lado=420):
    t = redimensionar_periodico(a, lado)
    out = Image.new("RGB", (lado * n, lado * n))
    for i in range(n):
        for j in range(n):
            out.paste(t, (i * lado, j * lado))
    out.save(arq, quality=88)


def ler(arq):
    return np.asarray(Image.open(arq).convert("RGB")).astype(np.float64) / 255


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--so-medir", action="store_true", help="só mede a emenda dos arquivos brutos")
    ap.add_argument("--previas", type=Path, help="pasta para as prévias repetidas (antes e depois)")
    ap.add_argument("--qualidade", type=int, default=88, help="qualidade do WebP (0 a 100)")
    ap.add_argument("--sobra", type=float, default=0.12, help="largura da faixa de sobreposição (fração do lado)")
    args = ap.parse_args()
    if args.so_medir:
        for arq in sorted(BRUTOS.glob("*.png")):
            ex, ey = emenda(ler(arq))
            print(f"{arq.name:45s} emenda x {ex:.2f}  y {ey:.2f}")
        return
    if not features.check("webp"):
        sys.exit("O Pillow instalado não grava WebP.")
    arq_man = DESTINO / "texturas.json"
    manifesto = json.loads(arq_man.read_text(encoding="utf-8"))
    falhas = []
    for mat, cfg in TEXTURAS.items():
        bruto = BRUTOS / cfg["arquivo"]
        if not bruto.exists():
            sys.exit(f"Falta {bruto}")
        rgb = ler(bruto)
        antes = emenda(rgb)
        sobra = int(rgb.shape[0] * args.sobra)
        rgb2 = costurar(rgb, sobra)
        rgb2 = np.clip(achatar(rgb2, cfg["achatar"]), 0, 1)
        rgb2 = np.clip(ajustar_cor(rgb2, cfg["cor"]), 0, 1)
        # mapas de normal e ARM pela foto antes da redução do contraste (o relevo do grão continua nítido)
        normal, arm = mapas(rgb2, cfg["relevo"], cfg["rug"])
        rgb2, cv0 = contraste(rgb2, cfg["cv"])
        depois = emenda(rgb2)
        # medida também na versão de 1024 px gravada
        rgb_1k = np.asarray(redimensionar_periodico(rgb2, 1024)).astype(np.float64) / 255
        d1k = emenda(rgb_1k)
        ok = max(depois + d1k) < LIMITE
        print(
            f"{mat:14s} emenda antes x {antes[0]:.2f} y {antes[1]:.2f} | depois x {depois[0]:.2f} y {depois[1]:.2f}"
            f" | 1024 px x {d1k[0]:.2f} y {d1k[1]:.2f}  {'ok' if ok else 'REPROVADA'}  ({rgb2.shape[0]} px,"
            f" contraste {cv0:.2f} -> {min(cv0, cfg['cv']):.2f})"
        )
        if args.previas:
            args.previas.mkdir(parents=True, exist_ok=True)
            previa(rgb, args.previas / f"{mat}_antes.jpg")
            previa(rgb2, args.previas / f"{mat}_depois.jpg")
        if not ok:
            falhas.append(mat)
            continue
        m = {"cor": rgb2, "normal": normal, "arm": arm}
        gravar(DESTINO / mat / "1k", 1024, m, args.qualidade)
        # 2k: resolução útil do original (não amplia; o carregador redimensiona para o lado do perfil)
        gravar(DESTINO / mat / "2k", rgb2.shape[0], m, args.qualidade)
        manifesto["materiais"][mat] = {
            "id": bruto.stem,
            "nome": cfg["nome"],
            "autores": ["Felipe Miranda (ChatGPT, OpenAI)"],
            "tamanho_m": cfg["tamanho_m"],
            "origem": "Gerada por IA (ChatGPT, OpenAI); preparada por scripts/assets/preparar-texturas.py",
            "licenca": AUTORIA,
            "ia": True,
            "preparo": datetime.date.today().isoformat(),
            "emenda": {"antes": [round(v, 2) for v in antes], "depois": [round(v, 2) for v in d1k]},
        }
    arq_man.write_text(json.dumps(manifesto, ensure_ascii=False, indent=2), encoding="utf-8")
    if falhas:
        sys.exit(f"Emenda acima de {LIMITE} (não gravadas): {', '.join(falhas)}")
    print(f"Pronto: {DESTINO}. Créditos em assets/CREDITOS.md.")


if __name__ == "__main__":
    main()
