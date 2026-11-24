#!/usr/bin/env bash
# Gera o build do Blitz NO COMPUTADOR do integrante e envia para a EC2 (R06).
# Uso (Git Bash):  EC2=IP_PUBLICO CHAVE=~/.ssh/blitz-proex.pem USUARIO=ubuntu infra/aws/implantar.sh
# O build é feito localmente para não gastar memória da instância (Maven e npm são pesados para 2 GB).
set -euo pipefail
: "${EC2:?informe EC2=IP_PUBLICO}"
: "${CHAVE:?informe CHAVE=caminho da chave privada .pem}"
USUARIO=${USUARIO:-ubuntu}
RAIZ=$(cd "$(dirname "$0")/../.." && pwd)
SAIDA=$(mktemp -d)

echo "== Build do back-end (jar)"
(cd "$RAIZ/backend" && ./mvnw -q -B -DskipTests package)
cp "$RAIZ"/backend/target/blitz-*.jar "$SAIDA/blitz.jar" 2>/dev/null || cp "$(ls "$RAIZ"/backend/target/*.jar | grep -v original | head -1)" "$SAIDA/blitz.jar"

echo "== Build do front (mesma origem: VITE_API_URL vazio via .env.aws)"
(cd "$RAIZ/frontend" && npx vite build --mode aws)
tar -czf "$SAIDA/front.tar.gz" -C "$RAIZ/frontend/dist" .

cp "$RAIZ"/infra/aws/{instalar.sh,nginx-blitz.conf,blitz.service} "$SAIDA/"
echo "   commit: $(git -C "$RAIZ" rev-parse --short HEAD)" | tee "$SAIDA/VERSAO"

echo "== Envio para a EC2 e instalação"
ssh -i "$CHAVE" "$USUARIO@$EC2" "rm -rf /tmp/blitz-deploy && mkdir -p /tmp/blitz-deploy"
scp -i "$CHAVE" "$SAIDA"/* "$USUARIO@$EC2:/tmp/blitz-deploy/"
ssh -i "$CHAVE" "$USUARIO@$EC2" "chmod +x /tmp/blitz-deploy/instalar.sh && sudo /tmp/blitz-deploy/instalar.sh"
rm -rf "$SAIDA"
echo "Acesse: http://$EC2/"
