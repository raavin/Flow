import { supabase } from './supabase'
import { syncPostCoordinationObject } from './coordination-objects'
import { rankFeedItems, type FeedMode } from './feed-ranking'

export async function ensureSocialProfile(userId: string, firstName?: string | null, handle?: string | null) {
  if (!supabase) return
  // Refresh the session token before writing — prevents 401 when the access
  // token has expired mid-session (e.g. after a local db reset).
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return
  const resolvedHandle = handle?.trim() || `user-${userId.replaceAll('-', '').slice(0, 12)}`
  const { error } = await supabase.from('social_profiles').upsert({
    id: userId,
    handle: resolvedHandle,
    display_name: firstName ?? '',
  }, { onConflict: 'id', ignoreDuplicates: false })
  // Non-fatal: the post can still be created even if the social profile
  // upsert fails (no FK from posts.author_id to social_profiles).
  if (error) console.warn('[ensureSocialProfile]', error.message)
}

export async function updateSocialProfile(input: {
  userId: string
  displayName?: string
  bio?: string
  handle?: string
}) {
  if (!supabase) throw new Error('Supabase is not configured.')
  const payload: Record<string, unknown> = {}
  if (typeof input.displayName === 'string') payload.display_name = input.displayName
  if (typeof input.bio === 'string') payload.bio = input.bio
  if (typeof input.handle === 'string') payload.handle = input.handle
  if (!Object.keys(payload).length) return

  const { error } = await supabase.from('social_profiles').update(payload).eq('id', input.userId)
  if (error) throw error
}

