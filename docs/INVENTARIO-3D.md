# Inventário 3D · o que falta para o nível visual e didático alto

Data: 12/10/2026. Análise sem código: fontes lidas foram `docs/PLANO.md`, `docs/ESCOPO.md`, `docs/fase-07-relatorio.md`, `dados/servicos.json` (S01 a S28), `dados/ensaios.json` (26 controles), `dados/modelos.json` (42 GLB), `public/modelos/manifesto.json` e os módulos de `src/motor/`. A numeração "Mega N" remete ao mega prompt de imagens do ChatGPT (itens 1 a 59, colado pelo autor em 12/10/2026). Os itens novos continuam a numeração a partir do 60 (seção 5).

Legenda das formas de obtenção:

- **GLB IA**: imagem gerada (ChatGPT) e convertida em 3D (Tripo, TRELLIS ou Hunyuan3D). Para objetos parados ou que se movem inteiros.
- **GLB peças**: GLB com as partes móveis em nós separados, com o pivô no lugar real. Caminho recomendado: separar no Blender o GLB que já existe (mantém o estilo e a escala); o pipeline `npm run modelos` precisa passar a preservar os pivôs (relatório da Fase 7, seção 5).
- **Procedural**: geometria gerada no código, para formas que mudam com a obra (leiras, montes, valas, camadas) ou que se repetem ao longo de 1,6 km.
- **CC0**: biblioteca de domínio público (Poly Haven, Quaternius, Kenney).

---

## 1. O que já existe

Implementação: P simples (caixas e cilindros), P detalhado (malha ou shader elaborado), GLB (Tripo AI, 40 000 triângulos e texturas de 1024 no nível 0, malha única e um material).

| Grupo | Objeto | Implementação | Nível visual | Observação |
|---|---|---|---|---|
| Equipamentos | Escavadeira 20 t, motoniveladora, trator de esteiras, pá carregadeira, retroescavadeira, minicarregadeira | GLB | médio | Bons parados; sem giro, lança, lâmina ou caçamba móveis (o procedural antigo animava a escavadeira) |
| Equipamentos | Rolos pé-de-carneiro, liso, tandem e de pneus | GLB | médio | Vibração do conjunto; cilindros não giram |
| Equipamentos | Vibroacabadora, fresadora | GLB | médio | Mesa, silo e transportador fixos |
| Equipamentos | Basculante (vazio, carregado com lona, basculando) | GLB (3 arquivos) | médio | Troca de arquivo no lugar de báscula subindo |
| Equipamentos | Munck, pipa, betoneira, espargidores CM-30 e RR, pintura de faixas, comboio, picape | GLB | alto | Movem-se inteiros; ok |
| Equipamentos | Extrusora de sarjeta, placa vibratória (com o executor), vassoura mecânica | GLB | alto | A vassoura é puxada por um trator **procedural** (baixo) |
| Equipamentos | Caminhão de apoio da sinalização | GLB do munck recolorido | baixo | Não mostra cones nem placas |
| Equipamentos | Caminhão de prova 8,2 t com viga Benkelman | GLB do basculante + viga procedural | médio | Viga em caixas simples |
| Usina | Usina contínua completa | GLB (após 88 % da montagem) | alto | Tambor não gira |
| Usina | Montagem da usina por etapas (0 a 88 %) | P simples | baixo | Silos em pirâmides, tambor em cilindro |
| Usina | Tanques de CAP com bacia e cabine de comando | P simples | baixo | Ficam ao lado do GLB da usina e destoam dele |
| Usina | Estoque de fresado | P detalhado (monte com ruído e textura) | médio | Descoberto (a liberação do S10 pede proteção da chuva) |
| Canteiro | Contêineres (escritório, laboratório, almoxarifado, refeitório, sanitários) | GLB (o mesmo 5 vezes) | médio | Todos iguais |
| Canteiro | Gerador, baias de brita (GLB); pilhas de pó de pedra, areia e solo-brita (P detalhado) | GLB / P | alto / médio | |
| Canteiro | Tapume, placa da obra, faixas do estacionamento | P simples | baixo | Tapume liso; placa sem conteúdo |
| Canteiro | Mastro com bandeira | P detalhado | médio | |
| Canteiro | Estoques de tubos, meio-fio e caixas | GLB instanciado | alto | |
| Drenagem | Vala (paredes, fundo, reaterro) e monte de terra ao lado | P detalhado | médio | Sem berço nem camadas do reaterro |
| Drenagem | Tubos assentados na rede | P simples (cilindro aberto liso) | baixo | Sem ponta e bolsa; o GLB do tubo só está no estoque |
| Drenagem | Escoramento metálico | P simples (placas) | baixo | Sem estroncas |
| Drenagem | Bocas de lobo | GLB | alto | |
| Drenagem | Poços de visita (corpo e tampão) e ramais | P simples | baixo | |
| Drenagem | Meio-fio contínuo e sarjeta | P detalhado | médio | |
| Drenagem | Deságue e dissipador | não existe | — | Só a escavadeira no fim do trecho |
| Pavimento | Camadas (existente, fresado, subleito, sub-base, base, imprimação, pintura, CBUQ) | P detalhado (PBR, shader com molhado, marcas de rolo, ranhuras da fresagem) | alto | Ponto forte do app |
| Pavimento | Leiras, camada espalhada, monte da vala | P detalhado | médio | |
| Sinalização | Cone, tambor, barreira plástica | GLB instanciado | alto | |
| Sinalização | Placas de obra | P simples (caixa laranja lisa) | baixo | Sem pictograma nem suporte |
| Sinalização | Faixa de desvio provisória | P detalhado | médio | |
| Sinalização | Faixas definitivas (eixo e bordos) | P simples (caixas finas) | médio | |
| Sinalização | Placas definitivas | P simples (chapa branca lisa) | baixo | O entorno já tem placas com textura (viasEntorno.js) |
| Ensaios | Pontos de ensaio | P simples (marcadores verde e vermelho) | médio | Não há instrumento nem laboratorista na cena |
| Ensaios | Topografia (estação total, prisma, tripé de ré) | GLB | alto | |
| Pessoas | Engenheiro, encarregado, executor, topógrafo, auxiliar | GLB | médio | Só 5 pessoas para efetivos de 4 a 12 por serviço; encarregado com uniforme escuro e ombro quadrado |
| Entorno | Edificações do IPP/OSM | P detalhado (fachadas no shader, telhado de quatro águas) | médio | |
| Entorno | Vias, meio-fio, calçadas, postes, placas e faixas do entorno | P detalhado | médio | Postes sem rede aérea |
| Entorno | Árvores (jacarandá CC0 com 4 tons, palmeira-imperial procedural) | CC0 + P detalhado, 3 níveis e impostor | alto | |
| Entorno | Gramado, céu HDRI, terreno Lidar | P detalhado / CC0 | alto | |
| Entorno | Tráfego, pedestres, muros, relevo distante | não existe | — | A via "continua em uso", mas nenhum veículo civil circula |

