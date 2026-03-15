import { useMemo, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from 'react'
import { Link, createRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bookmark, Heart, ImagePlus, MessageCircle, Pencil, Repeat2, Search, Send, Share2, Sparkles, Star, Waves, X } from 'lucide-react'
import { AppButton, AppCard, AppInput, AppPanel, AppPill, AppSelect, AppTextarea, SectionHeading } from '@superapp/ui'
import { appRoute } from '@/components/layout'
import { useAppStore } from '@/hooks/useAppStore'
import { getSignedDmImageUrls, getSignedPostImageUrls, uploadDmImages, uploadPostImages } from '@/lib/message-media'
import { createDmThread, fetchDmMessages, fetchDmThreads, sendDmMessage } from '@/lib/dm'
import {
  createPost,
  ensureSocialProfile,
  fetchFeed,
  fetchPeopleDirectory,
  fetchPost,
  fetchSocialProfile,
  fetchTopicFeed,
  fetchTopics,
  linkPostToProject,
  toggleFollow,
  flagPostLabel,
  togglePostEngagement,
  toggleTopicSubscription,
  updateOwnPostLabel,
  updateOwnPost,
} from '@/lib/social'
import { createProject, fetchProjects } from '@/lib/projects'
import { searchSupportEntries } from '@/lib/support'

type FeedMode = 'following' | 'discover' | 'bookmarks'
type ComposerKind = 'post' | 'reply' | 'dm'
type AutocompleteOption = {
  id: string
  label: string
  value: string
  trigger: '@' | '#' | '/'
  subtitle?: string
}
type AutocompleteState = {
  kind: ComposerKind
  trigger: '@' | '#' | '/'
  query: string
  start: number
  end: number
}

export function MessagesFeedPage({ linkedProjectId }: { linkedProjectId?: string | null } = {}) {
  const { session, profile } = useAppStore()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [mode, setMode] = useState<FeedMode>('following')
  const [hideReviews, setHideReviews] = useState(false)
  const [body, setBody] = useState('')
  const [projectId, setProjectId] = useState('')
  const [contentKind, setContentKind] = useState<'update' | 'product' | 'opinion' | 'claim' | 'review'>('update')
  const [claimLinksText, setClaimLinksText] = useState('')
  const [selectedImages, setSelectedImages] = useState<File[]>([])
  const [quoteTarget, setQuoteTarget] = useState<{ id: string; body: string; author: string } | null>(null)
  const [composerOpen, setComposerOpen] = useState(false)
  const [editingPost, setEditingPost] = useState<{
    id: string
    mediaPaths?: string[]
  } | null>(null)
  const [flowDraft, setFlowDraft] = useState<{ postId: string; body: string; projectId?: string | null } | null>(null)
  const [dmDraft, setDmDraft] = useState<{ profileId: string; displayName: string } | null>(null)
  const [labelReviewDraft, setLabelReviewDraft] = useState<{
    postId: string
    currentKind: 'update' | 'product' | 'opinion' | 'claim'
    currentFlag?: 'update' | 'product' | 'opinion' | 'claim' | null
    isOwnPost?: boolean
    peerReasons?: string[]
  } | null>(null)
  const [flowTitle, setFlowTitle] = useState('')
  const [flowDate, setFlowDate] = useState('')
  const [flowError, setFlowError] = useState<string | null>(null)
  const [composerError, setComposerError] = useState<string | null>(null)
  const [labelReason, setLabelReason] = useState('')
  const [rightSearch, setRightSearch] = useState('')
  const [replyBody, setReplyBody] = useState('')
  const [dmBody, setDmBody] = useState('')
  const [autocomplete, setAutocomplete] = useState<AutocompleteState | null>(null)
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0)
  const postComposerRef = useRef<HTMLTextAreaElement>(null)
  const replyComposerRef = useRef<HTMLTextAreaElement>(null)
  const dmComposerRef = useRef<HTMLTextAreaElement>(null)
  const projectsQuery = useQuery({ queryKey: ['projects'], queryFn: fetchProjects })
  const dmThreadsQuery = useQuery({ queryKey: ['dm-threads'], queryFn: fetchDmThreads, enabled: Boolean(session?.user.id) })
  const topicsQuery = useQuery({
    queryKey: ['topics', session?.user.id],
    queryFn: () => fetchTopics(session?.user.id),
    enabled: Boolean(session?.user.id),
  })
  const peopleQuery = useQuery({
    queryKey: ['people-directory', session?.user.id],
    queryFn: () => fetchPeopleDirectory(session!.user.id),
    enabled: Boolean(session?.user.id),
  })
  const feedQuery = useQuery({
    queryKey: ['social-feed', session?.user.id, mode, linkedProjectId ?? 'all'],
    queryFn: () => fetchFeed(session!.user.id, mode, { linkedProjectId }),
    enabled: Boolean(session?.user.id),
  })

  const imagePaths = useMemo(
    () => (feedQuery.data ?? []).flatMap((post) => post.mediaPaths ?? []),
    [feedQuery.data],
  )
  const signedImagesQuery = useQuery({
    queryKey: ['post-images', imagePaths],
    queryFn: () => getSignedPostImageUrls(imagePaths),
    enabled: imagePaths.length > 0,
  })

  const createPostMutation = useMutation({
    mutationFn: async () => {
      const supportingLinks = parseSupportingLinks(claimLinksText)
      await ensureSocialProfile(session!.user.id, profile?.first_name)
      const mediaPaths = selectedImages.length ? await uploadPostImages(session!.user.id, selectedImages) : []
      return createPost({
        authorId: session!.user.id,
        body,
        contentKind,
        linkedProjectId: projectId || linkedProjectId || null,
        mediaPaths,
        supportingLinks,
        quotePostId: quoteTarget?.id ?? null,
      })
    },
    onSuccess: () => {
      resetComposer()
      void queryClient.invalidateQueries({ queryKey: ['social-feed'] })
      void navigate({ to: '/app/messages' })
    },
    onError: (error) => {
      setComposerError(describeError(error, 'Could not publish this post.'))
    },
  })

  const updatePostMutation = useMutation({
    mutationFn: () =>
      updateOwnPost({
        postId: editingPost!.id,
        userId: session!.user.id,
        body,
        contentKind,
        linkedProjectId: projectId || linkedProjectId || null,
        supportingLinks: parseSupportingLinks(claimLinksText),
      }),
    onSuccess: () => {
      resetComposer()
      void queryClient.invalidateQueries({ queryKey: ['social-feed'] })
      void queryClient.invalidateQueries({ queryKey: ['post'] })
      void navigate({ to: '/app/messages' })
    },
    onError: (error) => {
      setComposerError(describeError(error, 'Could not update this post.'))
    },
  })

  const engagementMutation = useMutation({
    mutationFn: ({ postId, field }: { postId: string; field: 'liked' | 'reposted' | 'bookmarked' }) =>
      togglePostEngagement({ postId, userId: session!.user.id, field }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['social-feed'] })
    },
  })

  const labelFlagMutation = useMutation({
    mutationFn: ({ postId, suggestedKind }: { postId: string; suggestedKind: 'update' | 'product' | 'opinion' | 'claim' }) =>
      flagPostLabel({ postId, userId: session!.user.id, suggestedKind, reason: labelReason }),
    onSuccess: () => {
      setLabelReviewDraft(null)
      setLabelReason('')
      void queryClient.invalidateQueries({ queryKey: ['social-feed'] })
      void queryClient.invalidateQueries({ queryKey: ['post'] })
      void queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  const ownLabelMutation = useMutation({
    mutationFn: ({ postId, contentKind }: { postId: string; contentKind: 'update' | 'product' | 'opinion' | 'claim' }) =>
      updateOwnPostLabel({ postId, userId: session!.user.id, contentKind }),
    onSuccess: () => {
      setLabelReviewDraft(null)
      void queryClient.invalidateQueries({ queryKey: ['social-feed'] })
      void queryClient.invalidateQueries({ queryKey: ['post'] })
    },
  })

  const createFlowMutation = useMutation({
    mutationFn: () =>
      createProject({
        ownerId: session!.user.id,
        title: flowTitle.trim() || (flowDraft ? flowDraft.body.slice(0, 60) : 'New project'),
        category: '',
        targetDate: flowDate || '',
      }).then(async (project) => {
        if (flowDraft?.postId) {
          await linkPostToProject({
            postId: flowDraft.postId,
            userId: session!.user.id,
            projectId: project.id,
          })
        }
        return project
      }),
    onSuccess: (project) => {
      setFlowDraft(null)
      setFlowTitle('')
      setFlowDate('')
      setFlowError(null)
      void queryClient.invalidateQueries({ queryKey: ['projects'] })
      void queryClient.invalidateQueries({ queryKey: ['social-feed'] })
      void navigate({ to: '/app/projects/$projectId/conversation', params: { projectId: project.id } })
    },
    onError: (error) => {
      setFlowError(describeError(error, 'Could not create a project from this message.'))
    },
  })

  const filteredPeople = (peopleQuery.data ?? []).filter((person) => {
    if (!rightSearch.trim()) return true
    const query = rightSearch.toLowerCase()
    return (person.display_name || person.handle).toLowerCase().includes(query) || person.handle.toLowerCase().includes(query)
  })

  const sidebarTopics = (topicsQuery.data ?? []).filter((topic) => {
    if (!rightSearch.trim()) return true
    return topic.label.toLowerCase().includes(rightSearch.toLowerCase())
  })

  const filteredFeed = (feedQuery.data ?? []).filter((post) => {
    if (hideReviews && post.content_kind === 'review') return false
    if (!rightSearch.trim()) return true
    const query = rightSearch.toLowerCase()
    return (
      post.body.toLowerCase().includes(query) ||
      (post.author?.display_name || '').toLowerCase().includes(query) ||
      (post.author?.handle || '').toLowerCase().includes(query) ||
      (post.topics ?? []).some((topic: { label: string }) => topic.label.toLowerCase().includes(query))
    )
  })

  const autocompleteOptions = useMemo(() => {
    if (!autocomplete) return []
    const query = autocomplete.query.toLowerCase()

    if (autocomplete.trigger === '@') {
      return (peopleQuery.data ?? [])
        .filter((person) => {
          if (!query) return true
          return (
            person.handle.toLowerCase().includes(query) ||
            (person.display_name || '').toLowerCase().includes(query)
          )
        })
        .slice(0, 6)
        .map((person) => ({
          id: person.id,
          label: `@${person.handle}`,
          value: person.handle,
          trigger: '@' as const,
          subtitle: person.display_name || undefined,
        }))
    }

    return (topicsQuery.data ?? [])
      .filter((topic) => {
        if (!query) return true
        return topic.slug.toLowerCase().includes(query) || topic.label.toLowerCase().includes(query)
      })
      .slice(0, 6)
      .map((topic) => ({
        id: topic.id,
        label: `#${topic.slug}`,
        value: topic.slug,
        trigger: '#' as const,
        subtitle: topic.label,
      }))
  }, [autocomplete, peopleQuery.data, topicsQuery.data])

  const dmShortcutMutation = useMutation({
    mutationFn: async () => {
      if (!dmDraft) throw new Error('No direct message target selected.')
      const existing = (dmThreadsQuery.data ?? []).find((thread) => thread.title === dmDraft.displayName)
      if (existing) return existing
      return createDmThread({
        ownerId: session!.user.id,
        title: dmDraft.displayName,
        threadKind: 'direct',
        memberIds: [dmDraft.profileId],
      })
    },
    onSuccess: (thread) => {
      setDmDraft(null)
      void queryClient.invalidateQueries({ queryKey: ['dm-threads'] })
      void navigate({ to: '/app/messages/dm/$threadId', params: { threadId: thread.id } })
    },
  })

  function resetComposer() {
    setBody('')
    setProjectId(linkedProjectId ?? '')
    setContentKind('update')
    setClaimLinksText('')
    setComposerError(null)
    setSelectedImages([])
    setQuoteTarget(null)
    setEditingPost(null)
    setComposerOpen(false)
  }

  return (
    <>
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_248px]">
        <div className="relative z-20 min-w-0 space-y-3">
          <AppCard className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              {linkedProjectId ? (
                <div className="flex flex-wrap items-center gap-2">
                  <AppPill tone="teal">Project view</AppPill>
                  <Link to="/app/projects/$projectId" params={{ projectId: linkedProjectId }}>
                    <AppButton variant="ghost">Open project</AppButton>
                  </Link>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {(['following', 'discover', 'bookmarks'] as FeedMode[]).map((item) => (
                    <AppButton key={item} variant={mode === item ? 'primary' : 'ghost'} onClick={() => setMode(item)}>
                      {item === 'following' ? 'Following' : item === 'discover' ? 'Discover' : 'Saved'}
                    </AppButton>
                  ))}
                  <button
                    type="button"
                    className={`ui-chip-toggle ${hideReviews ? 'ui-chip-toggle--active' : ''} flex items-center gap-1.5`}
                    onClick={() => setHideReviews((v) => !v)}
                    title={hideReviews ? 'Show reviews' : 'Hide reviews'}
                  >
                    <Star className="h-3.5 w-3.5" />
                    Reviews
                  </button>
                </div>
              )}
              <Link to="/app/messages/dm"><AppButton variant="secondary">DMs</AppButton></Link>
            </div>
            <button
              type="button"
              className="ui-panel ui-panel--surface flex w-full items-center gap-3 text-left transition hover:-translate-y-0.5"
              onClick={() => setComposerOpen(true)}
            >
              <AvatarBadge label={profile?.first_name || 'Y'} />
              <div className="min-w-0 flex-1">
                <p className="text-base font-bold text-ink/65">What&apos;s up?</p>
              </div>
              <Sparkles className="h-5 w-5 text-berry" />
            </button>
          </AppCard>

          <div className="ui-feed-shell space-y-0">
            {filteredFeed.map((post) => (
              <article key={post.id} className="ui-feed-row">
                <div className="flex gap-3">
                  <AvatarBadge label={post.author?.display_name || 'U'} />
                  <div className="relative min-w-0 flex-1">
                    <div className="absolute right-0 top-0">
                      <LabelBadge
                        kind={post.content_kind}
                        reviewState={post.review_state}
                        flagCount={post.mislabel_flag_count}
                        interactive
                        viewerFlagged={Boolean(post.viewerLabelFlag)}
                        isOwnPost={post.author_id === session?.user.id}
                        onClick={() => {
                          setLabelReviewDraft({
                            postId: post.id,
                            currentKind: post.content_kind,
                            currentFlag: post.viewerLabelFlag,
                            isOwnPost: post.author_id === session?.user.id,
                            peerReasons: post.labelReasons ?? [],
                          })
                          setLabelReason('')
                        }}
                      />
                    </div>
                    <div className="flex items-center gap-2 text-sm text-ink/55">
                      {post.repostedBy?.handle && post.repostedBy.id !== post.author_id ? (
                        <>
                          <span className="font-bold text-teal">@{post.repostedBy.handle}</span>
                          <span>reposted</span>
                          <span>·</span>
                        </>
                      ) : null}
                      <Link to="/app/messages/profile/$profileId" params={{ profileId: post.author_id }} className="font-extrabold text-ink">
                        {post.author?.display_name || 'User'}
                      </Link>
                      <span>@{post.author?.handle || 'user'}</span>
                      <span>·</span>
                      <span>{timeAgo(post.feedSortAt ?? post.created_at)}</span>
                      {isEditedPost(post.metadata) ? (
                        <span className="group relative inline-flex items-center">
                          <span>·</span>
                          <span className="ml-2 font-bold text-ink/65">edited</span>
                          <span className="pointer-events-none absolute left-1/2 top-[calc(100%+0.55rem)] z-[70] w-max max-w-[220px] -translate-x-1/2 rounded-[16px] border border-ink/10 bg-white px-3 py-2 text-xs font-medium text-ink/80 opacity-0 shadow-xl transition duration-150 ease-out group-hover:translate-y-1 group-hover:opacity-100">
                            Edited {formatEditedAt(post.metadata)}
                            <span className="absolute left-1/2 top-0 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rotate-45 border-l border-t border-ink/10 bg-white" />
                          </span>
                        </span>
                      ) : null}
                    </div>
                    {post.linked_project_id && post.linkedProjectTitle ? (
                      <div className="mt-2 flex items-center gap-2">
                        <Link
                          to="/app/projects/$projectId/conversation"
                          params={{ projectId: post.linked_project_id }}
                          className="ui-pill ui-pill--teal text-xs font-black uppercase tracking-[0.18em]"
                        >
                          Project · {post.linkedProjectTitle}
                        </Link>
                      </div>
                    ) : null}
                    <div className="mt-2 pr-12 space-y-3">
                      {post.content_kind === 'review' && extractReviewMeta(post.metadata) ? (
                        (() => {
                          const rm = extractReviewMeta(post.metadata)!
                          const lines = post.body.split('\n').filter(Boolean)
                          const reviewText = lines.slice(1).join('\n').trim() || lines[0] || ''
                          return (
                            <div className="ui-panel ui-panel--surface mt-2 space-y-2">
                              <div className="flex items-center justify-between gap-3">
                                <ReviewStars rating={rm.rating} />
                                <Link
                                  to="/app/marketplace/listings/$listingId"
                                  params={{ listingId: rm.listingId }}
                                  className="ui-pill ui-pill--teal text-xs font-black uppercase tracking-[0.18em]"
                                >
                                  {rm.listingTitle ?? 'View listing'}
                                </Link>
                              </div>
                              {reviewText ? (
                                <p className="text-[15px] leading-7 text-ink">{reviewText}</p>
                              ) : null}
                            </div>
                          )
                        })()
                      ) : (
                        <div className="mt-2 text-[17px] leading-8 text-ink">
                          <RichPostText body={post.body} mentionMap={post.mentionMap} />
                        </div>
                      )}
                      {post.quotePost ? (
                        <div className="ui-quote-card mt-3">
                          <p className="text-sm font-bold text-ink">@{post.quotePost.author?.handle || 'user'}</p>
                          <div className="mt-2 line-clamp-4 text-sm text-ink/75">
                            <RichPostText body={post.quotePost.body} mentionMap={post.quoteMentionMap} />
                          </div>
                        </div>
                      ) : null}
                      {extractSupportingLinks(post.metadata).length ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {extractSupportingLinks(post.metadata).map((link, index) => (
                            <a
                              key={`${post.id}-source-${index}`}
                              href={link}
                              target="_blank"
                              rel="noreferrer"
                              className="ui-pill ui-pill--teal text-xs hover:underline"
                            >
                              Source {index + 1}
                            </a>
                          ))}
                        </div>
                      ) : null}
                      {(post.mediaPaths ?? []).length ? (
                        <div className={`mt-3 grid gap-2 ${(post.mediaPaths ?? []).length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                          {(post.mediaPaths ?? []).map((path) => (
                            <img key={path} src={signedImagesQuery.data?.[path]} alt="" className="h-[320px] w-full rounded-[24px] object-cover" />
                          ))}
                        </div>
                      ) : null}
                    </div>
                    {post.topics?.length ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {post.topics.map((topic: { id: string; slug: string; label: string }) => (
                          <Link key={topic.id} to="/app/messages/topics/$slug" params={{ slug: topic.slug }} className="text-xs font-bold text-sky">
                            #{topic.label}
                          </Link>
                        ))}
                      </div>
                    ) : null}
                    <div className="mt-3 flex items-center justify-between text-ink/60">
                      <ActionButton
                        icon={<MessageCircle className="h-5 w-5" />}
                        label="Reply"
                        count={post.replyCount}
                        onClick={() => navigate({ to: '/app/messages/post/$postId', params: { postId: post.id } })}
                      />
                      <ActionButton
                        icon={<Repeat2 className={`h-5 w-5 ${post.viewerReposted ? 'text-teal' : ''}`} />}
                        label={post.viewerReposted ? 'Undo repost' : 'Repost'}
                        count={post.repostCount}
                        onClick={() => engagementMutation.mutate({ postId: post.id, field: 'reposted' })}
                      />
                      <ActionButton
                        icon={<Heart className={`h-5 w-5 ${post.viewerLiked ? 'fill-current text-berry' : ''}`} />}
                        label={post.viewerLiked ? 'Unlike' : 'Like'}
                        count={post.likeCount}
                        onClick={() => engagementMutation.mutate({ postId: post.id, field: 'liked' })}
                      />
                    <ActionButton
                      icon={<Bookmark className={`h-5 w-5 ${post.viewerBookmarked ? 'fill-current text-ink' : ''}`} />}
                      label={post.viewerBookmarked ? 'Unsave' : 'Save'}
                      count={post.bookmarkCount}
                      onClick={() => engagementMutation.mutate({ postId: post.id, field: 'bookmarked' })}
                    />
                    {post.author_id !== session?.user.id ? (
                      <ActionButton
                        icon={<Send className="h-5 w-5" />}
                        label="Direct message"
                        onClick={() =>
                          setDmDraft({
                            profileId: post.author_id,
                            displayName: post.author?.display_name || post.author?.handle || 'Direct message',
                          })
                        }
                      />
                    ) : null}
                      <ActionButton
                        icon={<Waves className="h-5 w-5" />}
                        label={post.linked_project_id ? 'Open project' : 'Create project'}
                        count={post.linked_project_id ? 1 : 0}
                        onClick={() => {
                          if (post.linked_project_id) {
                            void navigate({ to: '/app/projects/$projectId/conversation', params: { projectId: post.linked_project_id } })
                            return
                          }
                          setFlowError(null)
                          setFlowDraft({ postId: post.id, body: post.body, projectId: post.linked_project_id ?? null })
                          setFlowTitle(post.body.slice(0, 60))
                          setFlowDate(post.created_at.slice(0, 10))
                        }}
                      />
                      <ActionButton
                        icon={<Share2 className="h-5 w-5" />}
                        label="Copy link"
                        onClick={() => navigator.clipboard.writeText(`${window.location.origin}/app/messages/post/${post.id}`)}
                      />
                      {post.author_id === session?.user.id ? (
                        <ActionButton
                          icon={<Pencil className="h-5 w-5" />}
                          label="Edit post"
                          onClick={() => {
                            setEditingPost({ id: post.id, mediaPaths: post.mediaPaths ?? [] })
                            setBody(post.body)
                            setProjectId(post.linked_project_id ?? '')
                            setContentKind(post.content_kind)
                            setClaimLinksText(extractSupportingLinks(post.metadata).join('\n'))
                            setSelectedImages([])
                            setQuoteTarget(null)
                            setComposerError(null)
                            setComposerOpen(true)
                          }}
                        />
                      ) : null}
                      <button
                        type="button"
                        className="group relative ui-action-button text-xs font-bold"
                        onClick={() => {
                          setQuoteTarget({
                            id: post.id,
                            body: post.body,
                            author: post.author?.handle || 'user',
                          })
                          setComposerOpen(true)
                        }}
                      >
                        Quote
                        <span className="pointer-events-none absolute left-1/2 top-[calc(100%+0.55rem)] z-[70] w-max -translate-x-1/2 rounded-[16px] border border-ink/10 bg-white px-3 py-2 text-xs font-medium text-ink/80 opacity-0 shadow-xl transition-all duration-150 ease-out delay-500 group-hover:translate-y-1 group-hover:opacity-100 group-hover:delay-500">
                          Quote post
                          <span className="absolute left-1/2 top-0 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rotate-45 border-l border-t border-ink/10 bg-white" />
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            ))}
            {!filteredFeed.length ? <div className="px-5 py-6 text-sm text-ink/60">{linkedProjectId ? 'No project conversation yet.' : 'No posts match that search yet.'}</div> : null}
          </div>
        </div>

        <div className="relative z-0 space-y-3 xl:sticky xl:top-3 xl:self-start">
          <AppCard className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/40" />
              <AppInput value={rightSearch} onChange={(event) => setRightSearch(event.target.value)} className="pl-10" style={{ paddingLeft: '2.5rem' }} placeholder="Search posts, people, or topics" />
            </div>
          </AppCard>
          <AppCard className="space-y-3">
            <SectionHeading title="Feeds" />
            <div className="grid gap-2">
              {sidebarTopics.slice(0, 6).map((topic) => (
                <Link key={topic.id} to="/app/messages/topics/$slug" params={{ slug: topic.slug }}>
                  <AppButton className="w-full justify-start" variant="ghost">#{topic.label}</AppButton>
                </Link>
              ))}
              {!sidebarTopics.length ? <p className="text-sm text-ink/60">No matching topics.</p> : null}
            </div>
          </AppCard>
          <AppCard className="space-y-3">
            <SectionHeading title="Suggested follows" />
            {filteredPeople.slice(0, 5).map((person) => (
              <div key={person.id} className="ui-panel flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <Link to="/app/messages/profile/$profileId" params={{ profileId: person.id }} className="block truncate font-bold text-ink">
                    {person.display_name || person.handle}
                  </Link>
                  <p className="truncate text-sm text-ink/55">@{person.handle}</p>
                </div>
                <AppButton variant="ghost" onClick={() => navigate({ to: '/app/messages/profile/$profileId', params: { profileId: person.id } })}>
                  View
                </AppButton>
              </div>
            ))}
            {!filteredPeople.length ? <p className="text-sm text-ink/60">No matching people.</p> : null}
          </AppCard>
          <AppCard className="space-y-3">
            <SectionHeading eyebrow="Private" title="DMs" />
            <div className="space-y-2">
              {(dmThreadsQuery.data ?? []).slice(0, 4).map((thread) => (
                <Link key={thread.id} to="/app/messages/dm/$threadId" params={{ threadId: thread.id }} className="ui-panel block">
                  <p className="font-extrabold text-ink">{thread.title || 'Direct message'}</p>
                  <p className="text-sm text-ink/55">{thread.thread_kind}</p>
                </Link>
              ))}
              {!dmThreadsQuery.data?.length ? <p className="text-sm text-ink/60">No direct messages yet.</p> : null}
            </div>
          </AppCard>
        </div>
      </div>

      {composerOpen ? (
        <div className="fixed inset-0 z-40 flex items-start justify-center bg-ink/35 px-4 py-10 backdrop-blur-sm">
          <AppCard className="w-full max-w-2xl space-y-4">
            <SectionHeading eyebrow={editingPost ? 'Edit post' : 'New post'} title={editingPost ? 'Refine your post' : 'Share an update'} action={<button type="button" className="ui-soft-icon-button" onClick={() => resetComposer()}><X className="h-4 w-4" /></button>} />
            <div className="relative">
              <AppTextarea
                ref={postComposerRef}
                value={body}
                onChange={(event) => {
                  setBody(event.target.value)
                  updateAutocomplete('post', event.target.value, event.target.selectionStart ?? event.target.value.length, setAutocomplete, setActiveSuggestionIndex)
                }}
                onKeyDown={(event) =>
                  handleAutocompleteKeyDown({
                    event,
                    autocomplete,
                    options: autocompleteOptions,
                    activeSuggestionIndex,
                    setActiveSuggestionIndex,
                    applyOption: (option) =>
                      applyAutocompleteOption({
                        kind: 'post',
                        option,
                        autocomplete,
                        refs: { post: postComposerRef, reply: replyComposerRef, dm: dmComposerRef },
                        values: { post: body, reply: replyBody, dm: dmBody },
                        setters: { post: setBody, reply: setReplyBody, dm: setDmBody },
                        clearAutocomplete: () => setAutocomplete(null),
                      }),
                    clearAutocomplete: () => setAutocomplete(null),
                  })
                }
                onClick={(event) => updateAutocomplete('post', event.currentTarget.value, event.currentTarget.selectionStart ?? event.currentTarget.value.length, setAutocomplete, setActiveSuggestionIndex)}
                onKeyUp={(event) => updateAutocomplete('post', event.currentTarget.value, event.currentTarget.selectionStart ?? event.currentTarget.value.length, setAutocomplete, setActiveSuggestionIndex)}
                className="min-h-28"
                placeholder="What's happening? Try @, #, or /"
              />
              <p className="mt-2 text-xs text-ink/50">Examples: <span className="font-bold">@avery</span> <span className="font-bold">#moving</span> <span className="font-bold">/@</span> <span className="font-bold">/support</span></p>
              {autocomplete?.kind === 'post' ? (
                <AutocompleteMenu
                  options={autocompleteOptions}
                  activeIndex={activeSuggestionIndex}
                  onSelect={(option) =>
                    applyAutocompleteOption({
                      kind: 'post',
                      option,
                      autocomplete,
                      refs: { post: postComposerRef, reply: replyComposerRef, dm: dmComposerRef },
                      values: { post: body, reply: replyBody, dm: dmBody },
                      setters: { post: setBody, reply: setReplyBody, dm: setDmBody },
                      clearAutocomplete: () => setAutocomplete(null),
                    })
                  }
                />
              ) : null}
            </div>
            <AppSelect value={projectId} onChange={(event) => setProjectId(event.target.value)}>
              <option value="">No linked project</option>
              {(projectsQuery.data ?? []).map((project) => (
                <option key={project.id} value={project.id}>
                  {project.title}
                </option>
              ))}
            </AppSelect>
            <div className="flex flex-wrap gap-2">
              {(['update', 'product', 'opinion', 'claim'] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setContentKind(item)}
                  className={contentKind === item ? 'ui-chip-toggle ui-chip-toggle--active' : 'ui-chip-toggle ui-chip-toggle--inactive'}
                >
                  {labelForKind(item)}
                </button>
              ))}
            </div>
            <AppPanel tone="surface" className="text-xs text-ink/60">
              Choose the nature of the post so people know whether this is an update, product, opinion, or checkable claim.
            </AppPanel>
            {contentKind === 'claim' ? (
              <div className="space-y-2">
                <AppTextarea
                  value={claimLinksText}
                  onChange={(event) => setClaimLinksText(event.target.value)}
                  className="min-h-20"
                  placeholder="Add 1 or 2 supporting links, one per line"
                />
                <p className="text-xs text-ink/55">Fact claims need one or two supporting links.</p>
              </div>
            ) : null}
            {editingPost?.mediaPaths?.length ? (
              <AppPanel tone="surface" className="text-xs text-ink/60">
                Existing images stay attached while you edit this post. Image replacement can come next.
              </AppPanel>
            ) : null}
            {quoteTarget ? (
              <div className="ui-quote-card">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-ink/50">Quoting @{quoteTarget.author}</p>
                    <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm text-ink/75">{quoteTarget.body}</p>
                  </div>
                  <button type="button" className="ui-soft-icon-button" onClick={() => setQuoteTarget(null)}>
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ) : null}
            {composerError ? <AppPanel tone="peach" className="text-sm">{composerError}</AppPanel> : null}
            {selectedImages.length ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {selectedImages.map((file, index) => (
                  <div key={`${file.name}-${index}`} className="ui-media-frame">
                    <img src={URL.createObjectURL(file)} alt="" className="h-48 w-full object-cover" />
                    <button
                      type="button"
                      className="ui-soft-icon-button absolute right-2 top-2"
                      onClick={() => setSelectedImages((current) => current.filter((_, currentIndex) => currentIndex !== index))}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
            <div className="flex items-center justify-between gap-3">
              <label className="ui-upload-chip">
                <ImagePlus className="mr-1 inline h-3 w-3" />
                Add images
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(event) => setSelectedImages((current) => [...current, ...Array.from(event.target.files ?? [])])}
                />
              </label>
              <div className="flex gap-2">
                <AppButton variant="ghost" onClick={() => {
                  resetComposer()
                }}>Cancel</AppButton>
                <AppButton
                  disabled={
                    !session ||
                    createPostMutation.isPending ||
                    updatePostMutation.isPending ||
                    (!body.trim() && !selectedImages.length)
                  }
                  onClick={() => {
                    if (editingPost) {
                      updatePostMutation.mutate()
                    } else {
                      createPostMutation.mutate()
                    }
                  }}
                >
                  {editingPost ? (updatePostMutation.isPending ? 'Saving…' : 'Save changes') : createPostMutation.isPending ? 'Publishing…' : 'Publish'}
                </AppButton>
              </div>
            </div>
          </AppCard>
        </div>
      ) : null}

      {flowDraft ? (
        <div className="fixed inset-0 z-40 flex items-start justify-center bg-ink/35 px-4 py-10 backdrop-blur-sm">
          <AppCard className="w-full max-w-xl space-y-4">
            <SectionHeading eyebrow="Create project" title="Turn this message into a project" action={<button type="button" className="ui-soft-icon-button" onClick={() => setFlowDraft(null)}><X className="h-4 w-4" /></button>} />
            <AppPanel tone="butter" className="text-sm text-ink/70">{flowDraft.body}</AppPanel>
            <AppInput value={flowTitle} onChange={(event) => setFlowTitle(event.target.value)} placeholder="Project title" />
            <AppInput type="date" value={flowDate} onChange={(event) => setFlowDate(event.target.value)} />
            {flowError ? <AppPanel tone="peach" className="text-sm">{flowError}</AppPanel> : null}
            <div className="flex justify-end gap-2">
              <AppButton variant="ghost" onClick={() => {
                setFlowDraft(null)
                setFlowError(null)
              }}>Cancel</AppButton>
              <AppButton disabled={!session || createFlowMutation.isPending} onClick={() => createFlowMutation.mutate()}>
                {createFlowMutation.isPending ? 'Creating…' : 'Create project'}
              </AppButton>
            </div>
          </AppCard>
        </div>
      ) : null}

      {dmDraft ? (
        <div className="fixed inset-0 z-40 flex items-start justify-center bg-ink/35 px-4 py-10 backdrop-blur-sm">
          <AppCard className="w-full max-w-md space-y-4">
            <SectionHeading eyebrow="Direct message" title={`Message ${dmDraft.displayName}?`} action={<button type="button" className="ui-soft-icon-button" onClick={() => setDmDraft(null)}><X className="h-4 w-4" /></button>} />
            <AppPanel className="text-sm text-ink/70">
              Direct messages are possible from a post, but with a little friction so people don’t feel instantly cold-opened.
            </AppPanel>
            <div className="flex justify-end gap-2">
              <AppButton variant="ghost" onClick={() => setDmDraft(null)}>Cancel</AppButton>
              <AppButton disabled={!session || dmShortcutMutation.isPending} onClick={() => dmShortcutMutation.mutate()}>
                Open DM
              </AppButton>
            </div>
          </AppCard>
        </div>
      ) : null}

      {labelReviewDraft ? (
        <div className="fixed inset-0 z-40 flex items-start justify-center bg-ink/35 px-4 py-10 backdrop-blur-sm">
          <AppCard className="w-full max-w-md space-y-4">
            <SectionHeading eyebrow="Review label" title="Does this look mislabeled?" action={<button type="button" className="ui-soft-icon-button" onClick={() => setLabelReviewDraft(null)}><X className="h-4 w-4" /></button>} />
            <AppPanel className="text-sm text-ink/75">
              Current label: <span className="font-bold">{labelForKind(labelReviewDraft.currentKind)}</span>. If it looks off, suggest a better fit below.
            </AppPanel>
            {labelReviewDraft.isOwnPost ? (
              <div className="grid gap-2">
                {labelReviewDraft.peerReasons?.length ? (
                  <AppPanel tone="butter" className="space-y-2 text-sm text-ink/75">
                    <p className="font-bold text-ink">Why people flagged it</p>
                    <div className="space-y-1">
                      {labelReviewDraft.peerReasons.map((reason) => (
                        <p key={reason} className="rounded-2xl bg-white/70 px-3 py-2 text-sm">
                          “{reason}”
                        </p>
                      ))}
                    </div>
                  </AppPanel>
                ) : null}
                {(['update', 'product', 'opinion', 'claim'] as const).map((item) => (
                  <AppButton
                    key={item}
                    variant={labelReviewDraft.currentKind === item ? 'primary' : 'ghost'}
                    disabled={labelReviewDraft.currentKind === item || ownLabelMutation.isPending}
                    onClick={() => ownLabelMutation.mutate({ postId: labelReviewDraft.postId, contentKind: item })}
                  >
                    Change to {labelForKind(item)}
                  </AppButton>
                ))}
                <AppPanel tone="surface" className="text-sm text-ink/70">
                  You can fix the label on your own post here. To switch a post to a fact claim, it needs supporting links first.
                </AppPanel>
                {ownLabelMutation.error ? <AppPanel tone="peach" className="text-sm">{describeError(ownLabelMutation.error, 'Could not update the label.')}</AppPanel> : null}
              </div>
            ) : (
              <div className="grid gap-2">
                <AppInput
                  value={labelReason}
                  onChange={(event) => setLabelReason(event.target.value.slice(0, 40))}
                  placeholder="Optional short reason"
                />
                <p className="text-right text-xs text-ink/45">{labelReason.length}/40</p>
                {(['update', 'product', 'opinion', 'claim'] as const).map((item) => (
                  <AppButton
                    key={item}
                    variant={labelReviewDraft.currentFlag === item ? 'primary' : 'ghost'}
                    disabled={item === labelReviewDraft.currentKind || labelFlagMutation.isPending}
                    onClick={() => labelFlagMutation.mutate({ postId: labelReviewDraft.postId, suggestedKind: item })}
                  >
                    Flag as {labelForKind(item)}
                  </AppButton>
                ))}
              </div>
            )}
            <AppPanel tone="butter" className="text-xs text-ink/70">
              If enough people raise the same concern, the post is marked for review and the poster gets a gentle notice to check the label.
            </AppPanel>
          </AppCard>
        </div>
      ) : null}
    </>
  )
}

function ProjectMessagesPage() {
  const { projectId } = projectMessagesRoute.useParams()
  return <MessagesFeedPage linkedProjectId={projectId} />
}

function PostDetailPage() {
  const { session } = useAppStore()
  const { postId } = postRoute.useParams()
  const queryClient = useQueryClient()
  const [body, setBody] = useState('')
  const [autocomplete, setAutocomplete] = useState<AutocompleteState | null>(null)
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0)
  const replyComposerRef = useRef<HTMLTextAreaElement>(null)
  const peopleQuery = useQuery({
    queryKey: ['people-directory', session?.user.id],
    queryFn: () => fetchPeopleDirectory(session!.user.id),
    enabled: Boolean(session?.user.id),
  })
  const topicsQuery = useQuery({
    queryKey: ['topics', session?.user.id],
    queryFn: () => fetchTopics(session?.user.id),
    enabled: Boolean(session?.user.id),
  })
  const postQuery = useQuery({
    queryKey: ['post', postId, session?.user.id],
    queryFn: () => fetchPost(postId, session!.user.id),
    enabled: Boolean(session?.user.id),
  })
  const replyMutation = useMutation({
    mutationFn: () => createPost({ authorId: session!.user.id, body, replyToPostId: postId }),
    onSuccess: () => {
      setBody('')
      void queryClient.invalidateQueries({ queryKey: ['post', postId, session?.user.id] })
      void queryClient.invalidateQueries({ queryKey: ['social-feed'] })
    },
  })

  const autocompleteOptions = useMemo(() => {
    if (!autocomplete) return []
    return buildAutocompleteOptions(autocomplete, peopleQuery.data ?? [], topicsQuery.data ?? [])
  }, [autocomplete, peopleQuery.data, topicsQuery.data])

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {postQuery.data?.post ? (
        <AppCard className="space-y-4">
          <div className="flex items-center gap-3">
            <AvatarBadge label={postQuery.data.post.author?.display_name || 'U'} />
            <div>
              <p className="text-xl font-extrabold text-ink">{postQuery.data.post.author?.display_name || 'User'}</p>
              <p className="text-sm text-ink/55">@{postQuery.data.post.author?.handle || 'user'}</p>
            </div>
          </div>
          <div className="text-[17px] leading-8 text-ink">
            <RichPostText body={postQuery.data.post.body} mentionMap={postQuery.data.post.mentionMap} />
          </div>
        </AppCard>
      ) : null}
      <AppCard className="space-y-4">
        <div className="relative">
          <AppTextarea
            ref={replyComposerRef}
            value={body}
            onChange={(event) => {
              setBody(event.target.value)
              updateAutocomplete('reply', event.target.value, event.target.selectionStart ?? event.target.value.length, setAutocomplete, setActiveSuggestionIndex)
            }}
            onKeyDown={(event) =>
              handleAutocompleteKeyDown({
                event,
                autocomplete,
                options: autocompleteOptions,
                activeSuggestionIndex,
                setActiveSuggestionIndex,
                applyOption: (option) =>
                  applyAutocompleteOption({
                    kind: 'reply',
                    option,
                    autocomplete,
                    refs: { post: null, reply: replyComposerRef, dm: null },
                    values: { post: '', reply: body, dm: '' },
                    setters: { post: () => undefined, reply: setBody, dm: () => undefined },
                    clearAutocomplete: () => setAutocomplete(null),
                  }),
                clearAutocomplete: () => setAutocomplete(null),
              })
            }
            onClick={(event) => updateAutocomplete('reply', event.currentTarget.value, event.currentTarget.selectionStart ?? event.currentTarget.value.length, setAutocomplete, setActiveSuggestionIndex)}
            onKeyUp={(event) => updateAutocomplete('reply', event.currentTarget.value, event.currentTarget.selectionStart ?? event.currentTarget.value.length, setAutocomplete, setActiveSuggestionIndex)}
            className="min-h-28"
            placeholder="Write a reply..."
          />
          {autocomplete?.kind === 'reply' ? (
            <AutocompleteMenu
              options={autocompleteOptions}
              activeIndex={activeSuggestionIndex}
              onSelect={(option) =>
                applyAutocompleteOption({
                  kind: 'reply',
                  option,
                  autocomplete,
                  refs: { post: null, reply: replyComposerRef, dm: null },
                  values: { post: '', reply: body, dm: '' },
                  setters: { post: () => undefined, reply: setBody, dm: () => undefined },
                  clearAutocomplete: () => setAutocomplete(null),
                })
              }
            />
          ) : null}
        </div>
        <div className="flex justify-end">
          <AppButton disabled={!session || replyMutation.isPending || !body.trim()} onClick={() => replyMutation.mutate()}>
            Reply
          </AppButton>
        </div>
      </AppCard>
      <div className="space-y-3">
        {(postQuery.data?.replies ?? []).map((reply) => (
          <AppPanel key={reply.id} className="space-y-2">
            <p className="text-sm font-bold text-ink/60">
              {reply.author?.display_name || reply.author?.handle || 'User'} · {timeAgo(reply.created_at)}
            </p>
            <div className="text-ink">
              <RichPostText body={reply.body} mentionMap={reply.mentionMap} />
            </div>
          </AppPanel>
        ))}
      </div>
    </div>
  )
}

function SocialProfilePage() {
  const { session } = useAppStore()
  const { profileId } = socialProfileRoute.useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const profileQuery = useQuery({
    queryKey: ['social-profile', profileId, session?.user.id],
    queryFn: () => fetchSocialProfile(profileId, session!.user.id),
    enabled: Boolean(session?.user.id),
  })
  const feedQuery = useQuery({
    queryKey: ['social-feed', session?.user.id, 'discover'],
    queryFn: () => fetchFeed(session!.user.id, 'discover'),
    enabled: Boolean(session?.user.id),
  })
  const dmThreadsQuery = useQuery({ queryKey: ['dm-threads'], queryFn: fetchDmThreads, enabled: Boolean(session?.user.id) })
  const followMutation = useMutation({
    mutationFn: () => toggleFollow({ followerId: session!.user.id, followeeId: profileId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['social-profile', profileId, session?.user.id] })
      void queryClient.invalidateQueries({ queryKey: ['social-feed'] })
    },
  })
  const dmMutation = useMutation({
    mutationFn: async () => {
      const existing = (dmThreadsQuery.data ?? []).find((thread) => thread.title === (profileQuery.data?.profile?.display_name || 'Direct message'))
      if (existing) return existing
      return createDmThread({
        ownerId: session!.user.id,
        title: profileQuery.data?.profile?.display_name || 'Direct message',
        threadKind: 'direct',
        memberIds: [profileId],
      })
    },
    onSuccess: (thread) => {
      void queryClient.invalidateQueries({ queryKey: ['dm-threads'] })
      void queryClient.invalidateQueries({ queryKey: ['social-profile', profileId, session?.user.id] })
      void navigate({ to: '/app/messages/dm/$threadId', params: { threadId: thread.id } })
    },
  })

  const posts = (feedQuery.data ?? []).filter((post) => post.author_id === profileId)

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link to="/app/messages" className="inline-flex items-center gap-1 text-sm font-bold text-ink/60 hover:text-ink">
        ← Messages
      </Link>
      <AppCard className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex gap-3">
            <AvatarBadge label={profileQuery.data?.profile?.display_name || 'U'} />
            <div>
              <h2 className="ui-section-title text-2xl">{profileQuery.data?.profile?.display_name || 'User'}</h2>
              <p className="text-sm text-ink/55">@{profileQuery.data?.profile?.handle || 'user'}</p>
              <p className="mt-2 text-sm text-ink/70">{profileQuery.data?.profile?.bio || 'No bio yet.'}</p>
            </div>
          </div>
          {session?.user.id !== profileId ? (
            <div className="flex gap-2">
              <AppButton onClick={() => followMutation.mutate()}>
                {profileQuery.data?.viewerFollows ? 'Following' : 'Follow'}
              </AppButton>
              <AppButton variant="ghost" onClick={() => dmMutation.mutate()} disabled={dmMutation.isPending}>
                Message
              </AppButton>
            </div>
          ) : null}
        </div>
        <p className="text-sm text-ink/60">
          {profileQuery.data?.followerCount ?? 0} followers · {profileQuery.data?.followingCount ?? 0} following
        </p>
      </AppCard>
      {posts.map((post) => (
        <AppCard key={post.id}>
          <Link to="/app/messages/post/$postId" params={{ postId: post.id }} className="block whitespace-pre-wrap text-ink">
            {post.body}
          </Link>
        </AppCard>
      ))}
    </div>
  )
}

function TopicFeedPage() {
  const { session } = useAppStore()
  const { slug } = topicRoute.useParams()
  const queryClient = useQueryClient()
  const topicsQuery = useQuery({
    queryKey: ['topics', session?.user.id],
    queryFn: () => fetchTopics(session?.user.id),
    enabled: Boolean(session?.user.id),
  })
  const topicFeedQuery = useQuery({
    queryKey: ['topic-feed', slug, session?.user.id],
    queryFn: () => fetchTopicFeed(slug, session!.user.id),
    enabled: Boolean(session?.user.id),
  })
  const topic = (topicsQuery.data ?? []).find((item) => item.slug === slug)
  const subscriptionMutation = useMutation({
    mutationFn: () => toggleTopicSubscription({ topicId: topic!.id, userId: session!.user.id }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['topics'] })
    },
  })

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <AppCard className="space-y-4">
        <SectionHeading
          eyebrow="Topic"
          title={topic?.label || slug}
          action={topic ? <AppButton onClick={() => subscriptionMutation.mutate()}>{topic.viewerSubscribed ? 'Following topic' : 'Follow topic'}</AppButton> : null}
        />
        <p className="text-sm text-ink/60">
          Follow themes to tune what shows up in your main feed.
        </p>
      </AppCard>
      {(topicFeedQuery.data ?? []).map((post) => (
        <AppCard key={post.id}>
          <Link to="/app/messages/post/$postId" params={{ postId: post.id }} className="block whitespace-pre-wrap text-ink">
            {post.body}
          </Link>
        </AppCard>
      ))}
    </div>
  )
}

function DmInboxPage() {
  const { session, profile } = useAppStore()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const threadsQuery = useQuery({ queryKey: ['dm-threads'], queryFn: fetchDmThreads })
  const peopleQuery = useQuery({
    queryKey: ['people-directory', session?.user.id],
    queryFn: () => fetchPeopleDirectory(session!.user.id),
    enabled: Boolean(session?.user.id),
  })
  const [title, setTitle] = useState('')
  const [memberId, setMemberId] = useState('')
  const createMutation = useMutation({
    mutationFn: () =>
      createDmThread({
        ownerId: session!.user.id,
        title: title || 'New chat',
        threadKind: 'direct',
        memberIds: memberId ? [memberId] : [],
      }),
    onSuccess: (thread) => {
      setTitle('')
      setMemberId('')
      void queryClient.invalidateQueries({ queryKey: ['dm-threads'] })
      void navigate({ to: '/app/messages/dm/$threadId', params: { threadId: thread.id } })
    },
  })

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <AppCard className="space-y-4">
        <SectionHeading eyebrow="DMs" title="Direct messages" action={<Link to="/app/messages"><AppButton variant="ghost">Back to feed</AppButton></Link>} />
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
          <AppInput value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Chat name" />
          <AppSelect value={memberId} onChange={(event) => setMemberId(event.target.value)}>
            <option value="">Choose a person</option>
            {(peopleQuery.data ?? []).map((person) => (
              <option key={person.id} value={person.id}>
                {person.display_name || person.handle}
              </option>
            ))}
          </AppSelect>
          <AppButton disabled={!session || createMutation.isPending || !memberId} onClick={() => createMutation.mutate()}>
            Start
          </AppButton>
        </div>
      </AppCard>
      {(threadsQuery.data ?? []).map((thread) => (
        <AppCard key={thread.id}>
          <Link to="/app/messages/dm/$threadId" params={{ threadId: thread.id }} className="flex items-center gap-3">
            <AvatarBadge label={thread.title || profile?.first_name || 'D'} />
            <div>
              <p className="font-extrabold text-ink">{thread.title || 'Direct message'}</p>
              <p className="text-sm text-ink/55">{thread.thread_kind}</p>
            </div>
          </Link>
        </AppCard>
      ))}
    </div>
  )
}

function DmThreadPage() {
  const { session } = useAppStore()
  const { threadId } = dmThreadRoute.useParams()
  const queryClient = useQueryClient()
  const [body, setBody] = useState('')
  const [selectedImages, setSelectedImages] = useState<File[]>([])
  const [autocomplete, setAutocomplete] = useState<AutocompleteState | null>(null)
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0)
  const composerRef = useRef<HTMLTextAreaElement>(null)
  const peopleQuery = useQuery({
    queryKey: ['people-directory', session?.user.id],
    queryFn: () => fetchPeopleDirectory(session!.user.id),
    enabled: Boolean(session?.user.id),
  })
  const topicsQuery = useQuery({
    queryKey: ['topics', session?.user.id],
    queryFn: () => fetchTopics(session?.user.id),
    enabled: Boolean(session?.user.id),
  })
  const messagesQuery = useQuery({ queryKey: ['dm-messages', threadId], queryFn: () => fetchDmMessages(threadId) })
  const imagePaths = useMemo(
    () => (messagesQuery.data ?? []).flatMap((message) => (Array.isArray(message.metadata?.imagePaths) ? (message.metadata.imagePaths as string[]) : [])),
    [messagesQuery.data],
  )
  const signedImagesQuery = useQuery({
    queryKey: ['dm-images', threadId, imagePaths],
    queryFn: () => getSignedDmImageUrls(imagePaths),
    enabled: imagePaths.length > 0,
  })
  const sendMutation = useMutation({
    mutationFn: async () => {
      const imagePaths = selectedImages.length ? await uploadDmImages(session!.user.id, selectedImages) : []
      return sendDmMessage({ threadId, authorId: session!.user.id, body, imagePaths })
    },
    onSuccess: () => {
      setBody('')
      setSelectedImages([])
      void queryClient.invalidateQueries({ queryKey: ['dm-messages', threadId] })
    },
  })

  const autocompleteOptions = useMemo(() => {
    if (!autocomplete) return []
    return buildAutocompleteOptions(autocomplete, peopleQuery.data ?? [], topicsQuery.data ?? [])
  }, [autocomplete, peopleQuery.data, topicsQuery.data])

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <AppCard className="space-y-4">
        <SectionHeading eyebrow="DM" title="Chat" action={<Link to="/app/messages/dm"><AppButton variant="ghost">Inbox</AppButton></Link>} />
      </AppCard>
      <AppCard className="space-y-3">
        {(messagesQuery.data ?? []).map((message) => (
          <div key={message.id} className={`flex ${message.author_id === session?.user.id ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-[24px] px-4 py-3 ${message.author_id === session?.user.id ? 'bg-ink text-white' : 'bg-cloud text-ink'}`}>
              <p className="whitespace-pre-wrap text-sm">{message.body}</p>
              {Array.isArray(message.metadata?.imagePaths) && message.metadata.imagePaths.length ? (
                <div className="mt-2 grid gap-2">
                  {(message.metadata.imagePaths as string[]).map((path) => (
                    <img key={path} src={signedImagesQuery.data?.[path]} alt="" className="h-56 w-full rounded-[18px] object-cover" />
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        ))}
        <div className="relative">
          <AppTextarea
            ref={composerRef}
            value={body}
            onChange={(event) => {
              setBody(event.target.value)
              updateAutocomplete('dm', event.target.value, event.target.selectionStart ?? event.target.value.length, setAutocomplete, setActiveSuggestionIndex)
            }}
            onKeyDown={(event) =>
              handleAutocompleteKeyDown({
                event,
                autocomplete,
                options: autocompleteOptions,
                activeSuggestionIndex,
                setActiveSuggestionIndex,
                applyOption: (option) =>
                  applyAutocompleteOption({
                    kind: 'dm',
                    option,
                    autocomplete,
                    refs: { post: null, reply: null, dm: composerRef },
                    values: { post: '', reply: '', dm: body },
                    setters: { post: () => undefined, reply: () => undefined, dm: setBody },
                    clearAutocomplete: () => setAutocomplete(null),
                  }),
                clearAutocomplete: () => setAutocomplete(null),
              })
            }
            onClick={(event) => updateAutocomplete('dm', event.currentTarget.value, event.currentTarget.selectionStart ?? event.currentTarget.value.length, setAutocomplete, setActiveSuggestionIndex)}
            onKeyUp={(event) => updateAutocomplete('dm', event.currentTarget.value, event.currentTarget.selectionStart ?? event.currentTarget.value.length, setAutocomplete, setActiveSuggestionIndex)}
            className="min-h-24 bg-white"
            placeholder="Write a message..."
          />
          {autocomplete?.kind === 'dm' ? (
            <AutocompleteMenu
              options={autocompleteOptions}
              activeIndex={activeSuggestionIndex}
              onSelect={(option) =>
                applyAutocompleteOption({
                  kind: 'dm',
                  option,
                  autocomplete,
                  refs: { post: null, reply: null, dm: composerRef },
                  values: { post: '', reply: '', dm: body },
                  setters: { post: () => undefined, reply: () => undefined, dm: setBody },
                  clearAutocomplete: () => setAutocomplete(null),
                })
              }
            />
          ) : null}
        </div>
        {selectedImages.length ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {selectedImages.map((file, index) => (
              <div key={`${file.name}-${index}`} className="ui-media-frame">
                <img src={URL.createObjectURL(file)} alt="" className="h-40 w-full object-cover" />
                <button
                  type="button"
                  className="ui-soft-icon-button absolute right-2 top-2"
                  onClick={() => setSelectedImages((current) => current.filter((_, currentIndex) => currentIndex !== index))}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        ) : null}
        <div className="flex items-center justify-between">
          <label className="ui-upload-chip">
            <ImagePlus className="mr-1 inline h-3 w-3" />
            Add image
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(event) => setSelectedImages((current) => [...current, ...Array.from(event.target.files ?? [])])}
            />
          </label>
          <AppButton disabled={!session || sendMutation.isPending || (!body.trim() && !selectedImages.length)} onClick={() => sendMutation.mutate()}>
            <Send className="mr-2 h-4 w-4" />
            Send
          </AppButton>
        </div>
      </AppCard>
    </div>
  )
}

function AvatarBadge({ label }: { label: string }) {
  return <div className="ui-avatar-badge">{label.slice(0, 1).toUpperCase()}</div>
}

function ActionButton({ icon, label, count, onClick }: { icon: ReactNode; label: string; count?: number; onClick?: () => void }) {
  return (
    <button type="button" className="group relative ui-action-button" onClick={onClick} aria-label={label}>
      {icon}
      {typeof count === 'number' ? <span>{count}</span> : null}
      <span className="pointer-events-none absolute left-1/2 top-[calc(100%+0.55rem)] z-[70] w-max max-w-[220px] -translate-x-1/2 rounded-[16px] border border-ink/10 bg-white px-3 py-2 text-xs font-medium text-ink/80 opacity-0 shadow-xl transition-all duration-150 ease-out delay-500 group-hover:translate-y-1 group-hover:opacity-100 group-hover:delay-500">
        {label}
        <span className="absolute left-1/2 top-0 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rotate-45 border-l border-t border-ink/10 bg-white" />
      </span>
    </button>
  )
}

function RichPostText({ body, mentionMap }: { body: string; mentionMap?: Record<string, string> }) {
  const parts = body.split(/(@[a-z0-9_-]+|#[a-z0-9_-]+)/gi)

  return (
    <p className="whitespace-pre-wrap">
      {parts.map((part, index) => {
        if (/^@[a-z0-9_-]+$/i.test(part)) {
          const handle = part.slice(1).toLowerCase()
          const profileId = mentionMap?.[handle]
          return profileId ? (
            <Link key={`${part}-${index}`} to="/app/messages/profile/$profileId" params={{ profileId }} className="font-bold text-sky hover:underline">
              {part}
            </Link>
          ) : (
            <span key={`${part}-${index}`} className="font-bold text-sky">
              {part}
            </span>
          )
        }

        if (/^#[a-z0-9_-]+$/i.test(part)) {
          const slug = part.slice(1).toLowerCase()
          return (
            <Link key={`${part}-${index}`} to="/app/messages/topics/$slug" params={{ slug }} className="font-bold text-sky hover:underline">
              {part}
            </Link>
          )
        }

        return <span key={`${part}-${index}`}>{part}</span>
      })}
    </p>
  )
}

function LabelBadge({
  kind,
  reviewState,
  flagCount = 0,
  interactive = false,
  viewerFlagged = false,
  isOwnPost = false,
  onClick,
}: {
  kind: 'update' | 'product' | 'opinion' | 'claim' | 'review'
  reviewState?: 'clear' | 'peer_review' | 'under_review' | 'resolved'
  flagCount?: number
  interactive?: boolean
  viewerFlagged?: boolean
  isOwnPost?: boolean
  onClick?: () => void
}) {
  const className =
    kind === 'product'
      ? 'bg-amber-300 text-amber-950'
      : kind === 'opinion'
        ? 'bg-fuchsia-200 text-fuchsia-950'
        : kind === 'claim'
          ? 'bg-cyan-500 text-white'
          : kind === 'review'
            ? 'bg-zinc-200 text-zinc-900'
            : 'bg-slate-300 text-slate-900'
  const statusText =
    reviewState === 'under_review'
      ? `${labelNarration(kind)} It has been flagged for review.`
      : reviewState === 'peer_review'
        ? `${labelNarration(kind)} It has been flagged by peers for a label review.`
        : viewerFlagged
          ? `${labelNarration(kind)} You have flagged it as possibly mislabeled.`
          : isOwnPost
            ? `${labelNarration(kind)} Click to review how it reads to other people.`
            : interactive
              ? `${labelNarration(kind)} Click to review or flag the label.`
              : labelNarration(kind)
  const title = `${labelForKind(kind)} (${kindLetter(kind)})${flagCount ? ` • ${flagCount} label flag${flagCount === 1 ? '' : 's'}` : ''}. ${statusText}`

  return (
    <div className="group relative z-20 inline-flex group-hover:z-50">
      <button
        type="button"
        aria-label={title}
        onClick={(event) => {
          event.stopPropagation()
          if (interactive) onClick?.()
        }}
        className={`inline-flex h-7 min-w-7 items-center justify-center rounded-full border border-white/80 px-2 text-[11px] font-black uppercase tracking-[0.12em] shadow-sm transition ${className} ${interactive ? 'cursor-pointer hover:-translate-y-0.5' : 'cursor-default'} ${viewerFlagged || (reviewState && reviewState !== 'clear') ? 'ring-2 ring-berry/35' : ''}`}
      >
        <span>{kindLetter(kind)}</span>
        {reviewState && reviewState !== 'clear' ? <span className="ml-1 text-[10px]">!</span> : null}
        {flagCount > 0 ? <span className="ml-1 text-[10px]">{flagCount}</span> : null}
      </button>
      <div className="pointer-events-none absolute left-1/2 top-[calc(100%+0.65rem)] z-[80] w-64 -translate-x-1/2 translate-y-0 opacity-0 transition duration-150 ease-out group-hover:translate-y-1 group-hover:opacity-100">
        <div className="relative origin-top scale-95 rounded-[18px] border border-ink/10 bg-white px-3 py-2 text-left shadow-xl transition duration-150 ease-out group-hover:scale-100 group-hover:shadow-2xl">
          <div className="absolute left-1/2 top-0 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rotate-45 border-l border-t border-ink/10 bg-white" />
          <p className="text-xs font-black uppercase tracking-[0.18em] text-ink/45">{labelForKind(kind)}</p>
          <p className="mt-1 text-sm leading-6 text-ink/80">{statusText}</p>
          {flagCount ? <p className="mt-1 text-xs font-bold text-berry/80">{flagCount} peer flag{flagCount === 1 ? '' : 's'}</p> : null}
        </div>
      </div>
    </div>
  )
}

function labelNarration(kind: 'update' | 'product' | 'opinion' | 'claim' | 'review') {
  return kind === 'product'
    ? 'The author says this post promotes a product, service, or offer.'
    : kind === 'opinion'
      ? 'The author says this post is opinion only.'
      : kind === 'claim'
        ? 'The author says this post makes a factual claim.'
        : kind === 'review'
          ? 'This post is a verified purchase review.'
          : 'The author says this post is an update.'
}

function kindLetter(kind: 'update' | 'product' | 'opinion' | 'claim' | 'review') {
  return kind === 'product' ? 'P' : kind === 'opinion' ? 'O' : kind === 'claim' ? 'F' : kind === 'review' ? 'R' : 'U'
}

function labelForKind(kind: 'update' | 'product' | 'opinion' | 'claim' | 'review') {
  return kind === 'product' ? 'Product' : kind === 'opinion' ? 'Opinion' : kind === 'claim' ? 'Fact claim' : kind === 'review' ? 'Review' : 'Update'
}

function AutocompleteMenu({
  options,
  activeIndex,
  onSelect,
}: {
  options: AutocompleteOption[]
  activeIndex: number
  onSelect: (option: AutocompleteOption) => void
}) {
  if (!options.length) return null

  return (
    <div className="ui-card absolute left-0 right-0 top-[calc(100%+0.5rem)] z-20 p-2">
      <div className="space-y-1">
        {options.map((option, index) => (
          <button
            key={`${option.trigger}-${option.id}`}
            type="button"
            className={`ui-panel flex w-full items-center justify-between gap-3 px-3 py-2 text-left ${index === activeIndex ? 'ring-2 ring-sky/40' : ''}`}
            onMouseDown={(event) => {
              event.preventDefault()
              onSelect(option)
            }}
          >
            <div className="min-w-0">
              <p className="font-bold text-ink">{option.label}</p>
              {option.subtitle ? <p className="truncate text-sm text-ink/55">{option.subtitle}</p> : null}
            </div>
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-ink/40">
              {option.trigger === '@' ? 'Person' : option.trigger === '#' ? 'Topic' : 'Support'}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

function buildAutocompleteOptions(
  autocomplete: AutocompleteState,
  people: Array<{ id: string; handle: string; display_name: string }>,
  topics: Array<{ id: string; slug: string; label: string }>,
) {
  const query = autocomplete.query.toLowerCase()

  if (autocomplete.trigger === '@') {
    return people
      .filter((person) => !query || person.handle.toLowerCase().includes(query) || (person.display_name || '').toLowerCase().includes(query))
      .slice(0, 6)
      .map((person) => ({
        id: person.id,
        label: `@${person.handle}`,
        value: person.handle,
        trigger: '@' as const,
        subtitle: person.display_name || undefined,
      }))
  }

  if (autocomplete.trigger === '/') {
    return searchSupportEntries(query)
      .slice(0, 6)
      .map((entry) => ({
        id: entry.id,
        label: entry.shortcut || `/${entry.slug}`,
        value: (entry.shortcut || `/${entry.slug}`).replace(/^\//, ''),
        trigger: '/' as const,
        subtitle: entry.summary,
      }))
  }

  return topics
    .filter((topic) => !query || topic.slug.toLowerCase().includes(query) || topic.label.toLowerCase().includes(query))
    .slice(0, 6)
    .map((topic) => ({
      id: topic.id,
      label: `#${topic.slug}`,
      value: topic.slug,
      trigger: '#' as const,
      subtitle: topic.label,
    }))
}

function updateAutocomplete(
  kind: ComposerKind,
  value: string,
  caret: number,
  setAutocomplete: (state: AutocompleteState | null) => void,
  setActiveSuggestionIndex: (index: number) => void,
) {
  const next = detectAutocomplete(value, caret, kind)
  setAutocomplete(next)
  setActiveSuggestionIndex(0)
}

function detectAutocomplete(value: string, caret: number, kind: ComposerKind): AutocompleteState | null {
  const beforeCaret = value.slice(0, caret)
  const slashMatch = beforeCaret.match(/(^|\s)(\/)([^\s]*)$/)
  if (slashMatch) {
    const query = slashMatch[3] ?? ''
    const tokenStart = caret - query.length - 1
    return {
      kind,
      trigger: '/',
      query,
      start: tokenStart,
      end: caret,
    }
  }

  const match = beforeCaret.match(/(^|\s)([@#])([a-z0-9_-]*)$/i)
  if (!match) return null
  const trigger = match[2] as '@' | '#'
  const query = match[3] ?? ''
  const tokenStart = caret - query.length - 1
  return {
    kind,
    trigger,
    query,
    start: tokenStart,
    end: caret,
  }
}

function handleAutocompleteKeyDown({
  event,
  autocomplete,
  options,
  activeSuggestionIndex,
  setActiveSuggestionIndex,
  applyOption,
  clearAutocomplete,
}: {
  event: KeyboardEvent<HTMLTextAreaElement>
  autocomplete: AutocompleteState | null
  options: AutocompleteOption[]
  activeSuggestionIndex: number
  setActiveSuggestionIndex: (index: number | ((value: number) => number)) => void
  applyOption: (option: AutocompleteOption) => void
  clearAutocomplete: () => void
}) {
  if (!autocomplete || !options.length) return

  if (event.key === 'ArrowDown') {
    event.preventDefault()
    setActiveSuggestionIndex((current) => (current + 1) % options.length)
    return
  }

  if (event.key === 'ArrowUp') {
    event.preventDefault()
    setActiveSuggestionIndex((current) => (current - 1 + options.length) % options.length)
    return
  }

  if (event.key === 'Enter' || event.key === 'Tab') {
    event.preventDefault()
    applyOption(options[activeSuggestionIndex] ?? options[0])
    return
  }

  if (event.key === 'Escape') {
    event.preventDefault()
    clearAutocomplete()
  }
}

function applyAutocompleteOption({
  kind,
  option,
  autocomplete,
  refs,
  values,
  setters,
  clearAutocomplete,
}: {
  kind: ComposerKind
  option: AutocompleteOption
  autocomplete: AutocompleteState | null
  refs: {
    post: RefObject<HTMLTextAreaElement | null> | null
    reply: RefObject<HTMLTextAreaElement | null> | null
    dm: RefObject<HTMLTextAreaElement | null> | null
  }
  values: {
    post: string
    reply: string
    dm: string
  }
  setters: {
    post: (value: string) => void
    reply: (value: string) => void
    dm: (value: string) => void
  }
  clearAutocomplete: () => void
}) {
  if (!autocomplete) return
  const value = values[kind]
  const nextValue = `${value.slice(0, autocomplete.start)}${option.trigger}${option.value} ${value.slice(autocomplete.end)}`
  setters[kind](nextValue)
  clearAutocomplete()

  const ref = refs[kind]
  if (!ref?.current) return
  const nextCaret = autocomplete.start + option.value.length + 2
  requestAnimationFrame(() => {
    ref.current?.focus()
    ref.current?.setSelectionRange(nextCaret, nextCaret)
  })
}

function timeAgo(value: string) {
  const diffMs = Date.now() - new Date(value).getTime()
  const diffHours = Math.max(1, Math.round(diffMs / 3600000))
  return `${diffHours}h`
}

function parseSupportingLinks(value: string) {
  const candidates = value
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean)

  const unique = [...new Set(candidates)]
  for (const candidate of unique) {
    try {
      const url = new URL(candidate)
      if (!['http:', 'https:'].includes(url.protocol)) {
        throw new Error('invalid protocol')
      }
    } catch {
      throw new Error('Supporting links must be valid http or https URLs.')
    }
  }
  return unique
}

function extractReviewMeta(metadata: unknown): { rating: number; listingId: string; listingTitle: string | null; reviewId: string } | null {
  if (!metadata || typeof metadata !== 'object') return null
  const m = metadata as Record<string, unknown>
  if (!m.review_id || typeof m.rating !== 'number' || typeof m.listing_id !== 'string') return null
  return {
    rating: m.rating,
    listingId: m.listing_id,
    listingTitle: typeof m.listing_title === 'string' ? m.listing_title : null,
    reviewId: m.review_id as string,
  }
}

function ReviewStars({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} className={`h-3.5 w-3.5 ${i < rating ? 'fill-current text-ink' : 'text-ink/25'}`} />
      ))}
    </span>
  )
}

function extractSupportingLinks(metadata: unknown) {
  if (!metadata || typeof metadata !== 'object' || !('supportingLinks' in metadata)) return []
  const links = metadata.supportingLinks
  if (!Array.isArray(links)) return []
  return links.filter((item): item is string => typeof item === 'string' && item.length > 0).slice(0, 2)
}

function isEditedPost(metadata: unknown) {
  return Boolean(metadata && typeof metadata === 'object' && 'editedAt' in metadata && typeof metadata.editedAt === 'string')
}

function formatEditedAt(metadata: unknown) {
  if (!metadata || typeof metadata !== 'object' || !('editedAt' in metadata) || typeof metadata.editedAt !== 'string') {
    return 'recently'
  }
  const value = new Date(metadata.editedAt)
  if (Number.isNaN(value.getTime())) return 'recently'
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(value)
}

function describeError(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message
  if (typeof error === 'object' && error && 'message' in error && typeof error.message === 'string') {
    return error.message
  }
  return fallback
}

export const messagesRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'messages',
  component: MessagesFeedPage,
})

export const projectMessagesRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'messages/project/$projectId',
  component: ProjectMessagesPage,
})

export const postRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'messages/post/$postId',
  component: PostDetailPage,
})

export const socialProfileRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'messages/profile/$profileId',
  component: SocialProfilePage,
})

export const topicRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'messages/topics/$slug',
  component: TopicFeedPage,
})

export const dmInboxRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'messages/dm',
  component: DmInboxPage,
})

export const dmThreadRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'messages/dm/$threadId',
  component: DmThreadPage,
})
