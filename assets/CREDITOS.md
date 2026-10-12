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

## Texturas PBR do terreno e do pavimento (Fase 5)

Baixadas pela API pública do Poly Haven em 11/10/2026 por `scripts/assets/baixar_texturas.py` (1K e 2K; cor, normal OpenGL e ARM), convertidas para WebP. Manifesto com autores e tamanho real: `public/texturas/texturas.json`.

| Recurso | Fonte | Licença | Uso no app | Arquivos |
|---|---|---|---|---|
| Textura "Cracked Red Ground", de Amal Kumar | Poly Haven, https://polyhaven.com/a/cracked_red_ground | CC0 1.0 | Quadras de saibro do entorno (cor-alvo 0xa4683e) | `public/texturas/saibro/` |
| Textura "Dry Mud Field 001", de Rob Tuytel e Rico Cilliers | Poly Haven, https://polyhaven.com/a/dry_mud_field_001 | CC0 1.0 | Solo compactado: regularização, reaterro, substituição, sub-base existente, chão do entorno | `public/texturas/solo/` |
| Textura "Gravel Floor 04", de Charlotte Baglioni | Poly Haven, https://polyhaven.com/a/gravel_floor_04 | CC0 1.0 | Brita graduada, solo-brita, imprimação e pintura de ligação (sobre a base), pátio do canteiro, faixa de desvio | `public/texturas/brita/` |
| Textura "Asphalt 02", de Rob Tuytel | Poly Haven, https://polyhaven.com/a/asphalt_02 | CC0 1.0 | Revestimento existente e vias do entorno | `public/texturas/asfalto_usado/` |
| Textura "Leafy Grass", de Charlotte Baglioni | Poly Haven, https://polyhaven.com/a/leafy_grass | CC0 1.0 | Gramados, campos e matas | `public/texturas/grama/` |
| Textura "Concrete Floor 03", de Rob Tuytel e Matterfield | Poly Haven, https://polyhaven.com/a/concrete_floor_03 | CC0 1.0 | Passeios, sarjeta, meio-fio e vias de concreto | `public/texturas/concreto/` |

As texturas "Cracked Red Ground" (Amal Kumar) e "Asphalt Pit Lane" (Dimitrios Savva), usadas até 11/10/2026 no subleito e no CBUQ, foram substituídas pelas texturas geradas por IA abaixo. A "Cracked Red Ground" voltou em 12/10/2026 só para as quadras de saibro; a "Asphalt Pit Lane" não é mais distribuída com o app.

### Texturas geradas por IA

Geradas pelo autor com ChatGPT (OpenAI); pelos termos da OpenAI, o conteúdo gerado pertence ao usuário. Originais em `assets/brutos/texturas/*.png` (fora do git), tratados por `scripts/assets/preparar-texturas.py` (emenda eliminada por sobreposição das bordas com corte de erro mínimo, variação de brilho de grande escala atenuada, mapas de normal e ARM gerados a partir da cor, 1024 px e resolução útil do original). Manifesto: `public/texturas/texturas.json` (campo `ia: true`).

| Recurso | Arquivo de origem | Tratamento | Uso no app | Arquivos |
|---|---|---|---|---|
| Subleito argiloso compactado, de Felipe Miranda (ChatGPT) | Textura de Terra Vermelha Compactada.png | Saturação reduzida, tom vermelho-amarronzado (argila do RJ), faixas horizontais de rolo atenuadas; aplicada com 2 m de lado | Subleito exposto e vala | `public/texturas/argila/` |
| CBUQ compactado, de Felipe Miranda (ChatGPT) | Textura Asfáltica Escura e Granular.png | Emenda e mapas | CBUQ novo, superfície fresada, tinta de demarcação | `public/texturas/asfalto_novo/` |
| CBUQ solto, de Felipe Miranda (ChatGPT) | Textura de Asfalto Fresco e Brilhante.png | Emenda e mapas (rugosidade baixa: massa quente e brilhante) | CBUQ recém-espalhado, antes da rolagem | `public/texturas/asfalto_solto/` |

## Árvores (Fase 6)

