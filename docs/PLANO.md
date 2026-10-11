# Vila Militar 4D: plano do projeto realista

Objetivo: transformar o modelo 4D atual (HTML único) em um projeto no VS Code, sem limite de tamanho, com o local real da Vila Militar, visual realista, equipamentos em 3D de verdade, a missão do engenheiro residente e distribuição por link (GitHub Pages) e por executável offline.

Escopo da obra: reconstrução completa de cerca de 1,6 km de uma via existente, com drenagem nova, canteiro e usina no início do trecho. O escopo detalhado está em `docs/ESCOPO.md` e o local em `dados/local.json`. O app atual (300 m de trecho novo) é mantido até a Fase 2 e muda para o novo escopo na Fase 2B.

Como usar este plano: execute uma fase por vez no Claude Code (app Claude desktop, pasta do projeto aberta). Cole o prompt da fase, ou peça "execute docs/prompts/fase-XX.md". Só avance depois dos critérios de aceite da fase anterior.

## Fase 0 · Preparação (trabalho manual)

1. Instalar Node.js LTS, Git e VS Code (com as extensões ESLint e Live Server).
2. Criar a conta no GitHub, se ainda não tiver, e entrar com ela no Git (`git config --global user.name` e `user.email`).
3. Descompactar o pacote `vila-militar-4d-pacote.zip` em `C:\Projetos`; ele cria a pasta `C:\Projetos\vila-militar-4d`.
4. Abrir a pasta no app Claude desktop (Claude Code) e no VS Code.
5. Definir o trecho real da obra: abrir o Google Maps, clicar com o botão direito no início e no fim do trecho e anotar as coordenadas (latitude, longitude). Anotar também o nome da via e a largura aproximada. Feito: coordenadas e largura em `dados/local.json`; o nome da via será identificado na Fase 3.
6. Decidir a divulgação. Por se tratar de área militar, recomendo repositório privado e consultar a OM antes de publicar um link aberto com o local georreferenciado.
7. Opcional: criar uma chave da Google Map Tiles API (Photorealistic 3D Tiles), com cobrança ativada e restrição por domínio. Só é necessária para a camada "contexto Google" da Fase 3B.

Ao fim da fase: a pasta contém `src-legado/`, `docs/`, `CLAUDE.md` e o HTML atual.

## Fase 1 · Projeto base e migração com paridade

Cria o projeto Vite, move o código atual para módulos ES e garante que o resultado seja visualmente idêntico ao HTML atual. Sem mudança com o novo escopo: a migração mantém os 300 m atuais.

Prompt: `docs/prompts/fase-01.md`

Aceite: `npm run dev` abre o modelo igual ao HTML atual; `npm run build` gera `dist/` sem erros; primeiro commit feito.

## Fase 2 · Arquitetura em camadas e dados em JSON

Separa motor 3D, regras da obra, interface e jogo. Serviços, ensaios, decisões e parâmetros do trecho passam para arquivos JSON validados. Testes unitários para quantitativos, cronograma e ensaios.

Prompt: `docs/prompts/fase-02.md`

Aceite: mudar um prazo ou uma decisão no JSON altera o modelo sem tocar no código; `npm test` passa.

## Fase 2B · Novo escopo: reconstrução, drenagem e frentes de serviço

Troca o escopo do app (trecho novo de 300 m) pela reconstrução completa de cerca de 1,6 km descrita em `docs/ESCOPO.md`, ainda em eixo reto e terreno fictício. Entram os serviços e ensaios novos em JSON (fresagem, remoção de base e sub-base, drenagem, meio-fio e sarjeta, substituição de solo, sinalização), as frentes de serviço de 300 a 400 m com desvio de tráfego e o cronograma recalculado com produtividades típicas de BEC. Também entram os quantitativos de demolição, drenagem e pavimento, a representação 3D do pavimento existente sendo fresado e removido, de valas, tubos, caixas e meio-fio, e 4 decisões novas da missão.

Prompt: `docs/prompts/fase-02b.md`

Trabalho manual: validar as produtividades, os quantitativos de referência e o texto técnico das novas decisões.

Aceite: o cronograma e o 3D mostram as frentes avançando em sequência ao longo de 1,6 km; drenagem antes das camadas do pavimento; `npm test` passa com os novos testes.

## Fase 3 · Local real da Vila Militar (dados abertos)

Pipeline em Python que baixa e prepara os dados do trecho: vias e edificações do OpenStreetMap, edificações do IPP (Prefeitura do Rio), relevo e, se disponível, ortofoto oficial. Gera o terreno, as vias existentes e os prédios reais da vizinhança. O eixo da obra passa a seguir o traçado real da via existente entre os dois pontos de `dados/local.json`, e o canteiro e a usina ficam no início do trecho.

Prompt: `docs/prompts/fase-03.md`

Trabalho manual: confirmar a via identificada no OpenStreetMap e a área do canteiro no início do trecho; se o portal do IPP estiver fora do ar, baixar os shapefiles de edificações pelo navegador e salvar em `geo/brutos/`.

Aceite: o eixo da obra segue a via existente entre o início e o fim; o entorno corresponde ao trecho real (traçado das vias, quadras e prédios); canteiro e usina no início do trecho; créditos das fontes na tela.

## Fase 3B · Camada opcional "contexto Google" (somente online)

Mostra o entorno fotorrealista do Google (Photorealistic 3D Tiles) ao redor da obra, transmitido em tempo real, com atribuição obrigatória. Não entra na versão offline.

Prompt: `docs/prompts/fase-03b.md`

