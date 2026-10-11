# Vila Militar 4D · instruções para o Claude Code

## Projeto
Modelo 4D interativo de uma obra militar de terraplenagem e pavimentação em CBUQ na Vila Militar (Deodoro, Rio de Janeiro/RJ), com usina de CBUQ no canteiro, controle tecnológico conforme normas DNIT, diário de obra e uma missão de decisões do engenheiro residente.

O plano completo está em `docs/PLANO.md`. Cada fase tem um prompt em `docs/prompts/`.

## Regras de trabalho
- Responda e escreva textos de interface em português do Brasil, sem emojis.
- Uma fase por vez. Não antecipe trabalho de fases futuras.
- Antes de editar, leia os arquivos envolvidos. Prefira mudanças pequenas e verificáveis.
- Ao terminar uma fase: rode `npm run build` e os testes existentes, corrija os erros, faça commit com mensagem descritiva e escreva um relatório curto (o que mudou, como testar, pendências e trabalho manual necessário).
- Nunca crie contas, nunca insira chaves de API ou senhas e nunca aceite termos de serviço. Quando isso for necessário, pare e peça ao usuário.
- Não remova `src-legado/`: ele é a referência de comportamento até a Fase 2 terminar.

## Stack
- JavaScript (módulos ES) no navegador, Vite, Three.js (WebGLRenderer), Vitest, Playwright.
- Python 3 para scripts em `scripts/geo/` e `scripts/assets/` (pipeline de dados e recursos).
- Recursos 3D em GLB comprimido (gltf-transform), texturas KTX2 ou WebP, HDRI em `.hdr`.

## Normas e conteúdo técnico
- Especificações DNIT: 104/2009, 106/2009, 108/2009, 137/2010, 139/2010, 141/2022, 144/2014, 145/2012 e 031/2024-ES. Ensaios DNER-ME e DNIT-ME citados em `src-legado/data.js`.
- Não altere critérios de aceitação, frequências de ensaio ou valores normativos sem pedido explícito.
- Resultados de ensaio, terreno e quantidades são ilustrativos; a interface deve deixar isso claro.

## Licenças
- Registre a origem e a licença de todo recurso externo em `assets/CREDITOS.md` e na tela de créditos.
- OpenStreetMap: "© colaboradores do OpenStreetMap (ODbL)". IPP: "Prefeitura da Cidade do Rio de Janeiro – Instituto Pereira Passos". Poly Haven: CC0.
- Google Photorealistic 3D Tiles: somente transmissão online, sem cache próprio, sem extração, com logo e créditos do Google visíveis.
