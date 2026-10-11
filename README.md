# Vila Militar 4D

Modelo 4D interativo de uma obra militar de terraplenagem e pavimentação em CBUQ na Vila Militar (Deodoro, Rio de Janeiro/RJ), com usina de CBUQ no canteiro, controle tecnológico conforme as normas do DNIT, diário de obra e a missão de decisões do engenheiro residente.

Terreno, quantidades e resultados de ensaio são ilustrativos.

## Requisitos

- Node.js LTS (20 ou superior) e npm.

## Instalar

```
npm install
```

## Rodar em desenvolvimento

```
npm run dev
```

Abra o endereço mostrado no terminal (normalmente http://localhost:5173).

## Gerar o build

```
npm run build
npm run preview
```

O build vai para `dist/`. O `npm run preview` serve essa pasta localmente para conferência.

## Outros comandos

- `npm run lint`: verificação com ESLint.
- `npm run format`: formatação com Prettier (configuração em `.prettierrc.json`).

## Estrutura

- `index.html` e `src/main.js`: ponto de entrada.
- `src/`: módulos ES (`geo.js`, `data.js`, `scene.js`, `app.js`, `ui.js`, `game.js`) e estilos em `src/estilos/`.
- `src-legado/`: código original (HTML único), mantido como referência até o fim da Fase 2.
- `Vila_Militar_4D_Terraplenagem_Pavimentacao.html`: HTML de referência.
- `docs/`: plano do projeto (`PLANO.md`), escopo (`ESCOPO.md`) e prompts de cada fase.
- `dados/`: dados do local da obra.
