# Blitz — Sistema de Foco e Produtividade

Contexto do projeto para desenvolvimento assistido. Coloque este arquivo na raiz do repositório: o Claude Code lê `CLAUDE.md` automaticamente em toda sessão.

> **Natureza do projeto.** Blitz é o produto de um Trabalho de Conclusão de Curso da equipe T03N (Luiz Henrique, Vinicius Fagundes e Raphael Henke). É um protótipo funcional com escopo acadêmico, **não um produto em produção**. Isso muda as prioridades: rastreabilidade entre requisito, caso de uso e código vale tanto quanto o código funcionar.

---

## 1. O que é o produto

Ferramenta que une **organização de tarefas** e **sustentação do foco** na mesma aplicação, com um assistente de IA que decide a ordem de execução.

**Posicionamento:** *"O aplicativo que não só organiza suas tarefas, mas decide com você o que fazer agora."*

A lacuna que o produto explora: gestores de tarefas (Todoist, Trello, Notion) organizam mas não atuam durante a execução; apps de foco (Forest, Focus To-Do, Toggl) cronometram mas desconhecem o trabalho real. Nenhum concorrente analisado prioriza automaticamente.

**Públicos:** B2C (trabalhadores híbridos e estudantes) e B2B (empresas, licença por colaborador, venda via RH/benefícios).

---

## 2. Stack e arquitetura

| Camada | Tecnologia |
|---|---|
| Front-end | React 18 + TypeScript, Tailwind CSS, Framer Motion |
| Back-end | Supabase (PostgreSQL + Edge Functions) |
| IA | Gemini, chamado **sempre** via Edge Function, nunca direto do navegador |
| Protótipo atual | https://blitz-my-flow.lovable.app |

**Decisão de portabilidade (ADR 001):** estratégia web-first em três camadas.
1. Aplicação web responsiva — base do produto, única fonte de verdade da UI.
2. Empacotamento desktop com Electron — habilita bloqueio de distrações no nível do SO. É o diferencial, mas **fora do escopo da versão atual**.
3. PWA instalável — consulta rápida no celular. A sessão de foco completa é recomendada no desktop.

**Fora de escopo nesta versão:** aplicativos nativos iOS/Android.

**Regra de arquitetura:** a credencial do provedor de IA nunca vai para o cliente. A Edge Function é obrigatória como intermediária.

---

## 3. Modelo de dados

PostgreSQL. O script completo está em `S3_Estrutura-Banco-de-Dados_Script-PostgreSQL.sql` (10 tabelas, 5 enums, 9 índices, 1 view). Validado sintaticamente, **ainda não executado em instância real**.

### Tabelas

`organizacao`, `usuario`, `consentimento`, `preferencia_acessibilidade`, `modo_concentracao`, `lista`, `sprint`, `tarefa`, `sessao_foco`, `conversa_ia`

### Enums

```
prioridade_tarefa : BAIXA | MEDIA | ALTA
status_tarefa     : BACKLOG | EM_ANDAMENTO | CONCLUIDA
papel_usuario     : USUARIO | GESTOR | ADMINISTRADOR
tema_visual       : CLARO | ESCURO | ALTO_CONTRASTE
tamanho_fonte     : PEQUENO | MEDIO | GRANDE
```

### Decisões de modelagem que NÃO devem ser alteradas sem discussão

- **`sessao_foco.tarefa_id` é `ON DELETE SET NULL`.** Apagar uma tarefa não pode apagar o tempo trabalhado nela. A métrica sobrevive desvinculada (RN03).
- **`modo_concentracao` é `ON DELETE RESTRICT` em `sessao_foco`.** Apagar um modo destruiria o significado do histórico.
- **`consentimento` é histórico, só recebe INSERT.** Cada aceite gera registro novo com versão da política. Guardar só o último impede comprovar o que foi consentido e quando.
- **`preferencia_acessibilidade` tem a FK como PK.** É isso que impõe a cardinalidade 1:1.
- **`ck_tarefa_conclusao`**: tarefa `CONCLUIDA` exige `concluida_em`; tarefa não concluída exige `concluida_em IS NULL`. Não remover — essa restrição existe para impedir contradição de estado.
- **View `vw_metricas_organizacao` tem `HAVING COUNT(DISTINCT u.id) >= 5`.** Equipes com menos de 5 pessoas não exibem métricas, para evitar reidentificação. A proteção está no banco de propósito: uma consulta por outro caminho continua protegida.

---

## 4. Catálogo de requisitos

Prefixos: `RF` funcional · `RNF` não funcional · `RF-LGPD` proteção de dados · `RA` acessibilidade · `RN` regra de negócio.

### Funcionais

