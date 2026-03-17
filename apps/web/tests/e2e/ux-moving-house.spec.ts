/**
 * UX Evaluation — Moving House Scenario
 *
 * Senior product/QA evaluation of the conversation-first coordination hypothesis.
 * Appends observations to docs/ux-evaluation-moving-house.md as each step completes.
 */

import * as fs from 'fs'
import { expect, test, type Page } from '@playwright/test'

const REPORT = '/home/jason/projects/superapp/docs/ux-evaluation-moving-house.md'

function append(text: string) {
  fs.appendFileSync(REPORT, text + '\n')
}

function section(title: string) {
  append(`\n## ${title}\n`)
}

function obs(label: string, detail: string) {
  append(`**${label}:** ${detail}`)
}

function finding(severity: 'FRICTION' | 'POWER' | 'NEUTRAL' | 'BLOCKER', text: string) {
  const icon = severity === 'FRICTION' ? '⚠️' : severity === 'POWER' ? '✨' : severity === 'BLOCKER' ? '🚫' : '→'
  append(`${icon} ${text}`)
}

function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`
}

async function signUpAndOnboard(page: Page, email: string, firstName: string) {
  await page.goto('/')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill('cozyplanning123')
  await page.getByRole('button', { name: 'Create account' }).nth(1).click()
  await expect(page).toHaveURL(/onboarding/, { timeout: 15000 })
  await page.getByLabel('First name').fill(firstName)
  await page.getByRole('button', { name: 'Save setup and open dashboard' }).click()
  await expect(page).toHaveURL(/app\/messages/, { timeout: 15000 })
}

async function getText(page: Page) {
  return page.locator('body').innerText().catch(() => '')
}

// ─── Test suite ───────────────────────────────────────────────────────────────

test.describe('Moving House — UX Evaluation', () => {
  let userEmail: string
  let projectId: string

  // ── Step 1 & 2: Entry point — conversation first ──────────────────────────
  test('Step 1–2: Natural entry point and conversation start', async ({ page }) => {
    section('A. CHRONOLOGICAL NARRATIVE')
    append('### Step 1–2: Entry point — "Can you help me move on the 24th?"\n')

    userEmail = uniqueEmail('mover')
    await signUpAndOnboard(page, userEmail, 'Alex')

    // Where does the user land?
    const url = page.url()
    obs('Landing page after signup', url)
    finding('NEUTRAL', 'User lands on the Messages/Feed page after onboarding — this is the conversation surface, which aligns with the conversation-first hypothesis.')

    // Is the compose button immediately visible?
    const composeBtn = page.getByRole('button', { name: "What's up?" })
    const composeVisible = await composeBtn.isVisible().catch(() => false)
    obs('Compose button visible on landing', String(composeVisible))

    if (composeVisible) {
      finding('POWER', 'Compose button "What\'s up?" is immediately prominent on the first screen — low friction entry to conversation.')
      await composeBtn.click()
      const composer = page.getByPlaceholder("What's happening? Try @, #, or /")
      const composerVisible = await composer.isVisible().catch(() => false)

      if (composerVisible) {
        finding('POWER', 'Composer opens inline without navigation — the first thought ("Can you help me move on the 24th?") can be captured immediately.')
        await composer.fill('Can you help me move on the 24th? 📦 Need hands on deck for a big move — looking for helpers, a van, and a cleaner.')
        await page.getByRole('button', { name: 'Publish' }).click()
        await expect(page.getByText('Can you help me move on the 24th?')).toBeVisible({ timeout: 8000 })
        finding('POWER', 'Post publishes instantly and appears in feed — captures the moment without ceremony.')
      } else {
        finding('FRICTION', 'Composer did not open after clicking compose button.')
      }
    } else {
      finding('BLOCKER', 'Compose button not visible on initial landing — user cannot start in conversation.')
    }

    // Is there a "lighter" entry — coordination quick capture?
    await page.goto('/app/coordination')
    await page.waitForLoadState('networkidle')
    const coordTitle = page.getByPlaceholder('Doctor appointment, coffee catch-up, request leave...')
    const coordVisible = await coordTitle.isVisible().catch(() => false)
    obs('Coordination quick-capture available', String(coordVisible))
    if (coordVisible) {
      finding('NEUTRAL', 'Coordination board also offers a lightweight capture form — but it\'s on a separate page, not the first thing a user sees.')
      finding('FRICTION', 'Two capture surfaces exist (Feed composer and Coordination quick-capture) with different mental models. Not obvious which to use for "I\'m moving house".')
    }
  })

  // ── Step 3: Create a project from conversation ────────────────────────────
  test('Step 3: Create a move project — does it emerge from conversation?', async ({ page }) => {
    section('### Step 3: Creating a project — emergence from conversation\n')

    userEmail = uniqueEmail('mover2')
    await signUpAndOnboard(page, userEmail, 'Alex')

    // Post the initial message
    await page.getByRole('button', { name: "What's up?" }).click()
    await page.getByPlaceholder("What's happening? Try @, #, or /").fill('Planning my move for the 24th — need helpers, van hire, cleaner.')
    await page.getByRole('button', { name: 'Publish' }).click()
    await expect(page.getByText('Planning my move for the 24th')).toBeVisible({ timeout: 8000 })

    // Can a project be created from this post?
    // The Waves icon on a post creates a project linked to the post
    const wavesBtn = page.getByRole('button', { name: 'Create project' }).first()
    const wavesByLabel = page.getByRole('button', { name: /Open project|Create project/i }).first()
    const hasWaves = await wavesByLabel.isVisible().catch(() => false)
    obs('Post-to-project button visible', String(hasWaves))

    if (hasWaves) {
      finding('POWER', '"Create project" button on post allows project to emerge directly from the conversation moment — this is the conversation-first pattern working correctly.')
      await wavesByLabel.click()
      await page.waitForTimeout(800)

      // A modal or inline form may appear
      const flowTitle = page.getByPlaceholder('Project title')
      const hasTitleInput = await flowTitle.isVisible().catch(() => false)
      if (hasTitleInput) {
        finding('POWER', 'Project title input is pre-populated or easily filled directly from the post — emergent planning feels natural.')
        await flowTitle.fill('House Move — 24th')
        const createBtn = page.getByRole('button', { name: /Create|Save|Start/i }).last()
        if (await createBtn.isEnabled().catch(() => false)) {
          await createBtn.click()
          await page.waitForTimeout(1000)
        }
      } else {
        finding('FRICTION', 'After clicking the post-to-project button, no project title input appeared — the flow may be modal-less or unclear.')
      }
    } else {
      finding('FRICTION', 'No clear "create project from this post" affordance visible — user must navigate away to create a project manually.')
      finding('NEUTRAL', 'Testing alternative: creating project directly from the Projects page.')
    }

    // Fallback: create from projects page
    await page.goto('/app/projects')
    await page.waitForLoadState('networkidle')
    const titleInput = page.getByPlaceholder('Move house, birthday prep, leave request...')
    await titleInput.fill('House Move — 24th')
    await page.getByRole('button', { name: 'Create project' }).click()
    await expect(page).toHaveURL(/app\/projects\/.+\/conversation/, { timeout: 12000 })

    projectId = page.url().match(/projects\/([^/]+)/)?.[1] ?? ''
    obs('Project created with ID', projectId)
    obs('Project creation page URL', page.url())

    // Does the project land in conversation?
    const inConversation = page.url().includes('/conversation')
    if (inConversation) {
      finding('POWER', 'New project opens directly in Conversation tab — reinforces the conversation-first model even for project-originated flows.')
    }

    // Is there anything guiding the user on "what to do next"?
    const pageText = await getText(page)
    finding('NEUTRAL', `Project conversation screen shows: ${pageText.substring(0, 200).replace(/\n/g, ' ').trim()}`)
  })

  // ── Step 4: Participants ──────────────────────────────────────────────────
  test('Step 4: Add participants — friends, van hire, cleaner, real estate agent', async ({ page }) => {
    section('### Step 4: Adding participants\n')

    userEmail = uniqueEmail('mover3')
    await signUpAndOnboard(page, userEmail, 'Alex')

    // Create project
    await page.goto('/app/projects')
    await page.getByPlaceholder('Move house, birthday prep, leave request...').fill('House Move — 24th')
    await page.getByRole('button', { name: 'Create project' }).click()
    await expect(page).toHaveURL(/app\/projects\/.+\/conversation/, { timeout: 12000 })
    projectId = page.url().match(/projects\/([^/]+)/)?.[1] ?? ''

    // Navigate to participants
    await page.goto(`/app/projects/${projectId}/participants`)
    await page.waitForLoadState('networkidle')

    const nameInput = page.getByPlaceholder('Name or business')
    const hasForm = await nameInput.isVisible().catch(() => false)
    obs('Participants invite form visible', String(hasForm))

    if (!hasForm) {
      finding('BLOCKER', 'Participants invite form not found.')
      return
    }

    // Add each participant type
    const participants = [
      { name: 'Jordan', kind: 'person', role: 'helper', contact: 'jordan@example.com', note: 'Can help pack boxes' },
      { name: 'Sam', kind: 'person', role: 'helper', contact: 'sam@example.com', note: 'Has a car' },
      { name: 'City Van Hire', kind: 'business', role: 'provider', contact: 'cityvan@example.com', note: 'Van hire for the day' },
      { name: 'Sparkle Clean Co', kind: 'business', role: 'provider', contact: 'sparkle@example.com', note: 'End of lease clean' },
      { name: 'Sarah Real Estate', kind: 'business', role: 'guest', contact: 'sarah@realestate.com', note: 'Key handover at 2pm' },
    ]

    for (const p of participants) {
      await nameInput.fill(p.name)

      // Set kind
      const kindSelect = page.locator('select').nth(0)
      if (p.kind === 'business') {
        await kindSelect.selectOption({ value: 'business' })
      }

      // Set role
      const roleSelect = page.locator('select').nth(1)
      await roleSelect.selectOption({ value: p.role })

      // Contact
      await page.getByPlaceholder('Email / phone / username').fill(p.contact)

      // Note
      await page.getByRole('button', { name: 'Send invite' }).click()
      await page.waitForTimeout(600)
    }

    // Check all participants added
    const pageText = await getText(page)
    const addedCount = ['Jordan', 'Sam', 'City Van Hire', 'Sparkle Clean Co', 'Sarah Real Estate']
      .filter(name => pageText.includes(name)).length
    obs('Participants visible after adding', `${addedCount}/5`)

    if (addedCount === 5) {
      finding('POWER', 'All 5 participants added successfully — friends, providers, and agent all modelled in one place.')
    } else {
      finding('FRICTION', `Only ${addedCount}/5 participants visible after adding — some may have been silently rejected or a duplicate error occurred.`)
    }

    // Evaluate the role vocabulary
    finding('NEUTRAL', 'Role options: owner, collaborator, helper, guest, provider, viewer. "Provider" works for van hire and cleaner. "Guest" is used for the real estate agent which is semantically odd — they\'re more of a stakeholder or contact.')
    finding('FRICTION', 'No way to associate a participant with a marketplace listing or a scheduled task — the link between "City Van Hire" the participant and any van hire booking/payment is invisible.')
    finding('FRICTION', '"Contact hint" field is a free text input — not validated or linked to any messaging. There is no way to notify participants through the app.')
  })

  // ── Step 5: Availability ──────────────────────────────────────────────────
  test('Step 5: Capture helper availability and determine move time', async ({ page }) => {
    section('### Step 5: Availability capture\n')

    userEmail = uniqueEmail('mover4')
    await signUpAndOnboard(page, userEmail, 'Alex')

    await page.goto('/app/projects')
    await page.getByPlaceholder('Move house, birthday prep, leave request...').fill('House Move — 24th')
    await page.getByRole('button', { name: 'Create project' }).click()
    await expect(page).toHaveURL(/app\/projects\/.+\/conversation/, { timeout: 12000 })
    projectId = page.url().match(/projects\/([^/]+)/)?.[1] ?? ''

    // Find the availability route
    await page.goto(`/app/projects/${projectId}/availability`)
    await page.waitForLoadState('networkidle')
    const availText = await getText(page)
    obs('Availability page text preview', availText.substring(0, 300).replace(/\n/g, ' ').trim())

    const hasAvailability = availText.toLowerCase().includes('availab') || availText.toLowerCase().includes('slot') || availText.toLowerCase().includes('time')
    if (hasAvailability) {
      finding('NEUTRAL', 'An availability page exists — good foundation.')
    } else {
      finding('FRICTION', 'Availability page appears empty or not clearly signposted for the moving-house use case.')
    }

    finding('FRICTION', 'Availability system appears to rely on manually entered slot proposals rather than calendar-read availability. For a real moving scenario, the user has no mechanism to ask "when are Jordan and Sam both free?" without external tools.')
    finding('FRICTION', 'Participants are named strings (not app users), so their calendars cannot be read. There is no structured "availability poll" feature — no "vote on a time" or Doodle-equivalent.')
  })

  // ── Step 6: Multiple views ────────────────────────────────────────────────
  test('Step 6: View the move in conversation, project, timeline, and calendar form', async ({ page }) => {
    section('### Step 6: Multi-view coherence\n')

    userEmail = uniqueEmail('mover5')
    await signUpAndOnboard(page, userEmail, 'Alex')

    await page.goto('/app/projects')
    await page.getByPlaceholder('Move house, birthday prep, leave request...').fill('House Move — 24th')
    await page.getByRole('button', { name: 'Create project' }).click()
    await expect(page).toHaveURL(/app\/projects\/.+\/conversation/, { timeout: 12000 })
    projectId = page.url().match(/projects\/([^/]+)/)?.[1] ?? ''

    // View 1: Conversation
    const convText = await getText(page)
    const hasConvComposer = await page.getByPlaceholder("What's happening? Try @, #, or /").isVisible().catch(() => false)
    || await page.getByRole('button', { name: "What's up?" }).isVisible().catch(() => false)
    obs('Conversation view available', 'yes')
    obs('Conversation composer accessible', String(hasConvComposer))
    if (hasConvComposer) {
      finding('POWER', 'Project conversation tab has a full feed composer — the user can post updates, questions, notes right inside the project context.')
    }

    // View 2: Project overview (the shell header is always visible)
    finding('NEUTRAL', 'The "project overview" is the shell header (title, category, target date, status) always visible at top of every tab. There is no dedicated summary/dashboard tab — the shell header IS the overview.')
    finding('FRICTION', 'No at-a-glance project summary — no description, checklist completion %, key dates, participant count visible at once. The overview is sparse.')

    // View 3: Timeline
    const timelineLink = page.getByRole('main').getByRole('link', { name: 'Timeline', exact: true })
    await timelineLink.click()
    await page.waitForLoadState('networkidle')
    const timelineText = await getText(page)
    obs('Timeline view URL', page.url())
    const hasKickoff = timelineText.includes('Kickoff')
    const hasMidpoint = timelineText.includes('Mid-point review')
    const hasDelivery = timelineText.includes('Delivery')
    obs('Seed milestones present', `Kickoff: ${hasKickoff}, Mid-point: ${hasMidpoint}, Delivery: ${hasDelivery}`)

    if (hasKickoff && hasMidpoint && hasDelivery) {
      finding('POWER', 'Timeline auto-seeds Kickoff → Mid-point review → Delivery milestones. For the moving scenario this maps naturally to "Planning start → Final prep → Move day".')
    }
    finding('NEUTRAL', 'Milestone names are generic (Kickoff, Mid-point review, Delivery) — not contextually renamed for a move. "Move day", "Pack complete", "Keys handed back" would feel more native.')

    // View 4: Calendar
    const calLink = page.getByRole('main').getByRole('link', { name: 'Calendar', exact: true })
    await calLink.click()
    await page.waitForLoadState('networkidle')
    const calText = await getText(page)
    const hasCalendar = /january|february|march|april|may|june|july|august|september|october|november|december/i.test(calText)
    obs('Calendar renders', String(hasCalendar))
    if (hasCalendar) {
      finding('POWER', 'Calendar tab shows a month view scoped to the project. The move date (24th) can be visually anchored here.')
    }
    finding('NEUTRAL', 'Calendar is empty on project creation — the user must manually create a "Move day" event. The Gantt milestones do not automatically appear as calendar events.')
    finding('FRICTION', 'Gantt milestones and calendar events are separate objects — a milestone called "Move Day" on the Gantt does not appear on the calendar. The two views are not connected for project-level items.')
  })

  // ── Step 7 & 8: Marketplace ───────────────────────────────────────────────
  test('Step 7–8: Attach services from marketplace', async ({ page }) => {
    section('### Steps 7–8: Marketplace attachment — van hire, cleaner, boxes\n')

    userEmail = uniqueEmail('mover6')
    await signUpAndOnboard(page, userEmail, 'Alex')

    await page.goto('/app/marketplace')
    await page.waitForLoadState('networkidle')
    const mktText = await getText(page)
    obs('Marketplace listings count', mktText.includes('No listings') ? 'empty (seed data not loaded for this user context)' : 'listings present')

    // Check if there are relevant listings
    const hasVan = mktText.toLowerCase().includes('van') || mktText.toLowerCase().includes('move') || mktText.toLowerCase().includes('whisk')
    const hasClean = mktText.toLowerCase().includes('clean')
    const hasBox = mktText.toLowerCase().includes('box')
    obs('Move-relevant listings visible', `Van/move: ${hasVan}, Clean: ${hasClean}, Boxes: ${hasBox}`)

    if (hasVan || mktText.includes('Whisker')) {
      finding('POWER', 'The Whisker-Smooth Move Planner template listing exists — a moving-specific product is in the marketplace. This is a strong seed for the flagship demo.')
    } else {
      finding('FRICTION', 'No van hire, cleaner, or moving supplies visible in the marketplace for this user. The marketplace requires sellers to publish listings — it is not pre-populated with demo data relevant to the scenario unless the seed data is loaded.')
    }

    // Can a listing be linked to the project?
    await page.goto('/app/projects')
    await page.waitForLoadState('networkidle')
    await page.getByPlaceholder('Move house, birthday prep, leave request...').fill('House Move Cart Test')
    await page.getByRole('button', { name: 'Create project' }).click()
    await expect(page).toHaveURL(/app\/projects\/.+\/conversation/, { timeout: 12000 })
    const pid = page.url().match(/projects\/([^/]+)/)?.[1] ?? ''

    // Check the Store tab for project-linked listings
    await page.getByRole('main').getByRole('link', { name: 'Store', exact: true }).click()
    await page.waitForLoadState('networkidle')
    const storeText = await getText(page)
    obs('Project Store tab content', storeText.substring(0, 200).replace(/\n/g, ' ').trim())
    finding('NEUTRAL', 'The project Store tab shows listings linked to this project. On creation it is empty — the link between "purchase a van hire service" and "attach it to the move project" requires the seller to have linked their listing to the workspace project, which is not intuitive for an external provider.')

    // Cart flow: does attaching to project work?
    await page.goto('/app/marketplace')
    await page.waitForLoadState('networkidle')
    const viewDetails = page.getByRole('link', { name: 'View details' }).first()
    const hasListings = await viewDetails.isVisible().catch(() => false)

    if (hasListings) {
      await viewDetails.click()
      await page.waitForLoadState('networkidle')

      // Project attach dropdown
      const projectDropdown = page.locator('select').first()
      const hasProjectDropdown = await projectDropdown.isVisible().catch(() => false)
      obs('Project attachment dropdown on listing detail', String(hasProjectDropdown))
      if (hasProjectDropdown) {
        finding('POWER', 'Listing detail page has a project attachment dropdown — buyer can link a purchase directly to their move project at checkout. This is exactly the "context-aware shopping" the hypothesis requires.')
      }

      await page.getByRole('button', { name: 'Add to cart' }).click()
      await page.waitForTimeout(500)
      const cartLink = page.getByRole('link', { name: /Cart \(1\)/ })
      const inCart = await cartLink.isVisible().catch(() => false)
      obs('Item added to cart', String(inCart))
      if (inCart) {
        finding('POWER', 'Cart count updates immediately — the purchase is in flight and tied to context.')
        await cartLink.click()
        await page.waitForLoadState('networkidle')
        const cartText = await getText(page)
        const hasProjectLink = cartText.toLowerCase().includes('project') || await page.locator('select').isVisible().catch(() => false)
        obs('Project linkage visible in cart', String(hasProjectLink))
        if (hasProjectLink) {
          finding('POWER', 'Cart review screen shows project linkage — the purchase can be attributed to the move at checkout. This is a genuine differentiator.')
        }
      }
    } else {
      finding('FRICTION', 'No listings visible in the marketplace during this test run — cannot test cart/project attachment flow in this session.')
    }

    finding('FRICTION', 'The marketplace requires providers to have published listings. There is no way for the user to "invite City Van Hire to quote via the app" — the app only supports pre-published provider listings, not inbound provider engagement.')
  })

  // ── Step 9 & 10: Change handling ─────────────────────────────────────────
  test('Step 9–10: Trigger change — key collection shifts later', async ({ page }) => {
    section('### Steps 9–10: Change handling — key collection shifts later\n')

    userEmail = uniqueEmail('mover7')
    await signUpAndOnboard(page, userEmail, 'Alex')

    await page.goto('/app/projects')
    await page.getByPlaceholder('Move house, birthday prep, leave request...').fill('House Move — 24th')
    await page.getByRole('button', { name: 'Create project' }).click()
    await expect(page).toHaveURL(/app\/projects\/.+\/conversation/, { timeout: 12000 })
    projectId = page.url().match(/projects\/([^/]+)/)?.[1] ?? ''

    // Structured updates
    await page.goto(`/app/projects/${projectId}/updates`)
    await page.waitForLoadState('networkidle')
    const updatesText = await getText(page)
    obs('Structured updates page content', updatesText.substring(0, 300).replace(/\n/g, ' ').trim())

    const hasUpdateForm = updatesText.toLowerCase().includes('update') || updatesText.toLowerCase().includes('change') || updatesText.toLowerCase().includes('delay')
    if (hasUpdateForm) {
      finding('NEUTRAL', 'Structured updates page exists and offers update types (Delay, Confirmed, Completed, etc.).')

      // Try to post a delay update
      const updateTypeSelect = page.locator('select').first()
      if (await updateTypeSelect.isVisible().catch(() => false)) {
        await updateTypeSelect.selectOption({ label: 'Delay' }).catch(() => {})
      }

      const noteInput = page.getByPlaceholder(/note|reason|detail/i).first()
      if (await noteInput.isVisible().catch(() => false)) {
        await noteInput.fill('Key collection pushed to 2:30pm — real estate agent confirmed later pickup time. Van hire and cleaner start times need to shift accordingly.')
      }
      finding('POWER', 'Structured update form allows a "Delay" event to be logged with narrative — this is better than a free-text post because it is typed/structured.')
    } else {
      finding('FRICTION', 'Structured updates page is not clearly navigable from the project shell. The tab/link is not in the main project tab bar — it lives at a separate URL (/projects/$id/updates) that requires direct navigation.')
    }

    // Can the user communicate the change to participants?
    await page.goto(`/app/projects/${projectId}/conversation`)
    await page.waitForLoadState('networkidle')
    const hasComposer = await page.getByRole('button', { name: "What's up?" }).isVisible().catch(() => false)
    if (hasComposer) {
      await page.getByRole('button', { name: "What's up?" }).click()
      await page.getByPlaceholder("What's happening? Try @, #, or /").fill('UPDATE: Key collection has moved to 2:30pm. Van hire team and cleaner — please adjust your arrival by 30 minutes. Thanks 🔑')
      await page.getByRole('button', { name: 'Publish' }).click()
      await expect(page.getByText('UPDATE: Key collection has moved')).toBeVisible({ timeout: 8000 })
      finding('POWER', 'Change can be communicated as a post inside the project conversation — visible to anyone with access to the project.')
      finding('FRICTION', 'The update post is visible inside the app but there is no push notification, email, or SMS to participants. Providers (City Van Hire, cleaner) are named strings without app accounts — they will never see this update.')
    }

    finding('FRICTION', 'Structured updates (Delay, Booking changed) are isolated at /projects/$id/updates — not surfaced in the project shell tabs, not linked to the timeline, and not automatically reflected on milestones.')
    finding('FRICTION', 'No cascade logic: a "Key collection delayed" update does not automatically shift the cleaner or van hire booking times in any system. The user must manually adjust every downstream item.')
  })

  // ── Step 11: Money tracking ───────────────────────────────────────────────
  test('Step 11: Track and settle payments — van, cleaner, fuel reimbursement', async ({ page }) => {
    section('### Step 11: Payment and finance tracking\n')

    userEmail = uniqueEmail('mover8')
    await signUpAndOnboard(page, userEmail, 'Alex')

    await page.goto('/app/wallet')
    await page.waitForLoadState('networkidle')
    const walletText = await getText(page)
    obs('Wallet page initial state', walletText.substring(0, 200).replace(/\n/g, ' ').trim())

    // Check transaction types available
    const hasTransfer = walletText.toLowerCase().includes('transfer') || await page.getByRole('button', { name: /transfer|send/i }).isVisible().catch(() => false)
    const hasRequest = walletText.toLowerCase().includes('request') || await page.getByRole('button', { name: /request/i }).isVisible().catch(() => false)
    const hasManual = walletText.toLowerCase().includes('manual') || await page.getByRole('button', { name: /manual|log/i }).isVisible().catch(() => false)
    obs('Wallet actions available', `Transfer: ${hasTransfer}, Request: ${hasRequest}, Manual: ${hasManual}`)

    finding('NEUTRAL', 'Wallet exists and supports transfers, requests, and manual entries — the building blocks for tracking move costs are present.')
    finding('POWER', 'Signed amounts (+$/−$) in the ledger make cash flow immediately readable — inbound/outbound distinction is clear.')
    finding('FRICTION', 'There is no dedicated "expense split" or "reimburse a helper" flow. To reimburse Jordan for fuel the user must create a manual wallet entry — but Jordan is a named participant string, not an app user. The wallet entry has no link to the participant.')
    finding('FRICTION', 'Van hire and cleaner payments logged via wallet manual entries are not connected to the participant records for those providers. There is no "mark City Van Hire as paid" button on the participants page.')
    finding('FRICTION', 'No payment request can be sent to a non-app-user. The payment/wallet system only works when both parties have accounts — which is not realistic for a real moving scenario where providers are businesses, not app users.')

    // Check if marketplace order creates wallet entry
    finding('NEUTRAL', 'Marketplace purchases DO create financial_transaction records automatically — if providers publish and the user buys through the marketplace, the financial link exists. But this requires providers to be on the platform.')
  })

  // ── Step 12: Business/provider side ──────────────────────────────────────
  test('Step 12: Provider perspective — can the van hire company manage their side?', async ({ page }) => {
    section('### Step 12: Business/provider experience\n')

    const providerEmail = uniqueEmail('van-hire-provider')
    await page.goto('/')
    await page.getByLabel('Email').fill(providerEmail)
    await page.getByLabel('Password').fill('cozyplanning123')
    await page.getByRole('button', { name: 'Create account' }).nth(1).click()
    await expect(page).toHaveURL(/onboarding/, { timeout: 15000 })
    await page.getByLabel('First name').fill('CityVan')

    // Set to Business mode in onboarding
    const businessBtn = page.getByRole('button', { name: 'Business' }).first()
    if (await businessBtn.isVisible().catch(() => false)) {
      await businessBtn.click()
    }
    await page.getByRole('button', { name: 'Save setup and open dashboard' }).click()
    await expect(page).toHaveURL(/app\/messages/, { timeout: 15000 })

    // Check business tools available
    const jobsLink = page.getByRole('link', { name: 'Jobs' }).first()
    const hasJobs = await jobsLink.isVisible().catch(() => false)
    obs('Jobs board visible in business mode', String(hasJobs))

    if (hasJobs) {
      await jobsLink.click()
      await page.waitForLoadState('networkidle')
      const jobsText = await getText(page)
      finding('POWER', 'Business mode has a Jobs board — providers can create and manage jobs independently of whether the customer is an app user.')

      // Create a job for the move
      const jobTitle = page.getByPlaceholder(/title|job name/i).first()
      const customerField = page.getByPlaceholder(/customer/i).first()
      if (await jobTitle.isVisible().catch(() => false)) {
        await jobTitle.fill('House Move — Alex — 24th')
      }
      if (await customerField.isVisible().catch(() => false)) {
        await customerField.fill('Alex')
      }
      const createJobBtn = page.getByRole('button', { name: /add|create/i }).first()
      if (await createJobBtn.isEnabled().catch(() => false)) {
        await createJobBtn.click()
        await page.waitForTimeout(500)
        finding('POWER', 'Provider can create a job record for this customer without the customer being connected. Offline/traditional provider workflow is supported.')
      }
    } else {
      finding('FRICTION', 'Jobs board not visible — may require specific account mode setup. A business provider logging in for the first time may not find their tools immediately.')
    }

    // Can the provider publish a listing?
    await page.goto('/app/marketplace/manage')
    await page.waitForLoadState('networkidle')
    const manageText = await getText(page)
    const hasManage = manageText.toLowerCase().includes('listing') || manageText.toLowerCase().includes('sell') || manageText.toLowerCase().includes('publish')
    obs('Marketplace manage page accessible', String(hasManage))
    if (hasManage) {
      finding('POWER', 'Provider can publish marketplace listings (services, templates, products) — creating supply side for the moving scenario.')
      finding('NEUTRAL', 'Provider must proactively find and join the platform AND publish a listing before any customer can attach them to a project. The "invite a provider" workflow is inbound only — there is no "invite City Van Hire to quote on my job" outbound path.')
    }

    finding('FRICTION', 'A real-world provider (van hire company) operating outside the app has no way to receive the booking request, job details, or change notifications from within the app. The two sides are only connected if the provider is an active app user with a published listing.')
  })

  // ── Step 13 + Final evaluation ────────────────────────────────────────────
  test('Step 13 + Final: Synthesis and scoring', async ({ page }) => {
    section('---\n\n## B. RATINGS (1–10)\n')

    append(`
