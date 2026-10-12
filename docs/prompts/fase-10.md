# Fase 10 · Desempenho e testes automatizados

Leia `CLAUDE.md`. Execute somente a Fase 10.

Tarefas:
1. Orçamento de desempenho em `docs/DESEMPENHO.md`: carga inicial, memória de GPU, chamadas de desenho e quadros por segundo por perfil de qualidade. Meça e registre os valores atuais.
2. Otimizações: instanciamento, mesclagem de geometrias estáticas, compressão de texturas, carregamento sob demanda (máquinas só quando entram em serviço), descarte de recursos não usados.
   - Texturas PBR do terreno e do pavimento (`public/texturas/`): na conversão para KTX2, grave os mapas de normal e ARM sem perda ou em UASTC (não ETC1S). Hoje eles estão em WebP com perda, que cria uma diferença na borda (cerca de 14 níveis contra 8 no interior, no mapa de normal) e uma emenda fraca quando a textura repete; o mesmo vale para as texturas do Poly Haven. A cor pode ir em ETC1S. Meça a emenda depois da conversão com a métrica de `scripts/assets/preparar-texturas.py` (razão borda/interior abaixo de 1,1).
3. Playwright: testes que abrem o app, percorrem a obra do dia 0 ao fim nos cenários e na missão, trocam vistas e abas, verificam ausência de erros no console e salvam capturas de referência; comparação visual com tolerância.
4. Script `npm run test:all` que roda Vitest e Playwright.

Critérios de aceite: `npm run test:all` passa; o orçamento está documentado e respeitado.
