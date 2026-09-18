# Blitz — Sistema de Foco e Produtividade

> *"O aplicativo que não só organiza suas tarefas, mas decide com você o que fazer agora."*

Protótipo funcional do TCC da equipe T03N (Luiz Henrique, Vinicius Fagundes e Raphael Henke). Requisitos, casos de uso e decisões de modelagem estão em [`CLAUDE.md`](CLAUDE.md).

## Stack

| Camada | Tecnologia |
|---|---|
| Back-end | Java 21 · Spring Boot 3.5 (Web, Security, Data JPA, Validation) · Flyway |
| Banco | PostgreSQL 16 (schema `S3` da equipe, sem alterações) |
| Front-end | TypeScript puro + HTML + CSS · Vite (sem framework) |
| IA | Google Gemini, chamado **somente pelo servidor** (`GeminiClient`) |
| Infra | Docker (imagem única) · Render (web) · Neon (Postgres) · GitHub |

O front é compilado para dentro do jar e servido pelo próprio Spring: uma origem, um deploy, cookie de sessão simples.

## Rodar localmente

Pré-requisitos: Java 21, Node 20+, Docker (só para o Postgres local).

```bash
# 1) banco
docker compose up -d db

# 2) back-end (porta 8080) — o Maven Wrapper baixa o Maven sozinho
cd backend && ./mvnw spring-boot:run

# 3) front-end em modo dev (porta 5173, com proxy para /api)
cd frontend && npm install && npm run dev
```

**Sem Docker?** Suba o back-end com um Postgres embutido (os dados somem ao encerrar):

```bash
cd backend && ./mvnw -q test-compile dependency:build-classpath -Dmdep.includeScope=test -Dmdep.outputFile=target/cp.txt && java -cp "target/classes;target/test-classes;$(cat target/cp.txt)" br.com.blitz.DevEmbutido
```

(No Linux/macOS troque `;` por `:` no classpath.)

Abra http://localhost:5173. Sem `GEMINI_API_KEY`, o assistente responde em **modo alternativo** (ordenação determinística por prazo, prioridade e esforço — RF17); o resto funciona normalmente.

Build completo (front dentro do jar) e execução como em produção:

```bash
cd frontend && npm run build          # gera backend/src/main/resources/static
cd ../backend && ./mvnw -DskipTests package && java -jar target/blitz-0.1.0.jar
```

Ou tudo via Docker: `docker compose up --build` e abra http://localhost:8080.

### Variáveis de ambiente

| Variável | Padrão | Uso |
|---|---|---|
| `DATABASE_URL` | `jdbc:postgresql://localhost:5432/blitz` | URL JDBC (Neon: `jdbc:postgresql://<host>/<db>?sslmode=require`) |
| `DATABASE_USER` / `DATABASE_PASSWORD` | `blitz` / `blitz` | credenciais do banco |
| `GEMINI_API_KEY` | vazio | chave do provedor de IA; vazio = modo alternativo |
| `GEMINI_MODELO` | `gemini-2.0-flash` | modelo |
| `IA_LIMITE_TOKENS_DIA` | `20000` | limite por usuário em 24h (RNF09) |
| `IA_PSEUDONIMO_SAL` | `blitz-dev` | sal do identificador pseudonimizado nos logs (RNF-LGPD07) |
| `COOKIE_SECURE` | `false` | `true` em produção (HTTPS) |
| `APP_URL` | `http://localhost:8080` | base dos links enviados por e-mail (RF03) |
| `APP_SECRET` | vazio | assina os tokens de redefinição de senha; vazio = aleatório a cada start (links caem no reinício) |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASSWORD` | vazio / `587` | SMTP de qualquer provedor (Gmail com senha de app, Brevo, Resend…). Sem `SMTP_HOST`, o link de redefinição vai para o **log** do servidor (só desenvolvimento) |
| `EMAIL_REMETENTE` | `SMTP_USER` | remetente dos e-mails |
| `PORT` | `8080` | porta HTTP (o Render define) |

## Testes

```bash
cd backend && ./mvnw test
```

Um único teste de integração (`FluxoPrincipalTest`) sobe um **PostgreSQL real embutido** (sem Docker), aplica o schema via Flyway e percorre o fluxo principal: cadastro com aceite, tarefas e restrição `ck_tarefa_conclusao`, modos, sessão de foco (`RESTRICT` no modo, `SET NULL` na tarefa), IA em modo alternativo, acessibilidade, exportação e exclusão por anonimização.

Há também um teste de fumaça por `curl` contra um servidor rodando: `BASE=http://localhost:8080 ./scripts/smoke.sh`.