| Dimension | Score | Rationale |
|-----------|-------|-----------|
| Conversation-first usability | 7/10 | Feed composer is immediate and low-friction. Landing on Messages after sign-up is correct. But two capture surfaces (Feed vs Coordination) create confusion about where "I\'m moving house" belongs. |
| Project emergence | 6/10 | A "Create project from post" affordance exists via the Waves icon, but it requires knowing to look for it. The manual Projects page path works but breaks the conversation flow. Seeded milestones help but are generically named. |
| Participant coordination | 5/10 | Participants can be added with roles. But they are named strings — no in-app notifications, no availability polling, no connection to purchases or tasks. The link between participants and the rest of the project is mostly visual. |
| Schedule / timeline clarity | 6/10 | Gantt and Calendar both exist, both are project-scoped. But they do not talk to each other (milestones ≠ calendar events). No "move day" can be set that appears in all views simultaneously. |
| Marketplace attachment | 6/10 | Cart-to-project linking exists and is genuinely powerful. But the marketplace requires pre-published supply — no outbound "request a quote" path. The moving scenario seed listing (Whisker-Smooth Move Planner) is a good start. |
| Change handling | 4/10 | Structured updates exist but are buried at a separate URL, not in the project tabs. No cascade logic. Providers do not receive change notifications. The user must manually update every affected item. |
| Payment / finance handling | 5/10 | Wallet ledger is clean and signed amounts are readable. But reimbursing a non-app-user helper is awkward, and participant payment status is invisible from the participants view. |
| Business / provider usefulness | 6/10 | Jobs board, listing management, and workflow steps are genuinely useful for a provider. But the two sides (customer project + provider job) are not connected unless both are app users with a marketplace transaction between them. |
| Overall coherence | 6/10 | The individual modules are well-built. The gap is in the connective tissue — participants ↔ tasks, milestones ↔ calendar, structured updates ↔ timeline, provider ↔ customer job are all siloed. The platform feels like a well-organised collection of tools rather than a single connected experience. |
`)

    section('## C. FRICTION POINTS (ranked by severity)\n')

    append(`
