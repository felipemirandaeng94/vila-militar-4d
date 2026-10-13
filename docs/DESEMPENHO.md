# Desempenho (Fase 10)

Orçamento de desempenho por perfil de qualidade, como ele é medido e os valores medidos antes e depois das otimizações da Fase 10.

## Como medir

```
npm run desempenho      # build + medição dos três perfis; grava docs/desempenho.json
npm run test:e2e        # inclui e2e/desempenho.spec.js, que confere o orçamento
```

`e2e/medir-desempenho.mjs` sobe o `vite preview` com o build de produção e abre o Chromium do Playwright com a GPU da máquina (ANGLE sobre Direct3D 11). Cada perfil roda num contexto novo, sem cache, com a qualidade fixada pela escolha salva (`vm4d.qualidade`). Janela de 1600 × 900, densidade de pixels 1, sincronia vertical desligada (a taxa de quadros não fica presa em 60). Ver `e2e/medicao.js`.

| Medida | Como é obtida |
|---|---|
| Carga inicial | Tempo até o motor montar (o modelo já pode ser usado) e até todos os arquivos pedidos chegarem, sem novos por 1,5 s. MB e número de arquivos pela Resource Timing. |
| Memória de GPU | `e2e/instrumentacao.js` intercepta o WebGL 2 e soma o que o app aloca: texturas (por nível, camada e formato, com os blocos dos formatos comprimidos), buffers e renderbuffers (com as amostras do MSAA), descontando o que é apagado. Soma também o framebuffer da tela. É o que o app pede ao driver; o driver pode alinhar ou duplicar. |
| Chamadas de desenho e triângulos | Contagem de `drawArrays` e `drawElements` (e as versões instanciadas) por quadro, com a sombra e o pós-processamento incluídos. |
| Quadros por segundo | `requestAnimationFrame` por 4 s em cada vista. |

Vistas medidas: 3D (a do início), planta do trecho inteiro e usina, no dia inicial (dia 28,4: drenagem, meio-fio e sarjeta) e num dia de CBUQ (primeira janela do S24). Os valores das tabelas são o pior caso entre as seis medições (menor taxa de quadros, mais chamadas de desenho).

Máquina de referência: AMD Ryzen 5 5600G, 16 GB de RAM, NVIDIA GeForce GTX 1660 Ti (6 GB, driver 591.86), Windows 11. A GPU integrada do Ryzen está desligada nesta máquina, então não houve medição numa GPU integrada.

## Orçamento

Definido em `e2e/orcamento.js` e conferido por `e2e/desempenho.spec.js` a cada `npm run test:e2e`.

| Perfil | Carga até todos os arquivos | Transferência | Memória de GPU | Chamadas de desenho por quadro | Quadros por segundo |
|---|---|---|---|---|---|
| Baixa | até 15 s | até 55 MB | até 256 MB | até 500 | 45 ou mais |
| Média | até 15 s | até 55 MB | até 450 MB | até 500 | 45 ou mais |
| Alta | até 15 s | até 80 MB | até 800 MB | até 550 | 45 ou mais |

Critérios:
- **Taxa de quadros:** 45 é o limite em que a qualidade automática desce um perfil (`FPS_MINIMO` em `src/motor/qualidade.js`). O teste só confere a taxa com GPU de verdade: com renderização por software (SwiftShader, llvmpipe) o número não diz nada do app.
- **Memória de GPU:** o perfil baixo é o das GPUs integradas e móveis. 256 MB cabem na fatia de vídeo que uma GPU integrada costuma reservar. O médio e o alto deixam folga para o navegador e o sistema numa placa de 2 GB e de 4 GB.
- **Transferência:** cerca de 20 % acima do medido, para acomodar modelos novos sem refazer o orçamento a cada um. A pasta `public/modelos` já tem o limite próprio de 40 MB (`npm run modelos`).
- **Carga:** medida em servidor local, então reflete a decodificação (KTX2, GLB, HDRI) e a montagem, não a rede. Pela internet, some o tempo de baixar a transferência da tabela: cerca de 7 s a 50 Mbit/s no perfil médio. O modelo pode ser usado desde que o motor monta (cerca de 1,5 s); o resto entra em segundo plano.

## Medições

### Antes da Fase 10 (commit d76d2f0)

