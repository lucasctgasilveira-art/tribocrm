/**
 * Replace template variables in text with actual values.
 * Supports {{primeiro_nome}} which extracts the first word from the lead name.
 */
export function replaceTemplateVars(
  text: string,
  vars: {
    nome_lead?: string
    empresa_lead?: string
    nome_vendedor?: string
    nome_produto?: string
    valor_produto?: string
    data_hoje?: string
  },
): string {
  let result = text

  // {{primeiro_nome}} — first word of lead name
  if (vars.nome_lead) {
    const primeiroNome = vars.nome_lead.split(' ')[0] ?? vars.nome_lead
    result = result.replace(/\{\{primeiro_nome\}\}/g, primeiroNome)
  }

  if (vars.nome_lead) result = result.replace(/\{\{nome_lead\}\}/g, vars.nome_lead)
  if (vars.empresa_lead) result = result.replace(/\{\{empresa_lead\}\}/g, vars.empresa_lead)
  if (vars.nome_vendedor) result = result.replace(/\{\{nome_vendedor\}\}/g, vars.nome_vendedor)
  if (vars.nome_produto) result = result.replace(/\{\{nome_produto\}\}/g, vars.nome_produto)
  if (vars.valor_produto) result = result.replace(/\{\{valor_produto\}\}/g, vars.valor_produto)

  const dataHoje = vars.data_hoje ?? new Date().toLocaleDateString('pt-BR')
  result = result.replace(/\{\{data_hoje\}\}/g, dataHoje)

  return result
}
