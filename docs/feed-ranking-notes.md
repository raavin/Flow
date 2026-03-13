## Feed Ranking

The message feed now uses a central ranking module in [apps/web/src/lib/feed-ranking.ts](/home/jason/projects/superapp/apps/web/src/lib/feed-ranking.ts).

This is the tuning surface for:
- `following`
- `discover`
- `bookmarks`

Each feed mode has:
- `freshnessWindowHours`
- capped engagement inputs
- named weights for relationship, reposts, bookmarks, project relevance, topics, and freshness

Design intent:
- favor trusted ties over pure virality
- allow reposts to amplify posts without overwhelming direct follows
- keep weights editable in one place
- make it easy to later add group/project/context signals

Current implementation:
- assemble visible candidate posts in `fetchFeed()`
- attach author, topic, mention, and repost context
- pass candidates to `rankFeedItems()`
- sort using explicit weights instead of ad hoc branching

If we want to tune feed behavior later, start in:
- [apps/web/src/lib/feed-ranking.ts](/home/jason/projects/superapp/apps/web/src/lib/feed-ranking.ts)