---

## 2. Inventário do que falta ou está em nível baixo

### 2.1 Equipamentos

| Nº | Objeto | Finalidade no app | Situação atual | Forma de obtenção | Precisa de partes móveis? (quais) | Prioridade | Observações |
|---|---|---|---|---|---|---|---|
| EQ-01 | Escavadeira 20 t articulada | S11, S14, S15, S16: ciclo de escavação e carga do basculante | médio | GLB peças | Sim: superestrutura (giro), lança, braço, caçamba | alta | Mega 1 já gerado; separar no Blender |
| EQ-02 | Basculante com báscula móvel | S04, S09, S15, S16, S20, S21, S24 | médio | GLB peças | Sim: báscula com o cilindro, tampa traseira | alta | Mega 3; um arquivo substitui os três de hoje |
| EQ-03 | Vibroacabadora com mesa e silo móveis | S24 | médio | GLB peças | Sim: extensões da mesa, abas do silo | alta | Mega 12; a mesa abrindo para meia pista é muito didática |
| EQ-04 | Fresadora com transportador articulado | S09 e retrabalho do CBUQ | médio | GLB peças | Sim: transportador (elevação e giro) | média | Mega 16 |
| EQ-05 | Rolos com cilindros e rodas soltos (4 tipos) | S16, S17, S20, S21, S24 | médio | GLB peças | Sim: cilindros e rodas (giro), articulação | média | Mega 8 a 11; giro pela distância percorrida |
| EQ-06 | Motoniveladora com lâmina móvel | S17, S20, S21 | médio | GLB peças | Sim: lâmina e círculo, escarificador | média | Mega 5 |
| EQ-07 | Pá carregadeira articulada | S01, S05, S06, S10, S28 | médio | GLB peças | Sim: braços, caçamba, articulação | média | Mega 7 |
| EQ-08 | Munck com guindauto móvel | S01, S05, S11, S12, S13, S18, S28 | médio | GLB peças | Sim: coluna (giro), lanças, patolas, gancho | média | Mega 15; içamento de tubos, caixas e anéis |
| EQ-09 | Trator de pneus que reboca a vassoura | S09, S22, S23 | baixo | GLB IA | Não | média | Novo 60; hoje procedural ao lado de GLB detalhados |
| EQ-10 | Caminhão de apoio com cones, cavaletes e placas | S07, S27 | baixo | GLB IA | Não | média | Novo 61; hoje é o munck recolorido |
| EQ-11 | Betoneira de obra 400 L | S12, S18 | GLB (12/10/2026, betoneira-obra; no canteiro) | GLB IA | Tambor (opcional) | média | Novo 62; pendência 1 do relatório da Fase 7 |
| EQ-12 | Caminhão-tanque de CAP | S24 (abastece os tanques da usina) | não existe | GLB IA | Não | baixa | Novo 63 |
| EQ-13 | Cavalo mecânico com prancha | S01, S28 (chegada e saída das máquinas) | não existe | GLB IA | Não | média | Novo 64; a máquina transportada vai como filho |
| EQ-14 | Caminhão militar de transporte de tropa | Efetivo chegando às frentes, S01 | não existe | GLB IA | Não | média | Novo 65 |
| EQ-15 | Compactador de percussão (sapo) | S11, reaterro junto ao tubo | não existe | GLB IA | Não (vibração no código) | baixa | Mega 18 |
| EQ-16 | Motobomba de esgotamento de vala | S11 | não existe | GLB IA | Não | baixa | Novo 66 |
| EQ-17 | Cortadora de piso | S09 e S11 (recorte nas bordas e juntas) | não existe | GLB IA | Não | baixa | Novo 67 |
| EQ-18 | Torre de iluminação móvel | Canteiro e frentes | não existe | GLB IA | Mastro (opcional) | baixa | Novo 68 |