export async function fetchFeed(userId: string, mode: FeedMode = 'following', options?: { linkedProjectId?: string | null }) {
  if (!supabase) return []
  const { data: posts, error: postsError } = await supabase
    .from('posts')
    .select('id, author_id, body, visibility, content_kind, mislabel_flag_count, review_state, reply_to_post_id, quote_post_id, linked_project_id, is_promoted, metadata, created_at')
    .order('created_at', { ascending: false })
  if (postsError) throw postsError
  if (!posts?.length) return []

  const rootPosts = posts.filter((post) => !post.reply_to_post_id)
  const quotedIds = [...new Set(rootPosts.map((post) => post.quote_post_id).filter(Boolean))]
  const authorIds = [...new Set(posts.map((post) => post.author_id))]
  const postIds = posts.map((post) => post.id)
  const linkedProjectIds = [...new Set(posts.map((post) => post.linked_project_id).filter(Boolean))]
  const mentionedHandles = extractMentions(posts.map((post) => post.body).join('\n'))
  const [
    { data: profiles, error: profilesError },
    { data: media, error: mediaError },
    { data: engagements, error: engagementsError },
    { data: follows, error: followsError },
    { data: postTopics, error: postTopicsError },
    { data: mentionedProfiles, error: mentionedProfilesError },
    { data: labelFlags, error: labelFlagsError },
    { data: projects, error: projectsError },
  ] =
    await Promise.all([
      supabase.from('social_profiles').select('id, handle, display_name, bio').in('id', authorIds),
      supabase.from('post_media').select('post_id, storage_path, sort_order').in('post_id', postIds).order('sort_order', { ascending: true }),
      supabase.from('post_engagements').select('post_id, user_id, liked, reposted, bookmarked, created_at').in('post_id', postIds),
      supabase.from('social_follows').select('followee_id').eq('follower_id', userId),
      supabase.from('post_topics').select('post_id, topics(id, slug, label)').in('post_id', postIds),
      mentionedHandles.length
        ? supabase.from('social_profiles').select('id, handle, display_name, bio').in('handle', mentionedHandles)
        : Promise.resolve({ data: [], error: null }),
      supabase.from('post_label_flags').select('post_id, user_id, suggested_kind, reason').in('post_id', postIds),
      linkedProjectIds.length
        ? supabase.from('projects').select('id, title').in('id', linkedProjectIds)
        : Promise.resolve({ data: [], error: null }),
    ])
  if (profilesError) throw profilesError
  if (mediaError) throw mediaError
  if (engagementsError) throw engagementsError
  if (followsError) throw followsError
  if (postTopicsError) throw postTopicsError
  if (mentionedProfilesError) throw mentionedProfilesError
  if (labelFlagsError) throw labelFlagsError
  if (projectsError) throw projectsError

  const followedIds = new Set((follows ?? []).map((row) => row.followee_id))
  const extraProfileIds = [...new Set((engagements ?? []).map((engagement) => engagement.user_id).filter((id) => !authorIds.includes(id)))]
  const { data: extraProfiles, error: extraProfilesError } = extraProfileIds.length
    ? await supabase.from('social_profiles').select('id, handle, display_name, bio').in('id', extraProfileIds)
    : { data: [], error: null }
  if (extraProfilesError) throw extraProfilesError

  const profileMap = new Map([...(profiles ?? []), ...(extraProfiles ?? [])].map((profile) => [profile.id, profile]))
  const mentionProfileMap = new Map((mentionedProfiles ?? []).map((profile) => [profile.handle.toLowerCase(), profile]))
  const projectMap = new Map((projects ?? []).map((project) => [project.id, project.title]))

  const filteredPosts =
    options?.linkedProjectId
      ? rootPosts.filter((post) => post.linked_project_id === options.linkedProjectId)
      : mode === 'following'
      ? rootPosts.filter((post) => {
          const visibleDirectly =
            post.author_id === userId ||
            followedIds.has(post.author_id) ||
            Boolean(post.linked_project_id)
          const visibleViaRepost = (engagements ?? []).some(
            (engagement) => engagement.post_id === post.id && engagement.reposted && (engagement.user_id === userId || followedIds.has(engagement.user_id)),
          )
          return visibleDirectly || visibleViaRepost
        })
      : mode === 'bookmarks'
        ? rootPosts.filter((post) => (engagements ?? []).some((engagement) => engagement.post_id === post.id && engagement.user_id === userId && engagement.bookmarked))
        : rootPosts

  const rankedItems = filteredPosts
    .map((post) => {
      const author = profileMap.get(post.author_id)
      const postEngagements = (engagements ?? []).filter((engagement) => engagement.post_id === post.id)
      const viewer = postEngagements.find((engagement) => engagement.user_id === userId)
      const quotePost = quotedIds.length ? posts.find((candidate) => candidate.id === post.quote_post_id) : null
      const quoteAuthor = quotePost ? profileMap.get(quotePost.author_id) : null
      const repostsByFollowed = postEngagements
        .filter((engagement) => engagement.reposted && (engagement.user_id === userId || followedIds.has(engagement.user_id)))
        .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
      const latestRepost = repostsByFollowed[0]
      const repostedBy = latestRepost ? profileMap.get(latestRepost.user_id) ?? null : null
      const viewerLabelFlag = (labelFlags ?? []).find((flag) => flag.post_id === post.id && flag.user_id === userId) ?? null
      const postLabelReasons = (labelFlags ?? [])
        .filter((flag) => flag.post_id === post.id && typeof flag.reason === 'string' && flag.reason.trim().length > 0)
        .map((flag) => flag.reason!.trim())

      return {
        ...post,
        author,
        mediaPaths: (media ?? []).filter((item) => item.post_id === post.id).map((item) => item.storage_path),
        quotePost: quotePost
          ? {
              ...quotePost,
              author: quoteAuthor,
              mediaPaths: (media ?? []).filter((item) => item.post_id === quotePost.id).map((item) => item.storage_path),
            }
          : null,
        topics: (postTopics ?? [])
          .filter((item) => item.post_id === post.id)
          .flatMap((item) => (Array.isArray(item.topics) ? item.topics : item.topics ? [item.topics] : [])),
        mentionMap: Object.fromEntries(
          extractMentions(post.body)
            .map((handle) => {
              const profile = mentionProfileMap.get(handle.toLowerCase())
              return profile ? [handle.toLowerCase(), profile.id] : null
            })
            .filter(Boolean) as Array<[string, string]>,
        ),
        quoteMentionMap: quotePost
          ? Object.fromEntries(
              extractMentions(quotePost.body)
                .map((handle) => {
                  const profile = mentionProfileMap.get(handle.toLowerCase())
                  return profile ? [handle.toLowerCase(), profile.id] : null
                })
                .filter(Boolean) as Array<[string, string]>,
            )
          : {},
        replyCount: posts.filter((candidate) => candidate.reply_to_post_id === post.id).length,
        likeCount: postEngagements.filter((engagement) => engagement.liked).length,
        repostCount: postEngagements.filter((engagement) => engagement.reposted).length,
        bookmarkCount: postEngagements.filter((engagement) => engagement.bookmarked).length,
        viewerLiked: viewer?.liked ?? false,
        viewerReposted: viewer?.reposted ?? false,
        viewerBookmarked: viewer?.bookmarked ?? false,
        viewerLabelFlag: viewerLabelFlag?.suggested_kind ?? null,
        labelReasons: [...new Set(postLabelReasons)].slice(0, 3),
        repostedBy,
        repostedById: repostedBy?.id ?? null,
        feedSortAt: latestRepost ? latestRepost.created_at : post.created_at,
        linkedProjectTitle: post.linked_project_id ? projectMap.get(post.linked_project_id) ?? null : null,
      }
    })

  return rankFeedItems(rankedItems, mode, {
    viewerId: userId,
    followedIds,
  }, (item) => ({
    authorId: item.author_id,
    createdAt: item.created_at,
    feedSortAt: item.feedSortAt,
    linkedProjectId: item.linked_project_id ?? null,
    topics: item.topics,
    replyCount: item.replyCount,
    likeCount: item.likeCount,
    repostCount: item.repostCount,
    viewerBookmarked: item.viewerBookmarked,
    repostedById: item.repostedById,
  }))
}

