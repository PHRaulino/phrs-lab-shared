# Analytics modular e controle de backend

## Inspeção e limites

O projeto usa Angular 17.3.11, componentes standalone, rotas lazy, signals, RxJS, HttpClient, MSW e CSS próprio com identidade clara/verde. Não foram adicionados outro frontend, um backend, autenticação paralela ou uma biblioteca de gráficos/grid.

Pipelines foi preservado. As alterações de integração ficaram no interceptor global e na fonte de observabilidade: em desenvolvimento, com o backend desativado, a demonstração usa JSON local em vez do endpoint do MSW. O editor/prévia/cópia de YAML e as regras de ondas/dependências continuam como estavam.

## Fases e entregáveis

| Fase                          | Entregáveis                                                                                                                                                                                                        |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1 — Integração global         | Configurações em `/settings`, preferência em localStorage, três estados do backend, bloqueio/cancelamento central de chamadas e alternativa local para a demonstração de Pipelines.                                |
| 2 — Fundação Analytics        | Contratos TypeScript, catálogo de datasets, adapter JSON, cache sob demanda, processamento local, catálogo de visuais e IndexedDB versionado.                                                                      |
| 3 — Dashboards                | Duas definições oficiais estáticas, dashboards pessoais, seções, menus de contexto, cópia de instâncias, grid de 12 colunas, edição explícita, redimensionamento, filtros compartilhados e feedback de salvamento. |
| 4 — Composição e distribuição | Galeria interna, busca/categoria/tags/prévia, criação de composições oficiais locais e importação/exportação JSON validada.                                                                                        |
| 5 — Verificação               | Testes de bloqueio e cancelamento, filtros, layout, schemas, importação, regressões de Pipelines e verificações no navegador.                                                                                      |

## Contratos TypeScript

A fonte de verdade dos contratos está em `src/app/features/analytics/models/analytics.models.ts`.

- `VisualDefinition`: ID e versão, nome, descrição, categoria, tags, referência tipada ao componente, datasets, filtros, dimensões e consulta declarativa. O componente é resolvido exclusivamente pelo registro em código.
- `ModuleInstance`: ID próprio, `visualId`, configuração da instância e posição `x/y/w/h`. A implementação do componente nunca é duplicada no JSON.
- `Dashboard`: versão do schema, metadados, visibilidade, proprietário quando pessoal, estado de publicação, seções e data de atualização.
- `DashboardSection`: ID, título, ordem, estado recolhido, módulos e layout de 12 colunas.
- `DatasetDefinition`: versão, tabelas, campos tipados, chaves, relacionamentos, dimensões e métricas.
- `DatasetAdapter`: `load(definition): Promise<DatasetData>`. `DATASET_ADAPTER` é o ponto de substituição do adapter JSON por uma fonte futura. Os componentes recebem `VisualView`, sem conhecer transporte ou persistência.
- `FilterDefinition`: ID semântico, rótulo, tipo, operadores, opções, padrão opcional e mapeamento para dataset/tabela/campo.
- `BoundFilter`: filtro consolidado, IDs dos módulos afetados e mapeamentos específicos por módulo.
- `AnalyticsRecord`: versão, proprietário, dashboards pessoais, composições oficiais locais e estados dos filtros por dashboard.

## Controle de backend

`BackendModeService` centraliza preferência e disponibilidade. A preferência usa a chave pequena `phrs.backend.enabled.v1` no localStorage. Desativar é imediato, sem recarregar a aplicação.

O interceptor protege URLs `/api/` da mesma origem e requisições futuras marcadas com `USES_BACKEND`. `guardBackendRequest` só inicia a operação se habilitada e mantém o cancelamento ativo mesmo depois de eventos de progresso. A desativação encerra a assinatura anterior; reativar não entrega uma resposta antiga automaticamente. A funcionalidade pode iniciar uma nova consulta pelos seus controles normais.

Uma resposta HTTP real confirmada marca disponibilidade; falhas de rede/5xx marcam indisponibilidade. O endpoint demonstrativo existente é marcado com `LOCAL_DEMO_REQUEST` e não serve como prova de disponibilidade. Não foi inventado endpoint de saúde. Como não há contrato real de API neste projeto, o estado inicial habilitado aparece como indisponível até existir confirmação real.

| Capacidade                                                | Com backend desativado                                     |
| --------------------------------------------------------- | ---------------------------------------------------------- |
| Analytics, datasets JSON, filtros, layouts e persistência | Continua funcionando localmente.                           |
| Prévia e cópia do YAML de uma task já disponível          | Continua local.                                            |
| Demonstração de Pipelines no desenvolvimento              | Usa os snapshots JSON locais, sem `/api/overview`.         |
| Integração real do orquestrador                           | Indisponível; acesso às configurações permanece no header. |
| Novos adapters remotos                                    | Devem marcar `USES_BACKEND` e passar pelo interceptor.     |

Não há WebSocket ou SSE existente a interromper. Uma integração futura com esses mecanismos deverá usar o mesmo estado/fluxo de cancelamento central.

## Registro de novos visuais

1. Desenvolva um componente standalone com entrada `view: VisualView`.
2. Registre-o em `data/visual-registry.ts` com um ID novo e dimensões mínimas/preferenciais.
3. Declare o dataset e os filtros aceitos, com IDs semânticos precisos.
4. Use a consulta declarativa para agrupamento/agregação ou os dados tabulares para uma representação personalizada.
5. Referencie o `visualId` em uma definição de dashboard.

Os 12 registros iniciais reutilizam cinco componentes de apresentação: KPI, barras, linhas, donut e tabela. Não há editor de código nem execução de referências/caminhos arbitrários vindos do JSON.

