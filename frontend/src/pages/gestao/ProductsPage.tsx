import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Plus, MoreHorizontal, Search, Loader2 } from 'lucide-react'
import AppLayout from '../../components/shared/AppLayout/AppLayout'
import { gestaoMenuItems } from '../../config/gestaoMenu'
import { getProducts, updateProduct } from '../../services/products.service'

// ── Types ──

interface Product {
  id: string
  name: string
  description: string | null
  category: string | null
  price: string | number
  allowsDiscount: boolean
  maxDiscount: string | number | null
  approvalType: string | null
  isActive: boolean
  createdAt: string
}

// ── Helpers ──

function fmt(v: number) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 }) }

const menuOpts = ['Editar', 'Duplicar', 'Desativar']

const dd: React.CSSProperties = {
  background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8,
  padding: '0 28px 0 12px', fontSize: 13, color: 'var(--text-primary)', outline: 'none', height: 36,
  cursor: 'pointer', appearance: 'none',
  backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%236b7280' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center',
}

// ── Component ──

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [activeF, setActiveF] = useState('')
  const [openMenu, setOpenMenu] = useState<string | null>(null)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handleSearch = useCallback((value: string) => {
    setSearch(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setDebouncedSearch(value), 500)
  }, [])

  const loadProducts = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = {}
      if (debouncedSearch) params.search = debouncedSearch
      if (activeF) params.isActive = activeF
      const data = await getProducts(params)
      setProducts(data)
    } catch {
      setProducts([])
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, activeF])

  useEffect(() => { loadProducts() }, [loadProducts])

  async function handleDeactivate(id: string) {
    try {
      await updateProduct(id, { isActive: false })
      setOpenMenu(null)
      loadProducts()
    } catch { /* ignore */ }
  }

  const stats = useMemo(() => {
    const total = products.length
    const active = products.filter(p => p.isActive).length
    const withDiscount = products.filter(p => p.allowsDiscount && Number(p.maxDiscount) > 0).length
    const prices = products.filter(p => p.isActive).map(p => Number(p.price))
    const avgTicket = prices.length > 0 ? Math.round(prices.reduce((s, v) => s + v, 0) / prices.length) : 0
    return { total, active, withDiscount, avgTicket }
  }, [products])

  return (
    <AppLayout menuItems={gestaoMenuItems}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Produtos</h1>
        <button style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f97316', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          <Plus size={15} strokeWidth={2} /> Novo Produto
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', alignItems: 'center', fontSize: 13, marginBottom: 16 }}>
        <span style={{ color: 'var(--text-muted)' }}>Total</span><span style={{ color: 'var(--text-primary)', fontWeight: 700, marginLeft: 4 }}>{stats.total}</span>
        <span style={{ color: 'var(--border)', margin: '0 10px' }}>|</span>
        <span style={{ color: 'var(--text-muted)' }}>Ativos</span><span style={{ color: '#22c55e', fontWeight: 700, marginLeft: 4 }}>{stats.active}</span>
        <span style={{ color: 'var(--border)', margin: '0 10px' }}>|</span>
        <span style={{ color: 'var(--text-muted)' }}>Com desconto</span><span style={{ color: 'var(--text-primary)', fontWeight: 700, marginLeft: 4 }}>{stats.withDiscount}</span>
        <span style={{ color: 'var(--border)', margin: '0 10px' }}>|</span>
        <span style={{ color: 'var(--text-muted)' }}>Ticket médio</span><span style={{ color: 'var(--text-primary)', fontWeight: 700, marginLeft: 4 }}>{fmt(stats.avgTicket)}</span>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 260 }}>
          <Search size={15} color="var(--text-muted)" strokeWidth={1.5} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
          <input type="text" value={search} onChange={e => handleSearch(e.target.value)} placeholder="Buscar produto..."
            style={{ width: '100%', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '0 12px 0 34px', fontSize: 13, color: 'var(--text-primary)', outline: 'none', height: 36, boxSizing: 'border-box' }} />
        </div>
        <select value={activeF} onChange={e => setActiveF(e.target.value)} style={dd}>
          <option value="">Todos</option>
          <option value="true">Ativo</option>
          <option value="false">Inativo</option>
        </select>
      </div>

      {/* Loading */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 60, gap: 10 }}>
          <Loader2 size={22} color="#f97316" strokeWidth={1.5} className="animate-spin" />
          <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>Carregando produtos...</span>
        </div>
      ) : products.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)', fontSize: 14 }}>Nenhum produto cadastrado</div>
      ) : (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg)' }}>
                {['Produto', 'Valor', 'Desconto máx.', 'Aprovação', 'Status', 'Ações'].map(h => (
                  <th key={h} style={{ padding: '12px 20px', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600, textAlign: 'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {products.map(p => {
                const maxDisc = Number(p.maxDiscount) || 0
                return (
                  <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-elevated)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
                    <td style={{ padding: '14px 20px' }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{p.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.category ?? '—'}</div>
                    </td>
                    <td style={{ padding: '14px 20px', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{fmt(Number(p.price))}</td>
                    <td style={{ padding: '14px 20px' }}>
                      {maxDisc > 0 ? <span style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b', borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 500 }}>{maxDisc}%</span> : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      {p.approvalType === 'VALIDATION_QUEUE' || p.approvalType === 'BOTH' ? (
                        <span style={{ background: 'rgba(249,115,22,0.12)', color: '#f97316', borderRadius: 999, padding: '3px 10px', fontSize: 11, fontWeight: 500 }}>Gestor</span>
                      ) : p.allowsDiscount ? (
                        <span style={{ background: 'rgba(34,197,94,0.12)', color: '#22c55e', borderRadius: 999, padding: '3px 10px', fontSize: 11, fontWeight: 500 }}>Automática</span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <span style={{ background: p.isActive ? 'rgba(34,197,94,0.12)' : 'rgba(107,114,128,0.12)', color: p.isActive ? '#22c55e' : 'var(--text-muted)', borderRadius: 999, padding: '3px 10px', fontSize: 11, fontWeight: 500 }}>{p.isActive ? 'Ativo' : 'Inativo'}</span>
                    </td>
                    <td style={{ padding: '14px 20px', position: 'relative' }}>
                      <button onClick={() => setOpenMenu(openMenu === p.id ? null : p.id)}
                        style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border)', background: openMenu === p.id ? 'var(--border)' : 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                        <MoreHorizontal size={14} strokeWidth={1.5} />
                      </button>
                      {openMenu === p.id && (
                        <div style={{ position: 'absolute', right: 20, top: 48, zIndex: 20, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.4)', minWidth: 140, padding: '4px 0' }}>
                          {menuOpts.map(opt => (
                            <div key={opt}
                              onClick={() => {
                                if (opt === 'Desativar') handleDeactivate(p.id)
                                else setOpenMenu(null)
                              }}
                              style={{ padding: '8px 14px', fontSize: 13, color: opt === 'Desativar' ? '#ef4444' : 'var(--text-primary)', cursor: 'pointer' }}
                              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
                              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>{opt}</div>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </AppLayout>
  )
}
