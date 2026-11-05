# IARA Analysis — Knowledge, Features e Projetos

## Escopo e integração

A área fica em `/projects`, no mesmo Angular 17.3.11 e design system. Pipelines e Analytics permanecem independentes. O menu lateral tem a entrada **IARA Analysis**, com ícone de sparkles. A navegação principal possui três abas nesta ordem: **Knowledge**, **Features** e **Projetos**. Knowledge e features são cadastros independentes, com vínculos reutilizáveis.

Rotas:

- `/projects?area=knowledge`: cadastro, busca, edição, leitura e importação textual de knowledges independentes (aba padrão).
- `/projects?area=features`: listagem e cadastro independente de features.
- `/projects?area=projects`: projetos, busca, criação, edição, confirmação de exclusão e backups.
- `/projects/:projectId`: nome, descrição, contexto opcional, vínculos de features e knowledges diretos, requisitos e histórico agregado.
- `/projects/features/:featureId`: feature independente, N knowledges, requisitos e análises sem necessidade de projeto.
- `/projects/:projectId/features/:featureId`: compatibilidade com links anteriores; exige feature vinculada ao projeto.
- `/projects/ai-settings`: preferências de análise e estado da integração.

As abas usam query parameters para manter a navegação e permitir links diretos. Estados de projeto e feature estão centralizados em `PROJECT_STATUSES` e `FEATURE_STATUSES`, com tipos derivados desses registros.

## Componentes e responsabilidades

| Componente/camada            | Responsabilidade                                                                           |
| ---------------------------- | ------------------------------------------------------------------------------------------ |
| `ProjectsComponent`          | Navegação, busca/filtros, detalhes, features, requisitos e backups.                        |
| `ProjectCardComponent`       | Card reutilizável com metadados e progresso.                                               |
| `ProjectEditorComponent`     | Formulário compartilhado por projetos e features.                                          |
| `MaterialsComponent`         | Cadastro, edição e consulta de knowledge e documentos textuais.                            |
| `AnalysisWorkbenchComponent` | Seleção de contexto, instruções, tipo de análise, refinamento e histórico do escopo atual. |
| `AnalysisResultsComponent`   | Resultado estruturado, origem das afirmações, fontes, comparação, cópia e exportação.      |
| `AISettingsComponent`        | Preferências do provedor registrado, modelo, instruções e parâmetros permitidos.           |
| `WorkspaceModalComponent`    | Modal genérico seguindo o padrão visual e de foco existente.                               |
| `ProjectsStore`              | Operações sobre o workspace, persistência, execução/cancelamento e histórico imutável.     |
| `ProjectsRepository`         | IndexedDB local, transações serializadas e tratamento de falhas.                           |
| `context-engine.ts`          | Restrição de escopo, snapshots, validação de resultados, comparação e Markdown.            |
| `projects-validation.ts`     | Validação de backups e fronteira de migração de schemas.                                   |
| `AIProvider` / `AI_PROVIDER` | Contrato e registro da integração de IA, sem acoplamento a fornecedor.                     |

## Estruturas de dados

Os contratos estão em `src/app/features/projects/models/projects.models.ts`.

- `Project`: ID, nome, descrição, objetivo/contexto opcionais no formulário, status, datas, `featureIds` e `knowledgeIds` diretos.
- `Feature`: ID, informações e status próprios, datas e `knowledgeIds`. Não exige projeto; pode ser agrupada por vários projetos.
- `Knowledge`: ID, tipo textual, título, conteúdo e data de inclusão, sem proprietário projeto/feature. `Material` é um alias de compatibilidade; a coleção persistida continua se chamando `materials` para os contratos de snapshots.
- `Requirement`: ID, escopo, texto e estado de rascunho/aprovado. Aprovação depende de uma ação explícita.
- `PreparedContext`: apenas os campos e materiais selecionados para a solicitação atual.
- `AnalysisRequest`: tipo, instrução, contexto selecionado, preferências e referência opcional ao resultado anterior.
- `AnalysisRun`: execução versionada com IDs, data, provedor/modelo, instrução, snapshot do contexto, configurações e resultado. Refinamentos usam `parentId` e geram novas versões.
- `AnalysisResult`: resumo, seções de itens e questões em aberto. Cada item identifica `provided`, `hypothesis` ou `suggestion`, com materiais/contexto de origem quando aplicável.
- `ProjectsRecord`: versão do schema, perfil local e coleções completas do workspace.

Knowledges são cadastrados e editados na aba Knowledge. Executar uma análise nunca edita um texto original. As execuções anteriores mantêm snapshots independentes mesmo após editar ou desvincular uma fonte. Resultados não alteram automaticamente requisitos, status ou decisões aprovadas.

A primeira versão aceita texto, ideias, requisitos informais, transcrições em texto e documentos TXT/Markdown/CSV/JSON textuais. O importador de documentos limita o arquivo a 1 MB e o conteúdo a 200 mil caracteres. Não há processamento de PDF, Word, áudio ou imagem; novos tipos devem ser adicionados ao contrato e ao adapter de entrada com uma migração correspondente quando necessário.

## Preparação de contexto e histórico

Nenhum material fica selecionado automaticamente. O usuário escolhe separadamente:

1. Informações gerais do projeto.
2. Informações da feature, quando estiver nesse escopo.
3. Knowledges associados à feature atual ou, na análise do projeto, knowledges diretos e das features agrupadas (sem duplicatas).
4. Requisitos existentes que deseja incluir.

Itens não associados ao contexto atual não entram na solicitação. Na análise independente da feature, dados dos projetos que a agrupam não são incluídos. O motor rejeita IDs fora do escopo e seleção vazia. “Revisar contexto” mostra a representação exata preparada, mesmo sem IA disponível.