export async function createPost(input: {
  authorId: string
  body: string
  contentKind?: 'note' | 'update' | 'product' | 'opinion' | 'claim' | 'review'
  visibility?: 'public' | 'followers' | 'private' | 'project'
  replyToPostId?: string | null
  quotePostId?: string | null
  linkedProjectId?: string | null
  mediaPaths?: string[]
  supportingLinks?: string[]
}) {
  if (!supabase) throw new Error('Supabase is not configured.')
  if (input.contentKind === 'claim') {
    const links = (input.supportingLinks ?? []).filter(Boolean)
    if (!links.length) {
      throw new Error('Fact claims need at least one supporting link.')
    }
    if (links.length > 2) {
      throw new Error('Fact claims can include up to two supporting links.')
    }
  }
  const { data: post, error } = await supabase
    .from('posts')
    .insert({
      author_id: input.authorId,
      body: input.body,
      content_kind: input.contentKind ?? 'note',
      visibility: input.visibility ?? (input.linkedProjectId ? 'project' : 'followers'),
      reply_to_post_id: input.replyToPostId ?? null,
      quote_post_id: input.quotePostId ?? null,
      linked_project_id: input.linkedProjectId ?? null,
      metadata: input.supportingLinks?.length
        ? {
            supportingLinks: input.supportingLinks,
          }
        : {},
    })
    .select('id')
    .single()
  if (error) throw error

  if (input.mediaPaths?.length) {
    const { error: mediaError } = await supabase.from('post_media').insert(
      input.mediaPaths.map((storagePath, index) => ({
        post_id: post.id,
        owner_id: input.authorId,
        storage_path: storagePath,
        sort_order: index,
      })),
    )
    if (mediaError) throw mediaError
  }

  const topicLabels = extractTopics(input.body)
  if (topicLabels.length) {
    for (const label of topicLabels) {
      const slug = label.toLowerCase()
      const { data: topic, error: topicError } = await supabase
        .from('topics')
        .upsert({ slug, label }, { onConflict: 'slug' })
        .select('id')
        .single()
      if (topicError) throw topicError
      const { error: linkError } = await supabase.from('post_topics').upsert({ post_id: post.id, topic_id: topic.id })
      if (linkError) throw linkError
    }
  }

  await syncPostCoordinationObject({
    ownerId: input.authorId,
    postId: post.id,
    body: input.body,
    linkedProjectId: input.linkedProjectId ?? null,
    replyToPostId: input.replyToPostId ?? null,
    quotePostId: input.quotePostId ?? null,
  })

  return post
}