### 2.2 Usina

| Nº | Objeto | Finalidade no app | Situação atual | Forma de obtenção | Precisa de partes móveis? (quais) | Prioridade | Observações |
|---|---|---|---|---|---|---|---|
| US-01 | Tanques de CAP aquecidos com bacia | S05, S24 | GLB (12/10/2026, tanques-cap) | GLB IA | Não | alta | Mega 27 |
| US-02 | Cabine de comando da usina | S05, S06, S24 | baixo | GLB IA | Não | média | Mega 28 |
| US-03 | Montagem da usina por módulos | S05 (etapas de 0 a 88 %) | baixo | GLB IA por módulo | Sim: módulos entram em ordem, içados pelo munck | média | Mega 23 (já existe: "4 silos.glb", rejeitado na Fase 7, serve aqui), 24, 25 e 26 |
| US-04 | Tambor secador girando | S24 com a usina em operação | médio | GLB peças | Sim: tambor | média | Separar no GLB da usina ou usar o Mega 24 isolado |
| US-05 | Aquecedor de fluido térmico | S05, S24 | não existe | GLB IA | Não | média | Novo 69 |
| US-06 | Cobertura do estoque de fresado | S10 ("protegido da chuva" é critério de liberação) | não existe | GLB IA + lona procedural | Não | média | Novo 72 |
| US-07 | Silo de filler (cal) | S24 (dosagem) | GLB (12/10/2026, silo-filer; filer recuperado e de aporte) | GLB IA | Não | baixa | Novo 70; só se o projeto de mistura usar filler |
| US-08 | Tanques de emulsão e de CM-30 | S22, S23 (abastecimento dos espargidores) | não existe | GLB IA | Não | baixa | Novo 71 |
| US-09 | Peneira móvel de triagem do fresado | S10 ("estoque e triagem") | não existe | GLB IA | Não | baixa | Novo 73 |
| US-10 | Balança rodoviária | S24 (pesagem das cargas) | não existe | Procedural | Não | baixa | Plataforma de concreto com guarda-rodas |
| US-11 | Pilhas de agregados e de fresado | S05, S10, S24 | médio | Procedural | Forma muda | baixa | Acrescentar marcas da pá e frente de retomada |

### 2.3 Canteiro

| Nº | Objeto | Finalidade no app | Situação atual | Forma de obtenção | Precisa de partes móveis? (quais) | Prioridade | Observações |
|---|---|---|---|---|---|---|---|
| CA-01 | Contêineres diferenciados (escritório, laboratório, almoxarifado, sanitário) | S01; o laboratório é o ponto dos ensaios | médio | GLB IA | Não | média | Mega 29 a 32; hoje é um único modelo repetido |
| CA-02 | Placa da obra com conteúdo | S01 | baixo | GLB IA + face com textura gerada no código | Não | média | Mega 35; texto vem de `dados/obra.json`, não da imagem |
| CA-03 | Guarita com cancela | S01; acesso controlado em área militar | não existe | GLB IA | Cancela (opcional) | média | Novo 74 |
| CA-04 | Banheiro químico | Frentes de serviço (NR-18) | não existe | GLB IA | Não | média | Novo 75; um por frente ativa |
| CA-05 | Caixa d'água sobre torre | Canteiro | não existe | GLB IA | Não | baixa | Mega 34 |
| CA-06 | Mastro com bandeira | Entrada do canteiro | médio | Manter procedural | Bandeira (já anima) | baixa | Mega 36 desnecessário |
| CA-07 | Tapume metálico com textura | S01, S28 | baixo | Procedural com textura de telha trapezoidal | Não | baixa | |
| CA-08 | Caçamba estacionária de entulho | S01, S04, S28 | não existe | GLB IA | Não | baixa | Novo 76 |
| CA-09 | Tanque de diesel com bacia | Pátio de máquinas, queimador da usina | não existe | GLB IA | Não | baixa | Novo 77 |
| CA-10 | Área de vivência | Canteiro | não existe | GLB IA | Não | baixa | Novo 78 |
| CA-11 | Paletes de cimento e materiais | S12, S13, S18 | não existe | GLB IA | Não | baixa | Novo 79 |
| CA-12 | Lava-rodas na saída | Canteiro (controle ambiental) | não existe | Procedural | Não | baixa | |

### 2.4 Drenagem

