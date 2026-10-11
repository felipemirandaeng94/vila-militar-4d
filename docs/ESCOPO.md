# Escopo da obra: reconstrução completa da via existente

Este documento registra o novo escopo da obra e substitui o escopo anterior, que era um trecho novo de 300 m com terraplenagem em corte e aterro. A Fase 1 ainda reproduz o escopo antigo para garantir a paridade com o HTML de referência. O novo escopo entra no app a partir da Fase 2B (ver `docs/PLANO.md`).

Todos os quantitativos, resultados de ensaio e dados de terreno do modelo são ilustrativos. A interface deve deixar isso claro.

## Produtividades

O cronograma usa produtividades teóricas de referência: caso ideal, baseado nas composições do SICRO (DNIT), sem interferências, chuva, perdas, esperas ou improdutividade. Os atrasos aparecem só pelos eventos modelados (não conformidades, retrabalhos e decisões da missão). Os valores ficam em `dados/servicos.json`, com a composição de referência de cada um.

## Local

- Via existente em uso na Vila Militar, em Deodoro, Rio de Janeiro/RJ. O nome será identificado pelo OpenStreetMap na Fase 3.
- Início: -22.868801, -43.407832. Fim: -22.861972, -43.394281 (dados em `dados/local.json`).
- Distância em linha reta: 1.582 m, com azimute de cerca de 61°. A extensão sobre o eixo da via é de cerca de 1,6 km e será medida na Fase 3.
- Pista de 7,0 m de largura. A área de revestimento fica em torno de 11.200 m² (1.600 m × 7,0 m), sem contar alargamentos e acessos.
- O canteiro de obras e a usina de CBUQ ficam no início do trecho.

## Natureza da obra

A obra é a reconstrução completa do pavimento. O revestimento existente é fresado, a base e a sub-base existentes são removidas até o subleito, a drenagem é implantada (hoje não existe) e o pavimento é refeito sobre o subleito tratado. A via continua em uso durante a obra, que avança por frentes de serviço.

## Serviços, em ordem de execução

### 1. Mobilização, canteiro e usina
- Canteiro, escritório, laboratório de campo, almoxarifado, pátio de máquinas e estoques de agregados no início do trecho.
- Montagem, calibração e licenciamento da usina de CBUQ no canteiro, com área para estoque de material fresado.

### 2. Sinalização de obra e desvio de tráfego
- A via está em uso na Vila Militar, por isso a obra avança por frentes de 300 a 400 m. São 4 ou 5 frentes no total.
- Em cada frente: sinalização provisória (placas, cones, cavaletes e balizadores), desvio ou operação em meia pista, controle de acesso às edificações e passagens para pedestres, conforme o Manual de Sinalização de Obras e Emergências em Rodovias do DNIT (Publicação IPR 738, 2010).
- Uma frente só é aberta quando o plano de desvio for aprovado pela OM. Só é liberada ao tráfego com o revestimento concluído ou com uma solução provisória segura.

### 3. Serviços preliminares
- Topografia: levantamento planialtimétrico do eixo e das bordas, locação, nota de serviço e greide de projeto (NBR 13133).
- Cadastro de interferências: redes de água, esgoto, energia e telecomunicações, com consulta às concessionárias e à OM. Sondagem manual antes de escavar onde houver suspeita de rede.
- Sondagens do pavimento existente e do subleito, com espessuras das camadas e coleta de amostras.
- Ensaios do subleito: granulometria, limites, compactação, ISC e expansão (ensaios DNER-ME de `src-legado/data.js`).

### 4. Demolição do pavimento existente
- Fresagem a frio do revestimento existente (DNIT 159/2011-ES). O material fresado é estocado e separado. A parte que atender à DNIT 033/2021-ES (concreto asfáltico reciclado em usina a quente) é reaproveitada no CBUQ da usina; o restante vai para bota-fora licenciado.
- Remoção da base e da sub-base existentes até o subleito, com escavação, carga e transporte (DNIT 106/2009-ES, por analogia ao serviço de escavação, carga e transporte).
- Em cada frente, a fresagem vem antes da drenagem. A remoção da base e da sub-base vem depois das valas reaterradas, para que a caixa do pavimento não fique exposta à chuva sem deságue.

### 5. Drenagem nova
A drenagem é executada antes das camadas do pavimento.
- Escavação de valas com escoramento quando necessário, berço, assentamento de tubos de concreto, juntas e reaterro compactado em camadas.
- Caixas coletoras e bocas de lobo, poços de visita e ligações.
- Meio-fio e sarjeta ao longo das bordas.
- Deságue em ponto de lançamento definido em projeto, com dissipação quando necessário.

### 6. Subleito
- Regularização e compactação do subleito (DNIT 137/2010-ES).
- Substituição de solo onde o ISC não atender ao projeto, com material de empréstimo compactado em camadas (DNIT 108/2009-ES, por analogia à camada final de aterro).

