#!/usr/bin/env bash
# Instala ou atualiza o Blitz numa EC2 Ubuntu LTS, testado no 26.04 (R06, R07, R08, R09).
# Roda NA EC2, com sudo, a partir da pasta enviada pelo implantar.sh (/tmp/blitz-deploy), que contém:
#   blitz.jar, front.tar.gz, nginx-blitz.conf, blitz.service
# Idempotente: pode rodar de novo a cada nova versão; não apaga dados do banco.
set -euo pipefail
cd "$(dirname "$0")"
[ "$(id -u)" -eq 0 ] || { echo "rode com sudo"; exit 1; }

echo "== 1. Pacotes (Java 21, PostgreSQL, Nginx)"
export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get install -y -q openjdk-21-jre-headless postgresql nginx curl

echo "== 2. Usuário de serviço sem login (a aplicação não roda como root)"
id blitz >/dev/null 2>&1 || useradd --system --home /opt/blitz --shell /usr/sbin/nologin blitz
install -d -o blitz -g blitz -m 750 /opt/blitz
install -d -o root -g blitz -m 750 /etc/blitz
install -d -o root -g root -m 755 /var/www/blitz

echo "== 3. Banco PostgreSQL local (só escuta em localhost, padrão do Ubuntu)"
if [ ! -f /etc/blitz/blitz.env ]; then
  SENHA_BANCO=$(openssl rand -hex 16)
  sudo -u postgres psql -v ON_ERROR_STOP=1 -q <<SQL
DO \$\$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'blitz') THEN CREATE ROLE blitz LOGIN PASSWORD '${SENHA_BANCO}';
  ELSE ALTER ROLE blitz PASSWORD '${SENHA_BANCO}'; END IF;
END \$\$;
SQL
  sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='blitz'" | grep -q 1 || sudo -u postgres createdb -O blitz blitz

  echo "== 4. Segredos em /etc/blitz/blitz.env (fora do repositório, chmod 640)"
  IP=$(curl -s --max-time 3 https://checkip.amazonaws.com || echo IP_PUBLICO)
  cat > /etc/blitz/blitz.env <<ENV
SERVER_ADDRESS=127.0.0.1
PORT=8080
DATABASE_URL=jdbc:postgresql://127.0.0.1:5432/blitz
DATABASE_USER=blitz
DATABASE_PASSWORD=${SENHA_BANCO}
FRONT_URL=
COOKIE_SAMESITE=strict
COOKIE_SECURE=false
APP_URL=http://${IP}
APP_SECRET=$(openssl rand -hex 32)
ADMIN_EMAIL=
GEMINI_API_KEY=
IA_PSEUDONIMO_SAL=$(openssl rand -hex 16)
ENV
  chown root:blitz /etc/blitz/blitz.env
  chmod 640 /etc/blitz/blitz.env
else
  echo "   /etc/blitz/blitz.env já existe: mantido (senha do banco e segredos preservados)"
fi

echo "== 5. Aplicação: jar do back-end e build do front"
install -o blitz -g blitz -m 640 blitz.jar /opt/blitz/blitz.jar
rm -rf /var/www/blitz/*
tar -xzf front.tar.gz -C /var/www/blitz
chown -R root:root /var/www/blitz
find /var/www/blitz -type d -exec chmod 755 {} \; && find /var/www/blitz -type f -exec chmod 644 {} \;

echo "== 6. Serviço systemd do back-end"
install -m 644 blitz.service /etc/systemd/system/blitz.service
systemctl daemon-reload
systemctl enable blitz
systemctl restart blitz

echo "== 7. Nginx: site próprio, sem o site padrão"
# Depois do ativar-https.sh o arquivo tem o bloco 443 do Certbot: não sobrescrever, senão o HTTPS some
if grep -q "managed by Certbot" /etc/nginx/sites-available/blitz 2>/dev/null; then
  echo "   site com HTTPS do Certbot: mantido"
else
  install -m 644 nginx-blitz.conf /etc/nginx/sites-available/blitz
fi
# Não divulga a versão do Nginx em nenhum site, inclusive no redirect da porta 80 (Ubuntu 26.04 traz "server_tokens build")
sed -i -E 's/^(\s*)#?\s*server_tokens .*/\1server_tokens off;/' /etc/nginx/nginx.conf
ln -sf /etc/nginx/sites-available/blitz /etc/nginx/sites-enabled/blitz
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl enable nginx
systemctl reload nginx || systemctl restart nginx

echo "== 8. Verificação local (o Spring leva uns segundos para subir)"
for i in $(seq 1 40); do
  if curl -fs http://127.0.0.1:8080/api/auth/saude >/dev/null; then echo "   API respondeu em ~$((i*3))s"; break; fi
  sleep 3
done
curl -s -o /dev/null -w "   Nginx /           -> HTTP %{http_code}\n" http://127.0.0.1/
curl -s -w "   Nginx /api saúde  -> %{http_code}  " http://127.0.0.1/api/auth/saude; echo
systemctl is-enabled nginx blitz postgresql
echo "Pronto."