export async function fetchPost(postId: string, userId: string) {
  if (!supabase) return null
  const feed = await fetchFeed(userId, 'discover')
  const post = feed.find((item) => item.id === postId)
  if (!post) return null
  const { data: replies, error } = await supabase
    .from('posts')
    .select('id, author_id, body, visibility, content_kind, mislabel_flag_count, review_state, reply_to_post_id, quote_post_id, linked_project_id, is_promoted, metadata, created_at')
    .eq('reply_to_post_id', postId)
    .order('created_at', { ascending: true })
  if (error) throw error

  const replyAuthorIds = [...new Set((replies ?? []).map((reply) => reply.author_id))]
  const mentionHandles = extractMentions([post.body, ...(replies ?? []).map((reply) => reply.body)].join('\n'))
  const { data: replyAuthors, error: replyAuthorsError } = replyAuthorIds.length
    ? await supabase.from('social_profiles').select('id, handle, display_name, bio').in('id', replyAuthorIds)
    : { data: [], error: null }
  if (replyAuthorsError) throw replyAuthorsError
  const { data: mentionedProfiles, error: mentionedProfilesError } = mentionHandles.length
    ? await supabase.from('social_profiles').select('id, handle, display_name, bio').in('handle', mentionHandles)
    : { data: [], error: null }
  if (mentionedProfilesError) throw mentionedProfilesError
  const { data: labelFlags, error: labelFlagsError } = await supabase
    .from('post_label_flags')
    .select('post_id, user_id, suggested_kind, reason')
    .in('post_id', [postId, ...(replies ?? []).map((reply) => reply.id)])
  if (labelFlagsError) throw labelFlagsError
  const mentionProfileMap = new Map((mentionedProfiles ?? []).map((profile) => [profile.handle.toLowerCase(), profile.id]))

  return {
    post: {
      ...post,
      viewerLabelFlag: (labelFlags ?? []).find((flag) => flag.post_id === post.id && flag.user_id === userId)?.suggested_kind ?? null,
      mentionMap: Object.fromEntries(
        extractMentions(post.body)
          .map((handle) => {
            const profileId = mentionProfileMap.get(handle.toLowerCase())
            return profileId ? [handle.toLowerCase(), profileId] : null
          })
          .filter(Boolean) as Array<[string, string]>,
      ),
    },
    replies: (replies ?? []).map((reply) => ({
      ...reply,
      author: (replyAuthors ?? []).find((author) => author.id === reply.author_id) ?? null,
      viewerLabelFlag: (labelFlags ?? []).find((flag) => flag.post_id === reply.id && flag.user_id === userId)?.suggested_kind ?? null,
      mentionMap: Object.fromEntries(
        extractMentions(reply.body)
          .map((handle) => {
            const profileId = mentionProfileMap.get(handle.toLowerCase())
            return profileId ? [handle.toLowerCase(), profileId] : null
          })
          .filter(Boolean) as Array<[string, string]>,
      ),
    })),
  }
}

export async function fetchPostSummary(postId: string) {
  if (!supabase) return null

  const { data: post, error } = await supabase
    .from('posts')
    .select('id, author_id, body, content_kind, metadata, created_at')
    .eq('id', postId)
    .maybeSingle()
  if (error) throw error
  if (!post) return null

  const { data: author, error: authorError } = await supabase
    .from('social_profiles')
    .select('id, handle, display_name')
    .eq('id', post.author_id)
    .maybeSingle()
  if (authorError) throw authorError

  return {
    id: post.id,
    authorId: post.author_id,
    body: post.body,
    contentKind: post.content_kind as 'update' | 'product' | 'opinion' | 'claim',
    metadata: (post.metadata ?? {}) as Record<string, unknown>,
    createdAt: post.created_at,
    author: author
      ? {
          id: author.id,
          handle: author.handle,
          displayName: author.display_name,
        }
      : null,
  }
}

export async function togglePostEngagement(input: {
  postId: string
  userId: string
  field: 'liked' | 'reposted' | 'bookmarked'
}) {
  if (!supabase) throw new Error('Supabase is not configured.')
  const { data: existing, error: existingError } = await supabase
    .from('post_engagements')
    .select('id, liked, reposted, bookmarked')
    .eq('post_id', input.postId)
    .eq('user_id', input.userId)
    .maybeSingle()
  if (existingError) throw existingError

  const payload = {
    liked: existing?.liked ?? false,
    reposted: existing?.reposted ?? false,
    bookmarked: existing?.bookmarked ?? false,
    [input.field]: !(existing?.[input.field] ?? false),
  }
  const shouldRefreshRepostTime = input.field === 'reposted' && payload.reposted

  if (existing?.id) {
    const { error } = await supabase
      .from('post_engagements')
      .update({ ...payload, ...(shouldRefreshRepostTime ? { created_at: new Date().toISOString() } : {}) })
      .eq('id', existing.id)
    if (error) throw error
    return
  }

  const { error } = await supabase.from('post_engagements').insert({
    post_id: input.postId,
    user_id: input.userId,
    ...payload,
    ...(shouldRefreshRepostTime ? { created_at: new Date().toISOString() } : {}),
  })
  if (error) throw error
}

