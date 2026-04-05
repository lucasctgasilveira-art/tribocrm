import dotenv from 'dotenv'
dotenv.config()

import { registerPixWebhook } from '../services/efi.service'

async function main() {
  console.log('[Setup] Registrando webhook PIX no Banco Efi...')

  try {
    const result = await registerPixWebhook()
    console.log('[Setup] Webhook registrado com sucesso!')
    console.log('[Setup] URL:', result.url)
  } catch (error) {
    console.error('[Setup] Erro ao registrar webhook:', error)
    process.exit(1)
  }

  process.exit(0)
}

main()
