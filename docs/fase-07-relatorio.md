# Fase 7 (complemento) · Relatório da varredura e do tratamento dos modelos 3D

Data: 11/10/2026. Origem: `assets/brutos/modelos/` (36 arquivos). Licença dos modelos do autor: `assets/brutos/modelos/LICENCAS.txt`. Decisões: `dados/modelos.json`. Miniaturas: `assets/miniaturas/`.

## Resumo

- 36 arquivos varridos: 35 GLB do Tripo AI e o jacarandá do Poly Haven (já tratado na Fase 6, fora deste pipeline).
- 32 modelos aceitos e 3 rejeitados. Os 35 arquivos do Tripo seguem o mesmo padrão: malha única com um material, de 0,45 a 1,96 milhão de triângulos, texturas 4096² (cor e metal/rugosidade em JPEG, normal em PNG), extensões `KHR_materials_volume` e `FB_ngon_encoding` e maior dimensão perto de 1 unidade.
- Pipeline `npm run modelos`: 1 823 MB de origem viram 22,4 MB em `public/modelos/` (19,7 MB nos níveis 0, 2,7 MB nos níveis 1). O maior nível 0 é o da usina, com 1,15 MB. A pasta inteira, com as árvores da Fase 6, tem 23,8 MB (limite de 40 MB).
- Texturas em WebP: o `toktx` (KTX-Software) não está instalado. O pipeline já gera KTX2 quando ele estiver no PATH (ver "Trabalho manual").
- Taxa de quadros na qualidade baixa (GTX 1660 Ti, sem limitador de quadros, mesma cena da obra em andamento): vista geral 95 fps com os modelos procedurais e 148 fps com os GLB; vista da frente 178 e 183 fps. As chamadas de desenho caíram de 224 para 132. Com o limitador ligado, os dois casos ficam em 60 fps. Não foi preciso reduzir os LODs.

## 1. Antes e depois por modelo

Triângulos: original → nível 0 / nível 1. Tamanho: MB do original → nível 0 + nível 1. Dimensões finais em metros (largura × altura × comprimento, com a frente em −Z).

