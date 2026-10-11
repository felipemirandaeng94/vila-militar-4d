# Vila Militar 4D

Modelo 4D interativo da reconstrução de cerca de 1,6 km de uma via da Vila Militar (Deodoro, Rio de Janeiro/RJ), com fresagem, drenagem nova, pavimento em CBUQ, frentes de serviço com desvio de tráfego, usina de CBUQ no canteiro, controle tecnológico conforme as normas do DNIT, diário de obra e a missão de decisões do engenheiro residente.

O trecho segue a Av. Duque de Caxias (1.582,8 m medidos no OpenStreetMap), com o entorno real a partir de dados abertos (OpenStreetMap e IPP). Quantidades, produtividades (teóricas de referência), cotas do terreno e resultados de ensaio são ilustrativos. O escopo está em `docs/ESCOPO.md` e os créditos em `assets/CREDITOS.md`.

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

## Testes

```
npm test
```

Roda os testes das regras da obra (Vitest) em `tests/`.

## Outros comandos

- `npm run lint`: verificação com ESLint.
- `npm run format`: formatação com Prettier (configuração em `.prettierrc.json`).

## Estrutura

- `index.html` e `src/main.js`: ponto de entrada.
- `dados/`: dados da obra em JSON (serviços, ensaios, decisões, manual, normas, parâmetros do trecho). Editar estes arquivos muda o modelo sem tocar no código.
- `src/dominio/`: regras da obra (cronograma, frentes, quantitativos, ensaios, liberações, nota da missão), sem Three.js nem DOM.
- `src/motor/`: modelo 3D (Three.js).
- `src/interface/`: painéis, abas, gráficos e diário de obra.
- `src/jogo/`: missão do engenheiro residente.
- `src/estado.js` e `src/controlador.js`: estado central e ligação entre as camadas.
- `public/local/`: local real (eixo, terreno, vias, edificações e metadados), gerado por `scripts/geo/` (pipeline Python, veja `scripts/geo/README.md`).
- `assets/CREDITOS.md`: origem e licença dos recursos externos.
- `tests/`: testes do domínio e do local real.
- `src-legado/`: código original (HTML único), mantido como referência até o fim da Fase 2.
- `Vila_Militar_4D_Terraplenagem_Pavimentacao.html`: HTML de referência.
- `docs/`: plano (`PLANO.md`), escopo (`ESCOPO.md`), arquitetura (`ARQUITETURA.md`) e prompts de cada fase.

Detalhes das camadas e de como editar os dados em `docs/ARQUITETURA.md`.
