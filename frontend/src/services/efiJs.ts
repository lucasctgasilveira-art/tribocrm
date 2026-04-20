// Wrapper pra integração com Efi.js (tokenização PCI-DSS compliant).
// O script é carregado dinamicamente pra não bloquear o boot da app.

const PAYEE_CODE = import.meta.env.VITE_EFI_PAYEE_CODE
const SANDBOX = String(import.meta.env.VITE_EFI_SANDBOX ?? 'false').toLowerCase() === 'true'

interface CardTokenInput {
  number: string
  cvv: string
  expMonth: string
  expYear: string
}

interface CardTokenResult {
  token: string
  lastFour: string
  brand: string
}

let loadPromise: Promise<void> | null = null

declare global {
  interface Window {
    $gn?: any
  }
}

export async function loadEfiJs(): Promise<void> {
  if (loadPromise) return loadPromise

  if (!PAYEE_CODE) {
    throw new Error('VITE_EFI_PAYEE_CODE nao configurado')
  }

  loadPromise = new Promise<void>((resolve, reject) => {
    if (typeof window.$gn !== 'undefined' && window.$gn.ready) {
      window.$gn.ready(() => resolve())
      return
    }

    const varName = `gn_${Math.random().toString(36).slice(2)}`

    ;(window as any)[varName] = {
      validForm: true,
      processed: false,
      done: {},
      ready: (fn: any) => {
        ;(window as any)[varName].done = fn
      },
    }

    window.$gn = (window as any)[varName]

    const script = document.createElement('script')
    script.async = false
    script.onerror = () => reject(new Error('Falha ao carregar Efi.js'))

    const host = SANDBOX ? 'sandbox.gerencianet.com.br' : 'api.gerencianet.com.br'
    const randomSegment = Math.random().toString(36).slice(2)
    script.src = `https://${host}/v1/cdn/${PAYEE_CODE}/${randomSegment}`

    document.head.appendChild(script)

    window.$gn.ready = (fn: any) => {
      fn(window.$gn.checkout)
      resolve()
    }
  })

  return loadPromise
}

export async function getCardToken(input: CardTokenInput): Promise<CardTokenResult> {
  await loadEfiJs()

  if (!window.$gn?.checkout?.getPaymentToken) {
    throw new Error('Efi.js nao inicializou corretamente')
  }

  return new Promise<CardTokenResult>((resolve, reject) => {
    window.$gn.checkout.getPaymentToken(
      {
        brand: '',
        number: input.number,
        cvv: input.cvv,
        expiration_month: input.expMonth,
        expiration_year: input.expYear,
      },
      (error: any, response: any) => {
        if (error) {
          reject(new Error(error?.error_description ?? error?.message ?? 'Erro ao tokenizar cartao'))
          return
        }

        const token = response?.data?.payment_token ?? response?.payment_token
        const cardMask = response?.data?.card_mask ?? response?.card_mask ?? ''
        const brand = response?.data?.card_brand ?? response?.card_brand ?? ''
        const lastFour = cardMask.slice(-4)

        if (!token) {
          reject(new Error('Efi nao retornou payment_token'))
          return
        }

        resolve({ token, lastFour, brand })
      },
    )
  })
}

export async function detectBrand(number: string): Promise<string> {
  await loadEfiJs()

  if (!window.$gn?.checkout?.getBrand) return ''

  return new Promise<string>((resolve) => {
    window.$gn.checkout.getBrand(number, (error: any, brand: any) => {
      if (error) { resolve(''); return }
      resolve(String(brand ?? ''))
    })
  })
}
