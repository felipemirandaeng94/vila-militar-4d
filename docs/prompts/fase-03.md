# Fase 3 · Local real da Vila Militar (dados abertos)

Leia `CLAUDE.md`, `docs/PLANO.md`, `docs/ESCOPO.md` e `dados/local.json`. Execute somente a Fase 3.

Os dados do trecho já estão em `dados/local.json`: início (-22.868801, -43.407832), fim (-22.861972, -43.394281), pista de 7,0 m, canteiro e usina no início do trecho, cerca de 1,6 km pelo traçado da via existente (1.582 m em linha reta). O nome da via ainda está "a confirmar".

Objetivo: substituir o terreno e o entorno fictícios pelo local real, usando apenas dados abertos, e fazer o eixo da obra seguir o traçado real da via existente entre os dois pontos.

Tarefas:
1. Crie `scripts/geo/` em Python (venv, `requirements.txt` com geopandas, shapely, pyproj, rasterio, osmnx ou requests, numpy, trimesh). Defina um sistema local métrico (SIRGAS 2000 / UTM 23S, EPSG:31983) com origem no ponto de início do trecho e o eixo X alinhado à direção geral início → fim (azimute de cerca de 61°).
2. `baixar_osm.py`: baixe pela API Overpass, no retângulo que envolve o início e o fim com folga de cerca de 250 m em cada lado (aproximadamente 1,9 × 1,2 km), vias (com nome, largura, tipo e superfície), edificações, áreas verdes, campos e quadras. Salve em `geo/brutos/`.
3. `tracado.py`: identifique a via existente que liga o início ao fim. Ajuste cada ponto ao nó ou segmento de via mais próximo (relate a distância do ajuste; acima de 15 m, pare e confirme com o usuário), calcule o caminho mais curto pelo grafo de vias e mostre ao usuário o nome (ou nomes) das vias, a extensão e um mapa simples (PNG ou SVG) para confirmação antes de seguir. Se houver mais de um caminho plausível, apresente as opções. Gere `public/local/eixo.json` com a polilinha do eixo em coordenadas locais, o estaqueamento a cada 20 m, a extensão medida e as curvas (raios aproximados). Atualize `via` e a extensão medida em `dados/local.json` depois da confirmação.
4. `baixar_ipp.py`: tente obter as edificações do IPP (Prefeitura do Rio). Se o serviço estiver indisponível, explique ao usuário como baixar manualmente o shapefile pelo portal e onde salvar. Prefira o IPP ao OSM para contornos e alturas quando houver os dois.
5. `relevo.py`: gere o relevo a partir do melhor dado aberto disponível (Copernicus GLO-30 ou SRTM; se houver curvas de nível do IPP, use-as). Suavize e reamostre em grade de 2 m. Registre a precisão esperada (30 m) no relatório.
6. Ortofoto: verifique se há ortofoto oficial aberta da Prefeitura do Rio para a área e se a licença permite uso como textura. Se permitir, gere a textura do terreno do entorno. Não use imagens do Google Maps nem do Google Earth como textura: os termos do Google proíbem extração.
7. `gerar_cena.py`: produza `public/local/terreno.bin` (ou GLB), `public/local/vias.json`, `public/local/edificacoes.json` (contorno, altura ou nº de pavimentos, uso) e `public/local/meta.json` (origem, rotação, créditos).
8. No app: carregue esses arquivos, extruda os prédios e desenhe as vias existentes. Troque o eixo reto da Fase 2B pelo eixo curvo de `eixo.json`: pavimento, meio-fio, sarjeta, drenagem, frentes de serviço e equipamentos passam a seguir a polilinha (posição e orientação pelo estaqueamento), com as máquinas acompanhando as curvas. O greide de projeto acompanha o greide da via existente sobre o relevo real (é uma reconstrução: não há corte e aterro de terraplenagem). Recalcule os quantitativos e o cronograma com a extensão medida e redivida as frentes de 300 a 400 m.
9. Canteiro e usina: posicione-os no início do trecho, numa área livre próxima ao ponto inicial (sem edificações nem vias no OSM e no IPP), com área para estoques de agregados e de fresado. Proponha ao usuário uma ou duas opções de área e confirme antes de fixar. Registre a posição em `public/local/meta.json`.
10. Mostre os créditos das fontes na tela e em `assets/CREDITOS.md`.

Critérios de aceite: o eixo da obra segue a via existente entre o início e o fim, com a extensão medida registrada; o entorno corresponde ao trecho real; canteiro e usina estão no início do trecho, em área confirmada pelo usuário; os quantitativos, o cronograma e as frentes foram recalculados para a extensão medida e os testes atualizados; nenhum dado do Google foi baixado ou armazenado.

Atenção: área militar. Não inclua instalações sensíveis, nomes de edificações internas nem informações que não estejam em fontes públicas.
