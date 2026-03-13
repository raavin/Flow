insert into public.marketplace_listings (kind, category, title, summary, price_label, whimsical_note, template_payload)
values
  (
    'template',
    'Moving',
    'Whisker-Smooth Move Planner',
    'A cheerful moving template with helper prompts, milestone timing, and budget buckets.',
    '$12 one-time',
    'Comes with a tiny burst of moving-day calm.',
    '{
      "durationDays": 10,
      "milestones": [
        { "title": "Key collection", "offsetDays": 0, "durationDays": 1, "lane": "Planning" },
        { "title": "Van booking", "offsetDays": 1, "durationDays": 1, "lane": "Bookings" },
        { "title": "Packing sprint", "offsetDays": 2, "durationDays": 4, "lane": "Tasks" },
        { "title": "Move day", "offsetDays": 6, "durationDays": 1, "lane": "Coordination" },
        { "title": "Exit clean", "offsetDays": 7, "durationDays": 1, "lane": "Services" }
      ],
      "tasks": [
        { "title": "Confirm helpers", "offsetDays": 1 },
        { "title": "Order boxes and tape", "offsetDays": 1 },
        { "title": "Notify utilities", "offsetDays": 2 },
        { "title": "Book cleaner", "offsetDays": 3 },
        { "title": "Send fuel reimbursement", "offsetDays": 7 }
      ]
    }'::jsonb
  ),
  (
    'template',
    'Events',
    'Birthday Orbit Board',
    'Milestones, shopping, and guest coordination for delightfully low-stress parties.',
    '$9 one-time',
    'Confetti energy without confetti cleanup.',
    '{
      "durationDays": 14,
      "milestones": [
        { "title": "Choose venue", "offsetDays": 0, "durationDays": 1, "lane": "Planning" },
        { "title": "Send invitations", "offsetDays": 2, "durationDays": 1, "lane": "Coordination" },
        { "title": "Order cake", "offsetDays": 6, "durationDays": 1, "lane": "Bookings" },
        { "title": "Party day", "offsetDays": 14, "durationDays": 1, "lane": "Events" }
      ],
      "tasks": [
        { "title": "Collect dietary requirements", "offsetDays": 4 },
        { "title": "Buy decorations", "offsetDays": 7 },
        { "title": "Confirm playlist", "offsetDays": 11 }
      ]
    }'::jsonb
  ),
  (
    'service',
    'Cleaning',
    'Sunshine Exit Clean',
    'Bond-cleaning service with live status updates and flexible access windows.',
    'From $180',
    'Leaves the place sparkling like a good idea.',
    '{}'::jsonb
  ),
  (
    'product',
    'Moving gear',
    'Stackable Moving Box Bundle',
    'Reusable boxes, labels, and tape delivered in one tidy bundle.',
    '$65 bundle',
    'A little cardboard chorus line.',
    '{}'::jsonb
  )
on conflict do nothing;
