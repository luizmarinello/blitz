-- =============================================================================
-- Plataforma Blitz — Sistema de Foco e Produtividade
-- Modelo físico de dados — PostgreSQL
-- Versão 2.0 — Setembro/2026 — Equipe T03N
--
-- Esta versão incorpora as adequações da devolutiva:
--   - tabela consentimento          (RF-LGPD01, RNF-LGPD06, RN06)
--   - tabela preferencia_acessibilidade (RA04, RA05, RA06, RN08, UC12)
--   - anonimização de conta         (RF-LGPD04, RN07)
-- =============================================================================

-- ----------------------------------------------------------------------------
-- Tipos enumerados
-- ----------------------------------------------------------------------------
CREATE TYPE prioridade_tarefa AS ENUM ('BAIXA', 'MEDIA', 'ALTA');
CREATE TYPE status_tarefa     AS ENUM ('BACKLOG', 'EM_ANDAMENTO', 'CONCLUIDA');
CREATE TYPE papel_usuario     AS ENUM ('USUARIO', 'GESTOR', 'ADMINISTRADOR');
CREATE TYPE tema_visual       AS ENUM ('CLARO', 'ESCURO', 'ALTO_CONTRASTE');
CREATE TYPE tamanho_fonte     AS ENUM ('PEQUENO', 'MEDIO', 'GRANDE');

-- ----------------------------------------------------------------------------
-- Organização (frente B2B) — precede usuario por causa da FK
-- ----------------------------------------------------------------------------
CREATE TABLE organizacao (
    id               BIGSERIAL    PRIMARY KEY,
    nome             VARCHAR(180) NOT NULL,
    licencas_totais  INTEGER      NOT NULL DEFAULT 0,
    criado_em        TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT ck_organizacao_licencas CHECK (licencas_totais >= 0)
);

-- ----------------------------------------------------------------------------
-- Usuário
-- ----------------------------------------------------------------------------
CREATE TABLE usuario (
    id              BIGSERIAL      PRIMARY KEY,
    organizacao_id  BIGINT         NULL REFERENCES organizacao (id) ON DELETE SET NULL,
    nome            VARCHAR(180)   NOT NULL,
    email           VARCHAR(255)   NOT NULL,
    senha_hash      VARCHAR(255)   NOT NULL,
    papel           papel_usuario  NOT NULL DEFAULT 'USUARIO',
    ativo           BOOLEAN        NOT NULL DEFAULT TRUE,
    anonimizado_em  TIMESTAMPTZ    NULL,
    criado_em       TIMESTAMPTZ    NOT NULL DEFAULT now(),
    atualizado_em   TIMESTAMPTZ    NOT NULL DEFAULT now(),
    CONSTRAINT uq_usuario_email UNIQUE (email)
);

COMMENT ON COLUMN usuario.senha_hash     IS 'Hash da senha. Nunca armazenar senha em texto claro (RNF-LGPD05).';
COMMENT ON COLUMN usuario.anonimizado_em IS 'Data da anonimizacao apos pedido de exclusao de conta (RF-LGPD04).';
COMMENT ON COLUMN usuario.email          IS 'Dado pessoal. Substituido por valor anonimo na exclusao de conta.';

-- ----------------------------------------------------------------------------
-- Consentimento (LGPD) — histórico, nunca sobrescrito
-- ----------------------------------------------------------------------------
CREATE TABLE consentimento (
    id                BIGSERIAL    PRIMARY KEY,
    usuario_id        BIGINT       NOT NULL REFERENCES usuario (id) ON DELETE CASCADE,
    versao_politica   VARCHAR(20)  NOT NULL,
    aceito_em         TIMESTAMPTZ  NOT NULL DEFAULT now(),
    canal             VARCHAR(40)  NOT NULL DEFAULT 'WEB',
    finalidade        TEXT         NOT NULL,
    CONSTRAINT uq_consentimento_usuario_versao UNIQUE (usuario_id, versao_politica)
);

COMMENT ON TABLE consentimento IS 'Registro de consentimento exigido pelo art. 8 da LGPD. Insercao apenas, sem atualizacao.';