| ID | Requisito | Prioridade |
|---|---|---|
| RF01–RF04 | Cadastro, autenticação, recuperação de senha, mensagens de erro claras | Must / Should |
| RF05–RF09 | CRUD de listas e tarefas; título, descrição, prioridade, prazo, horas; histórico; organização automática em sprints | Must / Should |
| RF10–RF14 | Iniciar/pausar/encerrar sessão; registrar duração; 4 modos de concentração; ciclos personalizáveis; métricas | Must / Should |
| RF15–RF17 | Conversar com IA; IA sugere prioridade; **resposta alternativa quando a IA falha** | Must / Should |
| RF18–RF21 | Admin: gerenciar usuários, ver métricas, gerenciar integrações; gestor vê só a própria equipe | Must / Could |

### Não funcionais

`RNF01` resposta ≤2s no quadro · `RNF02` responsivo · `RNF03` Chrome/Firefox/Edge/Safari · `RNF04` HTTPS · `RNF05` Git + CI · `RNF06` backup diário · `RNF07` interface pt-BR · `RNF08` disponibilidade 99% · `RNF09` **limite de uso da IA por usuário**

### LGPD

| ID | Requisito |
|---|---|
| RF-LGPD01 | Consentimento explícito no cadastro (aceite de Termos + Política) |
| RF-LGPD02 | Informar finalidade e base legal do tratamento |
| RF-LGPD03 | Titular acessa, corrige e exporta seus dados (art. 18) |
| RF-LGPD04 | Exclusão de conta com apagamento ou anonimização |
| RNF-LGPD05 | Senha com hash; dados protegidos em trânsito e repouso |
| RNF-LGPD06 | Registrar consentimento com data, hora e versão da política |
| RNF-LGPD07 | **Não enviar dados pessoais desnecessários ao provedor de IA** |

### Acessibilidade (WCAG 2.1 AA + eMAG)

`RA01` contraste 4.5:1 texto / 3:1 gráficos · `RA02` navegação total por teclado com foco visível · `RA03` semântica + ARIA · `RA04` fonte ajustável sem quebrar layout · `RA05` tema de alto contraste · `RA06` reduzir animações (respeitar `prefers-reduced-motion`) · `RA07` **cor nunca é o único meio de transmitir informação** · `RA08` texto alternativo

### Regras de negócio

`RN01` autenticação obrigatória · `RN02` tarefas concluídas ficam no histórico · `RN03` sessões geram métricas · `RN04` admin tem acesso total · `RN05` modos alteram comportamento visual e funcional · `RN06` tratamento conforme LGPD com consentimento explícito · `RN07` titular pode acessar, corrigir, exportar e excluir · `RN08` interface respeita as preferências de acessibilidade **em todas as telas**

---

## 5. Casos de uso

| ID | Caso de uso | Ator |
|---|---|---|
| UC01 | Fazer Login (inclui «include» → Aceitar Termos e Política) | Usuário |
| UC02 | Criar e Gerenciar Listas de Tarefas | Usuário |
| UC03 | Gerenciar Tempo de Foco Diário | Usuário |
| UC04 | Conversar com IA Integrada | Usuário |
| UC05 | Ver Modos de Concentração (Pomodoro, Profundo, Relax, Personalizado) | Usuário |
| UC06–UC10 | Gerenciar usuários, conteúdos, métricas, funcionalidades, integrações | Administrador |
| UC11 | Gerenciar Consentimento e Dados Pessoais (LGPD) | Usuário |
| UC12 | Configurar Acessibilidade | Usuário |

---

## 6. Design tokens

Todos os valores abaixo tiveram o contraste **calculado e verificado** pela fórmula de luminância da WCAG. Não altere sem recalcular.

### Tema claro

```css
--color-bg:                #FFFFFF
--color-surface:           #F5F6F8
--color-border-subtle:     #D9DDE3  /* decorativo, sem exigência de contraste */
--color-border-interactive:#767F8C  /* campos e controles — 4.05:1 */
--color-text:              #1A1D23  /* 16.88:1 */
--color-text-muted:        #5A6270  /* 6.15:1 */
--color-primary:           #3B49DF  /* 6.55:1 */
--color-primary-hover:     #2E3AB8
--color-success:           #1E7B34  /* 5.33:1 */
--color-warning:           #96590A  /* 5.63:1 */
--color-danger:            #C0261F  /* 5.94:1 */
```

### Tema escuro

```css
--color-bg:                #12141A
--color-surface:           #1C2029
--color-border-subtle:     #2E343F
--color-border-interactive:#66707E  /* 3.67:1 */
--color-text:              #EEF1F6  /* 16.26:1 */
--color-text-muted:        #A3ACBA  /* 8.04:1 */
--color-primary:           #8A94FF  /* 6.80:1 */
--color-success:           #4ADE80  /* 10.56:1 */
--color-warning:           #F2B44D  /* 10.00:1 */
--color-danger:            #FF6B60  /* 6.60:1 */
```

