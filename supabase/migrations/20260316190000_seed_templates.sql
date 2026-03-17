insert into public.marketplace_listings (kind, category, title, summary, price_label, whimsical_note, template_payload)
values
  (
    'template',
    'Moving',
    'Weekend Move Planner',
    'A free lightweight template for a straightforward weekend move. Blocks, tasks, and helpers — nothing extra.',
    'Free',
    'Small move, big relief.',
    '{
      "durationDays": 7,
      "milestones": [
        { "title": "Pack prep",  "offsetDays": 0, "durationDays": 3, "lane": "Planning" },
        { "title": "Move day",   "offsetDays": 3, "durationDays": 1, "lane": "Coordination" },
        { "title": "Settle in",  "offsetDays": 4, "durationDays": 3, "lane": "Tasks" }
      ],
      "tasks": [
        { "title": "Book van hire",                  "offsetDays": 0 },
        { "title": "Confirm helper arrivals",         "offsetDays": 1 },
        { "title": "Order boxes and tape",            "offsetDays": 1 },
        { "title": "Notify utilities of new address", "offsetDays": 2 },
        { "title": "Arrange mail redirect",           "offsetDays": 2 },
        { "title": "Final walkthrough of old place",  "offsetDays": 3 },
        { "title": "Return keys",                     "offsetDays": 4 }
      ]
    }'::jsonb
  ),
  (
    'template',
    'Home',
    'Home Renovation Sprint',
    'Coordinate trades, materials, and inspections across a four-week reno without losing the thread.',
    '$14 one-time',
    'Sawdust optional. Stress reduction included.',
    '{
      "durationDays": 28,
      "milestones": [
        { "title": "Planning & quotes", "offsetDays": 0,  "durationDays": 5,  "lane": "Planning" },
        { "title": "Prep work",         "offsetDays": 5,  "durationDays": 3,  "lane": "Trades" },
        { "title": "Build phase",       "offsetDays": 8,  "durationDays": 14, "lane": "Trades" },
        { "title": "Finishing touches", "offsetDays": 22, "durationDays": 4,  "lane": "Tasks" },
        { "title": "Final inspection",  "offsetDays": 27, "durationDays": 1,  "lane": "Sign-off" }
      ],
      "tasks": [
        { "title": "Get three quotes",                  "offsetDays": 0 },
        { "title": "Lock in preferred tradie",          "offsetDays": 3 },
        { "title": "Order materials",                   "offsetDays": 4 },
        { "title": "Organise temporary accommodation",  "offsetDays": 5 },
        { "title": "Confirm delivery window",           "offsetDays": 6 },
        { "title": "Book building inspector",           "offsetDays": 20 },
        { "title": "Photograph completed work",         "offsetDays": 27 }
      ]
    }'::jsonb
  ),
  (
    'template',
    'Events',
    'Wedding Final Month',
    'The last 30 days before the big day — vendor lock-ins, rehearsal, and the morning-of checklist.',
    '$16 one-time',
    'Something borrowed, something planned.',
    '{
      "durationDays": 30,
      "milestones": [
        { "title": "Vendor confirmations", "offsetDays": 0,  "durationDays": 3,  "lane": "Planning" },
        { "title": "Rehearsal & dinner",   "offsetDays": 28, "durationDays": 1,  "lane": "Events" },
        { "title": "Wedding day",          "offsetDays": 29, "durationDays": 1,  "lane": "Events" },
        { "title": "Honeymoon departure",  "offsetDays": 30, "durationDays": 1,  "lane": "Travel" }
      ],
      "tasks": [
        { "title": "Send final guest numbers to caterer", "offsetDays": 0 },
        { "title": "Confirm florals and delivery time",   "offsetDays": 1 },
        { "title": "Collect rings from jeweller",         "offsetDays": 7 },
        { "title": "Write vows",                          "offsetDays": 14 },
        { "title": "Confirm transport for wedding party", "offsetDays": 20 },
        { "title": "Pack honeymoon bags",                 "offsetDays": 27 },
        { "title": "Assign thank-you card list",          "offsetDays": 29 }
      ]
    }'::jsonb
  ),
  (
    'template',
    'Career',
    'New Job First 90 Days',
    'Structured milestones and check-ins for landing well in a new role — from day one to fully embedded.',
    '$11 one-time',
    'First impressions last. So does a good plan.',
    '{
      "durationDays": 90,
      "milestones": [
        { "title": "Week 1 onboarding",  "offsetDays": 0,  "durationDays": 5,  "lane": "Onboarding" },
        { "title": "30-day check-in",    "offsetDays": 29, "durationDays": 1,  "lane": "Review" },
        { "title": "60-day review",      "offsetDays": 59, "durationDays": 1,  "lane": "Review" },
        { "title": "90-day milestone",   "offsetDays": 89, "durationDays": 1,  "lane": "Review" }
      ],
      "tasks": [
        { "title": "Set up accounts and tools",        "offsetDays": 0 },
        { "title": "Meet everyone on the team",        "offsetDays": 3 },
        { "title": "Read key company documents",       "offsetDays": 4 },
        { "title": "Schedule weekly 1:1 with manager", "offsetDays": 5 },
        { "title": "Write 30-day goals",               "offsetDays": 7 },
        { "title": "Identify quick wins",              "offsetDays": 14 },
        { "title": "Present 60-day plan to manager",   "offsetDays": 29 },
        { "title": "Request formal feedback",          "offsetDays": 59 }
      ]
    }'::jsonb
  ),
  (
    'template',
    'Travel',
    'Holiday Trip Planner',
    'Lock in flights, accommodation, and the practical bits before departure day — no loose ends.',
    '$8 one-time',
    'Itinerary included. Spontaneity not excluded.',
    '{
      "durationDays": 21,
      "milestones": [
        { "title": "Bookings locked",    "offsetDays": 0,  "durationDays": 5,  "lane": "Planning" },
        { "title": "Pre-departure prep", "offsetDays": 14, "durationDays": 6,  "lane": "Tasks" },
        { "title": "Departure day",      "offsetDays": 20, "durationDays": 1,  "lane": "Travel" }
      ],
      "tasks": [
        { "title": "Book flights",              "offsetDays": 0 },
        { "title": "Book accommodation",        "offsetDays": 1 },
        { "title": "Arrange travel insurance",  "offsetDays": 2 },
        { "title": "Book pet or house sitter",  "offsetDays": 3 },
        { "title": "Notify bank of travel",     "offsetDays": 14 },
        { "title": "Check passport expiry",     "offsetDays": 14 },
        { "title": "Download offline maps",     "offsetDays": 18 },
        { "title": "Pack and weigh bags",       "offsetDays": 19 }
      ]
    }'::jsonb
  )
on conflict do nothing;