| Recurso | Fonte | Licença | Uso no app | Arquivos |
|---|---|---|---|---|
| Modelo "Jacaranda Tree", de Rico Cilliers (orientação de Rob Tuytel) | Poly Haven, https://polyhaven.com/a/jacaranda_tree (API pública, download em 11/10/2026 por `scripts/assets/baixar_modelos.py`) | CC0 1.0 (domínio público); o crédito é cortesia | Árvores do entorno (jacarandá e os tons de oiti, ficus e amendoeira); a textura das folhas também forma as folhas da palmeira-imperial gerada no app | `public/modelos/arvores/jacaranda.glb` (malha reduzida por `scripts/assets/arvores.mjs`), `casca.webp`, `galhos.webp`, `folhas.webp`, `modelos.json` |

A palmeira-imperial, os tufos de grama, as fachadas (reboco, janelas, venezianas, telha cerâmica, laje e telha metálica), o meio-fio, a calçada, os postes e as placas são gerados no próprio app, sem recursos externos. O desenho das placas segue o Manual Brasileiro de Sinalização de Trânsito (CONTRAN).

## Equipamentos, canteiro, usina, drenagem e sinalização (Fase 7)

Autoria: imagens criadas por Felipe Miranda (ChatGPT) e modelos 3D gerados por Felipe Miranda no Tripo AI (plano pago). Licença: uso e distribuição autorizados pelo autor (assets/brutos/modelos/LICENCAS.txt). Reduzidos por scripts/otimizar-modelos.mjs (npm run modelos); decisões em dados/modelos.json.