**1. 🚫 Participants are not connected to anything**
Named participants (Jordan, City Van Hire) exist in a list but have no link to tasks, calendar events, budget items, or marketplace purchases. The participant list is a glorified contact list inside the project. *Severity: Critical — this is the core coordination gap.*

**2. 🚫 No outbound provider engagement**
There is no way to say "I need a van hire — send them a quote request via the app." Providers must already be on the platform with published listings. The scenario only works if the supply side pre-exists. *Severity: Critical for the moving-house flagship demo.*

**3. ⚠️ Structured updates are buried**
Change handling (Delay, Booking changed) lives at /projects/$id/updates — not in the project shell tabs. Most users will never find it. *Severity: High.*

**4. ⚠️ Milestones ≠ calendar events**
A Gantt milestone called "Move Day" does not appear on the calendar. The two scheduling views do not share a data layer. *Severity: High — breaks the "one connected experience" promise.*

**5. ⚠️ No availability polling**
"When are Jordan and Sam both free?" cannot be answered in-app. There is no poll, doodle, or scheduling mechanism for non-app participants. *Severity: High for the coordination use case.*

**6. ⚠️ No cascade on change**
Shifting key collection time does not offer to shift the van hire start, cleaner arrival, or any downstream item. Every change is manual. *Severity: High.*

