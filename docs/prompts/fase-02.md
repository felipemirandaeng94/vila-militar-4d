# Fase 2 · Arquitetura em camadas e dados em JSON

Leia `CLAUDE.md` e `docs/PLANO.md`. Execute somente a Fase 2.

Objetivo: separar responsabilidades e tirar os dados da obra do código, sem mudar o comportamento.

Estrutura alvo:
- `src/dominio/` (regras puras, sem Three.js nem DOM): geometria do trecho, quantitativos, cronograma, frentes de serviço, geração de ensaios, liberações de camada, métricas da missão.
- `src/motor/` (Three.js): renderizador, câmera, luzes, terreno, pavimento, canteiro, usina, equipamentos, marcadores, rótulos.
- `src/interface/`: painéis, barra 4D, abas, gráficos SVG, diário de obra.
- `src/jogo/`: missão, decisões, consequências, pontuação.
- `src/estado.js`: estado central simples (dia, cenário, modo, seleção) com assinatura de eventos; nada de variáveis globais soltas.
- `dados/obra.json` (trecho, seções, espessuras, larguras, datas), `dados/servicos.json`, `dados/ensaios.json` (planos e critérios), `dados/decisoes.json`, `dados/manual.json`, `dados/normas.json`.

Tarefas:
1. Mova os dados hoje embutidos em `data.js` e `game.js` para os JSON acima. Valide-os na carga com um esquema (zod ou validação própria) e mostre erro claro na tela se algo estiver inválido.
2. Reorganize o código nas pastas acima, mantendo a interface e o visual iguais.
3. Crie testes com Vitest para: volumes de corte e aterro, diagrama de massas, cronograma (incluindo os dois retrabalhos), quantidade e dias dos ensaios, emissão das liberações e cálculo da nota da missão. Use os valores atuais como referência (por exemplo corte ≈ 2.061 m³, aterro ≈ 2.754 m³, CBUQ ≈ 254 t).
4. Documente em `docs/ARQUITETURA.md` as camadas, o fluxo de dados e como adicionar um serviço, um ensaio ou uma decisão só editando JSON.

Critérios de aceite: `npm test` passa; alterar a duração de um serviço em `dados/servicos.json` reflete no Gantt e no 3D; a missão continua jogável do início ao fim.
