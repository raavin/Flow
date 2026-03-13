# Communication Safety Framework

## Purpose

This app should borrow the best parts of modern messaging and media products without inheriting the worst social dynamics.

The goal is:

- easy, familiar communication for positive outcomes
- high friction for abuse, dogpiling, humiliation, and performative harm
- strong privacy defaults
- communication that still supports coordination, not just attention seeking

This framework is the working product standard for all future chat, feed, story, and media features.

## Core principle

Communication should help people coordinate, connect, and express themselves.

It should be hard to use the product for:

- bullying
- public shaming
- mobbing
- harassment
- status games driven by virality
- unwanted exposure

## Product layers

### 1. Private layer

Use cases:

- 1:1 messages
- family groups
- friend groups
- provider/customer threads
- project participant chats

Modeled after the best of:

- WhatsApp
- iMessage
- Instagram DMs

Key properties:

- trusted, intimate, low-friction
- media-rich
- clear participant boundaries
- no accidental public exposure

### 2. Shared coordination layer

Use cases:

- project chats
- structured updates
- task requests
- availability asks
- booking confirmations
- payment requests

Key properties:

- tied to a coordination object
- visible to the right participants only
- can affect time, state, dependencies, and notifications

### 3. Public layer

Use cases:

- personal posts
- business updates
- provider listings updates
- optional discoverable content

Modeled after the useful parts of:

- Bluesky
- X/Twitter
- Instagram feed

Key properties:

- optional, not the app’s default mode
- discoverable only when explicitly intended
- lower virality bias than mainstream social media

### 4. Temporary layer

Use cases:

- stories
- ephemeral clips
- short-lived updates
- temporary availability/status moments

Modeled after:

- Instagram stories
- Snapchat
- TikTok-style quick media creation

Key properties:

- expires unless saved
- visibility is explicit
- cannot quietly become permanent public baggage

## Guardrail principles

### Default to smaller audiences

Nothing sensitive should start public by default.

Preferred visibility progression:

- `private`
- `group`
- `project`
- `followers`
- `public`

### Friction before amplification

Reposting, forwarding, or quote-posting personal content should have friction.

Examples:

- warning for reposting private-feeling content into wider audiences
- confirmation when sharing a story/post outside its original context
- blocked resharing for certain visibility levels

### Separate intimacy from broadcasting

DMs and close-group communication should not feel like mini public feeds.

Public posting should be clearly distinct from:

- direct messages
- project coordination
- provider/customer communication

### Limit harmful virality mechanics

We should avoid building systems that reward cruelty or public pile-ons.

Examples:

- avoid aggressive public engagement loops
- avoid “ratio” mechanics
- limit resharing depth
- make audience scope legible
- consider hiding or de-emphasizing vanity counts in some contexts

### Make moderation and escape easy

Users need simple controls for self-protection:

- mute
- block
- restrict
- hide replies
- leave thread
- report
- stop being suggested to each other

These should be fast and easy to find.

### Keep communication tied to purpose when needed

In coordination spaces, messages should stay useful.

Examples:

- structured updates in project threads
- booking confirmations in provider threads
- payment requests in wallet-linked threads

This lowers ambiguity and reduces room for social chaos in task-oriented contexts.

## Safety rules by layer

### Private chat

- end-to-end privacy expectations in UX, even if implementation details evolve
- no accidental public crossover
- invite-based membership for groups
- clear controls for leaving, muting, blocking

### Shared coordination threads

- tied to object membership and permissions
- structured actions available inline
- abuse controls still present
- less emphasis on performative engagement

### Public feed

- optional participation
- clear audience selection
- bounded discoverability
- reply and repost controls
- anti-dogpile protections for vulnerable posts

### Ephemeral media

- expiry is visible and predictable
- saving or converting to permanent content is explicit
- resharing controls are tighter than permanent public posts

## Design rules

### Familiar interaction, safer defaults

We want people to instantly understand:

- how to DM
- how to post
- how to reply
- how to attach media
- how to follow

But the defaults should be healthier than mainstream social platforms.

### Clarity of audience

Every communication surface should make these obvious:

- who can see this
- whether it expires
- whether it affects a project/plan
- whether it is private, shared, followers-only, or public

### Positive outcomes over performance

The app should bias toward:

- getting something done
- staying in touch
- sharing helpfully
- coordinating clearly

not toward:

- farming attention
- humiliation
- outrage
- public ranking anxiety

## Coordination-object connection

All communication types should still map onto the coordination-object model.

Shared fields:

- time
- intent
- participants
- state
- visibility
- permanence
- linked coordination object

This means:

- a DM thread is a coordination object
- a public post is a coordination object
- a story is a coordination object with expiry
- a project update is a coordination object tied to a project

## Implementation framework

### Phase 1

- private chat remains strong and familiar
- public feed stays opt-in
- visibility model becomes explicit in the data layer

### Phase 2

- stories/ephemeral posts
- media-first composer
- follower/public safety controls

### Phase 3

- richer moderation and anti-harassment tooling
- quote/repost guardrails
- project/business/public communication rules separated more clearly

## Product test

For any new communication feature, ask:

1. Does this help people connect or coordinate more easily?
2. Does the audience understand who can see it?
3. Can this be used to humiliate, dogpile, or harass too easily?
4. Is the private/public boundary clear?
5. Does the interaction push useful behavior or attention-seeking behavior?

If the answer to `3` is “yes” and we do not have compensating guardrails, the feature is not ready.
