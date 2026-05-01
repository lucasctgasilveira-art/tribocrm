-- Adiciona campos pra agendamento de mensagens WhatsApp via Tarefa.
-- Quando type='WHATSAPP' + dueDate definido + (whatsappTemplateId OU whatsappMessageBody)
-- → backend marca send_status='PENDING' e a extensão Chrome (scheduler)
-- envia a mensagem no horário agendado pelo WhatsApp Web do vendedor.
--
-- Todas colunas NULLABLE: tarefas existentes (sem WhatsApp ou sem agendamento)
-- continuam funcionando exatamente igual. send_status=NULL significa "tarefa-
-- lembrete normal" — scheduler ignora.
--
-- Migration extra-defensiva: IF NOT EXISTS em cada coluna. Idempotente:
-- pode rodar 2x sem efeito colateral. Rollback: DROP COLUMN nas 6 colunas
-- (todas adicionadas aqui, sem dependência externa).

ALTER TABLE "tasks"
  ADD COLUMN IF NOT EXISTS "whatsapp_template_id" UUID,
  ADD COLUMN IF NOT EXISTS "whatsapp_message_body" TEXT,
  ADD COLUMN IF NOT EXISTS "send_status" VARCHAR(20),
  ADD COLUMN IF NOT EXISTS "sent_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "send_error" TEXT,
  ADD COLUMN IF NOT EXISTS "reminder_minutes" INTEGER;

-- FK pra whatsapp_templates pra que template deletado nao quebre
-- a tarefa (SET NULL preserva a tarefa, mensagem ja foi expandida
-- e gravada em whatsapp_message_body no momento do agendamento).
-- Bloco defensivo: Postgres nao tem "ADD CONSTRAINT IF NOT EXISTS",
-- entao checamos pg_constraint antes de adicionar.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tasks_whatsapp_template_id_fkey'
  ) THEN
    ALTER TABLE "tasks"
      ADD CONSTRAINT "tasks_whatsapp_template_id_fkey"
      FOREIGN KEY ("whatsapp_template_id") REFERENCES "whatsapp_templates"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Indice pra fila de envio (scheduler busca tarefas com send_status='PENDING'
-- cuja due_date ja passou). Composite cobre o uso predominante.
CREATE INDEX IF NOT EXISTS "tasks_send_status_due_date_idx"
  ON "tasks"("send_status", "due_date")
  WHERE "send_status" IS NOT NULL;
