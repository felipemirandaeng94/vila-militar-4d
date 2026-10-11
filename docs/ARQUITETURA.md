# Arquitetura

O app é dividido em camadas. Cada camada só depende das camadas abaixo dela. A exceção é o controlador, que liga todas.

```
dados/*.json  ──►  src/dados.js (carga e validação)
                        │
                        ▼
                 src/dominio/   regras puras da obra (sem Three.js e sem DOM)
                        │
                        ▼
                 src/estado.js  estado central (ST, M, D, acoes, eventos)
                   │         │          │
                   ▼         ▼          ▼
            src/motor/  src/interface/  src/jogo/
            (Three.js)  (painéis, abas)  (missão)
                   ╲         │          ╱
                    ╲        │         ╱
                     src/controlador.js  →  src/main.js
```

## Camadas

### `dados/`
Arquivos JSON editáveis. Nada aqui é código.

| Arquivo | Conteúdo |
|---|---|
| `obra.json` | Identificação da obra, calendário (início, jornada, prazo contratual), geometria do trecho, canteiro, taxas, usina, contexto e texto padrão do tempo no diário. |
| `servicos.json` | Grupos (cores), serviços com janelas em dias úteis, equipe, equipamentos, frente de serviço e quantidade no diário; retrabalhos; cenários; liberações de camada (BLC). |
| `ensaios.json` | Semente do sorteio, plano de controle, dosagem Marshall, granulometria, curvas de compactação e os geradores de ensaios. |
| `decisoes.json` | Decisões da missão, alternativas, efeitos, consequências e regras de pontuação. |
| `manual.json` | Procedimento de cada serviço (onde, como executar, o que conferir). |
| `normas.json` | Códigos dos métodos de ensaio (usados como `@chave` nos ensaios) e a tabela de normas da aba de contexto. |
| `local.json` | Coordenadas do trecho real (usadas a partir da Fase 3). |

`src/dados.js` importa os JSON e chama `validarDados` (`src/dominio/validacao.js`). Se houver erro, o app não inicia. A tela mostra a lista de problemas com o arquivo e o campo, por exemplo `servicos.json.servicos[3].janelas[0]: o início (5) é posterior ao fim (2)`.

### `src/dominio/`
Funções puras, testadas com Vitest. Recebem os dados por parâmetro ou por funções de configuração (`configurarGeometria`, `configurarCalendario`).

| Módulo | Responsabilidade |
|---|---|
| `geometria.js` | Parâmetros do trecho (`P`), terreno natural, greide, taludes, seções. |
| `quantitativos.js` | Volumes por seção, diagrama de massas, quantidades de pavimentação, extensão das camadas do aterro. |
| `calendario.js` | Dias úteis, datas, horas e estacas. |
| `cronograma.js` | Serviços com janelas, retrabalhos ativados por opção, serviço ativo num dia. |
| `frentes.js` | Quadros-chave de cada frente de serviço e estado de todas as frentes num dia. |
| `ensaios.js` | Geração dos ensaios a partir dos blocos declarativos de `ensaios.json`; estatística de deflexões. |
| `cotas.js` | Cota da superfície de cada camada e do terreno trabalhado. |
| `liberacoes.js` | Dia de emissão e situação de cada BLC. |
| `missao.js` | Dia de cada decisão e cálculo da nota. |
| `modelo.js` | `montarModelo(dados, q, opcoes)` junta tudo: cronograma, frentes, ensaios, fim da obra e liberações. |
| `validacao.js` | Esquemas e referências cruzadas dos JSON. |

### `src/estado.js`
- `ST`: estado da interação (dia, cenário, modo, seleção, vista, camadas visíveis, exagero).
- `M`: modelo calculado pelo domínio.
- `D`: dados carregados.
- `acoes`: funções que o controlador registra (`irParaDia`, `tocar`, `reconstruir`, `atualizar`, `saltarServico`, `sincronizarVelocidade`). Assim interface, motor e jogo pedem mudanças sem importar o controlador.
- `on` e `emit`: eventos simples. O motor emite `info`, `selecionarEnsaio`, `semSelecao` e `seguir`, e a interface os trata.

### `src/motor/`
Só Three.js. Lê `M` e `ST` e não mexe nos painéis.
- `renderizador.js`: cena, câmera, luzes e controles.
- `base.js`: materiais e formas.
- `modelos.js`: equipamentos e construções.
- `usina.js`, `terreno.js`, `entorno.js`, `pavimento.js`, `canteiro.js` e `equipamentos.js`.
- `marcadores.js`: pontos de ensaio.
- `rotulos.js`: rótulos 2D.
- `camera.js`: vistas, perfil e seguir a frente.
- `selecao.js`: clique no modelo.
- `index.js`: interface pública do motor.

### `src/interface/`
DOM e textos de tela.
- `controles.js`: botões, opções e teclado.
- `paineis.js`: barra 4D, selos, "Agora na obra", liberações e janela de informação.
- `abas.js` e `abas/*.js`: sequência executiva, controle tecnológico, laboratório, usina, quantitativos, contexto e missão.
- `diario.js`: diário de obra.
- `graficos.js`: gráficos SVG.