| Arquivo | Equipamento identificado | Triângulos | MB | Dimensões (m) | Decisão |
|---|---|---|---|---|---|
| Escavadeira.glb | Escavadeira hidráulica 20 t | 1.910.037 → 39.997 / 4.900 | 63,8 → 0,93 + 0,11 | 4,4 × 5,8 × 9,5 | Aceito (exc) |
| cacamba vazia.glb | Caminhão basculante 6x4 (vazio) | 1.885.468 → 39.984 / 4.966 | 59,9 → 0,71 + 0,09 | 3,5 × 3,9 × 8,5 | Aceito (basculante, estado vazio) |
| cacamba cheia.glb | Caminhão basculante 6x4 carregado, com lona | 1.851.704 → 39.983 / 4.952 | 59,2 → 0,73 + 0,10 | 3,7 × 4,0 × 8,5 | Aceito (estado carregado; também é o caminhão de prova 8,2 t) |
| CAÇAMBA BASCULANDO.glb | Caminhão basculante com a caçamba levantada | 1.936.597 → 39.999 / 4.970 | 62,1 → 0,77 + 0,10 | 3,0 × 4,3 × 8,6 | Aceito (estado basculando, só na descarga) |
| caminhao munck.glb | Caminhão guindauto (munck) 6x4 | 1.837.868 → 39.980 / 4.930 | 59,9 → 0,81 + 0,10 | 3,3 × 4,1 × 9,0 | Aceito (munck e caminhão de apoio da sinalização) |
| CAMINHÃO DE CM-30.glb | Caminhão espargidor de CM-30 | 1.862.060 → 39.999 / 4.882 | 59,9 → 0,81 + 0,10 | 4,5 × 3,8 × 8,5 | Aceito (espargidor na imprimação) |
| CL.glb | Caminhão espargidor de emulsão RR | 1.844.315 → 39.997 / 4.928 | 59,9 → 0,82 + 0,10 | 4,7 × 4,0 × 8,5 | Aceito (espargidor na pintura de ligação) |
| carregadeira.glb | Pá carregadeira de rodas | 1.926.168 → 39.967 / 4.972 | 62,6 → 0,75 + 0,10 | 3,4 × 4,4 × 7,8 | Aceito (loader) |
| Motoniveladora.glb | Motoniveladora | 1.899.239 → 39.978 / 4.922 | 62,6 → 0,78 + 0,10 | 4,1 × 4,7 × 9,8 | Aceito (grader) |
| Rolo compactador.glb | Rolo pé-de-carneiro vibratório | 1.906.753 → 39.994 / 4.994 | 62,9 → 0,79 + 0,11 | 3,0 × 3,9 × 5,9 | Aceito (pe) |
| ROLO LISO COM RODAS.glb | Rolo liso vibratório monocilíndrico | 1.897.318 → 39.998 / 5.156 | 61,2 → 0,69 + 0,14 | 3,2 × 3,7 × 5,9 | Aceito (liso) |
| ROLO LISO.glb | Rolo tandem (dois cilindros) | 1.915.205 → 39.999 / 4.988 | 61,0 → 0,69 + 0,10 | 2,1 × 3,0 × 4,5 | Aceito (tandem) |
| ROLO PNEUMATICO.glb | Rolo de pneus | 1.894.995 → 39.990 / 4.970 | 59,9 → 0,67 + 0,10 | 2,7 × 3,3 × 4,9 | Aceito (pneus) |
| PAVIMENTADORA.glb | Vibroacabadora de esteiras | 1.836.321 → 39.972 / 4.958 | 60,6 → 0,81 + 0,11 | 3,7 × 3,4 × 6,0 | Aceito (paver) |
| Trator de Esteira.glb | Trator de esteiras com lâmina e escarificador | 1.911.462 → 40.160 / 5.014 | 61,6 → 0,77 + 0,10 | 3,5 × 4,0 × 6,6 | Aceito (dozer) |
| fresadora.glb | Fresadora a frio com transportador frontal | 1.836.639 → 39.978 / 4.978 | 59,3 → 0,75 + 0,10 | 3,1 × 6,3 × 12,5 | Aceito (mill) |
| vassoura mecânica.glb | Vassoura mecânica rebocável | 1.955.725 → 39.999 / 4.972 | 61,6 → 0,59 + 0,11 | 3,0 × 2,2 × 4,0 | Aceito, recolorida (vassoura, rebocada pelo trator procedural) |
| Retroescavadeira.glb | Retroescavadeira | 1.876.450 → 39.984 / 5.342 | 61,1 → 0,77 + 0,11 | 2,8 × 3,8 × 7,0 | Aceito (pátio do canteiro) |
| mini carregadeira.glb | Minicarregadeira | 1.865.816 → 39.997 / 4.968 | 61,2 → 0,80 + 0,10 | 2,0 × 2,4 × 3,5 | Aceito (pátio do canteiro) |
| viatura administrativa.glb | Picape cabine dupla | 1.851.694 → 40.000 / 4.948 | 59,3 → 0,73 + 0,10 | 2,4 × 2,2 × 5,3 | Aceito (junto ao escritório) |
| CL COMPLETO.glb | Caminhão comboio de combustível | 1.807.569 → 39.972 / 4.936 | 58,2 → 0,76 + 0,10 | 3,0 × 3,3 × 8,0 | Aceito (pátio do canteiro) |
| gerador.glb | Grupo gerador rebocável | 1.495.450 → 39.988 / 4.922 | 49,1 → 0,69 + 0,09 | 2,0 × 2,5 × 4,0 | Aceito (atrás dos contêineres) |
| Alojamento.glb | Contêiner de 20 pés | 1.813.550 → 20.000 / 3.000 | 55,3 → 0,33 + 0,07 | 6,1 × 2,4 × 2,8 | Aceito (os 5 módulos do canteiro) |
| armazen brita.glb | Baia de agregado com muros de concreto | 1.939.474 → 20.000 / 2.500 | 67,0 → 0,48 + 0,05 | 7,2 × 3,7 × 8,0 | Aceito (baias de brita 1, brita 0 e brita graduada) |
| USINA ASFALTO.glb | Usina de CBUQ contínua móvel | 1.887.138 → 79.998 / 7.936 | 60,7 → 1,15 + 0,13 | 24,0 × 18,1 × 18,0 | Aceito, recolorida (usina) |
| Engenheiro.glb | Engenheiro residente | 662.010 → 15.000 / 2.000 | 27,3 → 0,37 + 0,06 | 0,7 × 1,75 × 0,6 | Aceito (na frente principal) |
| cONE.glb | Cone de 75 cm | 1.318.573 → 3.000 / 300 | 43,7 → 0,09 + 0,02 | 0,5 × 0,75 × 0,5 | Aceito (cones da sinalização, instanciados) |
| cone circular.glb | Tambor canalizador | 1.701.336 → 4.000 / 406 | 53,4 → 0,09 + 0,02 | 0,8 × 1,05 × 0,8 | Aceito (portão do canteiro) |
| sinalizador.glb | Barreira plástica de bloqueio | 871.288 → 5.000 / 500 | 30,0 → 0,10 + 0,02 | 1,8 × 0,7 × 0,5 | Aceito (no lugar dos cavaletes do desvio total) |
| BUEIRO.glb | Caixa de boca de lobo com grelha | 1.941.768 → 6.000 / 800 | 66,3 → 0,17 + 0,04 | 1,2 × 0,6 × 0,9 | Aceito (bocas de lobo da sarjeta e estoque) |
| TUBO 1 M.glb | Tubo de concreto ponta e bolsa de 1 m | 1.918.362 → 4.996 / 598 | 66,2 → 0,16 + 0,02 | 1,0 × 0,6 × 0,6 | Aceito (estoque no canteiro) |
| MEIO FIO.glb | Peça de meio-fio de 1 m | 452.150 → 2.000 / 200 | 26,3 → 0,13 + 0,01 | 0,2 × 0,2 × 1,0 | Aceito (estoque no canteiro) |

