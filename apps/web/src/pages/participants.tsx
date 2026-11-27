import { createRoute, Navigate } from '@tanstack/react-router'
import { appRoute } from '@/components/layout'
function ParticipantsPage() {
  const { projectId } = participantsRoute.useParams()
  return <Navigate to="/app/projects/$projectId/people" params={{ projectId }} replace />
}
export const participantsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'projects/$projectId/participants',
  component: ParticipantsPage,
})