-- ----------------------------------------------------------------------------
-- Preferências de acessibilidade — 1:1 com usuário
-- ----------------------------------------------------------------------------
CREATE TABLE preferencia_acessibilidade (
    usuario_id         BIGINT         PRIMARY KEY REFERENCES usuario (id) ON DELETE CASCADE,
    tema               tema_visual    NOT NULL DEFAULT 'CLARO',
    tamanho_fonte      tamanho_fonte  NOT NULL DEFAULT 'MEDIO',
    reduzir_animacoes  BOOLEAN        NOT NULL DEFAULT FALSE,
    leitor_tela        BOOLEAN        NOT NULL DEFAULT FALSE,
    atualizado_em      TIMESTAMPTZ    NOT NULL DEFAULT now()
);

COMMENT ON TABLE preferencia_acessibilidade IS 'Atende UC12 e RN08. A chave primaria e a FK, garantindo cardinalidade 1:1.';

-- ----------------------------------------------------------------------------
-- Modo de concentração
-- ----------------------------------------------------------------------------
CREATE TABLE modo_concentracao (
    id                BIGSERIAL     PRIMARY KEY,
    usuario_id        BIGINT        NULL REFERENCES usuario (id) ON DELETE CASCADE,
    nome              VARCHAR(80)   NOT NULL,
    descricao         TEXT          NULL,
    ciclo_foco_min    SMALLINT      NOT NULL,
    ciclo_pausa_min   SMALLINT      NOT NULL,
    predefinido       BOOLEAN       NOT NULL DEFAULT FALSE,
    CONSTRAINT ck_modo_ciclo_foco  CHECK (ciclo_foco_min  BETWEEN 1 AND 240),
    CONSTRAINT ck_modo_ciclo_pausa CHECK (ciclo_pausa_min BETWEEN 0 AND 120),
    CONSTRAINT ck_modo_predefinido CHECK (
        (predefinido = TRUE AND usuario_id IS NULL)
        OR (predefinido = FALSE AND usuario_id IS NOT NULL)
    )
);

-- ck_modo_predefinido: modo predefinido (Pomodoro, Profundo, Relax) nao pertence a
-- usuario algum; modo personalizado pertence obrigatoriamente a um usuario.