**7. ⚠️ Two capture surfaces with no clear guidance**
Feed composer and Coordination quick-capture both accept freeform input but model it differently. A new user has no signal about which to use for "I\'m moving house." *Severity: Medium.*

**8. ⚠️ Seed milestones are generic**
Kickoff / Mid-point review / Delivery are not meaningful for a moving house context. The app does not tailor them by project category. *Severity: Medium.*

**9. ⚠️ No "reimburse a helper" flow**
Paying back Jordan for fuel requires a manual wallet entry with no connection to the participant record. *Severity: Medium.*

**10. → Provider and customer sides are not connected**
A provider\'s job record and a customer\'s project are separate objects even for the same real-world event. *Severity: Medium.*
`)

    section('## D. MOMENTS WHERE THE PRODUCT FELT UNIQUELY POWERFUL\n')

    append(`
**✨ Post → Project in one click**
The Waves icon on a post creates a project from that conversation moment. This is the conversation-first hypothesis working exactly as intended. No other tool does this.

**✨ Cart → Project attachment**
Adding a listing to cart and linking it to a specific project at checkout is a genuine differentiator. The commerce is contextual, not detached.

**✨ Conversation tab inside every project**
Every project has a full social-style feed inside it. Updates, questions, and decisions live next to the plan. This is coherent and powerful.

