import { participantsRoute } from '@/route-definitions'
import { Navigate } from '@tanstack/react-router'

export function ParticipantsPage() {
  const { projectId } = participantsRoute.useParams()
  return <Navigate to="/app/projects/$projectId/people" params={{ projectId }} replace />
}