export async function flagPostLabel(input: {
  postId: string
  userId: string
  suggestedKind: 'update' | 'product' | 'opinion' | 'claim'
  reason?: string | null
}) {
  if (!supabase) throw new Error('Supabase is not configured.')

  const { data: post, error: postError } = await supabase.from('posts').select('author_id, content_kind').eq('id', input.postId).maybeSingle()
  if (postError) throw postError
  if (!post) throw new Error('Post not found.')
  if (post.author_id === input.userId) throw new Error('You cannot flag your own post label.')

  const { data: existing, error: existingError } = await supabase
    .from('post_label_flags')
    .select('id, suggested_kind, reason')
    .eq('post_id', input.postId)
    .eq('user_id', input.userId)
    .maybeSingle()
  if (existingError) throw existingError

  const trimmedReason = input.reason?.trim() ?? ''
  if (trimmedReason.length > 40) throw new Error('Keep the reason under 40 characters.')

  if (existing?.id && existing.suggested_kind === input.suggestedKind && (existing.reason ?? '') === trimmedReason) {
    const { error } = await supabase.from('post_label_flags').delete().eq('id', existing.id)
    if (error) throw error
    return
  }

  if (existing?.id) {
    const { error } = await supabase
      .from('post_label_flags')
      .update({ suggested_kind: input.suggestedKind, reason: trimmedReason || null })
      .eq('id', existing.id)
    if (error) throw error
    return
  }

  const { error } = await supabase.from('post_label_flags').insert({
    post_id: input.postId,
    user_id: input.userId,
    suggested_kind: input.suggestedKind,
    reason: trimmedReason || null,
  })
  if (error) throw error
}

export async function updateOwnPostLabel(input: {
  postId: string
  userId: string
  contentKind: 'update' | 'product' | 'opinion' | 'claim'
}) {
  if (!supabase) throw new Error('Supabase is not configured.')

  const { data: post, error: postError } = await supabase
    .from('posts')
    .select('author_id, metadata')
    .eq('id', input.postId)
    .maybeSingle()
  if (postError) throw postError
  if (!post) throw new Error('Post not found.')
  if (post.author_id !== input.userId) throw new Error('You can only relabel your own post.')

  const supportingLinks =
    post.metadata &&
    typeof post.metadata === 'object' &&
    'supportingLinks' in post.metadata &&
    Array.isArray(post.metadata.supportingLinks)
      ? post.metadata.supportingLinks.filter((item: unknown): item is string => typeof item === 'string' && item.length > 0)
      : []

  if (input.contentKind === 'claim' && supportingLinks.length === 0) {
    throw new Error('Add one or two supporting links before changing this post to a fact claim.')
  }

  const { error } = await supabase
    .from('posts')
    .update({
      content_kind: input.contentKind,
    })
    .eq('id', input.postId)
    .eq('author_id', input.userId)
  if (error) throw error
}

export async function deletePost(postId: string, userId: string) {
  if (!supabase) throw new Error('Supabase is not configured.')
  const { error } = await supabase
    .from('coordination_objects')
    .delete()
    .eq('id', postId)
    .eq('owner_id', userId)
  if (error) throw error
}