| Modelo | Arquivo de origem | Uso no app | Arquivos |
|---|---|---|---|
| Escavadeira hidráulica 20 t | Escavadeira.glb | Equipamento ou objeto do 4D (terraplenagem) | public/modelos/escavadeira_lod0.glb, _lod1.glb |
| Caminhão basculante 6x4 (vazio) | cacamba vazia.glb | Equipamento ou objeto do 4D (terraplenagem) | public/modelos/basculante_lod0.glb, _lod1.glb |
| Caminhão basculante 6x4 carregado, com lona | cacamba cheia.glb | Equipamento ou objeto do 4D (terraplenagem) | public/modelos/basculante-carregado_lod0.glb, _lod1.glb |
| Caminhão basculante 6x4 com a caçamba levantada | CAÇAMBA BASCULANDO.glb | Equipamento ou objeto do 4D (terraplenagem) | public/modelos/basculante-basculando_lod0.glb, _lod1.glb |
| Caminhão guindauto (munck) 6x4 com carroceria | caminhao munck.glb | Equipamento ou objeto do 4D (apoio/viaturas) | public/modelos/caminhao-munck_lod0.glb, _lod1.glb |
| Caminhão espargidor de asfalto diluído CM-30 (imprimação) | CAMINHÃO DE CM-30.glb | Equipamento ou objeto do 4D (pavimentação) | public/modelos/espargidor-cm30_lod0.glb, _lod1.glb |
| Caminhão espargidor de emulsão asfáltica (pintura de ligação) | CL.glb | Equipamento ou objeto do 4D (pavimentação) | public/modelos/espargidor-rr_lod0.glb, _lod1.glb |
| Pá carregadeira de rodas | carregadeira.glb | Equipamento ou objeto do 4D (terraplenagem) | public/modelos/pa-carregadeira_lod0.glb, _lod1.glb |
| Motoniveladora | Motoniveladora.glb | Equipamento ou objeto do 4D (terraplenagem) | public/modelos/motoniveladora_lod0.glb, _lod1.glb |
| Rolo pé-de-carneiro vibratório | Rolo compactador.glb | Equipamento ou objeto do 4D (terraplenagem) | public/modelos/rolo-pe-de-carneiro_lod0.glb, _lod1.glb |
| Rolo liso vibratório monocilíndrico | ROLO LISO COM RODAS.glb | Equipamento ou objeto do 4D (terraplenagem) | public/modelos/rolo-liso_lod0.glb, _lod1.glb |
| Rolo tandem vibratório (dois cilindros lisos) | ROLO LISO.glb | Equipamento ou objeto do 4D (pavimentação) | public/modelos/rolo-tandem_lod0.glb, _lod1.glb |
| Rolo de pneus | ROLO PNEUMATICO.glb | Equipamento ou objeto do 4D (pavimentação) | public/modelos/rolo-pneus_lod0.glb, _lod1.glb |
| Vibroacabadora de esteiras | PAVIMENTADORA.glb | Equipamento ou objeto do 4D (pavimentação) | public/modelos/vibroacabadora_lod0.glb, _lod1.glb |
| Trator de esteiras com lâmina e escarificador | Trator de Esteira.glb | Equipamento ou objeto do 4D (terraplenagem) | public/modelos/trator-esteiras_lod0.glb, _lod1.glb |
| Fresadora a frio de esteiras com transportador frontal | fresadora.glb | Equipamento ou objeto do 4D (pavimentação) | public/modelos/fresadora_lod0.glb, _lod1.glb |
| Vassoura mecânica rebocável | vassoura mecânica.glb | Equipamento ou objeto do 4D (pavimentação) | public/modelos/vassoura-mecanica_lod0.glb, _lod1.glb |
| Retroescavadeira | Retroescavadeira.glb | Estacionada no pátio de máquinas do canteiro (o cronograma não tem equipe com retroescavadeira). | public/modelos/retroescavadeira_lod0.glb, _lod1.glb |
| Minicarregadeira (skid steer) | mini carregadeira.glb | Estacionada no pátio de máquinas do canteiro. | public/modelos/minicarregadeira_lod0.glb, _lod1.glb |
| Viatura administrativa (picape cabine dupla) | viatura administrativa.glb | Estacionada junto ao escritório da obra. | public/modelos/viatura-administrativa_lod0.glb, _lod1.glb |
| Caminhão comboio de combustível | CL COMPLETO.glb | Estacionado no pátio de máquinas do canteiro. | public/modelos/comboio-combustivel_lod0.glb, _lod1.glb |
| Grupo gerador rebocável | gerador.glb | Junto aos contêineres do canteiro. | public/modelos/gerador_lod0.glb, _lod1.glb |
| Contêiner de canteiro de 20 pés (escritório, laboratório, almoxarifado, refeitório e sanitários) | Alojamento.glb | Equipamento ou objeto do 4D (canteiro) | public/modelos/conteiner_lod0.glb, _lod1.glb |
| Baia de agregado com muros de concreto (brita) | armazen brita.glb | Equipamento ou objeto do 4D (usina) | public/modelos/baia-brita_lod0.glb, _lod1.glb |
| Usina de CBUQ contínua móvel (silos dosadores, tambor secador-misturador, filtro de mangas, elevador e silo de massa) | USINA ASFALTO.glb | Equipamento ou objeto do 4D (usina) | public/modelos/usina-cbuq_lod0.glb, _lod1.glb |
| Engenheiro residente (militar com colete refletivo e prancheta) | Engenheiro.glb | Na frente de serviço principal; sem frente ativa, junto ao escritório. | public/modelos/engenheiro_lod0.glb, _lod1.glb |
| Cone de sinalização de 75 cm | cONE.glb | Equipamento ou objeto do 4D (sinalização) | public/modelos/cone_lod0.glb, _lod1.glb |
| Tambor canalizador de sinalização | cone circular.glb | Acesso do canteiro. | public/modelos/tambor-sinalizacao_lod0.glb, _lod1.glb |
| Barreira plástica de bloqueio | sinalizador.glb | Equipamento ou objeto do 4D (sinalização) | public/modelos/barreira-plastica_lod0.glb, _lod1.glb |
| Caixa de boca de lobo pré-moldada com grelha | BUEIRO.glb | Equipamento ou objeto do 4D (drenagem) | public/modelos/boca-de-lobo_lod0.glb, _lod1.glb |
| Tubo de concreto ponta e bolsa, peça de 1 m | TUBO 1 M.glb | Estoque de tubos no canteiro e ao lado da vala aberta. A rede assentada continua procedural (centenas de peças instanciadas, ver relatório). | public/modelos/tubo-concreto_lod0.glb, _lod1.glb |
| Peça de meio-fio pré-moldado de concreto (1 m) | MEIO FIO.glb | Pilhas de peças no canteiro e na frente de meio-fio. O meio-fio assentado continua contínuo (procedural). | public/modelos/meio-fio_lod0.glb, _lod1.glb |
| Caminhão-pipa 10 000 L 6x4 | caminhao pipa.glb | Equipamento ou objeto do 4D (terraplenagem) | public/modelos/caminhao-pipa_lod0.glb, _lod1.glb |
| Caminhão betoneira 6x4 (balão de 8 m³) | caminhao betoneira.glb | Equipamento ou objeto do 4D (drenagem) | public/modelos/caminhao-betoneira_lod0.glb, _lod1.glb |
| Caminhão de pintura de faixas com carrinho aplicador | caminhao pintura de faixas.glb | Equipamento ou objeto do 4D (sinalização) | public/modelos/caminhao-pintura-faixas_lod0.glb, _lod1.glb |
| Extrusora de sarjeta de esteiras (fôrma deslizante) | extrusora de sarjeta.glb | Equipamento ou objeto do 4D (drenagem) | public/modelos/extrusora-sarjeta_lod0.glb, _lod1.glb |
| Compactador de placa vibratória | Compactador de solo.glb | Equipamento ou objeto do 4D (terraplenagem) | public/modelos/placa-vibratoria_lod0.glb, _lod1.glb |
| Topógrafo operando estação total sobre tripé, com a maleta | topografia estacao total.glb | Equipamento ou objeto do 4D (terraplenagem) | public/modelos/topografo-estacao-total_lod0.glb, _lod1.glb |
| Auxiliar de topografia com bastão e prisma | aux topografia.glb | Equipamento ou objeto do 4D (terraplenagem) | public/modelos/auxiliar-prisma_lod0.glb, _lod1.glb |
| Tripé com base nivelante (ponto de ré) | tripe seco.glb | Equipamento ou objeto do 4D (terraplenagem) | public/modelos/tripe-re_lod0.glb, _lod1.glb |
| Militar executor com colete refletivo e capacete branco | executor.glb | Operador da placa vibratória no reaterro da vala. | public/modelos/executor_lod0.glb, _lod1.glb |
| Sargento encarregado com rádio, colete refletivo e capacete azul | encarregado.glb | Na frente de serviço principal, ao lado do engenheiro residente. | public/modelos/encarregado_lod0.glb, _lod1.glb |

