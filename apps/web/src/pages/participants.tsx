import { useState } from 'react'
import { createRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AppButton, AppCard, AppInput, AppPanel, AppSelect, AppTextarea, SectionHeading } from '@superapp/ui'
import { appRoute } from '@/components/layout'
import { useAppStore } from '@/hooks/useAppStore'
import { fetchParticipants, inviteParticipant, removeParticipant, updateParticipant } from '@/lib/participants'
import { fetchProjectDetail } from '@/lib/projects'

function ParticipantsPage() {
  const { projectId } = participantsRoute.useParams()
  const { session } = useAppStore()
  const queryClient = useQueryClient()
  const detailQuery = useQuery({
    queryKey: ['project-detail', projectId],
    queryFn: () => fetchProjectDetail(projectId),
  })
  const participantsQuery = useQuery({
    queryKey: ['participants', projectId],
    queryFn: () => fetchParticipants(projectId),
  })
  const [name, setName] = useState('')
  const [participantKind, setParticipantKind] = useState<'person' | 'business'>('person')
  const [role, setRole] = useState<'owner' | 'collaborator' | 'helper' | 'guest' | 'provider' | 'viewer'>('helper')
  const [contactHint, setContactHint] = useState('')
  const [note, setNote] = useState('')
  const inviteMutation = useMutation({
    mutationFn: () =>
      inviteParticipant({
        ownerId: session!.user.id,
        projectId,
        name,
        participantKind,
        role,
        contactHint,
        note,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['participants', projectId] })
      void queryClient.invalidateQueries({ queryKey: ['project-activity', projectId] })
    },
  })
  const updateMutation = useMutation({
    mutationFn: ({
      participantId,
      nextStatus,
      nextRole,
    }: {
      participantId: string
      nextStatus?: 'invited' | 'active' | 'declined'
      nextRole?: 'owner' | 'collaborator' | 'helper' | 'guest' | 'provider' | 'viewer'
    }) =>
      updateParticipant({
        participantId,
        status: nextStatus,
        role: nextRole,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['participants', projectId] })
    },
  })
  const removeMutation = useMutation({
    mutationFn: (participantId: string) => removeParticipant(participantId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['participants', projectId] })
    },
  })

  return (
    <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
      <AppCard className="space-y-4">
        <SectionHeading eyebrow="Invite" title={`Participants for ${detailQuery.data?.project.title ?? 'project'}`} />
        <AppInput value={name} onChange={(event) => setName(event.target.value)} placeholder="Name or business" />
        <AppSelect value={participantKind} onChange={(event) => setParticipantKind(event.target.value as typeof participantKind)}>
          <option value="person">Person</option>
          <option value="business">Business/provider</option>
        </AppSelect>
        <AppSelect value={role} onChange={(event) => setRole(event.target.value as typeof role)}>
          <option value="owner">Owner</option>
          <option value="collaborator">Collaborator</option>
          <option value="helper">Helper</option>
          <option value="guest">Guest</option>
          <option value="provider">Provider</option>
          <option value="viewer">Viewer only</option>
        </AppSelect>
        <AppInput value={contactHint} onChange={(event) => setContactHint(event.target.value)} placeholder="Email / phone / username" />
        <AppTextarea value={note} onChange={(event) => setNote(event.target.value)} className="min-h-24" />
        <AppButton disabled={!session || inviteMutation.isPending} onClick={() => inviteMutation.mutate()}>
          Send invite
        </AppButton>
      </AppCard>

      <AppCard className="space-y-4">
        <SectionHeading eyebrow="Team" title="People and providers" />
        <div className="grid gap-3">
          {(participantsQuery.data ?? []).map((participant) => (
            <AppPanel key={participant.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-extrabold text-ink">{participant.name}</p>
                  <p className="text-sm text-ink/65">
                    {participant.role} · {participant.status} · {participant.visibility_scope}
                  </p>
                  <p className="mt-1 text-xs font-bold text-berry">{participant.availability_status}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(['invited', 'active', 'declined'] as const).map((status) => (
                    <AppButton key={status} variant={participant.status === status ? 'primary' : 'ghost'} onClick={() => updateMutation.mutate({ participantId: participant.id, nextStatus: status })}>
                      {status}
                    </AppButton>
                  ))}
                  <AppButton variant="secondary" onClick={() => removeMutation.mutate(participant.id)}>
                    Remove
                  </AppButton>
                </div>
              </div>
            </AppPanel>
          ))}
          {!participantsQuery.data?.length ? <p className="text-sm text-ink/60">Invite helpers, guests, and providers to make the project collaborative.</p> : null}
        </div>
      </AppCard>
    </div>
  )
}

export const participantsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'projects/$projectId/participants',
  component: ParticipantsPage,
})
