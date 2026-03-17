import { useRef, useState } from 'react'
import { createRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil } from 'lucide-react'
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
  const [inviteError, setInviteError] = useState<string | null>(null)
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
      setInviteError(null)
      void queryClient.invalidateQueries({ queryKey: ['participants', projectId] })
      void queryClient.invalidateQueries({ queryKey: ['project-activity', projectId] })
    },
    onError: (err) => {
      setInviteError(err instanceof Error ? err.message : 'Failed to add participant.')
    },
  })
  const updateMutation = useMutation({
    mutationFn: ({
      participantId,
      nextStatus,
      nextRole,
      name,
    }: {
      participantId: string
      nextStatus?: 'invited' | 'active' | 'declined'
      nextRole?: 'owner' | 'collaborator' | 'helper' | 'guest' | 'provider' | 'viewer'
      name?: string
    }) =>
      updateParticipant({
        participantId,
        status: nextStatus,
        role: nextRole,
        name,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['participants', projectId] })
    },
  })
  const removeMutation = useMutation({
    mutationFn: (participantId: string) => removeParticipant(participantId),
    onSuccess: () => {
      setRemoveConfirmId(null)
      void queryClient.invalidateQueries({ queryKey: ['participants', projectId] })
    },
  })

  const [removeConfirmId, setRemoveConfirmId] = useState<string | null>(null)
  const [editingParticipantId, setEditingParticipantId] = useState<string | null>(null)
  const [editParticipantValue, setEditParticipantValue] = useState('')
  const participantEditRef = useRef<HTMLInputElement>(null)

  function beginNameEdit(participantId: string, currentName: string) {
    setEditingParticipantId(participantId)
    setEditParticipantValue(currentName)
    setTimeout(() => participantEditRef.current?.select(), 0)
  }

  function commitNameEdit(participantId: string) {
    if (!editParticipantValue.trim()) { cancelNameEdit(); return }
    updateMutation.mutate({ participantId, name: editParticipantValue })
    cancelNameEdit()
  }

  function cancelNameEdit() {
    setEditingParticipantId(null)
    setEditParticipantValue('')
  }

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
        <AppButton disabled={!session || inviteMutation.isPending} onClick={() => { setInviteError(null); inviteMutation.mutate() }}>
          Send invite
        </AppButton>
        {inviteError ? <p className="text-xs font-bold text-berry">{inviteError}</p> : null}
      </AppCard>

      <AppCard className="space-y-4">
        <SectionHeading eyebrow="Team" title="People and providers" />
        <div className="grid gap-3">
          {(participantsQuery.data ?? []).map((participant) => (
            <AppPanel key={participant.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  {/* Name — double-click to edit */}
                  {editingParticipantId === participant.id ? (
                    <input
                      ref={participantEditRef}
                      value={editParticipantValue}
                      onChange={(e) => setEditParticipantValue(e.target.value)}
                      onBlur={() => commitNameEdit(participant.id)}
                      onKeyDown={(e) => { if (e.key === 'Enter') commitNameEdit(participant.id); if (e.key === 'Escape') cancelNameEdit() }}
                      className="w-full bg-transparent text-lg font-extrabold text-ink outline-none border-b-2 border-ink/40 focus:border-ink"
                    />
                  ) : (
                    <p
                      className="text-lg font-extrabold text-ink cursor-text group/name flex items-center gap-1.5"
                      onDoubleClick={() => beginNameEdit(participant.id, participant.name)}
                      title="Double-click to rename"
                    >
                      <span>{participant.name}</span>
                      <Pencil className="h-3 w-3 shrink-0 text-ink/30 opacity-0 group-hover/name:opacity-100 transition-opacity" />
                    </p>
                  )}
                  {/* Role — inline select */}
                  <div className="mt-1 flex items-center gap-2">
                    <select
                      value={participant.role}
                      onChange={(e) => updateMutation.mutate({ participantId: participant.id, nextRole: e.target.value as typeof participant.role })}
                      className="bg-transparent text-sm text-ink/65 outline-none cursor-pointer hover:text-ink transition-colors"
                    >
                      {(['owner', 'collaborator', 'helper', 'guest', 'provider', 'viewer'] as const).map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                    <span className="text-sm text-ink/40">·</span>
                    <span className="text-sm text-ink/65">{participant.status}</span>
                  </div>
                  {participant.availability_status ? (
                    <p className="mt-1 text-xs font-bold text-berry">{participant.availability_status}</p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  {(['invited', 'active', 'declined'] as const).map((status) => (
                    <AppButton key={status} variant={participant.status === status ? 'primary' : 'ghost'} onClick={() => updateMutation.mutate({ participantId: participant.id, nextStatus: status })}>
                      {status}
                    </AppButton>
                  ))}
                  {removeConfirmId === participant.id ? (
                    <>
                      <span className="flex items-center text-xs font-bold text-berry">Remove?</span>
                      <AppButton variant="secondary" onClick={() => removeMutation.mutate(participant.id)} disabled={removeMutation.isPending}>
                        Yes
                      </AppButton>
                      <AppButton variant="ghost" onClick={() => setRemoveConfirmId(null)}>Cancel</AppButton>
                    </>
                  ) : (
                    <AppButton variant="secondary" onClick={() => setRemoveConfirmId(participant.id)}>
                      Remove
                    </AppButton>
                  )}
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