Não usados (rejeitados na varredura): 4 silos.glb, ARVORE GRANDE.glb, ARVORE PQN.glb. Motivos em dados/modelos.json.

## Som ambiente (Fase 8)

Áudios do Freesound com licença Creative Commons 0 (CC0 1.0, domínio público; a licença de cada um foi conferida na página do som em 12/10/2026). Baixados sem conta, a partir das prévias públicas em MP3 (`cdn.freesound.org/previews/…-hq.mp3`). O crédito é cortesia. Tocam em laço, só depois do clique no botão Som, com volume pela distância à câmera (`src/motor/som.js`).

| Recurso | Fonte | Licença | Uso no app | Arquivo |
|---|---|---|---|---|
| "Truck Engine Idle Loops", de qubodup | Freesound, https://freesound.org/people/qubodup/sounds/187564/ | CC0 1.0 | Motores a diesel das máquinas e dos caminhões em serviço | `public/sons/motor-diesel.mp3` |
| "Truck Reverse Beeper", de Disasteradio | Freesound, https://freesound.org/people/Disasteradio/sounds/197166/ | CC0 1.0 | Bipe de ré dos caminhões e das máquinas andando de ré | `public/sons/bipe-re.mp3` |
| "Soil compactor. Pinnasetihendaja müra.", de Jyri-channel | Freesound, https://freesound.org/people/Jyri-channel/sounds/857744/ | CC0 1.0 | Rolos vibratórios e placa vibratória em serviço | `public/sons/rolo-vibratorio.mp3` |
| "industrial hums factory water treatment plant drone highcut", de kyles | Freesound, https://freesound.org/people/kyles/sounds/453460/ | CC0 1.0 | Usina de CBUQ produzindo (ruído industrial contínuo; não há gravação CC0 de usina de asfalto no Freesound) | `public/sons/usina.mp3` |

Os efeitos de partículas (poeira, fumaça, vapor, jatos do pipa e do espargidor, exaustão) são gerados no próprio app, sem recursos externos.

## Fontes tipográficas

| Recurso | Licença |
|---|---|
| Instrument Serif, Hanken Grotesk e JetBrains Mono (pacotes @fontsource) | SIL Open Font License 1.1 |

## Bibliotecas

| Recurso | Licença |
|---|---|
| Three.js | MIT |