| Nº | Objeto | Finalidade no app | Situação atual | Forma de obtenção | Precisa de partes móveis? (quais) | Prioridade | Observações |
|---|---|---|---|---|---|---|---|
| DR-01 | Painel de escoramento com estroncas | S11 | baixo | GLB IA instanciado | Não | alta | Mega 43 |
| DR-02 | Tubos da rede com ponta e bolsa | S11 | baixo | GLB existente (`tubo-concreto`) em InstancedMesh | Não | alta | Mega 38 já gerado; escalar ao diâmetro de projeto |
| DR-03 | Poço de visita pré-moldado | S13 | baixo | GLB IA (inteiro) ou peças empilhadas | Anéis entram por etapa (opcional) | média | Mega 41; peças separadas: Novos 81 e 82 |
| DR-04 | Dissipador no deságue (boca com alas e enrocamento) | S14 | não existe | GLB IA + enrocamento procedural com pedras CC0 (Poly Haven) | Não | média | Novo 80 |
| DR-05 | Interferências expostas na vala (água, eletroduto, esgoto) | S08, S11 e decisões da missão | não existe | Procedural (cilindros com as cores usuais das redes) | Não | média | Muito didático para o cadastro de interferências |
| DR-06 | Proteção de borda da vala (gradil e fita zebrada) | S11 (segurança) | não existe | GLB IA (gradil) + fita procedural | Não | média | Novo 84 |
| DR-07 | Passarela de pedestres sobre a vala | S07, S11 (passagens para pedestres, IPR 738) | não existe | GLB IA | Não | média | Novo 83 |
| DR-08 | Berço e camadas do reaterro | S11 (camadas ≤ 20 cm, GC por camada) | médio | Procedural | Forma muda | média | Listras das camadas na parede do reaterro |
| DR-09 | Ramais das bocas de lobo | S12 | baixo | GLB do tubo escalado | Não | baixa | |
| DR-10 | Chapa de travessia veicular | S11 (acesso às edificações) | não existe | Procedural | Não | baixa | |
| DR-11 | Marcação de interferências no piso | S08 | baixo | Procedural (decalque de tinta) | Não | baixa | |
| DR-12 | Cintas e tubo içado pelo munck | S11, S12, S13 | não existe | Procedural + GLB do tubo | Sim, com EQ-08 | baixa | |

### 2.5 Pavimento e materiais soltos

| Nº | Objeto | Finalidade no app | Situação atual | Forma de obtenção | Precisa de partes móveis? (quais) | Prioridade | Observações |
|---|---|---|---|---|---|---|---|
| PV-01 | CBUQ no silo da vibroacabadora e cordão na frente da mesa | S24 | não existe | Procedural | Nível baixa e sobe com a descarga | alta | Junto com EQ-03 |
| PV-02 | Descarga do basculante na vibroacabadora | S24 | não existe | Procedural | Depende de EQ-02 | média | |
| PV-03 | Pavimento existente degradado (panelas, remendos, trincas em bloco) | S09; mostra por que a via é reconstruída | médio | Procedural (shader e decalques) | Não | média | |
| PV-04 | Descarga em montes antes da leira | S16, S20, S21 | médio | Procedural | Forma muda | média | Um monte por basculante, depois a leira |
| PV-05 | Furos de extração de corpos de prova | S24 (GC e espessura) | não existe | Procedural | Não | baixa | Liga ao EN-03 |
| PV-06 | Juntas transversais de início e fim de frente | S09, S24 | médio | Procedural | Não | baixa | |
| PV-07 | Carga na caçamba ajustada ao GLB | Caminhões | médio | Procedural | Sim, com EQ-02 | baixa | |

### 2.6 Sinalização

| Nº | Objeto | Finalidade no app | Situação atual | Forma de obtenção | Precisa de partes móveis? (quais) | Prioridade | Observações |
|---|---|---|---|---|---|---|---|
| SI-01 | Placa de obra com suporte de pés | S07 | baixo | GLB IA do suporte com chapa em branco + pictograma em textura no código | Não | alta | Mega 47 (ver correção na seção 4.3) |
| SI-02 | Painel de seta luminosa em reboque | S07 (meia pista e desvio) | não existe | GLB IA | Seta piscando (emissivo no código) | alta | Novo 85 |
| SI-03 | Placas definitivas com face pintada | S27 | baixo | Procedural (reaproveitar `texturaDePlaca` de viasEntorno.js) | Não | alta | |
| SI-04 | Cavalete listrado | S07 | não existe | GLB IA | Não | média | Mega 45 |
| SI-05 | Balizador tubular | S07 | não existe | GLB IA | Não | média | Novo 86 |
| SI-06 | Legendas, setas e faixa de pedestres | S26 | não existe | Procedural (decalques) | Não | média | |
| SI-07 | Pisca-pisca sobre cavalete | S07 | não existe | GLB IA | Luz piscando (código) | baixa | Mega 49 |
| SI-08 | Tachas refletivas | S26 | não existe | Procedural instanciado | Não | baixa | |
| SI-09 | Faixas definitivas no shader do CBUQ | S26 | médio | Procedural | Não | baixa | Hoje são caixas finas |

### 2.7 Ensaios e laboratório

