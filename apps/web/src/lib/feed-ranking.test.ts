import { describe, expect, it } from 'vitest'
import { feedRankingProfile, rankFeedItems } from './feed-ranking'

describe('rankFeedItems', () => {
  it('prioritizes followed reposts above unrelated discoverable posts in following feed', () => {
    const now = new Date('2026-03-13T10:00:00.000Z').toISOString()
    const slightlyOlder = new Date('2026-03-13T08:00:00.000Z').toISOString()

    const ranked = rankFeedItems(
      [
        {
          id: 'direct-follow',
          author_id: 'friend',
          created_at: slightlyOlder,
          feedSortAt: slightlyOlder,
          linked_project_id: null,
          topics: [],
          replyCount: 0,
          likeCount: 1,
          repostCount: 0,
          viewerBookmarked: false,
          repostedById: null,
        },
        {
          id: 'followed-repost',
          author_id: 'stranger',
          created_at: slightlyOlder,
          feedSortAt: now,
          linked_project_id: null,
          topics: [],
          replyCount: 1,
          likeCount: 2,
          repostCount: 1,
          viewerBookmarked: false,
          repostedById: 'friend',
        },
      ],
      'following',
      {
        viewerId: 'viewer',
        followedIds: new Set(['friend']),
      },
      (item) => ({
        authorId: item.author_id,
        createdAt: item.created_at,
        feedSortAt: item.feedSortAt,
        linkedProjectId: item.linked_project_id,
        topics: item.topics,
        replyCount: item.replyCount,
        likeCount: item.likeCount,
        repostCount: item.repostCount,
        viewerBookmarked: item.viewerBookmarked,
        repostedById: item.repostedById,
      }),
    )

    expect(ranked[0].id).toBe('direct-follow')
    expect(feedRankingProfile.following.weights.authorFollowed).toBeGreaterThan(feedRankingProfile.following.weights.repostedByFollowed)
  })

  it('keeps bookmarks heavily promoted in saved feed', () => {
    const now = new Date('2026-03-13T10:00:00.000Z').toISOString()

    const ranked = rankFeedItems(
      [
        {
          id: 'bookmarked',
          author_id: 'stranger',
          created_at: now,
          feedSortAt: now,
          linked_project_id: null,
          topics: [],
          replyCount: 0,
          likeCount: 0,
          repostCount: 0,
          viewerBookmarked: true,
          repostedById: null,
        },
        {
          id: 'plain',
          author_id: 'friend',
          created_at: now,
          feedSortAt: now,
          linked_project_id: null,
          topics: [],
          replyCount: 3,
          likeCount: 4,
          repostCount: 1,
          viewerBookmarked: false,
          repostedById: null,
        },
      ],
      'bookmarks',
      {
        viewerId: 'viewer',
        followedIds: new Set(['friend']),
      },
      (item) => ({
        authorId: item.author_id,
        createdAt: item.created_at,
        feedSortAt: item.feedSortAt,
        linkedProjectId: item.linked_project_id,
        topics: item.topics,
        replyCount: item.replyCount,
        likeCount: item.likeCount,
        repostCount: item.repostCount,
        viewerBookmarked: item.viewerBookmarked,
        repostedById: item.repostedById,
      }),
    )

    expect(ranked[0].id).toBe('bookmarked')
  })
})