Cada execução armazena uma cópia independente dos dados enviados. O histórico mantém tipos, instruções, fontes, configurações, versões e referências de refinamento. O painel permite consultar o snapshot usado e comparar trechos adicionados, removidos e mantidos entre análises do mesmo projeto/feature/tipo. É uma comparação textual estruturada; não uma avaliação semântica por IA.

Afirmações marcadas como fornecidas precisam referenciar um material selecionado ou o contexto explícito do projeto, feature ou requisitos. Fontes desconhecidas são rejeitadas. A aplicação valida a estrutura e a procedência declarada; a fidelidade semântica de um provedor real ainda exige revisão humana.

## Integração com IA e toggle de backend

**Não existe provedor real configurado nesta entrega.** `UnavailableAIProvider` mantém “Solicitar análise” indisponível. Não há respostas demonstrativas apresentadas como execuções reais, endpoints inventados, campos para chaves privadas ou credenciais no bundle.

`AIProvider` declara:

- Identificador, nome e disponibilidade.
- Transporte: `none`, `secure-proxy` ou `browser-local`.
- Associação ao backend da aplicação por `usesApplicationBackend`.
- Parâmetros suportados e seus tipos.
- `analyze(request, AbortSignal): Promise<AnalysisResult>`.

Para integrar futuramente, registre um adapter confiável em `AI_PROVIDER`. Se houver credenciais sigilosas, elas devem ficar em um mecanismo seguro externo ao frontend. Um adapter de proxy associado ao backend da aplicação deve também usar o controle/interceptor global existente para suas chamadas; o contrato não define URL fictícia.

O toggle global só interfere na IA quando o adapter declara `usesApplicationBackend: true`. Um provedor externo/local independente não é confundido com o backend do orquestrador. Ao cancelar ou desativar uma integração associada, o sinal de aborto e a identificação da execução impedem respostas tardias de gravar resultados ou alterar outra execução.

As configurações persistem modelo, tipo padrão, instruções e parâmetros suportados. Configurar apenas o nome de um modelo não habilita um provedor. Campos de credenciais são rejeitados; parâmetros numéricos como `max_output_tokens` podem ser aceitos quando declarados pelo adapter.

## Persistência, migração e recuperação

Foi reutilizado o padrão de IndexedDB e transações serializadas da aplicação, em um banco independente: `phrs-projects`, versão 1, object store `profiles`. O workspace usa o perfil local `browser-profile`; não foi criado login paralelo. Pessoas no mesmo perfil de navegador compartilham esse armazenamento, que não representa isolamento seguro entre identidades reais.

`ProjectsRecord.schemaVersion` é 2. A migração de v1 valida o registro anterior antes de converter a propriedade em vínculos: features passam a `project.featureIds`; materiais de feature passam a `feature.knowledgeIds`; materiais próprios do projeto passam a `project.knowledgeIds`. Todos os textos ficam no cadastro independente. Requisitos e análises de feature acompanham a feature, com IDs, conteúdo, resultados e snapshots preservados. A migração é idempotente e é salva no IndexedDB após validação.

Excluir um projeto preserva features e knowledges independentes. Excluir uma feature remove seus vínculos nos projetos, requisitos e análises próprios, preservando os knowledges. Desvincular remove somente a associação; não exclui o registro nem reescreve snapshots históricos. Versões desconhecidas ou registros inconsistentes não são sobrescritos automaticamente: a gravação fica bloqueada para preservar os dados existentes.

Backups JSON completos ou de um único projeto podem ser exportados. A importação limita o arquivo a 10 MB e valida IDs, status, datas, escopos, vínculos, tipos de materiais, fontes, preferências e referências de refinamento antes de alterar o workspace.

O modo padrão adiciona projetos sem sobrescrever os existentes e rejeita IDs duplicados. A restauração que substitui todo o workspace exige seleção explícita e confirmação, com opção de exportar os dados atuais antes. Um backup válido permite recuperar o perfil quando a persistência tiver sido bloqueada por incompatibilidade.

Há feedback do salvamento e mensagens de falha. Sem IndexedDB disponível, alterações podem permanecer apenas na sessão; o usuário deve exportar para preservá-las. Não há sincronização entre navegadores ou armazenamento remoto.

## Resultados e exportação

Resultados disponíveis no histórico podem ser copiados como Markdown ou exportados como Markdown/JSON. JSON conserva o contexto, instruções e metadados da execução. Markdown inclui seções, procedência das afirmações, questões abertas, versão e identificação da execução.

O histórico pode ser consultado a partir de um backup válido importado, mas nenhuma análise é simulada para preencher a interface. A geração real e os testes de integração com um fornecedor dependem de um adapter seguro ainda não disponível.

## Validação

- Testes unitários verificam restrição de escopo, snapshots independentes, seleção vazia, procedência dos resultados, round-trip de backups, versões incompatíveis, relações órfãs, IDs duplicados e rejeição de credenciais.
- Testes do store usam um adapter e repositório restritos ao ambiente de testes: verificam preservação de textos/requisitos aprovados, geração independente do backend e descarte de respostas tardias de um adapter associado ao toggle.
- Os testes do resultado cobrem Markdown e comparação de versões. As regressões anteriores de Pipelines, Analytics, filtros, layout e backend continuam no mesmo comando `npm test`.
- A validação no navegador inclui criação/edição de projeto e feature, transcrição textual, aprovação de requisito, restauração após recarregar, seleção explícita e revisão de contexto, botão de análise indisponível, preferências de IA persistidas, confirmação de exclusão cancelada e edição local com backend desligado.

Use Node 20 e execute `npm test`, `npm run build` e `npm run build:dev`.