| Nº | Objeto | Finalidade no app | Situação atual | Forma de obtenção | Precisa de partes móveis? (quais) | Prioridade | Observações |
|---|---|---|---|---|---|---|---|
| EN-01 | Conjunto do frasco de areia | GC de S11, S16, S17, S20, S21 (o ensaio de campo mais frequente) | GLB (12/10/2026, frasco-areia; sem o laboratorista) | GLB IA | Não | alta | Mega 51; aparece com o laboratorista (PE-03) no ponto do ensaio |
| EN-02 | Viga Benkelman | S21, S25 | GLB (12/10/2026, viga-benkelman) | GLB IA | Não | alta | Mega 50 |
| EN-03 | Extratora de corpos de prova | S24 (GC e espessura) | não existe | GLB IA | Coroa desce (opcional) | alta | Novo 87 |
| EN-04 | Speedy | S17, S20, S21 | não existe | GLB IA | Não | média | Novo 88 |
| EN-05 | Pêndulo britânico | S25 | não existe | GLB IA | Pêndulo (opcional) | média | Novo 89 |
| EN-06 | Bandeja de taxa de aplicação | S22, S23 | não existe | Procedural | Não | média | Bandeja metálica rasa |
| EN-07 | Nível digital sobre tripé | S02, S17, S18, S19 | não existe | GLB IA | Não | média | Novo 93 |
| EN-08 | Trado manual | S03, S08 | não existe | GLB IA | Não | média | Novo 92 |
| EN-09 | Kit da mancha de areia | S25 | não existe | GLB IA | Não | baixa | Novo 90 |
| EN-10 | Régua de 3 m com cunha | S25, S17 | não existe | Procedural | Não | baixa | |
| EN-11 | Retrorrefletômetro | S26 | não existe | GLB IA | Não | baixa | Novo 91 |
| EN-12 | Cone de Abrams | S12, S13, S19 (recebimento do concreto) | não existe | GLB IA | Não | baixa | Novo 94 |
| EN-13 | Estufa | S03, S10, S20, S24 | não existe | GLB IA | Não | baixa | Mega 52 |
| EN-14 | Prensa ISC | S03, S15, S20, S21 | não existe | GLB IA | Não | baixa | Novo 95 |
| EN-15 | Compactador Marshall | S06 | não existe | GLB IA | Soquete (opcional) | baixa | Novo 96 |
| EN-16 | Rotarex | S10, S24 | não existe | GLB IA | Não | baixa | Novo 97 |
| EN-17 | Balança e peneiras com agitador | S03, S10, S20, S24 | não existe | GLB IA | Não | baixa | Novo 98 |
| EN-18 | Prensas de concreto e de tubos | S11 (NBR 8890), S12, S13, S19 | não existe | GLB IA | Não | baixa | Novos 99 e 100 |
| EN-19 | Interior do laboratório (contêiner em corte) | S03, S06, S24 | não existe | Procedural + EN-13 a EN-18 | Não | baixa | Os itens EN-13 a EN-18 só valem com essa vista; carregar sob demanda |

### 2.8 Pessoas

| Nº | Objeto | Finalidade no app | Situação atual | Forma de obtenção | Precisa de partes móveis? (quais) | Prioridade | Observações |
|---|---|---|---|---|---|---|---|
| PE-01 | Soldados com EPI em 6 poses (pá, enxada, rastelo de CBUQ, carrinho de mão, carregando cone, em pé) | Efetivo de todos os serviços (de 2 a 6 Sd por frente) | parcial: GLB em pé (12/10/2026, soldado; 2 na frente principal) | GLB IA, uma por pose | Não (pose fixa, balanço leve no código) | alta | Novos 101 a 106; instanciados |
| PE-02 | Sinaleiro com placa PARE/SIGA | S07 (meia pista) | não existe | GLB IA | Placa gira (opcional) | alta | Mega 53 |
| PE-03 | Laboratorista agachado | EN-01, EN-04 | não existe | GLB IA | Não | alta | Mega 54 |
| PE-04 | Operador sentado | Cabines de todas as máquinas | não existe | GLB IA | Não | média | Novo 107; só nas cabines abertas ou envidraçadas |
| PE-05 | Pedreiro agachado | S12, S13, S18 | não existe | GLB IA | Não | média | Novo 108 |
| PE-06 | Laboratorista com termômetro | S24 (temperaturas) | não existe | GLB IA | Não | média | Novo 109 |
| PE-07 | Encarregado refeito | Frente principal | GLB (12/10/2026, arquivo novo do encarregado) | GLB IA | Não | baixa | Novo 111; uniforme igual ao dos demais |
| PE-08 | Fiscal da OM | Decisões da missão, S25 | não existe | GLB IA | Não | baixa | Novo 110 |
| PE-09 | Pedestres (moradores civis e militares) | Entorno e passagens de pedestres | não existe | CC0 com esqueleto e caminhada (Quaternius) | Sim: caminhada | baixa | Recolorir; o Tripo não gera esqueleto |

### 2.9 Entorno e vegetação