| Perfil | Motor pronto | Carga | Transferência | Memória de GPU | Chamadas de desenho | Triângulos por quadro | Quadros por segundo (mín.) |
|---|---|---|---|---|---|---|---|
| Baixa | 1,7 s | 10,9 s | 55,1 MB (158 arquivos) | 272 MB | 317 | 3,8 milhões | 163 |
| Média | 1,5 s | 12,7 s | 55,1 MB (155 arquivos) | 519 MB | 330 | 4,2 milhões | 166 |
| Alta | 1,6 s | 11,7 s | 94,0 MB (159 arquivos) | 1.475 MB | 337 | 6,4 milhões | 152 |

O perfil alto passava de 1,4 GB de memória de vídeo: fora do orçamento.

### Depois da Fase 10

| Perfil | Motor pronto | Carga | Transferência | Memória de GPU | Chamadas de desenho | Triângulos por quadro | Quadros por segundo (mín.) |
|---|---|---|---|---|---|---|---|
| Baixa | 1,8 s | 10,0 s | 45,4 MB (107 arquivos) | 169 MB | 317 | 3,8 milhões | 164 |
| Média | 1,4 s | 11,6 s | 45,4 MB (106 arquivos) | 306 MB | 330 | 4,2 milhões | 162 |
| Alta | 1,4 s | 9,5 s | 65,2 MB (110 arquivos) | 583 MB | 337 | 6,4 milhões | 158 |

Os três perfis cabem no orçamento. O detalhe por vista está em `docs/desempenho.json`. A memória da página (heap do JavaScript) caiu de 270 a 324 MB para 147 a 224 MB.

Memória de GPU no perfil médio, depois:

| Item | MB |
|---|---|
| Texturas do terreno e do pavimento (três arrays KTX2) | 33 |
| Ambiente do céu (PMREM, meio float) | 24 |
| Fundo do céu (cubo de 512 px, meio float) | 12 |
| Mapa de sombra de 2048 px (profundidade e uma textura de cor que o three aloca e não usa) | 32 |
| Pós-processamento: alvos de GTAO, FXAA e intermediários (25) e renderbuffers com MSAA (26) | 51 |
| Texturas dos modelos 3D, das árvores e as demais | 74 |
| Buffers de geometria | 62 |
| Framebuffer da tela | 19 |

## Otimizações da Fase 10

| Otimização | Efeito medido |
|---|---|
| **Texturas do terreno em KTX2** (`scripts/assets/texturas-ktx2.py`): três arrays em vez de 33 WebP. Cor em ETC1S (1K e 2K); normal (1K) e ARM (512 px) em UASTC + Zstandard. Na GPU ficam comprimidos (BC7 nesta placa); antes eram enviados em RGBA de 8 bits. | Arrays do terreno: de 176 para 33 MB no perfil médio e de 704 para 88 MB no alto. No disco: de 49 para 28,6 MB. |
| **Fundo do céu do tamanho certo** (`src/motor/ceu.js`): o three converte o HDRI de fundo num cubo com faces da altura da imagem (1024 px no 2K e 2048 px no 4K). Agora o cubo tem faces de largura ÷ 4, a mesma resolução angular do HDRI no horizonte, e o HDRI sai da GPU e da CPU depois da conversão. O cubo de 4K sai da GPU quando o perfil alto deixa de ser usado. | De 64 para 12 MB nos perfis baixo e médio e de 256 para 60 MB no alto, sem diferença visível (capturas comparadas). |
| **Carga sob demanda dos modelos 3D** (`src/motor/modelos3d.js`, `equipamentos.js`): o nível 1 de todas as máquinas (4 MB no total) vem na carga inicial. O nível 0 (35 MB) só é baixado quando a máquina entra em serviço, quando a câmera chega a menos de 160 m dela ou quando outro objeto já pediu o mesmo modelo. | Transferência inicial de 55 para 45 MB nos perfis baixo e médio, mesmo com o KTX2 do terreno maior que o WebP em 1K. |
| **Descarte das cópias na CPU** das texturas KTX2 (terreno e modelos) depois do envio à GPU. | Heap da página de 270 a 324 MB para 147 a 224 MB. |
| **Carregador KTX2 único** (`src/motor/ktx2.js`) para o terreno e os modelos: um só conjunto de workers do transcodificador. | Sem efeito medido isolado. |