export async function updateOwnPost(input: {
  postId: string
  userId: string
  body: string
  contentKind: 'note' | 'update' | 'product' | 'opinion' | 'claim' | 'review'
  linkedProjectId?: string | null
  visibility?: 'public' | 'followers' | 'private' | 'project'
  supportingLinks?: string[]
  mediaPaths?: string[]
}) {
  if (!supabase) throw new Error('Supabase is not configured.')

  const trimmedBody = input.body.trim()
  if (!trimmedBody) throw new Error('Post text cannot be empty.')

  const supportingLinks = (input.supportingLinks ?? []).filter(Boolean)
  if (input.contentKind === 'claim' && supportingLinks.length === 0) {
    throw new Error('Fact claims need at least one supporting link.')
  }
  if (supportingLinks.length > 2) {
    throw new Error('Fact claims can include up to two supporting links.')
  }

  const { data: existingPost, error: existingPostError } = await supabase
    .from('posts')
    .select('author_id, metadata')
    .eq('id', input.postId)
    .maybeSingle()
  if (existingPostError) throw existingPostError
  if (!existingPost) throw new Error('Post not found.')
  if (existingPost.author_id !== input.userId) throw new Error('You can only edit your own post.')

  const existingMetadata = existingPost.metadata && typeof existingPost.metadata === 'object' ? existingPost.metadata : {}
  const nextMetadata: Record<string, unknown> = {
    ...existingMetadata,
    editedAt: new Date().toISOString(),
    editCount:
      typeof existingMetadata.editCount === 'number' && Number.isFinite(existingMetadata.editCount)
        ? existingMetadata.editCount + 1
        : 1,
  }
  if (supportingLinks.length) {
    nextMetadata.supportingLinks = supportingLinks
  } else {
    delete nextMetadata.supportingLinks
  }

  const updatePayload: Record<string, unknown> = {
    body: trimmedBody,
    content_kind: input.contentKind,
    linked_project_id: input.linkedProjectId ?? null,
    visibility: input.visibility ?? (input.linkedProjectId ? 'project' : 'followers'),
    metadata: nextMetadata,
  }
  const { error } = await supabase
    .from('posts')
    .update(updatePayload)
    .eq('id', input.postId)
    .eq('author_id', input.userId)
  if (error) throw error

  if (input.mediaPaths !== undefined) {
    const { error: delError } = await supabase
      .from('post_media')
      .delete()
      .eq('post_id', input.postId)
    if (delError) throw delError

    if (input.mediaPaths.length) {
      const { error: mediaError } = await supabase.from('post_media').insert(
        input.mediaPaths.map((storagePath, index) => ({
          post_id: input.postId,
          owner_id: input.userId,
          storage_path: storagePath,
          sort_order: index,
        })),
      )
      if (mediaError) throw mediaError
    }
  }

  const topicLabels = extractTopics(trimmedBody)
  const { error: deleteTopicsError } = await supabase.from('post_topics').delete().eq('post_id', input.postId)
  if (deleteTopicsError) throw deleteTopicsError

  if (topicLabels.length) {
    for (const label of topicLabels) {
      const slug = label.toLowerCase()
      const { data: topic, error: topicError } = await supabase
        .from('topics')
        .upsert({ slug, label }, { onConflict: 'slug' })
        .select('id')
        .single()
      if (topicError) throw topicError
      const { error: linkError } = await supabase.from('post_topics').upsert({ post_id: input.postId, topic_id: topic.id })
      if (linkError) throw linkError
    }
  }
}

export async function promotePost(postId: string, userId: string) {
  if (!supabase) throw new Error('Supabase is not configured.')
  const { error } = await supabase
    .from('posts')
    .update({ is_promoted: true, visibility: 'public' })
    .eq('id', postId)
    .eq('author_id', userId)
  if (error) throw error
}

export async function demotePost(postId: string, userId: string) {
  if (!supabase) throw new Error('Supabase is not configured.')
  const { error } = await supabase
    .from('posts')
    .update({ is_promoted: false, visibility: 'project' })
    .eq('id', postId)
    .eq('author_id', userId)
  if (error) throw error
}

export async function linkPostToProject(input: {
  postId: string
  userId: string
  projectId: string | null
}) {
  if (!supabase) throw new Error('Supabase is not configured.')

  const { error } = await supabase
    .from('posts')
    .update({ linked_project_id: input.projectId, visibility: input.projectId ? 'project' : 'followers' })
    .eq('id', input.postId)
    .eq('author_id', input.userId)

  if (error) throw error
}

export async function fetchSocialProfile(profileId: string, viewerId: string) {
  if (!supabase) return null
  const [{ data: profile, error: profileError }, { data: followers, error: followersError }, { data: following, error: followingError }] =
    await Promise.all([
      supabase.from('social_profiles').select('id, handle, display_name, bio').eq('id', profileId).maybeSingle(),
      supabase.from('social_follows').select('follower_id, followee_id').eq('followee_id', profileId),
      supabase.from('social_follows').select('follower_id, followee_id').eq('follower_id', profileId),
    ])
  if (profileError) throw profileError
  if (followersError) throw followersError
  if (followingError) throw followingError

  return {
    profile,
    followerCount: followers?.length ?? 0,
    followingCount: following?.length ?? 0,
    viewerFollows: (followers ?? []).some((row) => row.follower_id === viewerId),
  }
}

