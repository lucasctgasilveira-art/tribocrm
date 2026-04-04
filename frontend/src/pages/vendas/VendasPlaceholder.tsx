import AppLayout from '../../components/shared/AppLayout/AppLayout'
import { vendasMenuItems } from '../../config/vendasMenu'

interface Props {
  title: string
  subtitle: string
}

export default function VendasPlaceholder({ title, subtitle }: Props) {
  return (
    <AppLayout menuItems={vendasMenuItems}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{title}</h1>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 4 }}>{subtitle}</p>
      </div>
      <div
        style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12,
          padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14,
        }}
      >
        Em construção
      </div>
    </AppLayout>
  )
}
