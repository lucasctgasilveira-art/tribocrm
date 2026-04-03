import { useState } from 'react'
import AppLayout from '../../components/shared/AppLayout/AppLayout'
import { gestaoMenuItems } from '../../config/gestaoMenu'

interface UserPerm {
  initials: string; name: string; role: string; active: boolean
  perms: Record<string, 'on' | 'custom' | 'off'>
}

const permGroups = [
  { label: 'Leads', keys: ['Ver todos os leads', 'Exportar leads', 'Importar leads', 'Editar lead de outro vendedor'] },
  { label: 'Pipeline', keys: ['Mover leads entre etapas', 'Criar novos leads', 'Arquivar leads'] },
  { label: 'Relatórios', keys: ['Ver relatórios da equipe', 'Exportar relatórios'] },
]

const allKeys = permGroups.flatMap(g => g.keys)

const usersPerms: UserPerm[] = [
  { initials: 'AS', name: 'Ana Souza', role: 'Vendedora', active: true, perms: Object.fromEntries(allKeys.map(k => [k, ['Ver todos os leads', 'Mover leads entre etapas', 'Criar novos leads'].includes(k) ? 'on' : 'off'])) },
  { initials: 'PG', name: 'Pedro Gomes', role: 'Vendedor', active: true, perms: Object.fromEntries(allKeys.map(k => [k, ['Ver todos os leads', 'Mover leads entre etapas', 'Criar novos leads'].includes(k) ? 'on' : 'off'])) },
  { initials: 'LC', name: 'Lucas Castro', role: 'Vendedor', active: true, perms: Object.fromEntries(allKeys.map(k => [k, ['Ver todos os leads', 'Mover leads entre etapas', 'Criar novos leads'].includes(k) ? 'on' : 'off'])) },
  { initials: 'MR', name: 'Mariana Reis', role: 'Líder', active: true, perms: Object.fromEntries(allKeys.map(k => [k, ['Exportar leads', 'Importar leads', 'Editar lead de outro vendedor'].includes(k) ? 'off' : k === 'Ver todos os leads' ? 'custom' : ['Mover leads entre etapas', 'Criar novos leads'].includes(k) ? 'on' : 'custom'])) },
  { initials: 'TB', name: 'Thiago Bastos', role: 'Vendedor', active: false, perms: Object.fromEntries(allKeys.map(k => [k, 'off'])) },
]

// Fix MR overrides
usersPerms[3]!.perms['Exportar leads'] = 'custom'
usersPerms[3]!.perms['Editar lead de outro vendedor'] = 'custom'
usersPerms[3]!.perms['Arquivar leads'] = 'custom'
usersPerms[3]!.perms['Ver relatórios da equipe'] = 'custom'
usersPerms[3]!.perms['Exportar relatórios'] = 'custom'

export default function PermissionsPage() {
  const [perms, setPerms] = useState(usersPerms)

  function toggle(userIdx: number, key: string) {
    setPerms(prev => prev.map((u, i) => {
      if (i !== userIdx || !u.active) return u
      const current = u.perms[key] ?? 'off'
      const next = current === 'off' ? 'on' : 'off'
      return { ...u, perms: { ...u.perms, [key]: next } }
    }))
  }

  return (
    <AppLayout menuItems={gestaoMenuItems}>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#e8eaf0', margin: 0 }}>Permissões</h1>
        <p style={{ fontSize: 14, color: '#6b7280', marginTop: 4 }}>Configure as permissões individuais de cada usuário</p>
      </div>

      {/* Info card */}
      <div style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 8, padding: '12px 16px', fontSize: 13, color: '#3b82f6', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span>ℹ️</span>
        <span>Permissões em <strong style={{ color: '#f97316' }}>laranja</strong> são padrão do perfil. Permissões em <strong style={{ color: '#a855f7' }}>roxo</strong> foram customizadas individualmente.</span>
      </div>

      {/* Table */}
      <div style={{ background: '#161a22', border: '1px solid #22283a', borderRadius: 12, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
          <thead>
            <tr style={{ background: '#0f1117' }}>
              <th style={{ width: 220, padding: '12px 16px', fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600, textAlign: 'left', position: 'sticky', left: 0, background: '#0f1117', zIndex: 2 }}>Permissão</th>
              {perms.map(u => (
                <th key={u.initials} style={{ padding: '12px 16px', textAlign: 'center', minWidth: 100 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, opacity: u.active ? 1 : 0.4 }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#22283a', color: '#e8eaf0', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{u.initials}</div>
                    <span style={{ fontSize: 11, color: '#e8eaf0', fontWeight: 500 }}>{u.name.split(' ')[0]}</span>
                    <span style={{ fontSize: 9, color: '#6b7280' }}>{u.role}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {permGroups.map(group => (
              <>
                <tr key={`g-${group.label}`}>
                  <td colSpan={1 + perms.length} style={{ padding: '10px 16px', fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600, background: '#0f1117', borderBottom: '1px solid #22283a' }}>{group.label}</td>
                </tr>
                {group.keys.map(key => (
                  <tr key={key} style={{ borderBottom: '1px solid #22283a' }}>
                    <td style={{ padding: '10px 16px', fontSize: 13, color: '#e8eaf0', position: 'sticky', left: 0, background: '#161a22', zIndex: 1 }}>{key}</td>
                    {perms.map((u, ui) => {
                      const val = u.perms[key] ?? 'off'
                      const isOn = val !== 'off'
                      const bgColor = val === 'custom' ? '#a855f7' : val === 'on' ? '#f97316' : '#22283a'
                      return (
                        <td key={u.initials} style={{ padding: '10px 16px', textAlign: 'center', opacity: u.active ? 1 : 0.4 }}>
                          <div onClick={() => toggle(ui, key)} style={{
                            width: 36, height: 20, borderRadius: 999, background: bgColor,
                            display: 'inline-flex', alignItems: 'center', padding: '0 2px',
                            cursor: u.active ? 'pointer' : 'not-allowed',
                            justifyContent: isOn ? 'flex-end' : 'flex-start',
                            transition: 'all 0.2s',
                          }}>
                            <div style={{ width: 16, height: 16, borderRadius: '50%', background: isOn ? '#fff' : '#6b7280', transition: 'all 0.2s' }} />
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </AppLayout>
  )
}
