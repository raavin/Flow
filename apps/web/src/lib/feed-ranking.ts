export type FeedMode = 'following' | 'discover' | 'bookmarks'

type FeedRankingWeights = {
  authoredByViewer: number
  authorFollowed: number
  repostedByViewer: number
  repostedByFollowed: number
  bookmarkedByViewer: number
  linkedProject: number
  topicCount: number
  replyCount: number
  likeCount: number
  repostCount: number
  freshness: number
}

type FeedRankingConfig = {
  freshnessWindowHours: number
  engagementCaps: {
    replies: number
    likes: number
    reposts: number
  }
  weights: FeedRankingWeights
}

export type FeedRankingProfile = Record<FeedMode, FeedRankingConfig>

export const feedRankingProfile: FeedRankingProfile = {
  following: {
    freshnessWindowHours: 72,
    engagementCaps: {
      replies: 6,
      likes: 10,
      reposts: 6,
    },
    weights: {
      authoredByViewer: 130,
      authorFollowed: 95,
      repostedByViewer: 80,
      repostedByFollowed: 60,
      bookmarkedByViewer: 18,
      linkedProject: 16,
      topicCount: 6,
      replyCount: 1.5,
      likeCount: 0.8,
      repostCount: 1.2,
      freshness: 34,
    },
  },
  discover: {
    freshnessWindowHours: 48,
    engagementCaps: {
      replies: 8,
      likes: 14,
      reposts: 10,
    },
    weights: {
      authoredByViewer: 120,
      authorFollowed: 55,
      repostedByViewer: 75,
      repostedByFollowed: 40,
      bookmarkedByViewer: 14,
      linkedProject: 10,
      topicCount: 8,
      replyCount: 2,
      likeCount: 1.3,
      repostCount: 1.8,
      freshness: 28,
    },
  },
  bookmarks: {
    freshnessWindowHours: 120,
    engagementCaps: {
      replies: 6,
      likes: 8,
      reposts: 6,
    },
    weights: {
      authoredByViewer: 0,
      authorFollowed: 18,
      repostedByViewer: 10,
      repostedByFollowed: 8,
      bookmarkedByViewer: 150,
      linkedProject: 12,
      topicCount: 4,
      replyCount: 0.8,
      likeCount: 0.4,
      repostCount: 0.6,
      freshness: 12,
    },
  },
}

export type FeedRankingContext = {
  viewerId: string
  followedIds: Set<string>
}

export type FeedRankingSignals = {
  authorId: string
  createdAt: string
  feedSortAt?: string
  linkedProjectId?: string | null
  topics?: Array<{ id: string; slug: string; label: string }>
  replyCount: number
  likeCount: number
  repostCount: number
  viewerBookmarked: boolean
  repostedById?: string | null
}

export function rankFeedItems<T>(
  items: T[],
  mode: FeedMode,
  context: FeedRankingContext,
  getSignals: (item: T) => FeedRankingSignals,
) {
  const config = feedRankingProfile[mode]

  return [...items].sort((left, right) => {
    const scoreDelta = scoreItem(getSignals(right), config, context) - scoreItem(getSignals(left), config, context)
    if (scoreDelta !== 0) return scoreDelta
    const leftSignals = getSignals(left)
    const rightSignals = getSignals(right)
    return new Date(rightSignals.feedSortAt ?? rightSignals.createdAt).getTime() - new Date(leftSignals.feedSortAt ?? leftSignals.createdAt).getTime()
  })
}

function scoreItem(item: FeedRankingSignals, config: FeedRankingConfig, context: FeedRankingContext) {
  const { weights, engagementCaps } = config
  const hoursOld = Math.max(0, (Date.now() - new Date(item.feedSortAt ?? item.createdAt).getTime()) / 3_600_000)
  const freshnessRatio = Math.max(0, 1 - hoursOld / config.freshnessWindowHours)

  let score = 0

  if (item.authorId === context.viewerId) score += weights.authoredByViewer
  if (context.followedIds.has(item.authorId)) score += weights.authorFollowed
  if (item.repostedById === context.viewerId) score += weights.repostedByViewer
  if (item.repostedById && context.followedIds.has(item.repostedById)) score += weights.repostedByFollowed
  if (item.viewerBookmarked) score += weights.bookmarkedByViewer
  if (item.linkedProjectId) score += weights.linkedProject

  score += Math.min(item.topics?.length ?? 0, 3) * weights.topicCount
  score += Math.min(item.replyCount, engagementCaps.replies) * weights.replyCount
  score += Math.min(item.likeCount, engagementCaps.likes) * weights.likeCount
  score += Math.min(item.repostCount, engagementCaps.reposts) * weights.repostCount
  score += freshnessRatio * weights.freshness

  return score
}