Trabalho manual: criar a chave da API e colar no arquivo `.env.local` (o Claude não insere chaves).

Aceite: a camada liga e desliga num botão, mostra o logo e os créditos do Google e some sem erro quando não há chave.

## Fase 4 · Iluminação e renderização realistas

Céu HDRI, sol com sombras de qualidade, oclusão de ambiente (GTAO), mapeamento de tons, névoa atmosférica e seletor de qualidade (baixa, média, alta) com detecção automática.

Prompt: `docs/prompts/fase-04.md`

Trabalho manual: nenhum (o HDRI CC0 do Poly Haven é baixado pelo script).

Aceite: a qualidade alta melhora visivelmente o modelo e a baixa roda fluida em notebook com vídeo integrado.

## Fase 5 · Materiais PBR do terreno e do pavimento

Texturas reais de solo, aterro, brita graduada, solo-brita, imprimação, pintura de ligação e CBUQ, com mistura por camada da obra, solo molhado pelo pipa, marcas de pneu e de rolo e sinalização horizontal.

Prompt: `docs/prompts/fase-05.md`

Aceite: cada camada é reconhecível de perto e a transição entre camadas acompanha a frente de serviço.

## Fase 6 · Vegetação e entorno

Árvores e gramado instanciados, prédios do entorno com fachadas e telhados texturizados, meios-fios, postes e calçadas nas vias existentes.

Prompt: `docs/prompts/fase-06.md`

Aceite: o entorno parece uma área militar arborizada do Rio, mantendo a taxa de quadros da Fase 4.

## Fase 7 · Equipamentos em 3D de verdade

Pipeline de modelos GLB (compressão Draco/Meshopt e texturas KTX2), mapeamento das partes móveis (lança, braço, caçamba, báscula, cilindros), níveis de detalhe e fallback para os modelos atuais.

Prompt: `docs/prompts/fase-07.md`

Trabalho manual: escolher e baixar os modelos (Sketchfab, CGTrader, Poly Pizza etc.), conferir a licença e salvar em `assets/brutos/modelos/`. Se um modelo vier com as partes móveis numa peça só, separar no Blender ou aceitar animação simplificada.

Aceite: escavadeira, basculante, motoniveladora, rolos, vibroacabadora e caminhões especiais aparecem com modelos reais e animações coerentes.

## Fase 8 · Efeitos e som

Partículas de poeira, fumaça da chaminé, vapor do CBUQ, jato do pipa e do espargidor; som ambiente da obra que só começa após clique.

Prompt: `docs/prompts/fase-08.md`

Aceite: os efeitos acompanham as frentes de serviço e podem ser desligados no seletor de qualidade.

## Fase 9 · Jogo, interface e conteúdo

Tela de carregamento com progresso, missão com decisões em JSON e salvamento local, ranking local, créditos e licenças, ajustes de interface e acessibilidade. Entram também novas decisões ligadas à reconstrução, somadas às 4 criadas na Fase 2B. Exemplos: a OM atrasa a aprovação do desvio da próxima frente; o subleito exposto após a remoção da base dá ISC abaixo do projeto em um segmento; o fresado chega à usina com teor de ligante muito variável; a sarjeta recém-executada fica com caimento invertido; o veículo de uma edificação lindeira precisa passar pela frente fechada.

Prompt: `docs/prompts/fase-09.md`

Aceite: a missão roda do início ao fim, salva o progresso e a tela de créditos lista todas as fontes.

## Fase 10 · Desempenho e testes automatizados

Orçamento de desempenho, testes de fumaça e de capturas com Playwright, verificação de erros de console e de quadros por segundo.

Prompt: `docs/prompts/fase-10.md`

Aceite: `npm run test:e2e` passa e o relatório de desempenho cabe no orçamento definido.

## Fase 11 · Distribuição

Publicação automática no GitHub Pages a cada push e executável Windows offline (Electron) com tudo embutido, sem a camada Google.

Prompt: `docs/prompts/fase-11.md`

Trabalho manual: ativar o GitHub Pages no repositório (Settings → Pages → Source: GitHub Actions) e, no Windows, aceitar o aviso do SmartScreen na primeira execução do `.exe` (executável sem assinatura digital).

Aceite: o link do GitHub Pages abre o modelo e o `.exe` roda sem internet.

## Como vamos fazer (resumo)

- Linguagem: JavaScript moderno (módulos ES) no navegador; Python para o pipeline de dados geográficos e de preparação de recursos.
- Motor 3D: Three.js (versão estável atual, r186 ou superior) com WebGLRenderer, por compatibilidade com computadores corporativos; caminho aberto para WebGPU no futuro.
- Ferramenta de projeto: Vite (servidor de desenvolvimento e build), npm, Git e GitHub.
- Editor e agente: VS Code para visualizar e editar; Claude Code no app Claude desktop executando os prompts de cada fase.
- Testes: Vitest (regras da obra) e Playwright (navegador e capturas).
- Recursos 3D: GLB com gltf-transform (Draco/Meshopt, KTX2); texturas e HDRI CC0 do Poly Haven; modelos de máquinas de bibliotecas com licença compatível.
- Dados do local: OpenStreetMap (ODbL), IPP/Data.Rio (citar a fonte), relevo SRTM/Copernicus ou levantamento próprio; Google Photorealistic 3D Tiles apenas como camada online opcional, transmitida e com atribuição.
- Distribuição: GitHub Pages (link) e Electron (executável offline para o canteiro).
- O que o Claude não faz: criar contas, inserir chaves ou senhas, aceitar termos de serviço e escolher licenças de modelos pagos. Esses passos estão marcados como trabalho manual.
