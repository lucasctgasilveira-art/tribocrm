import LeadDetailView from '../../components/shared/LeadDetailView/LeadDetailView'
import { vendasMenuItems } from '../../config/vendasMenu'

export default function VendasLeadDetailPage() {
  return <LeadDetailView menuItems={vendasMenuItems} instance="vendas" />
}