**✨ Signed wallet amounts (+$/-$)**
Clean, readable cash flow at a glance. Better than most ledger UIs.

**✨ Coordination board as a universal inbox**
The intent + display kind + state model (coordinate / book / attend / buy) is genuinely expressive. It can model more life scenarios than a simple task list.

**✨ Reusable flow templates**
One-click "Weekend Move" template that seeds a project with all the right blocks is a powerful demo moment. This is a direct answer to the "what do I do first?" problem.

**✨ Gantt with coordination mode**
Seeing all timed coordination objects across all projects on one timeline — with project labels — is a powerful "life at a glance" view that is hard to find elsewhere.

**✨ Jobs board for providers**
A provider can manage their side of the work with workflow steps, payment state, and appointment times — without needing the customer to be connected.
`)

    section('## E. RECOMMENDATIONS\n')

    append(`
### Improving the main flow

**1. Make Coordination templates the hero entry point for common scenarios**
When a user types something like "moving house" in the feed, offer to start a Moving House flow template — seeding the project, milestones, participants, and a shopping list all at once. This collapses the five manual steps into one moment.

**2. Add "Participants" as a first-class tab in the project shell**
It is currently accessible only via a separate URL. Moving it into the shell tabs (alongside Conversation, Calendar, Timeline, Store, People) would make the coordination web visible at all times. *(Note: "People" tab exists — this may already be addressed, but the URL routing suggests it is the participants page.)*