Primeira tentativa descartada: carregar sob demanda os dois níveis. A máquina sem GLB fica com o modelo procedural, que custa dezenas de chamadas de desenho por máquina. Com as máquinas do pátio procedurais, o perfil baixo foi a 1.165 chamadas e o alto caiu a 41 quadros por segundo. Por isso o nível 1 vem sempre.

### Avaliadas e não feitas

- **Instanciamento e mesclagem de geometrias estáticas.** Já há 46 malhas instanciadas: árvores, gramado, entorno, vias do entorno, sinalização (cones e barreiras), drenagem (bocas de lobo), canteiro e marcadores. Das 1.287 malhas da cena, 261 ficam visíveis, e os quadros têm de 130 a 340 chamadas de desenho, menos de 70 % do orçamento. As repetições que sobram são 29 esferas de giroflex e 13 soldados, todos presos a objetos que se movem e com estado próprio. Instanciar economizaria cerca de 40 chamadas, abaixo da variação entre medições. O limite atual é o número de triângulos (até 6,4 milhões por quadro no alto, metade na passada de sombra), não as chamadas.
- **Textura de cor do mapa de sombra.** O three r186 aloca uma textura de cor junto da profundidade do mapa de sombra PCF e não a usa: 16 MB no perfil médio e 64 MB no alto. Tirá-la exigiria mudar o three.
- **Normal e ARM de 2K em UASTC no perfil alto.** Somariam cerca de 100 MB de arquivo. O perfil alto usa a cor de 2K com a normal de 1K e o ARM de 512 px.

## Emenda das texturas depois da conversão

Métrica de `scripts/assets/preparar-texturas.py`: razão entre a diferença média na borda (última e primeira coluna ou linha) e a diferença média entre vizinhas no interior. Perto de 1,0, não há emenda. Limite: abaixo de 1,1.

O WebP com perda (até a Fase 9) passava do limite no ARM de quase todos os materiais (até 1,92 no saibro) e na cor do saibro e do solo solto (1,38 e 1,25). Nos originais do Poly Haven, o ARM já tinha emenda (até 1,52 no solo). O conversor corrige só junto da borda, antes de codificar: tira o degrau de baixa frequência sem apagar o grão. Depois, decodifica as camadas e mede de novo.

Na cor em ETC1S, a borda é comparada aos limites de bloco 4 × 4 do interior. O ETC1S cria um degrau em todo limite de bloco, inclusive no interior, e a borda da textura é um desses limites. Contra a média de todas as vizinhas, qualquer cor em ETC1S daria cerca de 1,4, mesmo sem emenda.

| Material | Cor 1K | Normal 1K | ARM 512 | Cor 2K |
|---|---|---|---|---|
| argila | 0,94 | 1,00 | 0,96 | 0,96 |
| solo | 0,89 | 0,87 | 1,01 | 0,89 |
| brita | 0,97 | 0,95 | 0,94 | 0,94 |
| asfalto_novo | 0,96 | 0,97 | 0,94 | 0,95 |
| asfalto_usado | 0,96 | 0,95 | 0,97 | 0,93 |
| grama | 0,91 | 0,98 | 0,97 | 0,92 |
| concreto | 0,95 | 0,94 | 0,98 | 0,96 |
| saibro | 0,98 | 0,99 | 1,02 | 0,99 |
| asfalto_solto | 0,92 | 1,04 | 0,93 | 0,89 |
| solo_solto | 1,00 | 0,98 | 0,95 | 0,98 |
| cascalho_solto | 0,97 | 0,94 | 0,97 | 0,96 |

Os valores ficam no manifesto `public/texturas/texturas.json` (`emenda_ktx2`), e `tests/renderizacao.test.js` confere que todos estão abaixo de 1,1.

## Limitações

- Uma só máquina de referência, com GPU dedicada. Numa GPU integrada, a taxa de quadros será bem menor. A qualidade automática mede os primeiros segundos e desce de perfil abaixo de 45 quadros por segundo.
- O Chromium roda sem janela visível. A composição da página pelo navegador é a mesma, mas sem a sincronia vertical; com ela, a taxa fica presa na frequência do monitor.
- A memória é a que o app pede ao WebGL. O uso real do driver pode ser maior por alinhamento e cópias internas.
- A carga foi medida em servidor local: não inclui a latência nem a banda da internet.