### Alto contraste

```css
--color-bg: #FFFFFF; --color-text: #000000;      /* 21:1 */
--color-primary: #0000CC;                        /* 11.22:1 */
--color-border-interactive: #000000;             /* 21:1 */
```

### Armadilhas conhecidas

- **`--color-border-subtle` NÃO pode ser usado em campo de formulário nem em controle.** Ele tem 1.36:1 e reprova o critério 1.4.11. Use `--color-border-interactive`.
- O âmbar original (`#B26B00`) reprovava com 4.20:1. O valor correto é `#96590A`.
- Nenhuma cor deve ser escrita direto no código. Sempre pelo token, senão a troca de tema quebra.

### Escala

Espaçamento em múltiplos de 4px (`space-1`=4 … `space-12`=48). Raio: `sm` 6px, `md` 10px, `lg` 16px. Tipografia: Space Grotesk (títulos) + Inter (texto), com fallback declarado. `text-body` 16px/1.5; nunca abaixo de 14px em elemento informativo. **Implementar em unidades relativas**, senão RA04 quebra.

---

## 7. Regras de integração com a IA

Estas regras vêm da revisão de infraestrutura e são obrigatórias.

### Payload permitido na chamada ao provedor

| Campo | Enviar? |
|---|---|
| Título da tarefa | Sim |
| Prioridade, prazo, horas estimadas | Sim |
| Descrição da tarefa | Só se necessário — é o campo com maior chance de conter dado pessoal |
| Nome do usuário | **Não** |
| E-mail e identificador da conta | **Não** — viola RNF-LGPD07 |
| Histórico completo de sessões | **Não** |

Use identificador pseudonimizado para manter contexto de conversa sem transmitir o ID real.

### Logs

Registrar: data/hora, identificador pseudonimizado, tokens consumidos, latência, código de resultado.
**Não registrar:** conteúdo da mensagem nem da resposta. Em erro, registrar a classe do erro, não o payload.

### Limite de uso

Implementar rate limit por usuário baseado em `conversa_ia.tokens_usados`. O custo da IA é o único item da estrutura de custos que não se dilui com escala — o limite é controle financeiro, não otimização. Ao atingir o limite: mensagem clara informando quando renova, **sem bloquear as demais funções**.

---

## 8. Telas

15 telas mapeadas. O painel principal concentra a navegação: 10 telas partem dele diretamente.

```
01 Carregamento  02 Login  03 Cadastro (com aceite)  04 Recuperação de senha
05 Painel principal  06 Detalhe da tarefa  07 Modos de concentração
08 Sessão de foco  09 Assistente de IA  10 Métricas e histórico
11 Perfil e preferências  12 Preferências de acessibilidade
13 Privacidade e dados  14 Exportar dados  15 Excluir conta
```

**Layout do painel (≥1280px):** três colunas — widgets à esquerda, quadro ao centro, assistente à direita. O quadro central é a única coluna que permanece visível em qualquer largura.

**Regras de navegação:** toda tela autenticada alcançável em ≤2 passos do painel; nenhuma tela é caminho sem retorno (exceção deliberada: excluir conta encerra a sessão).

**Estados obrigatórios em toda área que depende de dados:** vazio, carregando, erro, sucesso. A ausência do estado vazio é a falha mais comum e aparece no primeiro uso, que é quando o usuário decide se continua.

---

## 9. Estado atual e trabalho pendente

### Já existe no protótipo

Quadro de tarefas, widgets (Pomodoro, métricas, estratégias), assistente de IA com streaming, formulário de atividades, organização automática em sprints, temas claro/escuro.

### Pendente — ordenado por prioridade

| # | Tarefa | Origem |
|---|---|---|
| 1 | **Interface de Modos de Foco** — CRUD completo (listar, criar, editar, excluir), estado vazio, persistência por usuário, navegação por teclado | Escopo não concluído da Sprint 4 |
| 2 | **Aceite de termos no cadastro** + gravação em `consentimento` com versão, data e hora | RF-LGPD01, RNF-LGPD06 |
| 3 | **Tela Privacidade e dados** — consultar, corrigir, exportar (CSV), excluir conta | UC11, RF-LGPD03, RF-LGPD04 |
| 4 | **Tela Preferências de acessibilidade** — tema, tamanho de fonte, contraste, reduzir animações | UC12, RA04–RA06 |
| 5 | **Rate limit da IA** por usuário | RNF09, achado IA-01 (severidade alta) |
| 6 | **Auditar o payload enviado ao provedor** e documentar os campos | RNF-LGPD07, achado IA-03 (alta) |
| 7 | **Reduzir persistência do conteúdo das conversas** ao mínimo necessário | Achado IA-02 (alta), art. 6º III da LGPD |
| 8 | **Testar comportamento com o provedor de IA indisponível** | RF17, achado IA-04 |
| 9 | Recuperação de senha | RF03 |
| 10 | Drag and drop no quadro, com equivalente por teclado | US-02 (Must have) |
| 11 | Painel administrativo | UC06–UC10, **sem tela prototipada** |

