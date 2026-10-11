# Fase 2B · Novo escopo: reconstrução, drenagem e frentes de serviço

Leia `CLAUDE.md`, `docs/PLANO.md`, `docs/ESCOPO.md`, `docs/ARQUITETURA.md` e `dados/local.json`. Execute somente a Fase 2B.

Pré-requisito: a Fase 2 está concluída (dados em `dados/*.json`, camadas `dominio/`, `motor/`, `interface/`, `jogo/` e testes passando).

Objetivo: trocar o escopo do app (trecho novo de 300 m em corte e aterro) pela reconstrução completa de cerca de 1,6 km da via existente, conforme `docs/ESCOPO.md`. O eixo continua reto e o terreno continua fictício. O traçado real entra só na Fase 3. Toda a mudança deve vir dos JSON e do domínio, sem regra técnica fixa no código do motor ou da interface.

Tarefas:
1. Dados da obra (`dados/obra.json`): extensão de 1.600 m (parâmetro, que a Fase 3 vai substituir pela extensão medida), pista de 7,0 m, meio-fio e sarjeta nas duas bordas, larguras da caixa do pavimento, espessuras existentes (revestimento, base e sub-base, ilustrativas) e espessuras de projeto. Mantenha o estaqueamento de 20 m. Guarde o escopo antigo de 300 m como cenário legado só se isso não complicar o código. Se complicar, remova-o e registre a remoção no relatório.
2. Serviços novos em `dados/servicos.json`, com norma, equipe, equipamentos e produtividade: sinalização de obra e desvio, cadastro e sondagem de interferências, fresagem a frio (DNIT 159/2011-ES), remoção de base e sub-base com carga e transporte, estoque de fresado, escavação de valas, berço e assentamento de tubos de concreto (DNIT 023/2024-ES), caixas coletoras e bocas de lobo (DNIT 026/2025-ES e DNIT 030/2004-ES), poços de visita, reaterro compactado de valas, meio-fio (DNIT 020/2023-ES), sarjeta (DNIT 018/2023-ES), deságue (DNIT 022/2023-ES, se houver dissipador), substituição de solo do subleito, sinalização horizontal (DNIT 100/2018-ES) e vertical (DNIT 101/2009-ES). Os serviços de pavimento atuais continuam valendo. O corte e o aterro deixam de existir, e a limpeza (DNIT 104/2009-ES) fica restrita ao canteiro e às faixas laterais. Onde `docs/ESCOPO.md` marca "a confirmar", use esse texto no campo de norma e não invente número.
3. Ensaios novos em `dados/ensaios.json`, com frequência e critério: espessura e textura após a fresagem; caracterização do fresado (teor de ligante e granulometria); GC do reaterro de valas por camada; recebimento de tubos de concreto conforme ABNT NBR 8890 (inspeção visual e dimensional por lote, compressão diametral por amostragem e rejeição do lote reprovado); resistência do concreto de meio-fio, sarjeta e caixas; caimento da sarjeta; ISC do subleito exposto após a remoção da base, com gatilho de substituição de solo. Não altere critérios nem frequências dos ensaios já existentes. Quando a frequência de um ensaio novo não estiver numa norma confirmada, marque-a como valor de projeto ilustrativo e liste-a no relatório para validação.
4. Frentes de serviço (`src/dominio/frentes.js`): divida o trecho em frentes de 300 a 400 m (parâmetro em JSON; padrão de 4 frentes de 400 m) a partir do canteiro, no início do trecho. Cada frente segue a sequência de `docs/ESCOPO.md`: sinalização e desvio, interferências, fresagem, drenagem, remoção de base e sub-base, subleito, meio-fio e sarjeta, sub-base e base, imprimação, pintura, CBUQ, sinalização definitiva e liberação ao tráfego. As frentes se sobrepõem em cascata, limitadas pelas equipes disponíveis (uma equipe por tipo de serviço, configurável). Regra rígida: nenhuma camada de pavimento antes de a drenagem da frente estar concluída e com o reaterro aprovado. Na interface e no 3D, o desvio de tráfego de cada frente aparece como estado (via em uso, meia pista, desvio total, liberada).
5. Cronograma (`src/dominio/cronograma.js`): recalcule para 1,6 km a partir de quantidade ÷ produtividade, por frente e por equipe. Use como ponto de partida as produtividades típicas de BEC abaixo, todas em JSON e marcadas como ilustrativas. Peça ao usuário para validá-las antes de fechar a fase.
   - Fresagem a frio (fresadora de 1,0 m): 2.000 m²/dia.
   - Remoção de base e sub-base (escavadeira + basculantes): 500 m³/dia.
   - Vala, berço, tubo ø 400 a 600 mm e reaterro: 35 m/dia por equipe.
   - Caixa coletora ou boca de lobo: 2 un/dia. Poço de visita: 1 un/dia.
   - Meio-fio: 100 m/dia. Sarjeta: 100 m/dia.
   - Regularização do subleito: 2.500 m²/dia. Substituição de solo: 300 m³/dia.
   - Sub-base e base: 1.200 m²/dia por camada.
   - Imprimação e pintura de ligação: 4.000 m²/dia.
   - CBUQ (usina do canteiro + vibroacabadora): 400 t/dia.
   - Sinalização horizontal: 1.000 m/dia.
   Mantenha os cenários de não conformidade e os retrabalhos atuais, adaptados às frentes. O Gantt deve agrupar por frente e por serviço.
