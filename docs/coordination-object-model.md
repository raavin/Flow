# Coordination Object Model

## Core idea

The app should treat nearly every meaningful action as a `coordination object` with:

- time
- intent
- participants
- state

This is broader than a project and lighter than forcing every action into a formal plan.

Examples:

- a DM thread
- a doctor appointment
- a reminder
- a birthday flow
- a marketplace booking
- a project milestone
- a service fulfilment workflow

## Why this matters

The product already has multiple surfaces that are really the same thing viewed through different lenses:

- messages
- reminders
- calendar events
- project tasks
- bookings
- purchases
- jobs
- templates

Instead of modeling these as unrelated modules, we introduce one shared backbone and let the UI present it differently depending on scale and context.

## Object structure

Each coordination object has:

- `kind`: what it fundamentally is
- `displayKind`: how the UI should treat it
- `intent`: the human goal behind it
- `state`: draft, pending, active, completed, etc.
- `time`: start/end/due/flexibility
- `participants`: people or businesses involved
- `links`: project, listing, job, parent object
- `metadata`: type-specific details

## Progressive structure

The UI should not force “project” language on everything.

Suggested progression:

1. Quick capture
   A lightweight object like a note, message, reminder, or event.
2. Enriched flow
   The system adds participants, time, dependencies, reminders, or purchases.
3. Full project/workflow
   Larger chains become a project or workflow view.

This lets the backend stay unified while the frontend stays light.

## Timeline implication

The Gantt should evolve into a timeline editor for coordination objects:

- tracks
- clips
- support clips
- locked anchors
- reusable blocks
- alternates
- overlays
- dependency snapping

That makes the timeline a composition of life and work rather than a rigid corporate chart.

## Current implementation direction

This branch introduces:

- shared coordination-object types
- secure Supabase tables for coordination objects, participants, dependencies, and reusable templates
- sync hooks so existing modules write into the coordination-object layer when projects, events, posts, and DM threads are created
- communication design guidance in [docs/communication-safety-framework.md](/home/jason/projects/superapp/docs/communication-safety-framework.md)

That means the app can keep its current screens while gradually rebasing onto the stronger domain model.

## Near-term milestones

1. Projects, events, posts, and DMs write coordination objects.
2. Templates become reusable blocks of coordination objects.
3. Timeline/Gantt reads from the coordination-object layer rather than only milestones/tasks.
4. Chat-to-flow conversion becomes a first-class user path.
5. Communication layers adopt explicit visibility, safety, and permanence rules.
