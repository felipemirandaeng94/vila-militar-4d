# Fase 11 · Distribuição

Leia `CLAUDE.md`. Execute somente a Fase 11.

Tarefas:
1. GitHub Pages: workflow em `.github/workflows/deploy.yml` que roda testes e build a cada push na branch `main` e publica `dist/`. Ajuste `base` no `vite.config.js` para o nome do repositório. Peça ao usuário para ativar Settings → Pages → Source: GitHub Actions.
2. Build offline: modo `npm run build:offline` sem a camada Google (Fase 3B) e com todos os recursos locais.
3. Executável Windows com Electron e electron-builder (alvo `portable`): janela única, sem barra de menus, abre o build offline sem internet. Gere `release/VilaMilitar4D.exe`.
4. Pacote alternativo em pasta: `iniciar.bat` que sobe um servidor local estático e abre o navegador, para máquinas onde o `.exe` não puder rodar.
5. Atualize o README com: link publicado, como gerar o `.exe`, como rodar a pasta offline e o aviso do SmartScreen (executável sem assinatura).

Critérios de aceite: o link do GitHub Pages abre o modelo; o `.exe` e a pasta offline funcionam sem internet.