export async function fetchPeopleDirectory(viewerId: string) {
  if (!supabase) return []
  const [{ data: profiles, error: profilesError }, { data: follows, error: followsError }] = await Promise.all([
    supabase.from('social_profiles').select('id, handle, display_name, bio').neq('id', viewerId).order('display_name', { ascending: true }),
    supabase.from('social_follows').select('followee_id').eq('follower_id', viewerId),
  ])
  if (profilesError) throw profilesError
  if (followsError) throw followsError

  const followedIds = new Set((follows ?? []).map((row) => row.followee_id))
  return (profiles ?? []).map((profile) => ({
    ...profile,
    viewerFollows: followedIds.has(profile.id),
  }))
}

export async function toggleFollow(input: { followerId: string; followeeId: string }) {
  if (!supabase) throw new Error('Supabase is not configured.')
  const { data: existing, error: existingError } = await supabase
    .from('social_follows')
    .select('id')
    .eq('follower_id', input.followerId)
    .eq('followee_id', input.followeeId)
    .maybeSingle()
  if (existingError) throw existingError

  if (existing?.id) {
    const { error } = await supabase.from('social_follows').delete().eq('id', existing.id)
    if (error) throw error
    return
  }

  const { error } = await supabase.from('social_follows').insert({
    follower_id: input.followerId,
    followee_id: input.followeeId,
  })
  if (error) throw error
}

export async function fetchTopics(userId?: string) {
  if (!supabase) return []
  const [{ data: topics, error: topicsError }, { data: subscriptions, error: subscriptionsError }] = await Promise.all([
    supabase.from('topics').select('id, slug, label').order('label', { ascending: true }),
    userId ? supabase.from('topic_subscriptions').select('topic_id').eq('user_id', userId) : Promise.resolve({ data: [], error: null }),
  ])
  if (topicsError) throw topicsError
  if (subscriptionsError) throw subscriptionsError

  const subscribedIds = new Set((subscriptions ?? []).map((row) => row.topic_id))
  return (topics ?? []).map((topic) => ({
    ...topic,
    viewerSubscribed: subscribedIds.has(topic.id),
  }))
}

export async function fetchTopicFeed(slug: string, userId: string) {
  if (!supabase) return []
  const { data: topic, error: topicError } = await supabase.from('topics').select('id, slug, label').eq('slug', slug).maybeSingle()
  if (topicError) throw topicError
  if (!topic) return []
  const allFeed = await fetchFeed(userId, 'discover')
  const { data: links, error: linksError } = await supabase.from('post_topics').select('post_id, topic_id').eq('topic_id', topic.id)
  if (linksError) throw linksError
  const linkedIds = new Set((links ?? []).map((link) => link.post_id))
  return allFeed.filter((post) => linkedIds.has(post.id))
}

export async function toggleTopicSubscription(input: { topicId: string; userId: string }) {
  if (!supabase) throw new Error('Supabase is not configured.')
  const { data: existing, error: existingError } = await supabase
    .from('topic_subscriptions')
    .select('id')
    .eq('topic_id', input.topicId)
    .eq('user_id', input.userId)
    .maybeSingle()
  if (existingError) throw existingError
  if (existing?.id) {
    const { error } = await supabase.from('topic_subscriptions').delete().eq('id', existing.id)
    if (error) throw error
    return
  }
  const { error } = await supabase.from('topic_subscriptions').insert({
    topic_id: input.topicId,
    user_id: input.userId,
  })
  if (error) throw error
}

function extractTopics(body: string) {
  const text = body.replace(/<[^>]*>/g, ' ')
  return [...new Set(Array.from(text.matchAll(/#([a-z0-9_-]+)/gi)).map((match) => match[1]))]
}

function extractMentions(body: string) {
  return [...new Set(Array.from(body.matchAll(/@([a-z0-9_-]+)/gi)).map((match) => match[1]))]
}
