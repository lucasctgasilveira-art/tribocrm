import TasksView from '../../components/shared/TasksView/TasksView'
import { adminMenuItems } from '../../config/adminMenu'

export default function AdminTasksPage() {
  return <TasksView menuItems={adminMenuItems} />
}