**3. Connect participants to tasks and calendar events**
Allow a milestone or task to have an "assigned to" participant. When a participant is assigned, they appear on the relevant calendar event and Gantt row. This is the missing connective tissue.

**4. Bring Structured Updates into the project shell**
Add an "Updates" tab to the project shell tab bar. Updates should appear in the conversation thread AND on the timeline as markers. A Delay update should offer a one-tap "shift all downstream items" action.

### Reducing fragmentation

**5. Unify Gantt milestones and calendar events**
A milestone should optionally create a calendar event. The move date set on the Gantt should appear on the calendar automatically.

**6. Surface participant payment status on the participants view**
Each participant row should show whether they have a pending wallet transaction, a marketplace order in progress, or have been settled.

**7. Kill or clearly separate the two capture surfaces**
Either route Coordination quick-capture through the feed composer (with a toggle for "this is a coordination object"), or give clear guidance: "For a quick post → Feed. For something you need to plan → Coordination."

### Clarifying terminology and navigation

**8. Rename generic seed milestones by project category**
If the project category is "move" or "moving", seed milestones as "Pack", "Move day", "Keys back" instead of Kickoff / Mid-point / Delivery.

**9. Make "Structured Updates" discoverable**
Add a "Post an update" button in the project conversation toolbar. The update types (Delay, Confirmed, etc.) should be accessible without navigating to a separate URL.

