import { useState } from 'react'
import { Plus, MoreHorizontal } from 'lucide-react'
import AppLayout from '../../components/shared/AppLayout/AppLayout'
import { gestaoMenuItems } from '../../config/gestaoMenu'

interface Product {
  id: string; name: string; category: string; value: number; maxDiscount: number
  approval: 'auto' | 'manager' | 'none'; active: boolean
}

const products: Product[] = [
  { id: '1', name: 'Consultoria Premium', category: 'Serviços', value: 5000, maxDiscount: 10, approval: 'auto', active: true },
  { id: '2', name: 'Treinamento Equipe', category: 'Treinamentos', value: 3500, maxDiscount: 15, approval: 'manager', active: true },
  { id: '3', name: 'Plano Pro — Anual', category: 'Assinaturas', value: 12000, maxDiscount: 20, approval: 'manager', active: true },
  { id: '4', name: 'Plano Enterprise — Anual', category: 'Assinaturas', value: 28000, maxDiscount: 15, approval: 'manager', active: true },
  { id: '5', name: 'Consultoria Express', category: 'Serviços', value: 1500, maxDiscount: 5, approval: 'auto', active: true },
  { id: '6', name: 'Implementação Completa', category: 'Serviços', value: 8500, maxDiscount: 10, approval: 'manager', active: true },
  { id: '7', name: 'Suporte Mensal', category: 'Suporte', value: 890, maxDiscount: 0, approval: 'none', active: false },
  { id: '8', name: 'Licença Adicional', category: 'Licenças', value: 350, maxDiscount: 5, approval: 'auto', active: false },
]

function fmt(v: number) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 }) }
const menuOpts = ['Editar', 'Duplicar', 'Desativar']

export default function ProductsPage() {
  const [openMenu, setOpenMenu] = useState<string | null>(null)

  return (
    <AppLayout menuItems={gestaoMenuItems}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#e8eaf0', margin: 0 }}>Produtos</h1>
        <button style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f97316', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          <Plus size={15} strokeWidth={2} /> Novo Produto
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', fontSize: 13, marginBottom: 16 }}>
        <span style={{ color: '#6b7280' }}>Total</span><span style={{ color: '#e8eaf0', fontWeight: 700, marginLeft: 4 }}>8</span>
        <span style={{ color: '#22283a', margin: '0 10px' }}>|</span>
        <span style={{ color: '#6b7280' }}>Ativos</span><span style={{ color: '#22c55e', fontWeight: 700, marginLeft: 4 }}>6</span>
        <span style={{ color: '#22283a', margin: '0 10px' }}>|</span>
        <span style={{ color: '#6b7280' }}>Com desconto</span><span style={{ color: '#e8eaf0', fontWeight: 700, marginLeft: 4 }}>4</span>
        <span style={{ color: '#22283a', margin: '0 10px' }}>|</span>
        <span style={{ color: '#6b7280' }}>Ticket médio</span><span style={{ color: '#e8eaf0', fontWeight: 700, marginLeft: 4 }}>R$ 12.750</span>
      </div>

      <div style={{ background: '#161a22', border: '1px solid #22283a', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#0f1117' }}>
              {['Produto', 'Valor', 'Desconto máx.', 'Aprovação', 'Status', 'Ações'].map(h => (
                <th key={h} style={{ padding: '12px 20px', fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600, textAlign: 'left' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {products.map(p => (
              <tr key={p.id} style={{ borderBottom: '1px solid #22283a' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#1c2130' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
                <td style={{ padding: '14px 20px' }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#e8eaf0' }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>{p.category}</div>
                </td>
                <td style={{ padding: '14px 20px', fontSize: 13, fontWeight: 700, color: '#e8eaf0' }}>{fmt(p.value)}</td>
                <td style={{ padding: '14px 20px' }}>
                  {p.maxDiscount > 0 ? <span style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b', borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 500 }}>{p.maxDiscount}%</span> : <span style={{ color: '#6b7280' }}>—</span>}
                </td>
                <td style={{ padding: '14px 20px' }}>
                  {p.approval === 'auto' && <span style={{ background: 'rgba(34,197,94,0.12)', color: '#22c55e', borderRadius: 999, padding: '3px 10px', fontSize: 11, fontWeight: 500 }}>Automática</span>}
                  {p.approval === 'manager' && <span style={{ background: 'rgba(249,115,22,0.12)', color: '#f97316', borderRadius: 999, padding: '3px 10px', fontSize: 11, fontWeight: 500 }}>Gestor</span>}
                  {p.approval === 'none' && <span style={{ color: '#6b7280' }}>—</span>}
                </td>
                <td style={{ padding: '14px 20px' }}>
                  <span style={{ background: p.active ? 'rgba(34,197,94,0.12)' : 'rgba(107,114,128,0.12)', color: p.active ? '#22c55e' : '#6b7280', borderRadius: 999, padding: '3px 10px', fontSize: 11, fontWeight: 500 }}>{p.active ? 'Ativo' : 'Inativo'}</span>
                </td>
                <td style={{ padding: '14px 20px', position: 'relative' }}>
                  <button onClick={() => setOpenMenu(openMenu === p.id ? null : p.id)}
                    style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #22283a', background: openMenu === p.id ? '#22283a' : 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>
                    <MoreHorizontal size={14} strokeWidth={1.5} />
                  </button>
                  {openMenu === p.id && (
                    <div style={{ position: 'absolute', right: 20, top: 48, zIndex: 20, background: '#161a22', border: '1px solid #22283a', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.4)', minWidth: 140, padding: '4px 0' }}>
                      {menuOpts.map(opt => (
                        <div key={opt} onClick={() => setOpenMenu(null)} style={{ padding: '8px 14px', fontSize: 13, color: opt === 'Desativar' ? '#ef4444' : '#e8eaf0', cursor: 'pointer' }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>{opt}</div>
                      ))}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppLayout>
  )
}