Os datasets demonstrativos estão centralizados em `src/assets/analytics/datasets/`. O catálogo é `data/dataset-catalog.ts`. A fonte carrega apenas os datasets exigidos pelos visuais consultados. Consultas e cargas compartilham cache; a cache de consultas é limitada a 200 entradas. O processamento implementa validação, filtros, ordenação, joins declarados no schema, agrupamento, somas, contagens e médias. Os datasets atuais são pequenos; não houve necessidade de Worker. Um adapter/Worker pode ser introduzido nessa camada para fontes maiores sem alterar os componentes.

## Filtros compartilhados

A consolidação usa a combinação de **ID semântico + tipo + conjunto de operadores**. O nome exibido não determina equivalência. As opções compatíveis são unificadas; os mapeamentos são mantidos por módulo. Contratos incompatíveis permanecem separados.

Cada visual recebe apenas os critérios que declarou. Valores padrão são respeitados e podem ser explicitamente limpos. Os estados são independentes por dashboard e persistidos no perfil.

O dashboard de operações demonstra um caso intencional: Status é aplicado a seis dos sete visuais. “Ritmo das execuções” mantém o histórico completo porque não declara esse filtro. A interface informa a abrangência e permite destacar os afetados.

## Grid e composição

Oficiais e pessoais usam o mesmo componente de board. A edição é explícita; em consulta os cards não são arrastáveis. Títulos funcionam como alças de drag-and-drop, e o canto do card permite redimensionar. O menu também oferece movimentos e dimensões por botões, acessíveis por teclado.

As posições são inteiras e respeitam 12 colunas, dimensões mínimas e limite horizontal. Colisões deslocam os demais módulos para linhas disponíveis, sem sobreposição persistida. Em telas pequenas, os cards são empilhados mantendo a configuração desktop.

Seções podem ser criadas, renomeadas, reordenadas, removidas e recolhidas. Dashboards pessoais podem ser renomeadas, configuradas e exportadas. Exclusões pedem confirmação. O menu dos módulos oficiais também abre por clique direito e oferece a cópia para uma dashboard/seção pessoal, com criação de uma nova dashboard no mesmo fluxo.

## Persistência e validação

O IndexedDB `phrs-analytics`, versão 1, possui o object store `profiles`, indexado por proprietário. Transações de salvamento são serializadas e recebem snapshots clonados. O feedback informa quando a transação terminou.

Os registros têm `schemaVersion: 1`. A inicialização valida registros existentes antes de usá-los. Estruturas incompatíveis bloqueiam novas gravações automáticas para preservar o original. A criação do object store está no upgrade da versão 1; futuras versões devem acrescentar migrações explícitas, sem apagar registros desconhecidos.

Importações limitam o tamanho a 1 MB e validam versão, metadados, identidade, referências publicadas, IDs únicos, dimensões e colisões. Visuais privados/desconhecidos/não publicados não podem ser introduzidos em dashboards pessoais apenas por ID. A importação cria uma composição local com novo ID e proprietário atual, nunca substitui uma oficial compartilhada.

## Autorização e privacidade

Não existe autenticação no projeto. `ANALYTICS_ACCESS` isola o adapter de identidade/permissões para futura integração confiável; não foi criado login paralelo nem um toggle local de privilégio.

No desenvolvimento, a galeria e a composição oficial ficam disponíveis como demonstração interna, com indicação explícita de que isso não é proteção de segurança. Em produção, a política padrão não autoriza essas funções. Os métodos de composição/publicação também verificam a política.

A identidade inicial é `browser-profile`. A segregação por chave permite conectar uma identidade real futuramente, mas **não isola com segurança pessoas que usam o mesmo perfil de navegador**. Os arquivos/visuais enviados ao navegador também não devem conter dados confidenciais cuja proteção dependa dessa política local.

## Publicação oficial

As oficiais distribuídas com a aplicação estão em `src/assets/analytics/official-dashboards.json`.

“Compor oficial” cria um rascunho local. “Preparar publicação” valida e exporta uma definição JSON com `published: true`, mas a composição no navegador continua marcada como local. Para distribuir, a equipe deve versionar a definição no catálogo estático e publicar o frontend pelo processo existente. Como o catálogo é uma lista, a definição exportada deve ser adicionada como um item dessa lista.

Salvar no IndexedDB não torna uma dashboard global. Não há serviço de publicação compartilhada ou sincronização entre navegadores implementado.

## Estratégia e evidências de testes

Execute `npm test`, `npm run build` e `npm run build:dev` com Node 20.

- Testes unitários cobrem os três estados do backend, restauração da preferência, bloqueio antes da chamada, cancelamento após progresso e descarte de respostas antigas.
- Os testes do Analytics cobrem equivalência/incompatibilidade semântica, opções e mapeamentos, filtros por módulo, valores padrão, movimentação/redimensionamento sem colisões, validade dos arquivos oficiais, rejeição de identidade/visuais/versões/IDs/layouts inválidos, joins e agregações locais.
- As regressões existentes cobrem mocks, filtros e grafo de Pipelines, as camadas SOR/SOT/SPEC e geração do YAML.
- As verificações de navegador cobrem clique direito, cópia de módulos, criação e persistência de dashboard pessoal, redimensionamento, filtros seletivos, galeria/prévia, composição e exportação oficial, toggle persistido e funcionamento local com backend desativado.
- A validação de produção verifica a ausência da galeria/composição interna sob a política padrão e o carregamento das oficiais com JSON local.

A integração com um backend real, autorização real e sincronização/publicação compartilhada depende dos contratos ainda não disponíveis; esses cenários não são apresentados como validados contra infraestrutura real.
