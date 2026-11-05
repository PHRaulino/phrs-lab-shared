# PHRS Lab · Observabilidade de pipelines

Frontend **Angular 17.3.11**, com execuções em consulta e edição e exportação de configurações YAML. Reutiliza o shell, o header fixo, o menu hambúrguer, componentes standalone, rotas lazy, signals, RxJS, HttpClient e MSW existentes. Não há backend nem arquivos YAML no diretório `data-orchestrator/` neste repositório.

## Executar

Use Node 20 (`.nvmrc`).

```sh
nvm install
npm ci
npm start
```

Acesse http://localhost:4200/overview. O desenvolvimento ativa o MSW antes do bootstrap Angular.

```sh
npm run build       # produção: sem bundles/worker do MSW; Analytics usa JSON local
npm run build:dev   # desenvolvimento: demonstração com mocks
npm run start:real  # exibe a integração indisponível; nenhuma API do orquestrador é presumida
npm test           # contratos dos mocks, filtros, métricas e layout do grafo
npm run mock:init  # regenera o worker ao atualizar o MSW
```

## Interface

- `/overview`: indicadores, filtros, hierarquia, grafo e resumo por ondas.
- `/dependencies`: os mesmos componentes com foco no grafo, sem os cards de indicadores.
- Filtros por unidade, camada, workflow, status e nome de task/tabela. As camadas de dados são **SOR, SOT e SPEC**. As opções dos filtros vêm dos dados recebidos. Ondas de execução são independentes das camadas.
- Hierarquia expansível por unidade → camada → tabela → task. As tabelas aparecem em cards compactos com nome destacado, schema secundário, status e botão de edição. Tabelas com uma task não repetem um nível extra de navegação; tabelas com várias tasks continuam expansíveis. O explorador e o painel de detalhes são recolhíveis.
- Grafo com zoom pelos botões/roda do mouse, pan por arraste/setas, ajuste à tela com Home, centralização e seleção por clique/Enter/Espaço. Tooltips mostram nome, estado, unidade, camada e dependências.
- Seleção destaca as dependências diretas em lilás, os dependentes diretos em azul e o nó selecionado em verde. As relações mantêm seus estados com ícones e rótulos.
- Os detalhes mostram identificação, arquivo YAML demonstrativo, configuração genérica, parâmetros estruturados, SQL, estado, horários, duração, erro e metadados. O botão **Editar task.yaml** abre o formulário de configuração. Não há comandos de processamento.
- Selecionar uma dependência no painel revela e centraliza o nó. Se os filtros o ocultarem, os filtros são limpos para permitir a navegação.
- Selecionar uma onda destaca seus nós; selecionar a mesma onda remove o destaque. Filtros também afetam suas contagens.
- Conexões com origem fora dos filtros não são inventadas: o grafo informa o número de dependências ocultas e o painel permite consultá-las.
- Cenários demonstrativos de 24 e 240 tasks. O layout posiciona as ondas recebidas da esquerda para a direita e ordena os nós por workflow e posição média das dependências para reduzir cruzamentos. O modo com pouco zoom reduz detalhes, mantendo nomes e estados.
- Não existe tema escuro no shell original; foi mantido o design claro com cores verdes, tipografia, bordas e componentes existentes.

## Arquitetura

```text
src/app/core/layout/                     # shell, header, menu e ícones existentes
src/app/features/observability/
  observability.component.*             # composição das telas
  models/observability.models.ts        # modelo local de apresentação
  data/observability-source.service.ts   # ponto único de substituição pela API futura
  state/observability.store.ts           # filtros, seleção, polling e estado da interface
  state/observability.utils.ts           # indicadores e resumos derivados dos dados
  graph/                                # layout visual e interações SVG
  components/                           # filtros, hierarquia, detalhes e status reutilizáveis
src/mocks/fixtures/observability.ts      # somente dados fictícios
src/mocks/handlers/overview.handlers.ts  # extensão do handler de exemplo já existente
src/mocks/initialize*                    # inicialização específica por ambiente
```

## Dados e integração futura

**Os dados exibidos em desenvolvimento são fictícios**, identificados pelo banner e pelo snapshot demonstrativo. As camadas seguem SOR, SOT e SPEC; os parâmetros YAML e horários são exemplos, não configurações reais. O modelo `ObservationSnapshot` é um contrato local de apresentação, não uma especificação de backend.

Nenhum endpoint de orquestrador foi criado. O MSW estende apenas o endpoint de exemplo que já existia, `GET /api/overview?observability=standard|large`, mantendo sua resposta anterior quando o parâmetro não é informado. `ObservabilitySource` adapta essa resposta de demonstração para a interface.

A demonstração é consultada a cada 15 segundos, com pausa configurável e suspensão das consultas quando o documento está oculto. Os mocks simulam evolução limitada de alguns estados, sem comandar processamentos ou calcular dependências/ondas. A atualização mantém filtros, seleção e posição do grafo. Há atualização manual, carregamento, estado vazio, erro e preservação do último snapshot se uma atualização falhar.

Para conectar a fonte real, ainda são necessários:

1. Contrato e mecanismo de autenticação da API de consulta do orquestrador.
2. Configurações reais, incluindo nomes das camadas, parâmetros YAML, identificadores e relações.
3. Ondas, estados e informações de execução fornecidos pelo orquestrador.
4. Definição do mecanismo de atualização suportado pela API: polling, WebSocket ou SSE.