-- ----------------------------------------------------------------------------
-- Lista e Sprint
-- ----------------------------------------------------------------------------
CREATE TABLE lista (
    id          BIGSERIAL    PRIMARY KEY,
    usuario_id  BIGINT       NOT NULL REFERENCES usuario (id) ON DELETE CASCADE,
    nome        VARCHAR(120) NOT NULL,
    posicao     INTEGER      NOT NULL DEFAULT 0,
    criado_em   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE sprint (
    id           BIGSERIAL    PRIMARY KEY,
    usuario_id   BIGINT       NOT NULL REFERENCES usuario (id) ON DELETE CASCADE,
    data_inicio  DATE         NOT NULL,
    data_fim     DATE         NOT NULL,
    gerada_por_ia BOOLEAN     NOT NULL DEFAULT FALSE,
    CONSTRAINT ck_sprint_periodo CHECK (data_fim >= data_inicio)
);

-- ----------------------------------------------------------------------------
-- Tarefa
-- ----------------------------------------------------------------------------
CREATE TABLE tarefa (
    id               BIGSERIAL          PRIMARY KEY,
    lista_id         BIGINT             NOT NULL REFERENCES lista (id)  ON DELETE CASCADE,
    sprint_id        BIGINT             NULL     REFERENCES sprint (id) ON DELETE SET NULL,
    titulo           VARCHAR(200)       NOT NULL,
    descricao        TEXT               NULL,
    prioridade       prioridade_tarefa  NOT NULL DEFAULT 'MEDIA',
    horas_estimadas  NUMERIC(5,2)       NULL,
    prazo            DATE               NULL,
    status           status_tarefa      NOT NULL DEFAULT 'BACKLOG',
    posicao          INTEGER            NOT NULL DEFAULT 0,
    concluida_em     TIMESTAMPTZ        NULL,
    criado_em        TIMESTAMPTZ        NOT NULL DEFAULT now(),
    atualizado_em    TIMESTAMPTZ        NOT NULL DEFAULT now(),
    CONSTRAINT ck_tarefa_horas CHECK (horas_estimadas IS NULL OR horas_estimadas > 0),
    CONSTRAINT ck_tarefa_conclusao CHECK (
        (status = 'CONCLUIDA' AND concluida_em IS NOT NULL)
        OR (status <> 'CONCLUIDA' AND concluida_em IS NULL)
    )
);

-- ck_tarefa_conclusao: garante coerencia entre o status e a data de conclusao.
-- Atende a regra de negocio RN02.

-- ----------------------------------------------------------------------------
-- Sessão de foco
-- ----------------------------------------------------------------------------
CREATE TABLE sessao_foco (
    id                BIGSERIAL    PRIMARY KEY,
    usuario_id        BIGINT       NOT NULL REFERENCES usuario (id)            ON DELETE CASCADE,
    tarefa_id         BIGINT       NULL     REFERENCES tarefa (id)             ON DELETE SET NULL,
    modo_id           BIGINT       NOT NULL REFERENCES modo_concentracao (id)  ON DELETE RESTRICT,
    inicio            TIMESTAMPTZ  NOT NULL DEFAULT now(),
    fim               TIMESTAMPTZ  NULL,
    duracao_segundos  INTEGER      NULL,
    CONSTRAINT ck_sessao_periodo CHECK (fim IS NULL OR fim >= inicio),
    CONSTRAINT ck_sessao_duracao CHECK (duracao_segundos IS NULL OR duracao_segundos >= 0)
);

COMMENT ON TABLE sessao_foco IS 'Fonte das metricas de foco (RN03). Sessao em andamento tem fim e duracao nulos.';

-- ----------------------------------------------------------------------------
-- Conversa com a IA
-- ----------------------------------------------------------------------------
CREATE TABLE conversa_ia (
    id            BIGSERIAL    PRIMARY KEY,
    usuario_id    BIGINT       NOT NULL REFERENCES usuario (id) ON DELETE CASCADE,
    mensagem      TEXT         NOT NULL,
    resposta      TEXT         NULL,
    tokens_usados INTEGER      NULL,
    data_hora     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT ck_conversa_tokens CHECK (tokens_usados IS NULL OR tokens_usados >= 0)
);

COMMENT ON COLUMN conversa_ia.tokens_usados
    IS 'Base para o limite de uso por usuario exigido pelo RNF09.';

-- ----------------------------------------------------------------------------
-- Índices
-- ----------------------------------------------------------------------------
CREATE INDEX idx_lista_usuario            ON lista (usuario_id, posicao);
CREATE INDEX idx_tarefa_lista             ON tarefa (lista_id, posicao);
CREATE INDEX idx_tarefa_sprint            ON tarefa (sprint_id);
CREATE INDEX idx_tarefa_prazo             ON tarefa (prazo) WHERE status <> 'CONCLUIDA';
CREATE INDEX idx_sessao_usuario_inicio    ON sessao_foco (usuario_id, inicio DESC);
CREATE INDEX idx_sessao_tarefa            ON sessao_foco (tarefa_id);
CREATE INDEX idx_conversa_usuario_data    ON conversa_ia (usuario_id, data_hora DESC);
CREATE INDEX idx_consentimento_usuario    ON consentimento (usuario_id, aceito_em DESC);
CREATE INDEX idx_usuario_organizacao      ON usuario (organizacao_id) WHERE organizacao_id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- Visão agregada por organização (US-06)
-- Suprime equipes com menos de 5 pessoas para evitar reidentificação.
-- ----------------------------------------------------------------------------
CREATE VIEW vw_metricas_organizacao AS
SELECT
    o.id                                          AS organizacao_id,
    o.nome                                        AS organizacao,
    COUNT(DISTINCT u.id)                          AS colaboradores,
    ROUND(AVG(s.duracao_segundos) / 60.0, 1)      AS media_minutos_por_sessao,
    COUNT(s.id)                                   AS total_sessoes
FROM organizacao o
JOIN usuario     u ON u.organizacao_id = o.id AND u.ativo = TRUE
LEFT JOIN sessao_foco s ON s.usuario_id = u.id AND s.fim IS NOT NULL
GROUP BY o.id, o.nome
HAVING COUNT(DISTINCT u.id) >= 5;

COMMENT ON VIEW vw_metricas_organizacao
    IS 'Atende US-06 e N-B2B02: expoe apenas dados agregados e suprime equipes com menos de 5 colaboradores.';

-- ----------------------------------------------------------------------------
-- Modos predefinidos
-- ----------------------------------------------------------------------------
INSERT INTO modo_concentracao (usuario_id, nome, descricao, ciclo_foco_min, ciclo_pausa_min, predefinido) VALUES
    (NULL, 'Pomodoro', 'Ciclos de 25 minutos de foco com 5 minutos de pausa.',            25,  5, TRUE),
    (NULL, 'Profundo', 'Bloco longo de concentracao intensa, com pausa reduzida.',        50, 10, TRUE),
    (NULL, 'Relax',    'Ritmo mais leve, com pausas mais frequentes.',                    20, 10, TRUE);
