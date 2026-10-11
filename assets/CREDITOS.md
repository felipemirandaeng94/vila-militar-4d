# Créditos e licenças dos recursos externos

Todo recurso externo usado no app deve constar aqui e na tela de créditos (aba "Contexto e normas" e linha de créditos sobre o modelo 3D).

## Dados do local (Fase 3)

| Recurso | Fonte | Licença ou termo | Uso no app | Arquivos |
|---|---|---|---|---|
| Vias, áreas verdes, matas, campos, quadras e edificações complementares | © colaboradores do OpenStreetMap, API Overpass (download em 11/10/2026) | ODbL 1.0 (https://www.openstreetmap.org/copyright). Os arquivos derivados continuam sob a ODbL e precisam manter a atribuição. | Traçado do eixo da obra (Av. Duque de Caxias), vias existentes, cores do uso do solo, vegetação | `public/local/eixo.json`, `vias.json`, `areas.json`, parte de `edificacoes.json` (campo `fonte: "OSM"`) |
| Edificações 2019 (contorno, altura, cota da base e do topo, Lidar 2019) | Prefeitura da Cidade do Rio de Janeiro – Instituto Pereira Passos, serviço `CadLog/Edificacoes_2019` (pgeo3.rio.rj.gov.br) | Dado aberto da Prefeitura; crédito obrigatório "Prefeitura da Cidade do Rio de Janeiro – Instituto Pereira Passos" | Prédios do entorno extrudados pela altura | `public/local/edificacoes.json` (campo `fonte: "IPP"`) |
| Modelo Digital de Terreno, Lidar 2019 (5 m, escala 1:10.000) | Prefeitura da Cidade do Rio de Janeiro – Instituto Pereira Passos, serviço `Cartografia/Modelo_Digital_de_Terreno__Lidar_2019__escala_1_10_000_` | Dado aberto da Prefeitura; mesmo crédito | Relevo do entorno e greide da via existente (amostras a cada 10 a 25 m, grade de 2 m) | `public/local/terreno.bin` |

Não usados:

- Ortofotos do IPP (mosaicos 1999 a 2025): o serviço não declara licença. Não foram baixadas nem usadas como textura. Para usar, é preciso confirmar a licença com o IPP ou no portal data.rio.
- Imagens do Google Maps ou do Google Earth: os termos do Google proíbem a extração. Nenhum dado do Google foi baixado ou armazenado.
- Copernicus GLO-30 (ESA): previsto em `scripts/geo/relevo.py` só como reserva, se o MDT do IPP ficar indisponível. Não foi usado nesta versão.

## Céu e iluminação (Fase 4)

| Recurso | Fonte | Licença | Uso no app | Arquivos |
|---|---|---|---|---|
| HDRI "Kloofendal 48d Partly Cloudy (Pure Sky)", de Greg Zaal e Jarod Guest | Poly Haven, https://polyhaven.com/a/kloofendal_48d_partly_cloudy_puresky (API pública, download em 11/10/2026 por `scripts/assets/baixar_polyhaven.py`) | CC0 1.0 (domínio público); o crédito é cortesia | Fundo do céu, luz ambiente (PMREM), direção do sol e cor da névoa | `public/hdri/ceu_2k.hdr`, `public/hdri/ceu_4k.hdr`, `public/hdri/ceu.json` |

## Fontes tipográficas

| Recurso | Licença |
|---|---|
| Instrument Serif, Hanken Grotesk e JetBrains Mono (pacotes @fontsource) | SIL Open Font License 1.1 |

## Bibliotecas

| Recurso | Licença |
|---|---|
| Three.js | MIT |
