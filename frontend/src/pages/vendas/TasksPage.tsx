import TasksView from '../../components/shared/TasksView/TasksView'
import { vendasMenuItems } from '../../config/vendasMenu'

export default function VendasTasksPage() {
  return <TasksView menuItems={vendasMenuItems} />
}
