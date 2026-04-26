#!/bin/bash
# Script auxiliar pra restaurar backup do R2
# Uso: ./scripts/restore.sh <nome-do-backup.sql.gz> <DB_URL_DESTINO>

set -e

BACKUP_FILE="${1}"
DB_URL="${2}"

if [ -z "$BACKUP_FILE" ] || [ -z "$DB_URL" ]; then
  echo "Uso: $0 <nome-do-backup.sql.gz> <postgresql://...>"
  echo ""
  echo "Exemplo:"
  echo "  $0 backup-2026-04-26_0700.sql.gz postgresql://postgres:senha@host:5432/postgres"
  echo ""
  echo "ATENCAO: o restore APAGA dados atuais e substitui pelo backup."
  exit 1
fi

# Valida ferramentas
command -v aws >/dev/null || { echo "AWS CLI nao instalado. Veja docs/RESTORE.md"; exit 1; }
command -v psql >/dev/null || { echo "psql nao instalado. Veja docs/RESTORE.md"; exit 1; }

# Valida envs do R2
if [ -z "$R2_BUCKET" ] || [ -z "$R2_ENDPOINT" ]; then
  echo "Variaveis R2_BUCKET e R2_ENDPOINT precisam estar exportadas."
  echo "Veja docs/RESTORE.md passo 1."
  exit 1
fi

echo "Baixando ${BACKUP_FILE} do R2..."
aws s3 cp "s3://${R2_BUCKET}/${BACKUP_FILE}" . \
  --endpoint-url "${R2_ENDPOINT}"

echo "Descomprimindo..."
gunzip -k "${BACKUP_FILE}"
SQL_FILE="${BACKUP_FILE%.gz}"

echo ""
echo "AVISO: Vai restaurar ${SQL_FILE} em ${DB_URL}"
echo "Isso APAGA os dados atuais. Tem certeza? (digite 'sim' pra continuar)"
read CONFIRM
if [ "$CONFIRM" != "sim" ]; then
  echo "Cancelado."
  rm "${SQL_FILE}"
  exit 0
fi

echo "Restaurando..."
psql "${DB_URL}" < "${SQL_FILE}"

echo "Limpando arquivo local..."
rm "${SQL_FILE}"

echo "Restore concluido."