| Nº | Objeto | Finalidade no app | Situação atual | Forma de obtenção | Precisa de partes móveis? (quais) | Prioridade | Observações |
|---|---|---|---|---|---|---|---|
| EV-01 | Tráfego no desvio (hatch, sedã, SUV, ônibus, moto) | S07: a via continua em uso, em meia pista ou desvio | não existe | GLB IA (CC0 do Kenney ou do Quaternius como reserva, mas com estilo baixo-poli) | Não (rodas opcionais) | alta | Novos 112 a 116; também estacionados no entorno |
| EV-02 | Viatura militar 4x4 leve | Entorno da Vila Militar | não existe | GLB IA | Não | média | Novo 117 |
| EV-03 | Rede aérea (fios, cruzetas, transformador) | S08 (interferência aérea, risco do munck) | não existe | Procedural (catenárias) + GLB IA do transformador | Não | média | Novo 118 |
| EV-04 | Muros e gradis dos lotes | Entorno | não existe | Procedural | Não | média | Muro caiado ao longo dos contornos dos lotes |
| EV-05 | Relevo distante (maciço do Gericinó-Mendanha) | Contexto geográfico no horizonte | não existe | Procedural (SRTM de baixa resolução) | Não | média | |
| EV-06 | Poste de iluminação | Vias do entorno | médio | Manter procedural | Não | baixa | Mega 58 desnecessário |
| EV-07 | Arbustos e cercas vivas | Entorno | não existe | GLB IA com poucos triângulos ou CC0 | Vento no shader | baixa | Mega 59 |
| EV-08 | Abrigo de ônibus, lixeira, hidrante | Entorno | não existe | CC0 (Kenney, Poly Haven) ou GLB IA | Não | baixa | Novo 119 |
| EV-09 | Detalhes das edificações (caixa d'água no telhado, ar-condicionado) | Entorno | médio | Procedural | Não | baixa | |

---

## 3. Os 15 itens de maior impacto visual

1. **PE-01** Soldados com EPI em serviço: hoje as frentes têm máquinas e quase nenhuma pessoa.
2. **EV-01** Tráfego no desvio: mostra o conceito central da obra (via em uso, frentes com meia pista).
3. **EQ-01** Escavadeira articulada: é a máquina mais vista (vala, deságue, remoção, substituição).
4. **EQ-02** Basculante com báscula móvel: está em 7 serviços.
5. **EQ-03** Vibroacabadora com mesa e silo móveis, junto com **PV-01** (CBUQ no silo e na rosca).
6. **SI-01** Placas de obra com pictograma e suporte.
7. **SI-02** Painel de seta luminosa.
8. **DR-01** Escoramento com estroncas.
9. **DR-02** Tubos com ponta e bolsa na rede.
10. **PE-02** Sinaleiro com placa PARE/SIGA.
11. **US-01** Tanques de CAP ao lado da usina.
12. **EN-01** Frasco de areia com o laboratorista (**PE-03**).
13. **SI-03** Placas definitivas com face pintada.
14. **EN-02** Viga Benkelman.
15. **EQ-08** Munck com guindauto móvel, içando tubos e anéis.

---

## 4. Itens do mega prompt

### 4.1 Já gerados e no app (não refazer)

1 a 17 (exceto 18), 19, 20, 21, 22, 23 (os "4 silos", guardados e úteis para o US-03), 29 (contêiner genérico), 33, 37, 38, 40, 42, 44, 46, 48 e 55. O 56 e o 59 equivalem à "ARVORE GRANDE" e à "ARVORE PQN" rejeitadas na Fase 7.

### 4.2 A gerar por IA (do mega prompt), em ordem de prioridade

| Ordem | Mega | Item | Inventário | Prioridade |
|---|---|---|---|---|
| 1 | 53 | Militar sinaleiro com placa PARE/SIGA | PE-02 | alta |
| 2 | 54 | Laboratorista agachado operando o frasco de areia | PE-03 | alta |
| 3 | 51 | Conjunto do frasco de areia | EN-01 | alta |
| 4 | 50 | Viga Benkelman | EN-02 | alta |
| 5 | 43 | Painel de escoramento com estroncas | DR-01 | alta |
| 6 | 47 | Placa de obra sobre suporte (ver correção 4.3) | SI-01 | alta |
| 7 | 27 | Tanques de CAP com mureta | US-01 | alta |
| 8 | 28 | Cabine de comando da usina | US-02 | média |
| 9 | 45 | Cavalete listrado | SI-04 | média |
| 10 | 41 | Poço de visita com tampão | DR-03 | média |
| 11 | 30 | Contêiner laboratório | CA-01 | média |
| 12 | 31 | Contêiner almoxarifado | CA-01 | média |
| 13 | 32 | Contêiner sanitário | CA-01 | média |
| 14 | 35 | Placa de obra em branco | CA-02 | média |
| 15 | 24 | Tambor secador-misturador | US-03, US-04 | média |
| 16 | 25 | Filtro de mangas com chaminé | US-03 | média |
| 17 | 26 | Silo de massa com elevador | US-03 | média |
| 18 | 18 | Compactador de percussão (sapo) | EQ-15 | baixa |
| 19 | 34 | Caixa d'água sobre torre | CA-05 | baixa |
| 20 | 49 | Pisca-pisca sobre cavalete | SI-07 | baixa |
| 21 | 52 | Estufa de laboratório | EN-13 | baixa |
| 22 | 59 | Arbusto ornamental (pedir poucos triângulos no conversor) | EV-07 | baixa |

Não gerar: 36 (o mastro procedural já anima a bandeira), 39 (o estoque monta a pilha com o tubo 38), 56 e 57 (árvores de IA em malha única não servem para centenas de instâncias; o jacarandá CC0 e a palmeira procedural já têm três níveis de detalhe) e 58 (o poste procedural já é instanciado).

Para os itens com peças móveis (Mega 1, 3, 5, 7 a 12, 15 e 16), o caminho é separar as peças no Blender a partir dos GLB que já existem. Gerar de novo só ajuda se o conversor separar peças; nesse caso use "Imagem N vistas".

### 4.3 Ajustes no mega prompt

- **Item 47**: no Brasil, a placa de advertência de obra é em losango (laranja), não triangular. Trocar por: "Placa de sinalização de obra em losango, chapa em branco, sobre suporte metálico com pés." O pictograma entra no código, como textura.
- **Regra 7**: abrir exceção para veículos civis (itens 112 a 116, cor indicada no item), usina (já tem cor própria no cabeçalho) e equipamentos de laboratório (aço inox e cinza).
- **Pessoas**: pedir "braços afastados do corpo, sem cruzar à frente do tronco" nas poses neutras. Os modelos do Tripo vieram em pose T ou com braços colados, e o pipeline teve de corrigir os braços.
- **Licença do conversor**: o prompt cita TRELLIS e Hunyuan3D. Antes de usar, registre a licença em `assets/brutos/modelos/LICENCAS.txt` e em `assets/CREDITOS.md`; a licença do Hunyuan3D tem restrições de território e de uso que precisam ser conferidas.

---

## 5. Itens novos para acrescentar ao mega prompt

Cole abaixo da lista do mega prompt. Valem as regras fixas 1 a 9, com as exceções da seção 4.3.

```
EQUIPAMENTOS (continuação)
60. Trator de pneus agrícola compacto com capota sobre o posto do operador e engate traseiro, sem implemento.
61. Caminhão 4x2 de apoio com carroceria de madeira carregada com cones, cavaletes e placas de sinalização em branco, bem arrumados.
62. Betoneira de obra de 400 litros sobre duas rodas, tambor inclinado com a boca para cima e motor elétrico lateral.
63. Caminhão-tanque 6x4 de transporte de asfalto, tanque cilíndrico isolado preto com escada e passarela no topo.
64. Cavalo mecânico 6x4 com semirreboque prancha rebaixada vazio, rampas traseiras recolhidas.
65. Caminhão militar 4x4 de transporte de tropa, carroceria com bancos laterais e lona sobre arcos.
66. Motobomba diesel de esgotamento sobre base metálica, com mangote de sucção enrolado ao lado.
67. Cortadora de piso com disco diamantado, guidão de empurrar e reservatório de água.
68. Torre de iluminação móvel sobre reboque de um eixo, mastro recolhido com quatro refletores.

USINA DE CBUQ (continuação; cinza claro com detalhes laranja)
69. Aquecedor de fluido térmico sobre base metálica (skid), com chaminé curta e tubulações isoladas.
70. Silo vertical de filler sobre quatro pernas, com rosca transportadora inclinada saindo da base.
71. Dois tanques verticais pretos de emulsão asfáltica sobre base de concreto com mureta de contenção.
72. Telheiro metálico aberto, estrutura de aço e cobertura de telha trapezoidal cinza, sem paredes, cerca de 12 m de vão.
73. Peneira vibratória móvel sobre esteiras com correia de descarga lateral.

CANTEIRO (continuação)
74. Guarita pré-fabricada de controle de acesso com janela em toda a volta e cancela basculante listrada de vermelho e branco.
75. Banheiro químico individual de plástico cinza claro.
76. Caçamba estacionária de entulho metálica trapezoidal, vazia.
77. Tanque horizontal de óleo diesel de 15 m³ sobre bacia de contenção metálica, com bomba e mangueira de abastecimento.
78. Mesa longa de madeira com dois bancos sob toldo de lona sobre estrutura metálica.
79. Palete de madeira com sacos de cimento empilhados, sem estampas, parcialmente coberto por lona.

DRENAGEM (continuação; concreto cinza)
80. Boca de saída de bueiro em concreto com testa e duas alas inclinadas, com a ponta de um tubo de 600 mm saindo da testa.
81. Anel pré-moldado de poço de visita em concreto, 1 m de diâmetro e 50 cm de altura, com degraus metálicos na face interna.
82. Cone redutor de poço de visita em concreto com tampão redondo de ferro fundido no topo.
83. Passarela metálica de pedestres para travessia de vala, piso de chapa xadrez e guarda-corpo amarelo dos dois lados.
84. Módulo de grade móvel de obra em gradil galvanizado com duas bases de concreto.

SINALIZAÇÃO DE OBRA (continuação)
85. Painel de seta luminosa sobre reboque de um eixo, painel retangular preto com lâmpadas apagadas formando uma seta.
86. Balizador tubular flexível laranja com duas faixas refletivas brancas e base preta.

ENSAIOS E LABORATÓRIO (continuação; aço inox, alumínio e cinza; exceção à regra 7)
87. Extratora de corpos de prova de asfalto, coluna com motor a gasolina e coroa diamantada de 10 cm, sobre base com rodas.
88. Maleta aberta do ensaio Speedy com garrafa metálica com manômetro, balança pequena e ampolas.
89. Pêndulo britânico para atrito de pavimento, sobre base com pés niveladores.
90. Kit da mancha de areia: cilindro metálico pequeno, disco espalhador com face de borracha e escova, sobre uma bandeja.
91. Retrorrefletômetro portátil para faixa de pavimento, caixa com alça apoiada no chão.
92. Trado manual tipo concha com duas hastes de extensão e cruzeta, deitado.
93. Nível digital sobre tripé de alumínio, pernas abertas.
94. Cone de Abrams sobre placa metálica, com haste de adensamento ao lado.
95. Prensa de ISC de bancada com anel dinamométrico e molde cilíndrico posicionado.
96. Compactador Marshall automático com soquete e molde.
97. Extrator centrífugo de betume de bancada.
98. Balança eletrônica de bancada ao lado de um jogo de peneiras empilhadas sobre agitador.
99. Prensa hidráulica de compressão de corpos de prova de concreto, pórtico com cilindro.
100. Prensa de compressão diametral com três cutelos e um tubo de concreto de 600 mm posicionado.

PESSOAS (continuação; mesmas regras do cabeçalho de pessoas; braços afastados do tronco)
101. Militar de serviço de pé, segurando uma pá com a lâmina apoiada no chão.
102. Militar de serviço com enxada, em posição de trabalho.
103. Militar rasteleiro com rastelo de asfalto de cabo longo, inclinado para a frente.
104. Militar empurrando carrinho de mão vazio.
105. Militar caminhando com um cone de sinalização em uma das mãos.
106. Militar de serviço de pé, braços ao longo do corpo levemente afastados, luvas de raspa.
107. Militar sentado como se estivesse num banco, mãos à frente na altura de um volante, sem o banco.
108. Militar pedreiro agachado com colher de pedreiro na mão.
109. Laboratorista de pé medindo temperatura com termômetro de haste longa apontado para baixo.
110. Oficial de pé com prancheta, capacete branco e colete refletivo.
111. Sargento encarregado de pé com rádio portátil na mão, capacete azul e colete refletivo.

ENTORNO (continuação; veículos civis são exceção à regra 7)
112. Carro hatch civil compacto prata.
113. Sedã civil branco.
114. Utilitário esportivo civil cinza-escuro.
115. Ônibus urbano civil branco, letreiro apagado.
116. Motocicleta civil de 150 cc preta.
117. Viatura militar utilitária 4x4 leve com capota de lona, verde-oliva.
118. Transformador de distribuição em poste de concreto com cruzeta e isoladores, sem fios.
119. Abrigo de ônibus metálico com cobertura e banco.
```

Total a gerar: 22 itens do mega prompt (seção 4.2) e 60 novos (60 a 119). Para começar: 53, 54, 51, 50, 43, 47, 27, 85, 101 a 106 e 112 a 116.

---

## 6. Peso dos modelos e orçamento

### Hoje

- `public/modelos/`: 28,9 MB (27,5 MB nos 42 GLB, sendo 24,2 MB no nível 0 e 3,4 MB no nível 1, mais as árvores). O teste `tests/modelos.test.js` limita a pasta a 40 MB e o nível 0 a 1,5 MB.
- Texturas em WebP: o `toktx` não está instalado. Cada GLB tem 3 mapas (cor, metal/rugosidade e normal) de 1024 no nível 0. Na GPU, o WebP vira RGBA sem compressão: cerca de 5,6 MB por mapa com mipmaps, ou seja, cerca de **17 MB por modelo**. Com os 42 modelos carregados, as texturas dos GLB ocupam por volta de **700 MB** de memória de vídeo (estimativa). `modelos3d.js` carrega os dois níveis de todo modelo no início.

### Com o inventário completo (estimativa nos padrões atuais)

| Grupo | Novos GLB | MB (nível 0 + nível 1) |
|---|---|---|
| Veículos e máquinas novos (60, 61, 63 a 65, 112 a 117) | 11 | 7,2 |
| Equipamentos pequenos (18, 62, 66 a 68) | 5 | 1,1 |
| Usina (24 a 28, 69 a 73) | 10 | 4,6 |
| Canteiro (30 a 32, 34, 35, 74 a 79) | 11 | 3,0 |
| Drenagem (41, 43, 80 a 84) | 7 | 1,7 |
| Sinalização (45, 47, 49, 85, 86) | 5 | 0,7 |
| Ensaios e laboratório (50 a 52, 87 a 100) | 17 | 3,4 |
| Pessoas (53, 54, 101 a 111) | 13 | 5,6 |
| Entorno (59, 118, 119) e pedestres CC0 | 6 | 2,4 |
| Peças separadas (EQ-01 a EQ-08, US-04), menos os 2 basculantes que saem | substituem | cerca de −0,5 |
| **Total novo** | **85** | **cerca de 29 MB** |

Pasta final: cerca de **58 MB**, acima do limite de 40 MB do teste. A memória de vídeo passaria de 2 GB com texturas de 1024 em WebP, o que não cabe em vídeo integrado.

### Orçamento recomendado

1. **Texturas em KTX2** (ETC1S na cor e no metal/rugosidade, UASTC na normal). O pipeline já está pronto; falta instalar o KTX-Software e pôr o `toktx` no PATH (trabalho manual pendente desde a Fase 7). A memória de vídeo cai de 4 a 6 vezes.
2. **Triângulos e textura por classe** no nível 0:

   | Classe | Triângulos | Textura |
   |---|---|---|
   | Máquinas e caminhões | 40 000 | 1024 |
   | Veículos civis e viaturas | 15 000 | 512 |
   | Pessoas | 10 000 | 512 |
   | Objetos até 2 m (sinalização, ensaios, drenagem) | 3 000 a 6 000 | 512 |
   | Usina e módulos | 80 000 no conjunto | 1024 |

   Com esses valores, os 85 novos ficam em cerca de 17 MB.
3. **Carga em duas etapas**: o núcleo (máquinas, canteiro, usina, sinalização, drenagem, pessoas e tráfego) carrega o nível 1 primeiro e o nível 0 só perto da câmera; o laboratório (EN-13 a EN-19), os pedestres e o mobiliário urbano carregam sob demanda.
4. **Limites**:

   | Item | Limite |
   |---|---|
   | Pasta `public/modelos/` | até 45 MB (subir o teste de 40 para 45 MB) |
   | Carga inicial | até 20 MB |
   | Nível 0 por arquivo | até 1,5 MB (mantém o teste) |
   | Texturas dos modelos na GPU | até 512 MB no perfil alto e 256 MB no baixo |
   | Chamadas de desenho | até 250 no perfil alto (hoje 102), com pessoas, cones, tráfego e escoramento em InstancedMesh |

Estimativa final: cerca de 46 MB de pasta e cerca de 300 MB de texturas na GPU com KTX2. Os números da Fase 10 (`docs/DESEMPENHO.md`) devem confirmar esses valores.
