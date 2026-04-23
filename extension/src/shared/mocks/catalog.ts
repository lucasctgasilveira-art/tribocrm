import type { Product } from '@shared/types/extra';

export const CATALOG_PRODUCTS: Product[] = [
  { id: 'plan-solo', name: 'Plano Solo', defaultPrice: 69 },
  { id: 'plan-essencial', name: 'Plano Essencial', defaultPrice: 197 },
  { id: 'plan-pro', name: 'Plano Pro', defaultPrice: 349 },
  { id: 'plan-enterprise', name: 'Plano Enterprise', defaultPrice: 649 },
  { id: 'svc-onboarding', name: 'Onboarding assistido', defaultPrice: 1500 },
  { id: 'svc-consultoria', name: 'Consultoria de vendas', defaultPrice: 500 }
];
