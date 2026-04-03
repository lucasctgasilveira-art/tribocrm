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
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#e8eaf0', margin: 0 }}>{title}</h1>
        <p style={{ fontSize: 14, color: '#6b7280', marginTop: 4 }}>{subtitle}</p>
      </div>
      <div
        style={{
          background: '#161a22', border: '1px solid #22283a', borderRadius: 12,
          padding: 40, textAlign: 'center', color: '#6b7280', fontSize: 14,
        }}
      >
        Em construção
      </div>
    </AppLayout>
  )
}
