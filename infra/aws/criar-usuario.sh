#!/usr/bin/env bash
# Cria um usuário Linux individual com acesso SSH por chave (R05). Roda NA EC2 com sudo.
# Uso: sudo ./criar-usuario.sh vinicius "ssh-ed25519 AAAA... vinicius@notebook" [admin]
# A chave PRIVADA fica só no computador do integrante; aqui entra apenas a chave pública.
set -euo pipefail
[ "$(id -u)" -eq 0 ] || { echo "rode com sudo"; exit 1; }
NOME=${1:?nome}; CHAVE=${2:?chave pública}; PAPEL=${3:-}
id "$NOME" >/dev/null 2>&1 || adduser --disabled-password --gecos "" "$NOME"
install -d -o "$NOME" -g "$NOME" -m 700 "/home/$NOME/.ssh"
echo "$CHAVE" > "/home/$NOME/.ssh/authorized_keys"
chown "$NOME:$NOME" "/home/$NOME/.ssh/authorized_keys" && chmod 600 "/home/$NOME/.ssh/authorized_keys"
usermod -aG adm "$NOME"                        # lê logs do Nginx e os backups
[ "$PAPEL" = admin ] && usermod -aG sudo "$NOME" && echo "$NOME ALL=(ALL) NOPASSWD:ALL" > "/etc/sudoers.d/90-$NOME" && chmod 440 "/etc/sudoers.d/90-$NOME"
id "$NOME"