Critério de escala: medidas típicas de mercado registradas em `criterioEscala` de cada entrada (por exemplo, escavadeira de 20 t com lança 9,5 m, basculante 6x4 8,5 m, rolo tandem 4,5 m, vibroacabadora 6 m, fresadora com transportador 12,5 m, picape 5,3 m). A escala usa a maior dimensão horizontal; para pessoa, cone e tambor, a altura. Como o Tripo não respeita proporções reais, larguras e alturas saem aproximadas: a escavadeira ficou com 4,4 m de largura e o contêiner com 2,4 m de altura (real: 2,59 m).

Orientação: frente original em +Z em 18 modelos, em −X em 4, em +X em 4; os simétricos ficaram sem rotação. O rolo liso com rodas veio girado cerca de 45° no plano horizontal (análise de componentes principais: eixo longo a −47° de X) e recebeu −140°. Todos foram conferidos nas miniaturas do nível 0 (`assets/miniaturas/lod0/`), com a frente em −Z e a base em Y = 0.

Recoloração: só a vassoura (amarela) e a usina (tambor laranja e guarda-corpos amarelos). Cones, tambor, barreira e o colete do engenheiro ficaram laranja, porque são sinalização e EPI. O gerador (cinza) e os contêineres (brancos) ficaram como vieram.

Divergências entre nome e imagem (valeu a imagem): `ROLO LISO.glb` é tandem, `Rolo compactador.glb` é pé-de-carneiro, `cone circular.glb` é tambor, `BUEIRO.glb` é caixa de boca de lobo, `Alojamento.glb` é contêiner genérico e `sinalizador.glb` é barreira. `CL.glb`, `CL COMPLETO.glb` e `CAMINHÃO DE CM-30.glb` foram identificados pelo autor (ver "Pendências").

## 2. Rejeitados e duplicatas

| Arquivo | Motivo |
|---|---|
| 4 silos.glb | Duplicata parcial: a usina completa (`USINA ASFALTO.glb`) já tem os silos dosadores, junto com tambor, filtro, elevador e silo de massa. Dois conjuntos de silos dosadores no canteiro não fazem sentido. |
| ARVORE GRANDE.glb | Vegetação fora das categorias desta fase, já resolvida na Fase 6 (jacarandá instanciado com níveis de detalhe e impostor). A folhagem em tufos achatados parece deformada, e 1,8 milhão de triângulos numa malha única não serve para centenas de instâncias. |
| ARVORE PQN.glb | Arbusto. Mesma razão; o entorno não usa arbustos. |
| jacaranda_tree (Poly Haven) | Não rejeitado: já tratado na Fase 6 por `scripts/assets/arvores.mjs`. |

Basculante: os três arquivos são estados do mesmo equipamento, não duplicatas. O vazio é o modelo base, e o carregado e o basculando entram conforme o ciclo. O basculando tem outra cabine e uma peça solta pequena atrás do eixo traseiro; foi aceito porque só aparece por segundos, na descarga. Se você separar a báscula no Blender (item 5), um arquivo basta para os três estados.