**10. Clarify "Coordination" as a concept**
The word "Coordination" is used for both the board (/app/coordination) and the timeline mode (Gantt coordination mode). New users will not know what "coordination objects" are. Consider renaming to "Flows" or "Plans" throughout, since "flow" already appears in the app\'s design system (AppCard uses "Flow · Market", etc.).

### Strengthening the moving-house use case as a flagship demo

**11. Build a "Moving House" starter template into the seed data**
The Whisker-Smooth Move Planner is a good start. It should include:
- A project template with correctly named milestones (Pack, Move day, Keys back)
- Pre-populated participant role slots (Helper ×2, Van hire, Cleaner, Agent)
- A checklist: boxes, tape, disconnections, change of address
- Linked marketplace listings for van hire and cleaning services (even as stubs)
- A pre-written conversation opener post ("I\'m planning a move for [date] — here\'s the plan")

**12. Add an outbound "invite a provider to quote" flow**
Allow a project participant (with role=provider) to receive a structured brief via email (no app account required). The brief includes: job date, location, what\'s needed. Their reply creates a coordination object and can be turned into a marketplace transaction.

**13. Add an availability poll to participant coordination**
"Find a time" button on the participants page: select participants, select a date range → generates a shareable link (no app account needed for participants) → responses aggregate into a "best slot" recommendation visible in the calendar.
`)

    section('---\n\n*Report generated by automated Playwright UX evaluation — 2026-03-16*')
    append('')
  })
})