6. Quantitativos (`src/dominio/quantitativos.js`): área de fresagem e volume de fresado (com empolamento), volume de base e sub-base removidas, volume de bota-fora, extensão de vala, volume de escavação e reaterro, metros de tubo por diâmetro, número de caixas, bocas de lobo e poços de visita (espaçamento em JSON), metros de meio-fio e sarjeta, áreas e volumes de cada camada nova, toneladas de CBUQ e de fresado reaproveitado, consumo de CAP, imprimante e emulsão. Ordem de grandeza esperada (ilustrativa): cerca de 11.200 m² de pista, 3.200 m de meio-fio e 3.200 m de sarjeta, e cerca de 1.350 t de CBUQ para 5 cm de espessura.
7. 3D (`src/motor/`): pavimento existente desgastado sobre todo o trecho; fresadora removendo o revestimento e deixando a superfície fresada texturizada; esteira de carga no basculante; remoção da base e da sub-base até o subleito; valas abertas com escoramento, berço, tubos sendo assentados pelo munck, caixas, bocas de lobo, poços de visita e reaterro; meio-fio e sarjeta pré-moldados ou extrusados; estoque de fresado no canteiro; sinalização de obra (cones, cavaletes, placas) e faixa de desvio por frente. Use modelos procedurais simples; os modelos reais são da Fase 7. Com 1,6 km, use `InstancedMesh` para elementos repetidos (tubos, cones, meio-fio) e atualize a geometria do pavimento por segmento.
8. Missão: 4 decisões novas em `dados/decisoes.json`, com alternativas, consequências (prazo, custo, qualidade, segurança) e justificativa técnica. Escreva o texto e peça validação técnica ao usuário antes de fechar.
   - Rede não cadastrada encontrada na vala (por exemplo, um cabo ou tubo sem registro): parar e acionar a concessionária ou a OM, desviar o traçado ou seguir com cuidado.
   - Chuva forte prevista com vala aberta: escorar e cobrir, reaterrar parcialmente, bombear ou manter a vala aberta.
   - Tubo de concreto trincado no recebimento: rejeitar o lote, aceitar só os tubos sem trinca após inspeção ou assentar mesmo assim.
   - Percentual de fresado reaproveitado na usina: 0 %, 10 %, 20 % ou 30 %, com efeito no custo, no controle da mistura e no risco de não conformidade. O limite admitido fica "a confirmar" conforme `docs/ESCOPO.md`.
9. Interface: aviso visível de que quantitativos, produtividades, terreno e resultados são ilustrativos; diário de obra com os novos serviços por frente; painel de frentes com o estado do desvio.
10. Atualize `docs/ARQUITETURA.md` com as frentes de serviço e a regra de precedência da drenagem.

Testes (Vitest):
- Frentes: com 1.600 m e frentes de 400 m saem 4 frentes contíguas que cobrem o trecho sem lacuna nem sobreposição; com 350 m sai o número correto de frentes, e a última fica com o resto.
- Precedência: em nenhuma frente a sub-base começa antes do fim da drenagem e do reaterro aprovado; o CBUQ não começa antes da imprimação curada; a liberação ao tráfego vem depois da sinalização definitiva.
- Cronograma: a duração de cada serviço é igual a quantidade ÷ produtividade (arredondada conforme a regra adotada); dobrar uma produtividade no JSON reduz a duração do serviço; os retrabalhos atrasam só as frentes afetadas e as que dependem delas.
- Quantitativos: área de pista = extensão × 7,0 m; metros de meio-fio e de sarjeta = 2 × extensão; toneladas de CBUQ = área × espessura × densidade; número de caixas e de poços de visita de acordo com o espaçamento.
- Ensaios: quantidade e dias dos ensaios novos por frente; reprovação do ISC do subleito gera o serviço de substituição de solo; lote de tubos reprovado não é assentado.
- Missão: as 4 decisões novas carregam do JSON, passam na validação de esquema e alteram a nota conforme a consequência.
- Os testes antigos que dependiam do escopo de 300 m são atualizados ou removidos, com justificativa no relatório.

Critérios de aceite: `npm run build` e `npm test` passam; o Gantt e o 3D mostram as frentes avançando em sequência ao longo de 1,6 km, com canteiro e usina no início; drenagem sempre antes das camadas do pavimento; o desvio de tráfego aparece por frente; as 4 decisões novas são jogáveis; mudar uma produtividade ou o tamanho da frente no JSON altera o cronograma e o 3D sem tocar no código; o relatório lista as produtividades, frequências e textos de decisão que dependem de validação do usuário.