### `src/jogo/`
- `decisoes.js`: converte `decisoes.json` para o formato do jogo.
- `missao.js`: fluxo da missão (briefing, paradas, escolhas, consequências, fim), HUD e trava da linha do tempo.

### `src/controlador.js`
- Monta o modelo com as opções do cenário ou da missão.
- Inicia o motor e a interface.
- Avança o tempo a cada quadro e chama motor e interface.

## Frentes de serviço e cronograma (Fase 2B)

A obra é a reconstrução de cerca de 1,6 km da via existente (`docs/ESCOPO.md`). O trecho é dividido em frentes de `servicos.json.frentes.tamanho` metros (padrão de 400 m, 4 frentes) a partir do canteiro, no início do trecho. A última frente fica com o resto.

`src/dominio/cronograma.js` programa:
- **Serviços globais** (`escopo: "global"`), com janelas fixas: mobilização, topografia, ensaios prévios, usina e dosagem.
- **Serviços por frente** (`escopo: "frente"`), na ordem do arquivo e frente a frente.
- **Serviço final** (`escopo: "final"`), a desmobilização depois da liberação de todas as frentes.

Em cada frente:
- **Duração:** `quantidade da frente ÷ produtividade`, arredondada para cima em décimos de dia útil (1 h), ou `duracaoFixa`. As quantidades vêm de `src/dominio/quantitativos.js` (chaves listadas em `CHAVES_DE_QUANTIDADE`). As produtividades são as teóricas de referência (caso ideal do SICRO).
- **Dependências** (`depende`):
  - `TI` (término → início, o padrão), com `em: "fimDaCura"` para esperar a cura;
  - `II` (início → início, com `defasagem`);
  - `TT` (término → término);
  - `passagem` (a frente do serviço passou pelo trecho de solo mole há `defasagem` dias).
- **Faixas:** `faixas: true` executa a meia pista (BD e depois BE), metade da quantidade em cada uma. `dependeFaixa` liga faixas entre serviços (pintura BD → CBUQ BD → pintura BE → CBUQ BE).
- **Equipes:** cada serviço tem a sua equipe (`equipes`, padrão 1). A equipe atende uma frente de cada vez, o que produz a cascata.
- **Abertura de frente:** no máximo `abertasAoMesmoTempo` frentes com tráfego desviado. Além disso, `dependeFrenteAnterior` abre a frente seguinte perto do fim da drenagem da anterior.
- **Retrabalhos** (`servicos.json.retrabalhos`), ativados pelas opções do cenário ou da missão:
  - `inserirApos` / `inserirAntes` (com `bloqueia`);
  - `acrescentar` (dias a um serviço);
  - `falhaAntesDe` (trecho de CBUQ lançado e removido).
  O atraso afeta só a frente do retrabalho e as que dependem dela pela equipe ou pela abertura de frente.

### Regra de precedência da drenagem
Nenhuma camada de pavimento começa antes de a drenagem da frente estar concluída e com o reaterro aprovado:
- A sub-base (S20) depende de S11 a S14 (rede, bocas de lobo, poços de visita e deságue).
- A remoção da base (S15) só começa depois das valas reaterradas.
- Os testes conferem, em todos os cenários, que a sub-base de cada frente começa depois do último ensaio de GC do reaterro e da liberação BLC-D da frente.

### Desvio de tráfego
`servicos.json.frentes.desvio` define os estados de cada frente: via em uso, meia pista (da sinalização de obra), desvio total (da remoção da base), meia pista (da imprimação) e liberada (fim da sinalização definitiva). O domínio grava as mudanças em `frente.desvio`. A interface mostra o estado no painel "Frentes de serviço" e no diário, e o motor 3D desenha cones, cavaletes e a faixa de desvio provisória.

### 3D por dias de execução
O motor não refaz geometria a cada quadro:
- Cada faixa do pavimento e cada instância (tubos, caixas, meio-fio, cones, marcadores) guarda `[dia em que aparece, dia em que some]` no atributo `aDias`.
- O uniforme `uDia` (`src/motor/dias.js`) descarta no shader o que ainda não existe ou já foi removido: o pavimento existente sai na fresagem e na remoção, a vala abre e é reaterrada, e as camadas novas aparecem.
- O motor localiza cada serviço pela `representacao` definida no JSON, sem códigos fixos.

## Fluxo de dados

1. `main.js` carrega e valida `dados/`. Com dados válidos, chama `iniciar`.
2. O controlador configura o domínio (geometria e calendário) e calcula os quantitativos uma vez.
3. `montarModelo` calcula cronograma, frentes, ensaios e liberações com as opções em vigor (cenário escolhido ou decisões da missão). O resultado vai para `M`.
4. A cada quadro, `stateAt(M.frentes, ST.day)` dá a posição de cada frente. O motor atualiza terreno, pavimento, canteiro, equipamentos e marcadores, e a interface atualiza os painéis.
5. Trocar de cenário ou tomar uma decisão com retrabalho chama `acoes.reconstruir()`, que refaz o passo 3.

