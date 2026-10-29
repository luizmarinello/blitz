# Blitz — Estrutura do MVP para GitHub + Render + Neon

Gerado em 29/10/2026 a partir das decisões tomadas com a skill `estruturar-projeto`. Complementa o `CLAUDE.md` (requisitos, modelo de dados, tokens); não o substitui.

## 1. Resumo

Publicar o protótipo Blitz que já existe na branch `main` (Java 21 + Spring Boot no back, TypeScript + Vite no front, PostgreSQL via Flyway) como dois serviços no Render — um Static Site para o front e um Web Service em Docker para a API — usando o Neon como banco de produção, com o código em um repositório privado `luizmarinello/blitz` no GitHub e CI no GitHub Actions. Zero funcionalidade nova nesta semana: só a adaptação para duas origens, infraestrutura e publicação.

## 2. Decisões (por bloco)

| Bloco | Decisão | Por quê |
|---|---|---|
| Base de código | `main` (Java/Spring + Vite TS) | Já tem Dockerfile, `render.yaml`, Flyway com o schema S3, Neon vinculado e quase todos os RFs. A `blitz-v2` (React + Supabase) só tem login/cadastro. |
| Repositório | Criar **privado** `luizmarinello/blitz` | O remote `origin` já aponta para lá, mas o repo não existe no GitHub. O Render lê repo privado pela integração com o GitHub. |
| Equipe | Equipe T03N toda, com PR para a `main` | Três integrantes vão mexer; a `main` dispara deploy, então muda por PR. |
| Deploy | **Dois serviços** no Render: Static Site (front) + Web Service Docker (API) | Escolha do usuário. Custo: o front deixa de ser servido pelo Spring e o back precisa de CORS. |
| Sessão | Cookie HttpOnly com `SameSite=None; Secure` + CORS restrito à URL do front | Menor mudança em relação ao cookie atual (`Strict`). CSRF fica coberto porque a API só aceita JSON e a origem é restrita. |
| Banco | Neon, projeto `mute-brook-94294275` (São Paulo, Postgres 18); apagar o duplicado `gentle-frost-29029150` | Dois projetos vazios com o mesmo nome confundem. Apagar só com confirmação explícita. Schema entra pelo Flyway no primeiro boot. |
| IA e e-mail | Sem chave Gemini e sem SMTP nesta semana | Já existe modo alternativo (RF17) e link de redefinição no log. Ativar depois só trocando variáveis no Render. |
| Admin | `ADMIN_EMAIL` definido direto no painel do Render | Não entra em código nem em documento (LGPD). |
| CI | GitHub Actions: testes do back + build do front a cada push/PR | Atende RNF05. O deploy continua sendo o automático do Render. |
| Prazo | Esta semana | Prioridade é publicar e corrigir o que quebrar; pendências de produto ficam para depois. |

## 3. Escopo

### Nesta versão (publicar)

1. Front chamando a API por URL configurável (`VITE_API_URL`) e enviando cookie entre origens (`credentials: 'include'`).
2. Back com CORS restrito a `FRONT_URL` e cookie `SameSite=None; Secure` em produção.
3. `render.yaml` com os dois serviços; Dockerfile só do back.
4. Workflow de CI (`.github/workflows/ci.yml`).
5. Repositório privado no GitHub com a `main` publicada e os dois colegas convidados.
6. Neon: um projeto só, variáveis preenchidas no Render.
7. Teste de fumaça contra a URL pública (`scripts/smoke.sh` já existe).

### Fica para depois (sem história aberta ainda)

- Chave do Gemini e SMTP (só variáveis).
- Pendências do CLAUDE.md seção 9 que ainda estiverem abertas após revisão (não revisadas nesta rodada).
- Backup (RNF06): o Neon mantém histórico de 6 h no plano atual; backup diário não está coberto.
- Proteção de branch na `main` (revisão obrigatória) — depende de plano do GitHub para repo privado.

## 4. Stack e arquitetura

```
Navegador
   │  HTTPS
   ▼
Render Static Site (frontend/dist)  ──fetch + cookie──▶  Render Web Service (Docker, Spring Boot, :PORT)
        blitz-front.onrender.com                              blitz-api.onrender.com
                                                                      │ JDBC sslmode=require
                                                                      ▼
                                                          Neon Postgres (mute-brook-94294275)
                                                          schema aplicado pelo Flyway (V1 = S3)
GitHub luizmarinello/blitz (privado)
   ├─ push/PR → GitHub Actions (mvnw test + npm run build)
   └─ push na main → Render faz deploy dos dois serviços
```

