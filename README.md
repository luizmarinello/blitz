# Blitz — Sistema de Foco e Produtividade

> *"O aplicativo que não só organiza suas tarefas, mas decide com você o que fazer agora."*

Protótipo funcional do TCC da equipe T03N (Luiz Henrique, Vinicius Fagundes e Raphael Henke). Requisitos, casos de uso e decisões de modelagem estão em [`CLAUDE.md`](CLAUDE.md).

## Stack

| Camada | Tecnologia |
|---|---|
| Back-end | Java 21 · Spring Boot 3.5 (Web, Security, Data JPA, Validation) · Flyway |
| Banco | PostgreSQL 16 (schema `S3` da equipe, sem alterações) |
| Front-end | TypeScript puro + HTML + CSS · Vite (sem framework) · publicado como Static Site |
| IA | Google Gemini, chamado **somente pelo servidor** (`GeminiClient`) |
| Infra | Docker (só a API) · Render (Static Site + Web Service) · Neon (Postgres) · GitHub Actions (CI) |

Em produção o front e a API são dois serviços do Render em origens diferentes: a API libera CORS só para `FRONT_URL` e o cookie de sessão usa `SameSite=None; Secure`. Em desenvolvimento o Vite faz proxy de `/api` para o back local (`API_PROXY=http://localhost:8090 npm run dev` aponta para outra porta), então não há CORS.

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

Build de produção:

```bash
cd frontend && npm run build          # gera frontend/dist (Static Site)
cd ../backend && ./mvnw -DskipTests package && java -jar target/blitz-0.1.0.jar
```

Ou a API via Docker: `docker compose up --build` (porta 8080); o front em dev aponta para ela pelo proxy.

## Deploy (Render + Neon)

1. **Neon:** crie o projeto (ou use o existente) e copie host, banco, usuário e senha da connection string.
2. **Render:** *New → Blueprint* apontando para este repositório; o [`render.yaml`](render.yaml) cria `blitz-api` (Docker, plano free) e `blitz-front` (Static Site).
3. Preencha no painel as variáveis `sync: false`: em `blitz-api`, `DATABASE_URL` (`jdbc:postgresql://<host>/<db>?sslmode=require`), `DATABASE_USER`, `DATABASE_PASSWORD`, `FRONT_URL` e `APP_URL` (URL pública do `blitz-front`), `ADMIN_EMAIL`; em `blitz-front`, `VITE_API_URL` (URL pública do `blitz-api`). Gemini e SMTP são opcionais.
4. No primeiro boot o Flyway aplica o schema. Health check: `GET /api/auth/saude`.
5. Fumaça: `BASE=https://<blitz-api> ./scripts/smoke.sh`.

O plano free dorme a API após inatividade; o primeiro acesso demora alguns segundos. Se os serviços foram criados por "Public Git Repository" (sem a integração do Render com o GitHub), **não há deploy automático**: a cada push na `main` é preciso clicar em *Manual Deploy* nos dois serviços, ou conectar o GitHub em *Account Settings → Git Providers*. CI ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) roda testes do back e build do front a cada push/PR.

### Variáveis de ambiente

| Variável | Padrão | Uso |
|---|---|---|
| `DATABASE_URL` | `jdbc:postgresql://localhost:5432/blitz` | URL JDBC (Neon: `jdbc:postgresql://<host>/<db>?sslmode=require`) |
| `DATABASE_USER` / `DATABASE_PASSWORD` | `blitz` / `blitz` | credenciais do banco |
| `GEMINI_API_KEY` | vazio | chave do provedor de IA; vazio = modo alternativo |
| `GEMINI_MODELO` | `gemini-2.0-flash` | modelo |
| `IA_LIMITE_TOKENS_DIA` | `20000` | limite por usuário em 24h (RNF09) |
| `IA_PSEUDONIMO_SAL` | `blitz-dev` | sal do identificador pseudonimizado nos logs (RNF-LGPD07) |
| `IA_RETENCAO_DIAS` | `7` | dias até apagar o conteúdo das conversas com a IA, mantendo só data e tokens (achado IA-02); `0` desliga |
| `ADMIN_EMAIL` | vazio | e-mail da conta que vira `ADMINISTRADOR` no start ou no cadastro (RN04) |
| `COOKIE_SECURE` | `false` | `true` em produção (HTTPS) |
| `COOKIE_SAMESITE` | `strict` | `none` quando o front é servido de outra origem (Render) |
| `FRONT_URL` | vazio | origem do front publicado separado, liberada no CORS; vazio = mesma origem |
| `VITE_API_URL` (front) | vazio | origem da API no build do Static Site; vazio = mesma origem/proxy |
| `APP_URL` | `http://localhost:8080` | base dos links enviados por e-mail (RF03); em produção, a URL do front |
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

## API (resumo)

| Método e rota | Caso de uso |
|---|---|
| `POST /api/auth/cadastro` · `login` · `logout` · `GET /api/auth/me` · `POST /api/auth/recuperar` · `POST /api/auth/redefinir` | UC01, RF03 |
| `GET/POST/PUT/DELETE /api/listas` · `GET /api/tarefas` · `POST /api/listas/{id}/tarefas` · `PUT/DELETE /api/tarefas/{id}` · `PATCH /api/tarefas/{id}/status` | UC02 |
| `GET/POST/PUT/DELETE /api/modos` | UC05 |
| `POST /api/sessoes` · `GET /api/sessoes/ativa` · `POST /api/sessoes/{id}/encerrar` · `DELETE /api/sessoes/{id}` · `GET /api/sessoes` · `GET /api/metricas` | UC03 |
| `POST /api/ia/mensagem` · `GET /api/ia/historico` · `GET /api/ia/limite` | UC04 |
| `GET /api/sprints/atual` · `POST /api/sprints/planejar` | RF09 |
| `GET/PUT /api/acessibilidade` | UC12 |
| `GET /api/admin/usuarios` · `PATCH /api/admin/usuarios/{id}` · `GET/POST/PUT /api/admin/organizacoes` · `GET /api/admin/metricas` · `GET /api/admin/integracoes` | UC06, UC08, UC10 (só `ADMINISTRADOR`) |
| `GET /api/gestor/metricas` | RF21 (`GESTOR` ou `ADMINISTRADOR`) |
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
| 7 | Reduzir persistência do conteúdo das conversas | **Feito (por retenção)** — conteúdo apagado após `IA_RETENCAO_DIAS` (padrão 7), ficam só data e tokens para o limite. Remover a coluna `mensagem` exige discutir a modelagem |
| 8 | Comportamento com provedor indisponível | **Feito** — fallback determinístico, coberto pelo teste |
| 9 | Recuperação de senha | **Feito** — token assinado (HMAC com hash da senha, 1h, uso único), e-mail via SMTP; sem tabela nova |
| 10 | Drag and drop no quadro | **Feito** — HTML5 nativo entre colunas de status; botões de seta como equivalente por teclado |
| 11 | Painel administrativo | **Feito (mínimo)** — usuários (papel, ativo, organização), organizações, métricas agregadas pela view, status das integrações; gestor vê só a própria equipe. UC07 e UC09 sem requisito detalhado, fora |

RF09 (organização automática em sprints): **feito** como sprint semanal por capacidade em horas, ordenando por prazo, prioridade e esforço (widget "Sprint da semana" no painel). Não implementado: reordenar cartões dentro da coluna, sprints futuras, admin de "conteúdos" e "funcionalidades" (UC07/UC09).
