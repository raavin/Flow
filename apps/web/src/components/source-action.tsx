import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AppButton, AppInput, AppSelect } from '@superapp/ui'
import { AppDialog } from './app-dialog'
import { fetchProjects } from '@/lib/projects'
import { supabase } from '@/lib/supabase'
import { postPlainText } from '@/lib/post-content'

export function SourceAction({
  postId,
  messageId,
  body,
  onClose,
}: {
  postId?: string
  messageId?: string
  body: string
  onClose: () => void
}) {
  const [id] = useState(() => crypto.randomUUID())
  const [kind, setKind] = useState('task')
  const [title, setTitle] = useState(() => postPlainText(body).slice(0, 100))
  const [projectId, setProjectId] = useState('')
  const [date, setDate] = useState('')
  const projects = useQuery({ queryKey: ['projects'], queryFn: fetchProjects })
  const client = useQueryClient()
  const mutation = useMutation({
    mutationFn: async () => {
      if (!supabase) throw new Error('Not connected')
      const { data, error } = await supabase.rpc('create_source_action', {
        p_id: id,
        p_post_id: postId ?? null,
        p_message_id: messageId ?? null,
        p_kind: kind,
        p_title: title.trim(),
        p_project_id: projectId || null,
        p_date: date ? new Date(date).toISOString() : null,
      })
      if (error) throw error
      return data as { project_id: string | null; object_id: string | null }
    },
    onSuccess: () => {
      for (const key of ['projects', 'coordination-objects', 'calendar-events', 'source-actions'])
        void client.invalidateQueries({ queryKey: [key] })
    },
  })
  return (
    <AppDialog title={mutation.isSuccess ? 'Created' : 'Create from conversation'} onClose={onClose}>
      {mutation.data ? (
        <div className="space-y-4">
          <p role="status">{title}</p>
          <p className="text-sm text-ink/65">
            The original conversation is linked. Its audience stays the same.
          </p>
          <div className="flex flex-wrap gap-3">
            <AppButton onClick={onClose}>Done</AppButton>
            {mutation.data.object_id ? (
              <Link
                to="/app/coordination/$coordinationId"
                params={{ coordinationId: mutation.data.object_id }}
                className="inline-flex min-h-11 items-center underline"
              >
                Open {kind}
              </Link>
            ) : (
              mutation.data.project_id && (
                <Link
                  to="/app/projects/$projectId/conversation"
                  params={{ projectId: mutation.data.project_id }}
                  className="inline-flex min-h-11 items-center underline"
                >
                  Open project
                </Link>
              )
            )}
          </div>
        </div>
      ) : (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            mutation.mutate()
          }}
        >
          <label className="grid gap-1 text-sm font-semibold">
            Action
            <AppSelect value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="task">Create task</option>
              <option value="event">Create event</option>
              <option value="project">Start project</option>
              <option value="link">Add to project</option>
            </AppSelect>
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            Title
            <AppInput required maxLength={300} value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          {kind !== 'project' && (
            <label className="grid gap-1 text-sm font-semibold">
              Project {kind !== 'link' && '(optional)'}
              <AppSelect
                required={kind === 'link'}
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
              >
                <option value="">{kind === 'link' ? 'Choose a project' : 'Just for me'}</option>
                {projects.data
                  ?.filter((p) => p.isOwner)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
              </AppSelect>
            </label>
          )}
          {kind !== 'link' && (
            <label className="grid gap-1 text-sm font-semibold">
              {kind === 'event' ? 'Starts' : 'Due'} {kind !== 'event' && '(optional)'}
              <AppInput
                type="datetime-local"
                required={kind === 'event'}
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
          )}
          {kind === 'event' && (
            <p className="text-sm text-ink/65">One hour. You can change the duration in the calendar.</p>
          )}
          <p className="text-sm text-ink/65">
            A link keeps the source conversation available to people who already have access.
          </p>
          {mutation.isError && (
            <p role="alert" className="text-sm text-berry">
              {mutation.error.message}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <AppButton type="button" variant="ghost" onClick={onClose}>
              Cancel
            </AppButton>
            <AppButton type="submit" disabled={mutation.isPending || !title.trim()}>
              {mutation.isPending ? 'Saving…' : kind === 'link' ? 'Add to project' : 'Create'}
            </AppButton>
          </div>
        </form>
      )}
    </AppDialog>
  )
}
export function SourceLinks({
  postId,
  projectId,
  objectId,
}: {
  postId?: string
  projectId?: string
  objectId?: string
}) {
  const query = useQuery({
    queryKey: ['source-actions', postId, projectId, objectId],
    queryFn: async () => {
      if (!supabase) return []
      let q = supabase
        .from('source_actions')
        .select('id,source_post_id,source_message_id,project_id,object_id')
      if (postId) q = q.eq('source_post_id', postId)
      if (projectId) q = q.eq('project_id', projectId)
      if (objectId) q = q.eq('object_id', objectId)
      const { data, error } = await q
      if (error) throw error
      const ids = (data ?? []).flatMap((row) => (row.source_message_id ? [row.source_message_id] : []))
      const messages = ids.length
        ? await supabase.from('dm_messages').select('id,thread_id').in('id', ids)
        : { data: [], error: null }
      if (messages.error) throw messages.error
      return (data ?? []).map((row) => ({
        ...row,
        threadId: messages.data?.find((m) => m.id === row.source_message_id)?.thread_id,
      }))
    },
  })
  if (!query.data?.length) return null
  return (
    <div className="flex flex-wrap gap-3 text-sm">
      {query.data.map((link) => (
        <span key={link.id}>
          {postId ? (
            link.object_id ? (
              <Link
                className="underline"
                to="/app/coordination/$coordinationId"
                params={{ coordinationId: link.object_id }}
              >
                Linked task or event
              </Link>
            ) : (
              link.project_id && (
                <Link
                  className="underline"
                  to="/app/projects/$projectId/conversation"
                  params={{ projectId: link.project_id }}
                >
                  Linked project
                </Link>
              )
            )
          ) : link.source_post_id ? (
            <Link
              className="underline"
              to="/app/messages/post/$postId"
              params={{ postId: link.source_post_id }}
            >
              Source conversation
            </Link>
          ) : link.threadId ? (
            <Link className="underline" to="/app/messages/dm/$threadId" params={{ threadId: link.threadId }}>
              Source message
            </Link>
          ) : null}
        </span>
      ))}
    </div>
  )
}
