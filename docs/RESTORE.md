# Procedimento de restore — TriboCRM

## Quando usar

- Incidente Supabase (perda de dados)
- Migration mal-feita (rollback necessário)
- Cliente apagou dados por engano (LGPD: avaliar caso a caso)

## Pré-requisitos no seu computador

- AWS CLI instalado: https://aws.amazon.com/cli/
- psql instalado (postgresql-client). No Ubuntu/Debian: `sudo apt install postgresql-client`. No macOS: `brew install postgresql` ou usar Postgres.app
- Acesso aos GitHub Secrets do repo `tribocrm` (R2_*) ou aos valores no Cloudflare R2

## Passo a passo

### 1. Configurar acesso ao R2 localmente

Pega os valores dos GitHub Secrets ou cria um novo token de API no Cloudflare R2 com permissão de leitura.

No terminal:

```bash
export AWS_ACCESS_KEY_ID="<R2_ACCESS_KEY_ID>"
export AWS_SECRET_ACCESS_KEY="<R2_SECRET_ACCESS_KEY>"
export AWS_DEFAULT_REGION="auto"
export R2_ENDPOINT="<URL https://[id].r2.cloudflarestorage.com>"
export R2_BUCKET="tribocrm-backups"
```

### 2. Listar backups disponíveis

```bash
aws s3 ls "s3://${R2_BUCKET}/" --endpoint-url "${R2_ENDPOINT}"
```

Você vai ver lista similar a:

```
2026-04-26 07:00:23     14523 backup-2026-04-26_0700.sql.gz
2026-04-25 07:00:18     14501 backup-2026-04-25_0700.sql.gz
```

### 3. Decidir destino do restore

**OPÇÃO A — Substituir banco atual (cuidado, dados existentes serão substituídos):**
Pega `DATABASE_URL` do Railway (variáveis do projeto `enthusiastic-peace`).

**OPÇÃO B — Criar projeto Supabase novo (mais seguro):**
1. Cria projeto novo no Supabase
2. Pega connection string do projeto novo (Settings → Database → Connection string)
3. Restaura no projeto novo
4. Atualiza `DATABASE_URL` no Railway pro novo projeto
5. Redeploy backend

### 4. Executar restore

```bash
cd <pasta do repo tribocrm>
./scripts/restore.sh backup-2026-04-26_0700.sql.gz "postgresql://..."
```

Script vai pedir confirmação. Digite `sim` pra prosseguir.

### 5. Validar dados restaurados

```bash
psql "<DATABASE_URL>" -c "SELECT count(*) FROM tenants;"
psql "<DATABASE_URL>" -c "SELECT count(*) FROM users;"
psql "<DATABASE_URL>" -c "SELECT count(*) FROM leads;"
```

Confere se os números batem com o esperado.

### 6. Atualizar Railway (somente se Opção B foi usada)

1. Railway → projeto `enthusiastic-peace` → backend → Variables
2. `DATABASE_URL` → atualiza com nova connection string
3. Aguarda redeploy automático (1-2 min)
4. Valida `https://api.tribocrm.com.br/health` → 200

## Frequência recomendada de teste

Testar restore a cada **3 meses** em projeto Supabase de teste (criar e descartar após validar).
Backup que nunca foi testado é backup que talvez não funcione.

## Estrutura dos backups

- **Nome:** `backup-YYYY-MM-DD_HHMM.sql.gz`
- **Frequência:** 1x por dia às 04h BRT (07h UTC)
- **Retenção:** 30 dias (rotação automática)
- **Storage:** Cloudflare R2 bucket `tribocrm-backups`

## Disparar backup manual

GitHub → repo `tribocrm` → aba **Actions** → workflow **"Database backup to R2"** → botão **"Run workflow"** → branch `main` → **Run workflow**.

Útil pra testar antes do horário programado ou pra fazer backup pontual antes de migration arriscada.
