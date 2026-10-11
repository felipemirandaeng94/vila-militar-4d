# Fase 1 · Projeto base e migração com paridade

Leia `CLAUDE.md` e `docs/PLANO.md`. Execute somente a Fase 1.

Contexto: `src-legado/` contém o código do modelo atual, que hoje é montado num único HTML por `src-legado/build.py`. Os arquivos são `geo.js`, `data.js`, `scene.js`, `app.js`, `ui.js`, `game.js`, `body.html`, `base.css` e `extra.css`. Eles usam variáveis globais e o Three.js r128 global (com `THREE.OrbitControls` e `THREE.CSS2DRenderer`). O arquivo `Vila_Militar_4D_Terraplenagem_Pavimentacao.html` na raiz é a referência visual e funcional.

Tarefas:
1. Crie um projeto Vite (JavaScript, sem framework) na raiz: `package.json`, `vite.config.js`, `index.html`, `src/`, `public/`. Instale `three` na versão estável atual e use `three/addons/...` para OrbitControls e CSS2DRenderer.
2. Migre o código de `src-legado/` para módulos ES em `src/`, mantendo a mesma divisão por arquivo nesta fase (`src/geo.js`, `src/data.js` etc.), com `import`/`export` explícitos no lugar das globais. Corrija o que mudou entre a r128 e a versão atual do Three.js (por exemplo `outputEncoding` → `outputColorSpace`, `PCFSoftShadowMap` → `PCFShadowMap`, gerenciamento de cor).
3. Fontes: baixe Instrument Serif, Hanken Grotesk e JetBrains Mono com `@fontsource` (npm) em vez dos data URIs.
4. Garanta paridade: mesmos dias, cenários, missão, abas, gráficos e cores. Compare com o HTML de referência abrindo os dois lado a lado.
5. Configure ESLint e Prettier com regras simples, e um `.gitignore` adequado (node_modules, dist, .env*).
6. Inicialize o Git, faça o primeiro commit e crie o README com: como instalar (`npm install`), rodar (`npm run dev`) e gerar build (`npm run build`).

Critérios de aceite: `npm run dev` abre o modelo sem erros no console e com comportamento idêntico ao HTML de referência; `npm run build` passa; commit feito.

No relatório final, liste qualquer diferença visual restante e o motivo.
