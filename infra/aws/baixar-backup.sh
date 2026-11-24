#!/usr/bin/env bash
# Copia o backup mais recente da EC2 para fora da instância (R12). Roda NO COMPUTADOR do integrante.
# Uso: EC2=IP CHAVE=~/.ssh/blitz-proex.pem USUARIO=luiz infra/aws/baixar-backup.sh
set -euo pipefail
: "${EC2:?}"; : "${CHAVE:?}"; USUARIO=${USUARIO:-ubuntu}
ULTIMO=$(ssh -i "$CHAVE" "$USUARIO@$EC2" "ls -1t /var/backups/blitz/blitz-*.tar.gz | head -1")
mkdir -p backups-blitz
scp -i "$CHAVE" "$USUARIO@$EC2:$ULTIMO" backups-blitz/
ls -lh backups-blitz/
