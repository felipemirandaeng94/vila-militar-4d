# Recursos visuais (scripts/assets/)

Scripts que baixam ou preparam recursos externos. Registre a origem e a licença de cada recurso em `assets/CREDITOS.md` e na aba "Contexto e normas".

## baixar_polyhaven.py (Fase 4)

Baixa da API pública do Poly Haven (sem conta nem chave) o HDRI de céu diurno parcialmente nublado em 2K e 4K para `public/hdri/` (`ceu_2k.hdr`, `ceu_4k.hdr` e `ceu.json` com id, autores, licença e data). Só usa a biblioteca padrão do Python 3.

```
python scripts/assets/baixar_polyhaven.py                # HDRI padrão: kloofendal_48d_partly_cloudy_puresky
python scripts/assets/baixar_polyhaven.py --id <id>      # outro HDRI do Poly Haven
```

O app usa o 2K para a luz ambiente e o fundo (qualidades baixa e média) e o 4K só no fundo da qualidade alta. Prefira céus "pure sky" (sem chão fotografado): o chão é o terreno do modelo. Ao trocar de HDRI, atualize os créditos.

## baixar_texturas.py, preparar-texturas.py e texturas-ktx2.py (Fases 5 e 10)

`baixar_texturas.py` baixa do Poly Haven as texturas PBR do terreno e do pavimento em 1K e 2K (cor, normal OpenGL e ARM: oclusão, rugosidade e metal) para `assets/brutos/texturas/<id>/<res>/` (fora do git) e atualiza o manifesto `public/texturas/texturas.json`. `preparar-texturas.py` prepara as texturas geradas por IA (emenda, contraste, normal e ARM estimados) e grava PNG sem perda em `assets/brutos/texturas/preparadas/`.

`texturas-ktx2.py` (Fase 10) monta os arrays KTX2 que o app usa, uma camada por material na ordem de `TEXTURAS` (`src/motor/superficies.js`):

| Arquivo | Lado | Codificação |
|---|---|---|
| `public/texturas/1k/cor.ktx2` | 1024 px | ETC1S |
| `public/texturas/1k/normal.ktx2` | 1024 px | UASTC + Zstandard |
| `public/texturas/1k/arm.ktx2` | 512 px | UASTC + Zstandard |
| `public/texturas/2k/cor.ktx2` | 2048 px | ETC1S (qualidade alta) |

O WebP com perda (até a Fase 9) criava uma diferença na borda da textura e uma emenda fraca na repetição; o KTX2 sai dos originais. Antes da codificação, cada eixo com emenda acima de 0,95 recebe uma correção só junto da borda (o degrau de baixa frequência entre a última e a primeira coluna vai para uma rampa de 24 px de cada lado). Depois, as camadas são decodificadas e medidas de novo: a conversão falha se alguma passar de 1,1. Na cor em ETC1S a borda é comparada aos limites de bloco 4 × 4 do interior (o ETC1S cria degraus em todos eles). A cor média e a emenda de cada material vão para o manifesto.

```
pip install numpy pillow
python scripts/assets/baixar_texturas.py
python scripts/assets/preparar-texturas.py
python scripts/assets/texturas-ktx2.py           # requer o KTX-Software (ktx) no PATH ou em ferramentas/ktx-software/bin
python scripts/assets/texturas-ktx2.py --medir   # só mede a emenda dos arquivos gravados
```

Para trocar uma textura, mude o id em `MATERIAIS` no `baixar_texturas.py`, rode os três scripts, ajuste o tamanho real em `TAMANHO` (`src/motor/superficies.js`) e atualize os créditos.

## baixar_modelos.py e arvores.mjs (Fase 6)

`baixar_modelos.py` baixa do Poly Haven o modelo "Jacaranda Tree" (CC0) em glTF 1K para `assets/brutos/modelos/jacaranda_tree/` (fora do git; o binário tem 208 MB e 3,8 milhões de triângulos) e grava em `public/modelos/arvores/` as texturas em WebP (`casca.webp`, `galhos.webp` e `folhas.webp`, com o recorte das folhas no alfa) e o manifesto `modelos.json`.

`arvores.mjs` (Node, usa `meshoptimizer` e `@gltf-transform/core`, dependências de desenvolvimento) reduz a malha e grava `public/modelos/arvores/jacaranda.glb` com dois níveis de detalhe:

- tronco e galhos: tira os raminhos finos, solda os vértices pela posição e simplifica com o meshoptimizer (cerca de 4,6 mil triângulos no nível 0 e 0,8 mil no nível 1);
- folhas: cada cartão curvo do original vira um quadrilátero pelo ajuste afim entre a textura e o espaço; uma amostra estratificada pela copa fica (3.600 e 1.100 cartões), ampliada para cobrir 80% da área original;
- normais das folhas puxadas para fora da copa e oclusão na cor dos vértices.

```
pip install pillow
python scripts/assets/baixar_modelos.py
node scripts/assets/arvores.mjs
```

O impostor de longe e a palmeira-imperial são gerados no navegador (`src/motor/arvores.js`). Para trocar a árvore, ajuste o id em `baixar_modelos.py`, os nomes das primitivas em `arvores.mjs` (`branches`, `trunk`, `leaves`) e os créditos.
