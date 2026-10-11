# Fase 3B · Camada opcional "contexto Google" (somente online)

Leia `CLAUDE.md`. Execute somente a Fase 3B.

Objetivo: permitir ver o entorno fotorrealista do Google ao redor da obra, transmitido em tempo real, como camada opcional.

Tarefas:
1. Use a biblioteca `3d-tiles-renderer` (NASA-AMMOS) com o plugin de Google Photorealistic 3D Tiles. A chave vem de `import.meta.env.VITE_GOOGLE_TILES_KEY` em `.env.local`. Se o arquivo não existir, peça ao usuário para criá-lo (não escreva a chave você mesmo).
2. Alinhe os tiles ao sistema local da Fase 3 (origem e rotação de `public/local/meta.json`). Recorte ou esconda a faixa da obra para que o modelo próprio apareça por cima.
3. Botão "Contexto Google" no painel de camadas, desligado por padrão. Exiba o logo do Google Maps e os créditos de dados exigidos (campo `copyright`) sempre que a camada estiver ligada, sem sobrepor outros elementos.
4. Não implemente cache próprio, download antecipado nem captura de imagens dos tiles. Respeite os cabeçalhos de cache do serviço.
5. A camada deve ser excluída automaticamente do build offline (Fase 11) e do Electron.

Critérios de aceite: com chave, a camada liga e desliga e mostra a atribuição; sem chave, o botão fica desabilitado com uma explicação; o build offline não contém código nem referências da camada.