## Deploy (Render + Neon)

1. Crie um projeto no [Neon](https://neon.tech) e anote host, banco, usuário e senha.
2. No Render, crie um **Blueprint** apontando para este repositório (`render.yaml`) ou um Web Service Docker.
3. Preencha `DATABASE_URL` (formato JDBC acima), `DATABASE_USER`, `DATABASE_PASSWORD` e `GEMINI_API_KEY`.
4. O Flyway cria o schema no primeiro start.

## API (resumo)

| Método e rota | Caso de uso |
|---|---|
| `POST /api/auth/cadastro` · `login` · `logout` · `GET /api/auth/me` · `POST /api/auth/recuperar` · `POST /api/auth/redefinir` | UC01, RF03 |
| `GET/POST/PUT/DELETE /api/listas` · `GET /api/tarefas` · `POST /api/listas/{id}/tarefas` · `PUT/DELETE /api/tarefas/{id}` · `PATCH /api/tarefas/{id}/status` | UC02 |
| `GET/POST/PUT/DELETE /api/modos` | UC05 |
| `POST /api/sessoes` · `GET /api/sessoes/ativa` · `POST /api/sessoes/{id}/encerrar` · `DELETE /api/sessoes/{id}` · `GET /api/sessoes` · `GET /api/metricas` | UC03 |
| `POST /api/ia/mensagem` · `GET /api/ia/historico` · `GET /api/ia/limite` | UC04 |
| `GET/PUT /api/acessibilidade` | UC12 |
| `PUT /api/perfil` · `PUT /api/perfil/senha` | RF-LGPD03 |
| `GET /api/privacidade/consentimentos` · `GET /api/privacidade/exportar` (.json) · `exportar.csv` · `DELETE /api/privacidade/conta` | UC11 |

Erros vêm sempre em JSON pt-BR: `{ "mensagem": "...", "campos": { "email": "E-mail inválido." } }` (RF04).

## Estrutura

```
backend/   Spring Boot — br.com.blitz.{auth,usuario,lgpd,acessibilidade,modo,tarefa,sessao,ia,comum}
           src/main/resources/db/migration/V1__schema_inicial.sql  (= blitz_schema.sql da equipe)
frontend/  Vite + TypeScript — src/telas/*.ts (uma por tela do inventário), src/styles.css (tokens da seção 6)
scripts/   smoke.sh
Dockerfile · docker-compose.yml · render.yaml
```

## Estado atual x pendências do CLAUDE.md (seção 9)

| # | Item | Situação |
|---|---|---|
| 1 | Interface de Modos de Foco (CRUD, vazio, por usuário, teclado) | **Feito** |
| 2 | Aceite de termos + gravação em `consentimento` | **Feito** |
| 3 | Tela Privacidade e dados (consultar, corrigir, exportar CSV, excluir) | **Feito** (exporta JSON completo e CSV de tarefas) |
| 4 | Tela Preferências de acessibilidade | **Feito** (tema, fonte, contraste, reduzir animações; aplicado em todas as telas) |
| 5 | Rate limit da IA por usuário | **Feito** (janela de 24h sobre `conversa_ia.tokens_usados`; 429 sem bloquear o resto) |
| 6 | Auditar payload enviado ao provedor | **Feito** — sai só título, prioridade, prazo, horas, status (`IaController.instrucao`) |
| 7 | Reduzir persistência do conteúdo das conversas | **Pendente** — o schema exige `mensagem NOT NULL`; mudar exige discutir a modelagem |
| 8 | Comportamento com provedor indisponível | **Feito** — fallback determinístico, coberto pelo teste |
| 9 | Recuperação de senha | **Feito** — token assinado (HMAC com hash da senha, 1h, uso único), e-mail via SMTP; sem tabela nova |
| 10 | Drag and drop no quadro | **Parcial** — mover por botões (equivalente por teclado); arrastar não implementado |
| 11 | Painel administrativo | **Pendente** — rotas `/api/admin/**` já exigem `ADMINISTRADOR`, sem endpoints nem tela |

Também não implementado: organização automática em sprints (RF09; a tabela `sprint` existe e está vazia).
