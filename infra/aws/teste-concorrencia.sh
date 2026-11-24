#!/usr/bin/env bash
# Teste leve de acesso simultâneo (R13): 5 requisições sobrepostas a páginas e endpoints só de leitura.
# Roda NO COMPUTADOR do integrante.  Uso: URL=http://IP_OU_DOMINIO infra/aws/teste-concorrencia.sh
set -u
: "${URL:?informe URL=http://IP_OU_DOMINIO}"
echo "Início: $(date '+%H:%M:%S')"
for caminho in / /api/auth/saude / /api/auth/saude /; do
  curl --max-time 10 -s -o /dev/null -w "GET ${caminho} -> HTTP %{http_code} em %{time_total}s\n" "${URL}${caminho}" &
done
wait
echo "Fim: $(date '+%H:%M:%S')"
echo "Na EC2, conferir as 5 linhas no log:  sudo tail -n 10 /var/log/nginx/access.log"