Variáveis novas além das já documentadas no README:

| Onde | Variável | Valor |
|---|---|---|
| Static Site | `VITE_API_URL` | URL pública do Web Service |
| Web Service | `FRONT_URL` | URL pública do Static Site (origem permitida no CORS) |
| Web Service | `APP_URL` | igual a `FRONT_URL` (os links de e-mail apontam para o front) |
| Web Service | `COOKIE_SECURE` | `true` (já está no `render.yaml`) |

## 5. Estrutura de pastas (o que muda)

```
blitz/
├── .github/workflows/ci.yml        # novo
├── backend/                        # inalterado, exceto SecurityConfig + application.yml
├── frontend/
│   ├── vite.config.ts              # outDir volta para dist/
│   └── src/api.ts                  # base URL + credentials: 'include'
├── Dockerfile                      # remove o estágio do front
├── render.yaml                     # + serviço static
├── ESTRUTURA.md                    # este arquivo
└── dist/                           # lixo de build na raiz: apagar e ignorar
```

## 6. Etapas de construção (pequenas e verificáveis)

| # | Etapa | Como verificar |
|---|---|---|
| 1 | Limpar a raiz: apagar `dist/`, adicionar ao `.gitignore` | `git status` limpo |
| 2 | Front: `VITE_API_URL` em `api.ts`, `credentials: 'include'`, `outDir: 'dist'`, proxy de dev mantido | `npm run build` gera `frontend/dist`; `npm run dev` continua funcionando com o back local |
| 3 | Back: CORS para `FRONT_URL` em `SecurityConfig`, `same-site: none` quando `COOKIE_SECURE=true`, atualizar o comentário ponytail sobre CSRF | `./mvnw test` passa; `curl -H "Origin: <FRONT_URL>"` recebe `Access-Control-Allow-Origin` |
| 4 | Dockerfile só do back; `render.yaml` com `static` (build `npm ci && npm run build`, publish `frontend/dist`, rewrite `/* → /index.html`) + variáveis novas | `docker build .` conclui |
| 5 | CI: `.github/workflows/ci.yml` com `mvnw test` e `npm run build` | Workflow verde no primeiro push |
| 6 | GitHub: `gh repo create luizmarinello/blitz --private`, push da `main`, convidar os dois colegas | `git ls-remote origin` lista `main` |
| 7 | Neon: apagar `gentle-frost-29029150` **(pede confirmação)**, pegar a connection string do `mute-brook-94294275` | `list_projects` mostra um projeto |
| 8 | Render: criar Blueprint a partir do `render.yaml`, preencher `DATABASE_*`, `FRONT_URL`, `APP_URL`, `ADMIN_EMAIL`, `VITE_API_URL` | Logs do Web Service mostram o Flyway aplicando `V1`; `/` do front abre |
| 9 | Fumaça: `BASE=<api> ./scripts/smoke.sh` e cadastro + login pelo navegador no front publicado | Fluxo completo sem erro de CORS/cookie |
| 10 | README: seção "Deploy" com os dois serviços e as variáveis novas | Revisado por outro integrante (Definition of Done) |

Cada etapa vira um commit com o requisito no título (RNF04, RNF05, RN01…).

## 7. Pontos em aberto e riscos

- **Cookie entre subdomínios do Render.** `*.onrender.com` está na Public Suffix List, então front e API são sites diferentes; o cookie só funciona com `SameSite=None; Secure`. Safari com "Prevenir rastreamento" pode bloquear mesmo assim. Se acontecer, o plano B é token Bearer (decisão descartada nesta rodada, fica registrada).
- **Plano free do Render** dorme o Web Service após inatividade; o primeiro acesso leva dezenas de segundos. Afeta RNF01 e RNF08, aceitável para demonstração acadêmica.
- **Sem SMTP**, a recuperação de senha (RF03) só funciona lendo o link no log do Render.
- **Sem chave Gemini**, o assistente responde em modo alternativo (RF17). A banca deve ser avisada.
- **Postgres 18 no Neon** vs. Postgres 16 testado localmente: o schema S3 é SQL padrão, risco baixo, mas o primeiro boot confirma.
- **Dependências na raiz** (`neon.ts`, `@neon/config`) vieram do vínculo com o Neon e não fazem parte do produto; manter até confirmar se alguma ferramenta usa.
- **Exclusão do projeto Neon duplicado** é irreversível. Só executar após confirmação explícita no chat.
