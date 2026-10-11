# Fase 4 · Iluminação e renderização realistas

Leia `CLAUDE.md`. Execute somente a Fase 4.

Tarefas:
1. Script `scripts/assets/baixar_polyhaven.py` que baixa, pela API pública do Poly Haven (CC0), um HDRI de céu diurno parcialmente nublado em 2K e 4K para `public/hdri/`. Registre em `assets/CREDITOS.md`.
2. Renderizador: `outputColorSpace` sRGB, `ACESFilmicToneMapping` (ou AgX, compare e escolha), exposição ajustável. Ambiente por PMREM a partir do HDRI e fundo de céu com o mesmo HDRI.
3. Sol: luz direcional alinhada ao HDRI, com sombras em cascata (CSM do three/addons) ou mapa de sombra ajustado à câmera; bias calibrado para não haver serrilhado nem "peter panning".
4. Pós-processamento com EffectComposer: GTAO (oclusão de ambiente), SMAA ou FXAA, OutputPass; névoa atmosférica leve.
5. `src/motor/qualidade.js`: perfis baixa, média e alta (resolução de sombra, pixel ratio, pós-processamento, distância de desenho, densidade de vegetação), com detecção automática pela GPU e pela taxa de quadros nos primeiros segundos, e seletor manual salvo em localStorage.
6. Indicador de quadros por segundo opcional (tecla F).

Critérios de aceite: a qualidade alta melhora claramente o realismo; a baixa mantém pelo menos 45 quadros por segundo num notebook com vídeo integrado; nenhuma regressão de comportamento.
