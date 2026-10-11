# Pipeline do local real (Fase 3)

Gera os arquivos de `public/local/` a partir de dados abertos (OpenStreetMap e IPP). Os dados brutos ficam em `geo/brutos/` e os intermediários em `geo/tmp/` (fora do Git).

## Preparar

```
cd scripts/geo
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
```

No Windows, para ver os acentos no terminal: `set PYTHONIOENCODING=utf-8`.

## Sistema local

`comum.py`: SIRGAS 2000 / UTM 23S (EPSG:31983), origem no início do trecho (`dados/local.json`), eixo x na direção início → fim (azimute de cerca de 62°) e y à esquerda. No app: X = x, Z = −y (com o centro do eixo na origem) e Y = cota.

## Ordem

1. `baixar_osm.py`: vias, edificações, áreas verdes, campos e quadras pela API Overpass, no retângulo do trecho com 250 m de folga (1,9 × 1,2 km). Tenta vários servidores.
2. `tracado.py`: identifica a via existente entre o início e o fim, relata o ajuste dos pontos (acima de 15 m, pede confirmação) e lista os caminhos plausíveis com mapas em `geo/tmp/`.
   - `--preferir <ids OSM>` favorece um corredor (as demais vias custam 20 vezes mais).
   - Depois da confirmação do usuário: `--opcao N --confirmar` grava `public/local/eixo.json` e atualiza `dados/local.json`.
   - Traçado confirmado na Fase 3: `python tracado.py --preferir 1215394221,1280361847,1280361849,1280361851,1280361853,1280361855,1280361857 --aceitar-ajuste --opcao 1 --confirmar` (Av. Duque de Caxias, 1.582,8 m; ajuste de 26,1 m no início e de 3,1 m no fim).
3. `baixar_ipp.py`: edificações 2019 do IPP (altura do Lidar) e amostras do MDT Lidar 2019 (cerca de 5.300 consultas, 8 a 9 minutos; não repete se o arquivo existir). Se o serviço estiver fora do ar, o topo do script explica o download manual.
4. `relevo.py`: interpola as amostras em grade de 2 m e suaviza. Sem o IPP, usa o Copernicus GLO-30 (30 m).
5. `canteiro.py`: procura áreas livres de 135 × 72 m perto do início, sem edificações, vias, quadras ou água. Depois da confirmação: `--fixar N` (opção 2, noroeste, confirmada na Fase 3).
6. `gerar_cena.py`: grava `terreno.bin`, `vias.json`, `areas.json`, `edificacoes.json` e `meta.json` (origem, rotação, grade do terreno, pista existente, canteiro, acesso e créditos).

Depois de rodar o pipeline, confira `npm test` (os testes de `tests/local.test.js` leem `public/local/`).

## Regras

- Somente dados abertos. Nada do Google (Maps, Earth ou 3D Tiles) é baixado ou armazenado.
- Área militar: não gravar nomes de edificações; vias de acesso privado ficam sem nome.
- Créditos em `assets/CREDITOS.md` e na tela.
