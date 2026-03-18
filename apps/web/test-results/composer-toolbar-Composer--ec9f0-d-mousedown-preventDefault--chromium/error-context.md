# Page snapshot

```yaml
- generic [ref=e5]:
  - generic [ref=e7]:
    - paragraph [ref=e8]: Flow
    - heading "A friendly flow for everything you are making happen." [level=2] [ref=e9]
    - paragraph [ref=e10]: Coordinate people, calendars, tasks, bookings, templates, and helpful nudges in one bright place.
    - generic [ref=e11]:
      - generic [ref=e12]:
        - img [ref=e13]
        - paragraph [ref=e16]: Plan real life
      - generic [ref=e17]:
        - img [ref=e18]
        - paragraph [ref=e24]: Coordinate people & business
      - generic [ref=e25]:
        - img [ref=e26]
        - paragraph [ref=e29]: Book, buy, and keep it moving
  - generic [ref=e30]:
    - generic [ref=e32]:
      - paragraph [ref=e33]: Welcome
      - heading "Step inside" [level=2] [ref=e34]
    - generic [ref=e35]:
      - button "Create account" [ref=e36] [cursor=pointer]
      - button "Sign in" [active] [ref=e37] [cursor=pointer]
    - generic [ref=e38]:
      - text: Email
      - textbox "Email" [ref=e39]:
        - /placeholder: you@example.com
        - text: playwright@test.com
    - generic [ref=e40]:
      - text: Password
      - textbox "Password" [ref=e41]:
        - /placeholder: Enter a password
        - text: Playwright123!
    - generic [ref=e42]:
      - button "Sign in" [ref=e43] [cursor=pointer]
      - button "Peek at onboarding" [ref=e44] [cursor=pointer]
    - paragraph [ref=e45]: Authentication now uses the local Supabase project. Passwords are handled by Supabase Auth and never stored in the browser app.
```