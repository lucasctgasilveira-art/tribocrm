import type {
  Lead,
  Interaction,
  WhatsAppTemplate,
  Stage,
  User
} from '@shared/types/domain';

/**
 * Dados fake usados enquanto o backend não está pronto.
 * Os números de telefone seguem o formato E.164 sem o '+'.
 */

const USER_VENDEDOR: User = {
  id: 'user-vendedor-1',
  name: 'Pedro Gomes',
  email: 'pedro@triboclientedemo.com'
};

const STAGE_CONTATO: Stage = {
  id: 'stage-contato',
  name: 'Em Contato',
  type: 'NORMAL',
  color: '#3b82f6'
};

const STAGE_PROPOSTA: Stage = {
  id: 'stage-proposta',
  name: 'Proposta Enviada',
  type: 'NORMAL',
  color: '#f59e0b'
};

const STAGE_NEGOCIANDO: Stage = {
  id: 'stage-negociando',
  name: 'Negociando',
  type: 'NORMAL',
  color: '#f97316'
};

export const MOCK_STAGES: Stage[] = [
  STAGE_CONTATO,
  STAGE_PROPOSTA,
  STAGE_NEGOCIANDO,
  { id: 'stage-won', name: 'Venda Realizada', type: 'WON', color: '#22c55e' },
  { id: 'stage-lost', name: 'Perdido', type: 'LOST', color: '#ef4444' }
];

export const MOCK_LEADS: Lead[] = [
  {
    id: 'lead-1',
    name: 'Rafael Mendes',
    company: 'MendesNet',
    email: 'rafael@mendesnet.com',
    phone: '5521912345678',
    whatsapp: '5521912345678',
    position: 'Diretor de TI',
    source: 'LinkedIn',
    temperature: 'HOT',
    expectedValue: 15000,
    closedValue: null,
    status: 'ACTIVE',
    notes: 'Interessado no plano Pro. Pediu proposta até sexta.',
    stage: STAGE_PROPOSTA,
    pipeline: { id: 'pipe-1', name: 'Pipeline Principal' },
    responsible: USER_VENDEDOR,
    createdAt: '2026-04-10T09:00:00Z',
    updatedAt: '2026-04-18T14:30:00Z'
  },
  {
    id: 'lead-2',
    name: 'Camila Torres',
    company: 'Torres & Filhos',
    email: 'camila@torresfilhos.com',
    phone: '5511987654321',
    whatsapp: '5511987654321',
    position: 'Diretora Comercial',
    source: 'Indicação',
    temperature: 'WARM',
    expectedValue: 8500,
    closedValue: null,
    status: 'ACTIVE',
    notes: null,
    stage: STAGE_CONTATO,
    pipeline: { id: 'pipe-1', name: 'Pipeline Principal' },
    responsible: USER_VENDEDOR,
    createdAt: '2026-04-15T11:00:00Z',
    updatedAt: '2026-04-15T11:00:00Z'
  }
];

export const MOCK_INTERACTIONS: Interaction[] = [
  {
    id: 'int-1',
    leadId: 'lead-1',
    type: 'WHATSAPP',
    description: 'Primeiro contato — lead respondeu em 15min, interessado.',
    user: USER_VENDEDOR,
    createdAt: '2026-04-10T09:15:00Z'
  },
  {
    id: 'int-2',
    leadId: 'lead-1',
    type: 'CALL',
    description: 'Ligação de 22 min. Apresentei os planos Pro e Enterprise.',
    user: USER_VENDEDOR,
    createdAt: '2026-04-12T15:30:00Z'
  },
  {
    id: 'int-3',
    leadId: 'lead-1',
    type: 'EMAIL',
    description: 'Enviei proposta comercial com desconto de 10% no anual.',
    user: USER_VENDEDOR,
    createdAt: '2026-04-18T14:30:00Z'
  }
];

export const MOCK_TEMPLATES: WhatsAppTemplate[] = [
  {
    id: 'tpl-1',
    name: 'Primeiro Contato',
    body: 'Oi {{primeiro_nome}}! 👋 Passando para apresentar nossa solução — podemos conversar?'
  },
  {
    id: 'tpl-2',
    name: 'Follow-up 3 dias',
    body: 'Oi {{primeiro_nome}}, tudo bem? Passando para ver se ficou alguma dúvida sobre a proposta de {{valor}} que enviei para a {{empresa}}. Posso te ligar em um horário melhor?'
  },
  {
    id: 'tpl-3',
    name: 'Reativação',
    body: 'Olá {{primeiro_nome}}, faz um tempo que a gente não conversa! Como estão as coisas por aí? Quero saber se ainda faz sentido retomar nossa conversa sobre {{produto}}.'
  }
];