Espargidores: os dois arquivos ficaram, um por serviço (CM-30 na imprimação, RR na pintura de ligação), conforme a sua indicação.

Problemas encontrados nos aceitos: nenhuma base flutuando (o pipeline põe a base em Y = 0) e nenhuma textura borrada perceptível nas miniaturas. O basculando tem a peça solta já citada; a base da caixa de boca de lobo tem um pequeno desnível, sem efeito porque ela fica enterrada.

## 3. Equipamentos do 4D ainda sem GLB (continuam procedurais)

Em ordem de prioridade para você gerar:

1. **Caminhão-pipa 10 000 L**: aparece na regularização, na sub-base e na base. É o único "caminhão especial" do aceite que ainda falta.
2. **Caminhão betoneira**: bocas de lobo e sarjeta.
3. **Extrusora de sarjeta** (fôrma deslizante): sarjeta.
4. **Caminhão de pintura de faixas**: sinalização horizontal.
5. **Compactador de placa vibratória, com operador**: reaterro da vala.
6. **Estação total ou nível sobre tripé, com topógrafo**: topografia e interferências.

Situação do aceite da fase: escavadeira, basculante, motoniveladora, os quatro rolos, vibroacabadora, munck e os dois espargidores já usam GLB. Falta o caminhão-pipa (item 1).

Também ficam procedurais, por decisão de desempenho ou de modelagem: a rede de tubos assentada (centenas de peças instanciadas, com visibilidade por dia), o meio-fio e a sarjeta contínuos, os tanques de CAP com a bacia e a cabine de comando da usina, e a montagem da usina por etapas, que fica procedural até 88 % e depois dá lugar ao GLB.

## 4. Perda visual nos três modelos mais reduzidos

Os três com a maior redução de triângulos, à esquerda o original e à direita o nível 0 (3/4 e de frente):

- Cone, 440 vezes menos triângulos: `assets/miniaturas/comparacao/cone.webp`
- Tambor canalizador, 425 vezes: `assets/miniaturas/comparacao/tambor-sinalizacao.webp`
- Tubo de concreto, 384 vezes: `assets/miniaturas/comparacao/tubo-concreto.webp`

A perda aparece nas bordas das faixas refletivas do cone, que ficam um pouco onduladas (a simplificação desloca as costuras da textura), e na borda da bolsa do tubo, menos regular. Na distância em que esses objetos aparecem, a diferença não se nota. Se incomodar, suba `triangulos.lod0` dessas entradas em `dados/modelos.json` (por exemplo, cone para 6 000) e rode `npm run modelos`. Em máquinas, a redução fica entre 37 e 49 vezes; compare qualquer uma em `assets/miniaturas/originais/<id>.webp` × `assets/miniaturas/lod0/<id>.webp`.

## 5. Modelos que ganham com as peças móveis separadas no Blender

Hoje todos têm animação simplificada: deslocamento do conjunto, troca de estado do basculante e do espargidor, giroflex piscando nas máquinas em serviço cujo modelo tem luz âmbar (o pipeline achou em 11), e vibração vertical nos rolos lisos, pé-de-carneiro e tandem. O campo `partesMoveis` está vazio em todas as entradas.

| Modelo | Peças a separar | Ganho no 4D |
|---|---|---|
| Escavadeira | superestrutura (giro), lança, braço, caçamba, cilindros | Ciclo de escavação e giro de 90° para carregar o basculante, que o procedural já faz |
| Basculante (vazio) | báscula com o cilindro, carga | Um arquivo só para os três estados, com a báscula subindo de verdade |
| Vibroacabadora | mesa (abre e fecha), abas do silo, rosca | Mesa acompanhando a largura e silo esvaziando |
| Fresadora | transportador (elevação e giro), esteiras | Transportador acompanhando o basculante à frente |
| Pá carregadeira e retroescavadeira | braços, caçamba, articulação central; braço da retro | Ciclo de carga no estoque de fresado e na usina |
| Motoniveladora | lâmina com o círculo, escarificador | Lâmina inclinada no espalhamento |
| Rolos (4) | cilindros e rodas, articulação central | Cilindros girando conforme a distância percorrida |
| Munck | braço do guindauto, patolas | Içamento de tubos e de meio-fio |
| Trator de esteiras | lâmina, escarificador | Lâmina na limpeza |
| Usina | tambor secador | Tambor girando com a usina em operação |
| Vassoura | escova | Escova girando |

