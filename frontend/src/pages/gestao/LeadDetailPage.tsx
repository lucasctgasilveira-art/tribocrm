import LeadDetailView from '../../components/shared/LeadDetailView/LeadDetailView'
import { gestaoMenuItems } from '../../config/gestaoMenu'

export default function GestaoLeadDetailPage() {
  return <LeadDetailView menuItems={gestaoMenuItems} instance="gestao" />
}
