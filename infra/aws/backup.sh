#!/usr/bin/env bash
# Backup do Blitz (R12). Roda NA EC2 com sudo e gera /var/backups/blitz/blitz-AAAAMMDD-HHMM.tar.gz com:
#   - dump do banco (pg_dump formato custom, consistente mesmo com a aplicação no ar)
#   - configuração do Nginx, unidade systemd e versão da aplicação
# O blitz.env (segredos) NÃO entra no pacote compartilhável: é copiado à parte, só para o administrador.
# Depois, no computador do integrante, baixar com o baixar-backup.sh (cópia fora da EC2).
set -euo pipefail
[ "$(id -u)" -eq 0 ] || { echo "rode com sudo"; exit 1; }
DATA=$(date +%Y%m%d-%H%M)
TMP=$(mktemp -d)
install -d -m 750 -g adm /var/backups/blitz   # grupo adm (administradores) pode listar e baixar; .SEGREDO continua 600

sudo -u postgres pg_dump -Fc blitz > "$TMP/blitz-banco.dump"
cp /etc/nginx/sites-available/blitz "$TMP/nginx-blitz.conf"
cp /etc/systemd/system/blitz.service "$TMP/blitz.service"
cat > "$TMP/LEIA-ME.txt" <<TXT
Backup do Blitz gerado em $(date '+%d/%m/%Y %H:%M') na instância $(hostname).
Origem dos arquivos:
  blitz-banco.dump  -> banco PostgreSQL "blitz" (pg_dump -Fc)
  nginx-blitz.conf  -> /etc/nginx/sites-available/blitz
  blitz.service     -> /etc/systemd/system/blitz.service
Restaurar o banco: sudo -u postgres pg_restore --clean --if-exists -d blitz blitz-banco.dump
Reinstalar a aplicação: infra/aws/implantar.sh (repositório luizmarinello/blitz)
TXT

tar -czf "/var/backups/blitz/blitz-$DATA.tar.gz" -C "$TMP" .
install -m 600 /etc/blitz/blitz.env "/var/backups/blitz/blitz-env-$DATA.SEGREDO"   # só root lê
rm -rf "$TMP"
# pacote legível pelo grupo adm para poder ser baixado por scp sem expor o .env
chgrp adm "/var/backups/blitz/blitz-$DATA.tar.gz" && chmod 640 "/var/backups/blitz/blitz-$DATA.tar.gz"
ls -lh /var/backups/blitz/