### 7. Pavimento novo
- Sub-base de solo-brita (DNIT 139/2010-ES).
- Base de brita graduada (DNIT 141/2022-ES).
- Imprimação (DNIT 144/2014-ES).
- Pintura de ligação (DNIT 145/2012-ES).
- Revestimento em CBUQ produzido na usina do canteiro (DNIT 031/2024-ES).

### 8. Sinalização definitiva
- Sinalização horizontal (DNIT 100/2018-ES).
- Sinalização vertical (DNIT 101/2009-ES).

### 9. Controle tecnológico
Todos os serviços passam por controle tecnológico, com os planos e critérios atuais preservados. Entram também:
- Reaterro de valas: grau de compactação por camada, com frequência e critério a definir no projeto da Fase 2B.
- Recebimento de tubos de concreto conforme a ABNT NBR 8890: inspeção visual e dimensional de cada lote e ensaio de compressão diametral por amostragem. O lote é rejeitado quando houver trinca ou quando a amostra for reprovada.
- Meio-fio, sarjeta, caixas e poços de visita: resistência do concreto (corpos de prova), geometria e caimentos.
- Fresado reaproveitado: caracterização (teor de ligante e granulometria do material recuperado) e controle da mistura reciclada conforme a DNIT 033/2021-ES.

### 10. Desmobilização e entrega
- Limpeza final, desmontagem do canteiro e da usina, cadastro como construído das redes de drenagem e entrega à OM.

## Especificações DNIT de referência

Conferidas em 11/10/2026 na página "Especificação de Serviço (ES)" da coletânea de normas do DNIT (gov.br/dnit, IPR).

| Serviço | Especificação | Situação |
|---|---|---|
| Fresagem a frio do revestimento | DNIT 159/2011-ES (Pavimentos asfálticos: fresagem a frio) | Confirmada |
| Sarjetas e valetas | DNIT 018/2023-ES | Confirmada |
| Transposição de sarjetas e valetas | DNIT 019/2023-ES | Confirmada |
| Meios-fios e guias | DNIT 020/2023-ES | Confirmada |
| Entradas e descidas d'água | DNIT 021/2023-ES | Confirmada |
| Dissipadores de energia (deságue) | DNIT 022/2023-ES | Confirmada |
| Bueiros tubulares de concreto | DNIT 023/2024-ES | Confirmada |
| Caixas coletoras, caixas de ligação e passagem, bocas de bueiros | DNIT 026/2025-ES | Confirmada |
| Dispositivos de drenagem pluvial urbana | DNIT 030/2004-ES | Confirmada |
| Bocas de lobo e poços de visita | DNIT 030/2004-ES (provável) | A confirmar: a coletânea não tem especificação própria para eles e a cobertura pela 030/2004 precisa ser conferida no texto |
| Drenos subterrâneos (se necessários) | DNIT 015/2006-ES | Confirmada |
| Sinalização horizontal | DNIT 100/2018-ES | Confirmada |
| Sinalização vertical | DNIT 101/2009-ES | Confirmada |
| Remoção de base e sub-base existentes | Sem especificação própria; DNIT 106/2009-ES por analogia | A confirmar |
| Reaproveitamento de fresado no CBUQ | DNIT 033/2021-ES (Pavimentos flexíveis: concreto asfáltico reciclado em usina a quente) | Confirmada (percentual máximo a conferir no texto da norma) |
| Tubos de concreto (recebimento) | ABNT NBR 8890 (edição vigente a confirmar) | A confirmar a edição |
| Sinalização de obra e desvio | Manual de Sinalização de Obras e Emergências em Rodovias, DNIT, Publicação IPR 738 (2ª ed., 2010) | Adotado |

As especificações que já estavam no projeto (104/2009, 106/2009, 108/2009, 137/2010, 139/2010, 141/2022, 144/2014, 145/2012 e 031/2024) continuam valendo. A limpeza (DNIT 104/2009-ES) fica restrita a faixas laterais e às áreas do canteiro.

## Sequência por frente de serviço

Cada frente de 300 a 400 m segue esta ordem. As frentes se sobrepõem em cascata, e a frente seguinte começa quando a anterior libera as equipes de demolição.

1. Sinalização de obra e desvio.
2. Sondagem de interferências.
3. Fresagem do revestimento.
4. Drenagem (valas, tubos, caixas, poços de visita e reaterro).
5. Remoção da base e da sub-base existentes.
6. Subleito (regularização e substituição de solo, se for preciso).
7. Meio-fio e sarjeta.
8. Sub-base e base.
9. Imprimação, pintura de ligação e CBUQ.
10. Sinalização definitiva e liberação ao tráfego.

A ordem entre fresagem, drenagem e remoção da base pode mudar conforme a profundidade das valas. O que não muda é a regra: a drenagem fica pronta antes das camadas do pavimento.