Substitua a implementação de `ObservabilitySource.read()` por um adaptador do contrato real e revise o mecanismo de atualização no store. Em produção, a fonte atual retorna uma mensagem de integração indisponível, sem enviar requisições para endpoints inventados e sem carregar fixtures.

As métricas usam somente tasks filtradas; pendentes inclui aguardando dependências. Ondas são contadas por par workflow/onda. O tempo observado é o intervalo entre o primeiro início e o último fim (ou snapshot para tasks em execução), sem somar tarefas paralelas. Não é uma duração oficial do workflow. Os status de workflow fornecidos pela fonte aparecem separadamente como status globais.

O build de produção não inclui o MSW nem publica `mockServiceWorker.js`. Ao alternar desenvolvimento/produção na mesma origem, remova o worker de desenvolvimento no DevTools → Application → Service Workers e recarregue.

## Validação

`npm test` verifica a resposta do MSW, cenários de falha, filtros combinados, contagens, duração de tarefas paralelas, dependências fora dos filtros, evolução da demonstração e layout de 240 nós sem sobreposição. Os builds de desenvolvimento e produção usam a verificação estrita de tipos e templates do Angular.

## Editor e prévia de task.yaml

Abra pelo lápis da tabela no explorador ou por **Editar task.yaml** nos detalhes. O formulário mantém os tipos dos parâmetros existentes em `task.configuration`; listas e objetos são editados como JSON e validados antes da geração.

**Gerar YAML** mostra o conteúdo no próprio modal. **Copiar YAML** copia esse conteúdo para você substituir no `task.yaml` do CI, no caminho indicado. **Voltar ao formulário** permite ajustar os valores e gerar novamente. O botão informa quando a cópia foi concluída; se o navegador não permitir a cópia automática, o texto é selecionado para cópia manual.

Não há download, gravação no navegador ou publicação automática no CI. Os parâmetros são serializados na raiz do YAML, preservando estruturas, tipos, caracteres especiais e SQL, sem acrescentar metadados de execução. A serialização usa a biblioteca [yaml](https://eemeli.org/yaml/).

As camadas são **SOR, SOT e SPEC**. Como os dados ainda são demonstrativos e não há YAMLs reais no repositório, a prévia reflete os parâmetros disponíveis no formulário. Comentários ou campos ausentes dependerão da integração com o YAML real.

## Backend e Analytics

- `/settings`: toggle global de uso do backend, preferência persistida e indicação de desabilitado/disponível/indisponível.
- `/analytics`: oficiais estáticas, dashboards pessoais em IndexedDB, seções, grid editável de 12 colunas, filtros compartilhados e galeria interna de desenvolvimento.
- Analytics continua operacional com dados locais quando o backend está desabilitado. A demonstração de Pipelines usa snapshots locais nesse modo.
- Salvar uma composição oficial no navegador não a publica para todos. Use a exportação/importação JSON validada e distribuição estática versionada.
- Não há autenticação integrada. A galeria é uma demonstração interna no desenvolvimento e é restrita pela política padrão de produção. O perfil local não equivale a isolamento seguro entre pessoas no mesmo navegador.

Consulte [arquitetura, fases, contratos e estratégia de testes](docs/analytics.md).

## IARA Analysis

Acesse **IARA Analysis** no menu lateral (ícone de sparkles), em `/projects`. As abas **Knowledge**, **Features** e **Projetos** possuem cadastros independentes. Cada feature associa N knowledges; cada projeto agrupa features e knowledges diretos, sem exigir uma feature. Os itens podem ser reutilizados, e desvincular não exclui o cadastro.

O gerenciamento é local, com IndexedDB, backups JSON e busca. O schema 2 migra automaticamente os cadastros anteriores, preservando textos, requisitos aprovados, histórico e vínculos. Análises armazenam cópias do contexto usado, mesmo se um knowledge for editado depois.

O painel de análise oferece seleção explícita de contexto, instruções, tipos de análise, histórico, comparação e exportação de resultados. **A execução de IA permanece indisponível até a configuração de um provedor com acesso seguro.** Não foram criados endpoints ou credenciais no frontend.

Configurações ficam em `/projects/ai-settings`. A associação ao toggle global é declarada pelo adapter, sem confundir o backend do orquestrador com um provedor independente.

Consulte [componentes, contratos, persistência, integração e limitações](docs/projects.md).

## Chat IA

Acesse **Chat IA** no menu lateral ou `/chat`. A interface oferece múltiplas conversas, histórico e rascunhos locais em IndexedDB, sugestões iniciais, envio com Enter, quebra de linha com Shift+Enter, cópia de mensagens, cancelamento e repetição após falhas.

O provedor registrado em `AI_PROVIDER` pode implementar a capability opcional `completeChat(request, signal)`. A solicitação contém somente o histórico da conversa atual, modelo, instruções de chat e parâmetros permitidos. As preferências de modelo são compartilhadas com as configurações de IA. Não existe provedor real configurado por padrão.

Em desenvolvimento, **Experimentar demonstração** habilita um mock MSW identificado, com conversas separadas das reais. O endpoint `/demo-api/chat/completions` é apenas de demonstração e não indica disponibilidade do backend. A configuração de produção substitui o adaptador demonstrativo e não permite seu envio.

O histórico fica no banco `phrs-ai-chat`, perfil local `browser-profile`. Não há sincronização entre navegadores nem isolamento entre pessoas que usam o mesmo perfil. O carregamento valida o schema e preserva registros incompatíveis. Falhas de persistência são indicadas na tela.
