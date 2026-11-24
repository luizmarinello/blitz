#!/usr/bin/env bash
# Ativa HTTPS com Let's Encrypt (R09). Roda NA EC2 com sudo, DEPOIS de liberar a porta 443 no Security Group.
# Uso: sudo ./ativar-https.sh 18-225-117-192.sslip.io   (sslip.io: nome DNS gratuito que aponta para o próprio IP)
# Sem e-mail no cadastro do Let's Encrypt (minimização de dados, LGPD). A renovação é automática (certbot.timer).
set -euo pipefail
[ "$(id -u)" -eq 0 ] || { echo "rode com sudo"; exit 1; }
D=${1:?informe o domínio, ex.: 18-225-117-192.sslip.io}

apt-get install -y -q certbot python3-certbot-nginx
sed -i "s/server_name .*;/server_name $D;/" /etc/nginx/sites-available/blitz
nginx -t && systemctl reload nginx

# --redirect: o Certbot cria o bloco 443 e manda todo acesso HTTP para HTTPS
certbot --nginx -d "$D" --non-interactive --agree-tos --register-unsafely-without-email --redirect

# Com HTTPS o cookie de sessão passa a ser Secure; links de e-mail usam o domínio
sed -i -e 's/^COOKIE_SECURE=.*/COOKIE_SECURE=true/' -e "s#^APP_URL=.*#APP_URL=https://$D#" /etc/blitz/blitz.env
systemctl restart blitz

certbot renew --dry-run
systemctl list-timers certbot.timer --no-pager
echo "Acesse: https://$D/"