Como fazer no Blender:

1. Importe o GLB original de `assets/brutos/modelos/`.
2. Em Edit Mode, selecione a peça (L sobre a ilha, ou seleção em caixa) e use P > Selection.
3. Ponha a origem de cada peça no pivô real (pino da lança, eixo do cilindro) com Shift+S > Cursor to Selected e Set Origin > Origin to 3D Cursor.
4. Dê às peças os nomes que serão listados em `partesMoveis`.
5. Exporte em GLB com +Y para cima.

Atenção: o pipeline atual soma as transformações dos nós na geometria e zera os nós. Para modelos com peças separadas, ele precisa preservar os pivôs. Essa mudança fica para quando você enviar o primeiro modelo separado.

## 6. Canteiro (referência de arranjo)

A imagem `assets/referencias/vista_aerea_conceito.png` foi usada só como guia de arranjo, sem textura nem geometria. A área continua a de `public/local/meta.json` (135 × 72 m, no início do trecho):

- **Tapume** metálico no perímetro, com portão no ponto de acesso às vias reais (`acesso_pts`) e quatro tambores canalizadores no portão.
- **Contêineres na lateral**, junto ao portão: escritório, laboratório, almoxarifado, refeitório e sanitários. Atrás deles fica o gerador; a viatura administrativa fica ao lado.
- **Usina junto ao acesso**, com os tanques de CAP e a cabine de comando ao lado. O silo de massa do GLB foi posto no mesmo ponto em que os basculantes carregam, e a fumaça sai da chaminé do GLB.
- **Pátio de máquinas em três fileiras**, com as máquinas lado a lado. As vagas foram distribuídas pelo comprimento real: as mais longas nas duas fileiras da frente, as curtas na terceira, ao lado das baias. A retroescavadeira, a minicarregadeira e o comboio de combustível ocupam vagas do pátio.
- **Agregados separados por material**: brita 1, brita 0 e brita graduada em baias de concreto (GLB), na linha de trás; pó de pedra, areia e solo-brita em pilhas, na linha da frente. O estoque de fresado ficou ao lado da usina.
- **Estoques de drenagem** (tubos em pirâmide, meio-fio em camadas e caixas de boca de lobo) entre a usina e as baias.

## Como testar

1. `npm run modelos`: deve dizer "já processado" para os 32 modelos. Use `-- --forcar` para refazer tudo, ou `-- <id>` para um modelo só.
2. `npm test`: 73 testes, entre eles `tests/modelos.test.js`, que confere o catálogo, os equipamentos exigidos e o orçamento de arquivos.
3. `npm run dev` e abra o app:
   - Na vista 3D, o canteiro mostra primeiro os procedurais e, em alguns segundos, os GLB.
   - Avance o dia e use "Seguir frente".
   - Na aba "Contexto e normas", a tabela de recursos lista os 32 modelos.
   - Para conferir o fallback, renomeie um `public/modelos/<id>_lod0.glb` e `_lod1.glb`: o procedural fica e o console mostra um aviso.
4. `npm run build`.

## Pendências e trabalho manual

- **KTX2**: instale o KTX-Software (https://github.com/KhronosGroup/KTX-Software/releases), ponha o `toktx` no PATH e rode `npm run modelos -- --forcar`. O pipeline gera KTX2 (ETC1S na cor e em metal/rugosidade, UASTC na normal) e copia o transcodificador para `public/modelos/basis/`; o app já carrega o KTX2Loader. Esse ramo não pôde ser testado aqui, porque o `toktx` não está instalado.
- **Confirmar os caminhões-tanque**: nas suas respostas, a primeira dizia "CM-30 é o caminhão lubrificante", e a segunda disse que o CM-30 é o espargidor de CM-30, o CL é o espargidor de RR e o CL COMPLETO é o comboio de combustível. Segui a segunda. Você citou RR-2C; os dados da obra especificam RR-1C na pintura de ligação, e esse valor normativo não foi alterado.
- **Gerar os modelos da seção 3**, começando pelo caminhão-pipa.
- **Peças móveis no Blender** (seção 5), quando quiser animação completa.
- O Playwright do projeto pede o Chromium 1248, mas só o 1228 está baixado. Os scripts de miniatura usam o 1228 encontrado. Para atualizar, rode `npx playwright install chromium`.
- `assets/referencias/` não foi versionada (imagem de 4 MB, só referência). Diga se quiser incluí-la.