### Backlog do produto (não planejado)

US-01 lembrete de pausa · US-03 login Google · US-04 relatório semanal por e-mail · US-05 integração com agenda (*Won't have* nesta versão) · US-06 painel agregado B2B · US-07 uso offline · US-08 exportar CSV

**Lacunas de escopo já identificadas e sem história no backlog:** painel administrativo, requisitos não funcionais (backup RNF06, CI/CD RNF05, desempenho RNF01) e importação de dados de outra ferramenta.

---

## 10. Convenções

### Código

- Componentes reutilizáveis; nenhum componente é considerado pronto **sem o estado de foco por teclado definido**.
- Cores só por token semântico.
- Unidades relativas em tipografia e espaçamento.
- Elevação indica hierarquia, não decoração.

### Definition of Done

Um item só é concluído quando: (a) todos os critérios de aceitação foram atendidos; (b) o entregável está anexado ou linkado; (c) outro integrante revisou; (d) o status foi atualizado. **Nunca marcar como concluído algo com prazo no futuro.**

### Escopo não concluído

Não fica marcado como pronto. É transportado para a sprint seguinte em um item novo que referencia o original. Essa regra existe porque o projeto já cometeu esse erro uma vez: a Sprint 4 aparecia 100% entregue com escopo em aberto.

---

## 11. Como quero que você trabalhe comigo

- **Pergunte antes de assumir.** Se um requisito estiver ambíguo, pergunte em vez de escolher por mim.
- **Respeite as decisões de modelagem da seção 3.** Se achar que alguma está errada, argumente antes de mudar.
- **Não invente dado.** Se precisar de um número, uma métrica ou um resultado de teste que eu não forneci, diga que falta em vez de preencher.
- **Rastreabilidade importa.** Ao implementar algo, cite o requisito ou caso de uso correspondente no commit ou no comentário. É isso que a banca cobra.
- **Acessibilidade não é etapa final.** Foco por teclado e contraste entram junto com o componente, não depois.
- **Me avise quando eu estiver contornando um problema em vez de resolver.** Prefiro ouvir isso do que descobrir na apresentação.

---

## 12. Documentação de referência

| Documento | Conteúdo |
|---|---|
| `S2_Documento-Requisitos_Requisitos-v2` | RF, RNF, LGPD, acessibilidade, regras e matriz de rastreabilidade |
| `S3_Documentacao-Casos-de-Uso_Casos-de-Uso-v2` | UC01 a UC12 com fluxos, pré e pós-condições |
| `S3_Estrutura-Banco-de-Dados_Script-PostgreSQL.sql` | Schema completo |
| `S3_Estrutura-Banco-de-Dados_Modelo-de-Dados` | Dicionário de dados e justificativa das decisões |
| `S3_Prototipagem-Design_Design-System` | Componentes, estados e responsividade |
| `S2_Pesquisa-de-Cores_Paleta-e-Tokens` | Paleta com verificação de contraste |
| `S3_Linha-de-Telas_Fluxo-de-Navegacao` | Inventário de telas e fluxo |
| `S5_Atualizar-Diagramas_UML-v2-Documento-Completo` | Diagramas de casos de uso, atividades e classes |
| `S5_Uso-da-LGPD_Politica-Privacidade-e-Termos` | Minuta da política (requer revisão jurídica) |
| `S5_Revisao-Infra-IA_Relatorio` | Achados IA-01 a IA-06 e plano de ação |

---

## 13. Avisos honestos

- O protótipo **não está pronto para uso real**. É acadêmico. Homologação prevista para a Sprint 6.
- A **modelagem já está adequada à LGPD e à acessibilidade; o protótipo ainda não.** As telas de privacidade e de preferências não existem. Essa é a maior inconsistência atual entre documentação e produto.
- O script SQL foi validado sintaticamente, **não executado**.
- A Política de Privacidade é minuta de estudantes e **não substitui revisão jurídica**.
- O diferencial de IA é o mais fácil de um concorrente copiar. A defensibilidade real está na integração entre foco e tarefa, que exige arquitetura diferente — não no recurso de IA isolado.
