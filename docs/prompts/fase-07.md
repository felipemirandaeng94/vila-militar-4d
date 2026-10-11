# Fase 7 · Equipamentos em 3D de verdade

Leia `CLAUDE.md`. Execute somente a Fase 7.

Pré-requisito manual: o usuário salva os modelos escolhidos em `assets/brutos/modelos/` com um arquivo `LICENCAS.txt` (fonte, autor, licença). Se a pasta estiver vazia, liste para ele os modelos necessários e pare.

Modelos necessários: escavadeira hidráulica, caminhão basculante (com báscula separada), motoniveladora, trator de esteiras, pá carregadeira, rolo pé-de-carneiro, rolo liso, rolo de pneus, rolo tandem, vibroacabadora, caminhão-pipa, caminhão espargidor, caminhão munck, fresadora. Cor verde-oliva fosca.

Tarefas:
1. `scripts/assets/preparar_modelos.mjs` com gltf-transform: normalizar escala (metros) e orientação (frente em +X), aplicar a cor verde-oliva quando o modelo vier em amarelo, reduzir polígonos (até cerca de 30 mil por máquina), comprimir com Meshopt ou Draco e texturas em KTX2, gerar LOD1 e LOD2.
2. `src/motor/equipamentos/catalogo.json`: para cada máquina, o arquivo, a escala e o mapeamento das partes móveis (lança, braço, caçamba, giro da superestrutura, báscula, cilindros, lâmina, tambores, rodas, mesa da vibroacabadora).
3. Rig: amarre a animação atual (ciclos de carga, báscula, giro, avanço dos rolos) às partes mapeadas. Rodas e tambores giram conforme a distância percorrida. Sem giros no próprio eixo: quando a máquina inverte o sentido, ela anda de ré.
4. Fallback: se um modelo faltar ou falhar, use o modelo procedural atual e registre um aviso no console.
5. Créditos de cada modelo em `assets/CREDITOS.md` e na tela de créditos.

Se um modelo vier com as partes móveis numa peça só, informe ao usuário e ofereça duas saídas: separar no Blender (passo manual, explique como) ou animação simplificada.

Critérios de aceite: todas as máquinas aparecem com modelo real, animação coerente e licença registrada; carga total dos modelos abaixo de 40 MB.
