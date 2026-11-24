#!/usr/bin/env bash
# Teste de restauração (R12). Roda NA EC2 com sudo. Restaura um pacote do backup.sh num banco SEPARADO
# (blitz_restauracao_teste) e compara com a produção, sem tocar no banco "blitz".
# Uso: sudo ./restaurar-teste.sh /caminho/blitz-AAAAMMDD-HHMM.tar.gz
set -euo pipefail
[ "$(id -u)" -eq 0 ] || { echo "rode com sudo"; exit 1; }
PACOTE=${1:?informe o .tar.gz do backup}
D=$(mktemp -d); trap 'rm -rf "$D"' EXIT
tar -xzf "$PACOTE" -C "$D"; chown -R postgres "$D"; chmod 755 "$D"
sudo -u postgres dropdb --if-exists blitz_restauracao_teste
sudo -u postgres createdb -O blitz blitz_restauracao_teste
sudo -u postgres pg_restore --no-owner --role=blitz -d blitz_restauracao_teste "$D/blitz-banco.dump"
Q="SELECT (SELECT count(*) FROM usuario) usuarios, (SELECT count(*) FROM tarefa) tarefas, (SELECT count(*) FROM sessao_foco) sessoes, (SELECT count(*) FROM flyway_schema_history) migracoes"
for db in blitz blitz_restauracao_teste; do echo "== $db"; sudo -u postgres psql -d "$db" -c "$Q"; done
echo "Tarefas restauradas (só título e prioridade, sem dado pessoal):"
sudo -u postgres psql -d blitz_restauracao_teste -c "SELECT titulo, prioridade, status FROM tarefa ORDER BY id DESC LIMIT 5"
