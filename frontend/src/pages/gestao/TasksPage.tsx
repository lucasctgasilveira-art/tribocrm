import TasksView from '../../components/shared/TasksView/TasksView'
import { gestaoMenuItems } from '../../config/gestaoMenu'

export default function GestaoTasksPage() {
  return <TasksView menuItems={gestaoMenuItems} />
}
