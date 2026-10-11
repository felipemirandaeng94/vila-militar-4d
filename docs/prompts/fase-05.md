# Fase 5 · Materiais PBR do terreno e do pavimento

Leia `CLAUDE.md`. Execute somente a Fase 5.

Tarefas:
1. Baixe do Poly Haven (CC0), em 1K e 2K, texturas PBR (cor, normal, rugosidade, AO) para: solo argiloso vermelho, solo compactado, cascalho/brita, asfalto novo, asfalto usado, grama e concreto. Converta para KTX2 ou WebP com um script.
2. Terreno: material com mistura de camadas por atributo de vértice (natural, limpo, corte, corpo do aterro, camada final, regularizado, solo-brita, brita graduada), usando `onBeforeCompile` ou um material de nó. Mapeamento triplanar nos taludes para evitar esticamento.
3. Pavimento: CBUQ escuro e fosco quando novo, imprimação marrom brilhante, pintura de ligação preta com leve brilho, faixa central e bordas com tinta de demarcação.
4. Estados da obra: área molhada pelo pipa (mais escura e com rugosidade menor) que seca com o tempo; marcas de pneu e de rolo como decalques que seguem as máquinas; junta longitudinal entre as faixas do CBUQ.
5. Mantenha as espessuras exageradas ×3 como opção e preserve a leitura das camadas na vista de perfil.

Critérios de aceite: de perto, cada camada é reconhecível pelo material; a mudança de camada acompanha a frente de serviço; desempenho dentro dos perfis da Fase 4.
