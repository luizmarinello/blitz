#!/usr/bin/env bash
# Teste de fumaça da API: percorre o fluxo principal (UC01, UC02, UC03, UC04, UC11) e falha no primeiro erro.
# Uso: BASE=http://localhost:8080 ./scripts/smoke.sh
set -euo pipefail
BASE="${BASE:-http://localhost:8080}"
JAR="$(mktemp)"; trap 'rm -f "$JAR"' EXIT
EMAIL="smoke-$(date +%s)@teste.local"

req() { # metodo caminho [json]
  local m="$1" p="$2" d="${3:-}"
  if [ -n "$d" ]; then
    curl -sS -b "$JAR" -c "$JAR" -X "$m" "$BASE$p" -H 'Content-Type: application/json' -d "$d" -w '\n%{http_code}'
  else
    curl -sS -b "$JAR" -c "$JAR" -X "$m" "$BASE$p" -w '\n%{http_code}'
  fi
}
espera() { # descricao codigo_esperado resposta
  local desc="$1" esperado="$2" resp="$3"
  local code="${resp##*$'\n'}" body="${resp%$'\n'*}"
  if [ "$code" != "$esperado" ]; then echo "FALHOU: $desc -> HTTP $code (esperado $esperado)"; echo "$body"; exit 1; fi
  echo "ok  $desc ($code)"; echo "$body"
}
id_de() { sed -n 's/.*"id":\([0-9]*\).*/\1/p' <<<"$1" | head -1; }

espera "sem login retorna 401" 401 "$(req GET /api/tarefas)" >/dev/null
espera "cadastro sem aceite falha (RF-LGPD01)" 400 "$(req POST /api/auth/cadastro "{\"nome\":\"Teste\",\"email\":\"$EMAIL\",\"senha\":\"senha12345\",\"aceitaTermos\":false}")" >/dev/null
espera "cadastro" 201 "$(req POST /api/auth/cadastro "{\"nome\":\"Teste\",\"email\":\"$EMAIL\",\"senha\":\"senha12345\",\"aceitaTermos\":true}")" >/dev/null
espera "me" 200 "$(req GET /api/auth/me)" >/dev/null
espera "consentimento gravado (RNF-LGPD06)" 200 "$(req GET /api/privacidade/consentimentos)" | grep -q versaoPolitica

LISTAS=$(espera "listas (lista padrao criada)" 200 "$(req GET /api/listas)")
LISTA_ID=$(id_de "$LISTAS")
T=$(espera "criar tarefa" 201 "$(req POST "/api/listas/$LISTA_ID/tarefas" '{"titulo":"Escrever relatorio","prioridade":"ALTA","prazo":"2026-12-01","horasEstimadas":2.5}')")
TAREFA_ID=$(id_de "$T")
espera "concluir tarefa (ck_tarefa_conclusao)" 200 "$(req PATCH "/api/tarefas/$TAREFA_ID/status" '{"status":"CONCLUIDA"}')" | grep -q concluidaEm
espera "reabrir tarefa" 200 "$(req PATCH "/api/tarefas/$TAREFA_ID/status" '{"status":"EM_ANDAMENTO"}')" | grep -qv concluidaEm

MODOS=$(espera "modos (3 predefinidos)" 200 "$(req GET /api/modos)")
MODO_ID=$(id_de "$MODOS")
M=$(espera "criar modo personalizado" 201 "$(req POST /api/modos '{"nome":"Meu modo","cicloFocoMin":30,"cicloPausaMin":5}')")
MEU_MODO=$(id_de "$M")
espera "modo invalido (241 min)" 400 "$(req POST /api/modos '{"nome":"x","cicloFocoMin":241,"cicloPausaMin":5}')" >/dev/null

S=$(espera "iniciar sessao" 201 "$(req POST /api/sessoes "{\"modoId\":$MEU_MODO,\"tarefaId\":$TAREFA_ID}")")
SESSAO_ID=$(id_de "$S")
espera "segunda sessao simultanea bloqueada" 409 "$(req POST /api/sessoes "{\"modoId\":$MODO_ID}")" >/dev/null
espera "encerrar sessao" 200 "$(req POST "/api/sessoes/$SESSAO_ID/encerrar" '{"segundosAtivos":5}')" | grep -q duracaoSegundos
espera "modo usado nao pode ser excluido (RESTRICT)" 409 "$(req DELETE "/api/modos/$MEU_MODO")" >/dev/null
espera "excluir tarefa mantem sessao (SET NULL / RN03)" 204 "$(req DELETE "/api/tarefas/$TAREFA_ID")" >/dev/null
espera "metricas" 200 "$(req GET /api/metricas)" | grep -q totalSessoes

espera "IA responde (real ou fallback RF17)" 200 "$(req POST /api/ia/mensagem '{"mensagem":"O que devo fazer agora?"}')" | grep -q resposta
espera "limite IA" 200 "$(req GET /api/ia/limite)" | grep -q maximo

espera "acessibilidade" 200 "$(req PUT /api/acessibilidade '{"tema":"ALTO_CONTRASTE","tamanhoFonte":"GRANDE","reduzirAnimacoes":true,"leitorTela":false}')" | grep -q ALTO_CONTRASTE
espera "exportar JSON" 200 "$(req GET /api/privacidade/exportar)" | grep -q sessoesFoco
espera "exportar CSV" 200 "$(req GET /api/privacidade/exportar.csv)" | grep -q titulo
espera "excluir conta com senha errada" 401 "$(req DELETE /api/privacidade/conta '{"senha":"errada"}')" >/dev/null
espera "excluir conta (anonimizacao RF-LGPD04)" 200 "$(req DELETE /api/privacidade/conta '{"senha":"senha12345"}')" >/dev/null
espera "login apos exclusao falha" 401 "$(req POST /api/auth/login "{\"email\":\"$EMAIL\",\"senha\":\"senha12345\"}")" >/dev/null

echo; echo "TODOS OS PASSOS PASSARAM"
