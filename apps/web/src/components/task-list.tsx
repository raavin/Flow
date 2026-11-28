import { isPendingRecord } from '@/lib/optimistic'
import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AppButton, AppCard, AppInput, AppSelect, SectionHeading } from '@superapp/ui'
import { AppDialog } from './app-dialog'
import { QueryFeedback, MutationFeedback } from './request-feedback'
import { useAppStore } from '@/hooks/useAppStore'
import {
  createManualCoordinationObject,
  fetchCoordinationObjects,
  updateCoordinationObjectState,
} from '@/lib/coordination-objects'
import { updateTaskStatus } from '@/lib/projects'
import { groupCoordinationObjects } from '@/lib/task-groups'
import type { CoordinationObject } from '@superapp/types'

export function TaskList({ projectId, parentId }: { projectId?: string; parentId?: string }) {
  const { session } = useAppStore()
  const client = useQueryClient()
  const [adding, setAdding] = useState(false)
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [filter, setFilter] = useState('open')
  const [search, setSearch] = useState('')
  const tasks = useQuery({
    queryKey: ['coordination-objects', projectId ?? 'all'],
    queryFn: () => fetchCoordinationObjects({ linkedProjectId: projectId }),
  })
  const refresh = () => {
    void client.invalidateQueries({ queryKey: ['coordination-objects'] })
    void client.invalidateQueries({ queryKey: ['project-detail'] })
  }
  const create = useMutation({
    mutationFn: () =>
      createManualCoordinationObject({
        ownerId: session!.user.id,
        title: title.trim(),
        kind: 'task',
        displayKind: 'task',
        intent: 'deliver',
        state: 'pending',
        dueAt: date ? new Date(`${date}T17:00:00`).toISOString() : null,
        linkedProjectId: projectId,
        parentId,
        flexibility: 'shiftable',
      }),
    onSuccess: () => {
      refresh()
      setAdding(false)
      setTitle('')
      setDate('')
    },
  })
  const status = useMutation({
    mutationFn: async ({ item, done }: { item: CoordinationObject; done: boolean }) => {
      if (item.sourceTable === 'tasks' && item.sourceId)
        await updateTaskStatus(item.sourceId, done ? 'done' : 'todo')
      await updateCoordinationObjectState(item.id, done ? 'completed' : 'pending')
    },
    onSuccess: refresh,
  })
  const matches = (tasks.data ?? []).filter(
    (t) =>
      (!parentId || t.parentId === parentId) &&
      !['project', 'listing', 'job', 'template'].includes(t.kind) &&
      t.title.toLowerCase().includes(search.toLowerCase()) &&
      (filter === 'all' || (filter === 'done' ? t.state === 'completed' : t.state !== 'completed')),
  )
  const groups = groupCoordinationObjects(matches)
  return (
    <AppCard className="space-y-4">
      <SectionHeading
        title={parentId ? 'Steps' : projectId ? 'Tasks' : 'My tasks'}
        action={
          <div className="flex flex-wrap gap-2">
            <Link to="/app/ai" className="inline-flex min-h-11 items-center px-3 text-sm underline">
              Use a template
            </Link>
            <AppButton onClick={() => setAdding(true)}>Add task</AppButton>
          </div>
        }
      />
      <div className="flex flex-wrap gap-3">
        <AppInput
          aria-label="Search tasks"
          placeholder="Search tasks"
          className="min-w-0 flex-1"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <AppSelect
          aria-label="Task status"
          className="w-auto"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="open">Open</option>
          <option value="done">Completed</option>
          <option value="all">All</option>
        </AppSelect>
      </div>
      <QueryFeedback query={tasks} />
      <MutationFeedback mutation={status} />
      {(['now', 'next', 'backlog', 'done'] as const).map(
        (key) =>
          groups[key].length > 0 && (
            <section key={key}>
              <h2 className="mb-2 text-sm font-semibold text-ink/65">
                {
                  {
                    now: 'Due or in progress',
                    next: 'Upcoming',
                    backlog: 'No date',
                    done: 'Completed',
                  }[key]
                }
              </h2>
              <ul className="divide-y divide-border">
                {groups[key].map((item) => (
                  <li key={item.id} className="flex items-center gap-3 py-3">
                    <input
                      type="checkbox"
                      aria-label={`Complete ${item.title}`}
                      checked={item.state === 'completed'}
                      onChange={(e) => status.mutate({ item, done: e.target.checked })}
                      className="h-5 w-5"
                      disabled={
                        isPendingRecord(item) ||
                        (status.isPending && status.variables?.item.id === item.id) ||
                        item.ownerId !== session?.user.id
                      }
                    />
                    {isPendingRecord(item) ? (
                      <span className="min-w-0 flex-1 break-words font-medium">
                        {item.title} <span className="text-xs font-normal">Saving…</span>
                      </span>
                    ) : (
                      <Link
                        to="/app/coordination/$coordinationId"
                        params={{ coordinationId: item.id }}
                        className="min-w-0 flex-1 break-words font-medium hover:underline"
                      >
                        {item.title}
                      </Link>
                    )}
                    <span className="text-xs text-ink/65">
                      {item.time.dueAt || item.time.startsAt
                        ? new Date((item.time.dueAt || item.time.startsAt)!).toLocaleDateString(undefined, {
                            day: 'numeric',
                            month: 'short',
                          })
                        : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ),
      )}
      {!tasks.isPending && !tasks.isError && !matches.length && (
        <p className="py-4 text-sm text-ink/65">
          {search ? 'No matching tasks.' : filter === 'done' ? 'No completed tasks.' : 'No tasks here yet.'}
        </p>
      )}
      {adding && (
        <AppDialog title="Add task" onClose={() => setAdding(false)}>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault()
              create.mutate()
            }}
          >
            <label className="grid gap-1">
              Task
              <AppInput autoFocus required value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>
            <label className="grid gap-1">
              Due date (optional)
              <AppInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
            <MutationFeedback mutation={create} />
            <div className="flex justify-end gap-2">
              <AppButton type="button" variant="ghost" onClick={() => setAdding(false)}>
                Cancel
              </AppButton>
              <AppButton type="submit" disabled={create.isPending || !title.trim()}>
                Add task
              </AppButton>
            </div>
          </form>
        </AppDialog>
      )}
    </AppCard>
  )
}
