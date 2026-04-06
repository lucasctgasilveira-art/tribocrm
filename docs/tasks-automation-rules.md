# Tasks Automation Rules

## Automatic Execution

Tasks of type **E-mail** and **WhatsApp** are executed automatically at the scheduled time (`dueDate` + `dueTime`).

### E-mail Tasks
- The system sends the email via the user's connected Gmail account at the scheduled time.
- Uses the selected email template, or the custom message if "Personalizado" was chosen.
- Recipient: the lead's email address.

### WhatsApp Tasks
- The system sends the WhatsApp message via the user's connected WhatsApp Web session.
- Uses the selected WhatsApp template, or the custom message if "Personalizado" was chosen.
- Recipient: the lead's phone/WhatsApp number.

### Meeting / Visit Tasks
- If Google Calendar is connected, an event is created automatically with the task title, date, and time.
- A reminder is set based on the "Notificar com antecedencia" setting.

---

## Failure Handling

### WhatsApp Task Fails (disconnected)

When a WhatsApp message cannot be sent (e.g., WhatsApp Web is disconnected):

1. Task status is set to `FAILED`.
2. A notification is created for the user:
   - **Title:** "Falha ao enviar WhatsApp"
   - **Body:** "Nao foi possivel enviar o WhatsApp para [Lead Name]. Reconecte o WhatsApp Web e clique em reenviar."
   - **Type:** `WHATSAPP_FAILED`
3. The notification appears in:
   - The bell icon dropdown (Topbar)
   - The task card itself (with a red "Erro" badge)
4. A **"Reenviar"** button is displayed on the task card and in the notification.

### E-mail Task Fails (Gmail disconnected)

When an email cannot be sent (e.g., Gmail OAuth token expired or disconnected):

1. Task status is set to `FAILED`.
2. A notification is created for the user:
   - **Title:** "Falha ao enviar e-mail"
   - **Body:** "Nao foi possivel enviar o e-mail para [Lead Name]. Reconecte seu Gmail nas configuracoes e clique em reenviar."
   - **Type:** `EMAIL_FAILED`
3. The notification appears in:
   - The bell icon dropdown (Topbar)
   - The task card itself (with a red "Erro" badge)
4. A **"Reenviar"** button is displayed on the task card and in the notification.

---

## Resend Flow

When the user clicks "Reenviar":

### On Success
- Task status changes from `FAILED` to `DONE`.
- `doneAt` is set to the current timestamp.
- The task card shows a green "Executada" badge with the timestamp.
- A success notification is shown: "Mensagem reenviada com sucesso para [Lead Name]."

### On Error
- Task status remains `FAILED`, with updated error description.
- The task card shows a red "Erro" badge with the error description.
- A new notification is created with the error details.

---

## Reminder Notifications

Based on the "Notificar com antecedencia" setting selected during task creation:

| Setting | Notification timing |
|---------|-------------------|
| 0 min | No advance notification |
| 5 min | 5 minutes before dueDate+dueTime |
| 15 min | 15 minutes before |
| 30 min | 30 minutes before |
| 1 hora | 1 hour before |
| 1 dia | 24 hours before |

Reminder notifications appear in the bell icon and can be configured per-user in Settings > Preferences > Notifications.

---

## Role-based Assignment

| Role | Responsavel field behavior |
|------|---------------------------|
| SELLER | Hidden; always assigned to self |
| TEAM_LEADER | Shows only their team members |
| MANAGER / OWNER | Shows all users in the tenant |