## Como adicionar ou alterar só editando JSON

### Mudar uma produtividade, o tamanho da frente ou as equipes
- **Produtividade:** em `servicos.json`, altere `produtividade.valor` do serviço. A duração em cada frente é recalculada, e o Gantt, o 3D, os dias dos ensaios e as liberações acompanham.
- **Tamanho da frente:** altere `frentes.tamanho` (por exemplo, 320 m dá 5 frentes).
- **Equipes:** acrescente `"equipes": 2` a um serviço para ter duas equipes trabalhando em frentes diferentes.
- **Abertura de frentes:** `frentes.abertasAoMesmoTempo` limita quantas frentes ficam com o tráfego desviado.

### Adicionar um serviço
Acrescente um objeto em `servicos.json.servicos` com:
- `id`, `grupo`, `nome`, `curto`, `norma`;
- `janelas` ou `faixas`;
- `efetivo`, `equipamentos` e `liberacao`.

Opcionais:
- `frente`, para que o serviço avance no 3D. Tipos: `extensao`, `fracao`, `camadas`, `faixas` e `suave`. A representação 3D de uma camada nova exige código no motor.
- `diario`, com a quantidade do dia no diário de obra (`quantitativo` ou `valor`, `unidade`, `texto`).
- O procedimento do serviço em `manual.json`, na chave do `id`.

### Adicionar um ensaio
Acrescente um bloco em `ensaios.json.geradores`:
- `lista`: ensaios com resultado fixo. Cada item tem `nome`, `norma`, `v` (ou `valor` sorteado), `unidade`, `criterio`, e opcionalmente `s`, `z` e `camada` para aparecer na pista.
- `serie`: pontos ao longo das `estacas`, com `valor` sorteado (`media`, `desvio`, `min`, `max`, `casas`) e `umidade` opcional.
- `camadas` e `faixas`: repetem os itens por camada ou por meia pista.

O dia do ensaio (`dia`) e o fim da exibição no 3D (`ate`) usam regras:
- `servico` com `em`: `inicio`, `fim`, `curaInicio` ou `falhaOuInicio`;
- `frente`: o dia em que a frente passa pela estaca;
- `camada`: a fração da camada;
- `fixo`;
- `relativo`.

Todas aceitam `mais`, `passo` e `maisPorEstaca`. Em `norma`, `@chave` é substituído pelo código de `normas.json.metodos`.

Atenção: os blocos são processados em ordem e compartilham o gerador aleatório. Um bloco novo no fim não muda os ensaios existentes. Um bloco no meio muda os valores sorteados dos blocos seguintes, mas não os critérios.

### Adicionar uma decisão da missão
Acrescente um objeto em `decisoes.json.decisoes` com:
- `id`, `servico`, `titulo`, `contexto`, `dados` e 2 a 4 `opcoes`;
- `dia`, com uma das regras: `fixo`, `falhaDeEnsaio` (expressão regular do nome do ensaio reprovado) ou `servico` com `em` e `mais`.

Cada opção tem:
- `texto`, `avaliacao` (0 inadequada, 1 aceitável, 2 melhor), `efeitos` (`atraso`, `custo`, `qualidade`, `conformidade`) e `retorno`;
- opcionalmente `opcoes`, para ativar um retrabalho de `servicos.json.retrabalhos`;
- opcionalmente `consequencia`, que aparece num dia posterior.

A ordem no arquivo é a ordem de numeração das decisões.

### Retrabalhos e cenários
- `servicos.json.retrabalhos` lista, por opção (`rwBase`, `rwCbuq`...), o que muda no cronograma: deslocar serviços, inserir um serviço de retrabalho, redefinir faixas e marcar o trecho executado e removido.
- `cenarios` combina as opções que o modo explorar oferece.

## Testes

`npm test` roda `tests/dominio.test.js`. A suíte cobre:
- **Dados:** validação de todos os arquivos.
- **Frentes:** divisão contígua, resto na última frente, sequência e limite de frentes abertas.
- **Precedência:** drenagem antes do pavimento, CBUQ só depois da imprimação curada e liberação depois da sinalização definitiva.
- **Cronograma:** quantidade ÷ produtividade, efeito de dobrar uma produtividade e retrabalhos que atrasam só as frentes afetadas.
- **Quantitativos:** pista, meio-fio, sarjeta, CBUQ, bocas de lobo e poços de visita.
- **Ensaios:** ensaios novos por frente e seus dias, ISC reprovado que gera a substituição de solo e lote de tubos reprovado que não é assentado.
- **Liberações** por frente.
- **Missão:** 13 decisões e efeito das 4 novas na nota.

A referência da Fase 1 (`tests/referencia/fase1.json`, escopo de 300 m) foi removida na Fase 2B, porque o escopo mudou. Os testes do domínio da Fase 2 que dependiam dela foram substituídos pelos acima.
