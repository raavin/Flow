/**
 * UX Audit — comprehensive click-through
 * Appends findings to /home/jason/projects/superapp/ux-audit.md as it goes.
 */

import * as fs from 'fs'
import { expect, test, type Page } from '@playwright/test'

const ISSUES_FILE = '/home/jason/projects/superapp/ux-audit.md'

function log(section: string, finding: string) {
  const line = `\n## ${section}\n${finding}\n`
  fs.appendFileSync(ISSUES_FILE, line)
}

function issue(section: string, detail: string) {
  const line = `\n### ISSUE — ${section}\n${detail}\n`
  fs.appendFileSync(ISSUES_FILE, line)
}

function ok(section: string, detail: string) {
  const line = `\n### OK — ${section}\n${detail}\n`
  fs.appendFileSync(ISSUES_FILE, line)
}

function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`
}

async function signUpAndOnboard(page: Page, email: string, firstName = 'AuditUser') {
  await page.goto('/')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill('cozyplanning123')
  await page.getByRole('button', { name: 'Create account' }).nth(1).click()
  await expect(page).toHaveURL(/onboarding/, { timeout: 15000 })
  await page.getByLabel('First name').fill(firstName)
  await page.getByRole('button', { name: 'Save setup and open dashboard' }).click()
  await expect(page).toHaveURL(/app\/messages/, { timeout: 15000 })
}

// Helper: get all visible text in main content area
async function getMainText(page: Page): Promise<string> {
  const main = page.locator('main').first()
  return await main.innerText().catch(() => page.locator('body').innerText())
}

// Helper: check for obviously broken text patterns
function checkForJunk(text: string, where: string) {
  const patterns = [
    { re: /\[object Object\]/i, label: '[object Object] rendered' },
    { re: /undefined/i, label: '"undefined" visible in text' },
    { re: /NaN/g, label: 'NaN visible in text' },
    { re: /\{\{[^}]+\}\}/, label: 'uninterpolated template literal {{...}}' },
    { re: /Error:/i, label: 'raw Error: string visible' },
    { re: /Cannot read prop/i, label: 'JS error message visible' },
  ]
  for (const { re, label } of patterns) {
    if (re.test(text)) {
      issue(where, `${label}\n\nExtract: \`${text.substring(0, 400)}\``)
    }
  }
}

test.describe('UX Audit', () => {
  let email: string
  let projectId: string

  test('Landing page', async ({ page }) => {
    log('LANDING PAGE', 'Checking landing page content and navigation.')
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const text = await getMainText(page)
    checkForJunk(text, 'Landing page')

    // Check sign in / create account visible
    const hasSignIn = await page.getByRole('button', { name: 'Sign in' }).isVisible().catch(() => false)
    const hasCreate = await page.getByRole('button', { name: 'Create account' }).isVisible().catch(() => false)
    if (!hasSignIn) issue('Landing page', 'No "Sign in" button visible')
    else ok('Landing page', '"Sign in" button visible')
    if (!hasCreate) issue('Landing page', 'No "Create account" button visible')
    else ok('Landing page', '"Create account" button visible')

    // Check for email + password inputs
    const hasEmail = await page.getByLabel('Email').isVisible().catch(() => false)
    if (!hasEmail) issue('Landing page', 'Email input not visible on landing page')
    else ok('Landing page', 'Email/password form visible on landing page')
  })

  test('Sign up and onboarding', async ({ page }) => {
    log('SIGN UP & ONBOARDING', 'Creating fresh account and going through onboarding.')
    email = uniqueEmail('audit')
    await page.goto('/')
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill('cozyplanning123')
    await page.getByRole('button', { name: 'Create account' }).nth(1).click()

    await expect(page).toHaveURL(/onboarding/, { timeout: 15000 })
    const onboardText = await getMainText(page)
    checkForJunk(onboardText, 'Onboarding page')

    // First name field
    const firstNameInput = page.getByLabel('First name')
    const hasFirstName = await firstNameInput.isVisible().catch(() => false)
    if (!hasFirstName) issue('Onboarding', 'First name input not found')
    else ok('Onboarding', 'First name input visible')

    await firstNameInput.fill('Audra')
    await page.getByRole('button', { name: 'Save setup and open dashboard' }).click()
    await expect(page).toHaveURL(/app\/messages/, { timeout: 15000 })
    ok('Onboarding', 'Onboarding completes and lands on /app/messages')
  })

  test('Messages / Feed page', async ({ page }) => {
    log('MESSAGES / FEED', 'Checking feed and social post composer.')
    await signUpAndOnboard(page, uniqueEmail('audit-feed'), 'Audra')

    const text = await getMainText(page)
    checkForJunk(text, 'Messages feed')

    // Compose button
    const composeBtn = page.getByRole('button', { name: "What's up?" })
    if (!await composeBtn.isVisible().catch(() => false)) {
      issue('Messages feed', 'Compose / "What\'s up?" button not visible')
    } else {
      ok('Messages feed', 'Compose button visible')
      await composeBtn.click()
      const composer = page.getByPlaceholder("What's happening? Try @, #, or /")
      if (!await composer.isVisible().catch(() => false)) {
        issue('Messages feed', 'Post composer textarea not visible after clicking compose')
      } else {
        ok('Messages feed', 'Post composer opens correctly')
        await composer.fill('Audit test post #audit')
        await page.getByRole('button', { name: 'Publish' }).click()
        await expect(page.getByText('Audit test post #audit')).toBeVisible({ timeout: 8000 })
        ok('Messages feed', 'Post publishes and appears in feed')
      }
    }

    // Following / feed toggle
    const followingBtn = page.getByRole('button', { name: 'Following' })
    if (!await followingBtn.isVisible().catch(() => false)) {
      issue('Messages feed', '"Following" feed toggle button not found')
    } else {
      ok('Messages feed', '"Following" toggle visible')
    }

    // Search
    const search = page.getByPlaceholder('Search posts, people, or topics')
    if (!await search.isVisible().catch(() => false)) {
      issue('Messages feed', 'Search input not visible on feed')
    } else {
      ok('Messages feed', 'Search input visible')
    }
  })

  test('Navigation items', async ({ page }) => {
    log('NAV', 'Checking all nav links are visible and lead somewhere.')
    await signUpAndOnboard(page, uniqueEmail('audit-nav'), 'Audra')

    const navLinks = [
      { name: 'Projects', urlPattern: /app\/projects/ },
      { name: 'Marketplace', urlPattern: /app\/marketplace/ },
      { name: 'Wallet', urlPattern: /app\/wallet/ },
      { name: 'Calendar', urlPattern: /app\/calendar/ },
    ]

    for (const link of navLinks) {
      const el = page.getByRole('link', { name: link.name }).first()
      if (!await el.isVisible().catch(() => false)) {
        issue('Nav', `"${link.name}" nav link not visible`)
      } else {
        await el.click()
        await page.waitForLoadState('networkidle')
        const url = page.url()
        if (!link.urlPattern.test(url)) {
          issue('Nav', `"${link.name}" link navigated to ${url} but expected ${link.urlPattern}`)
        } else {
          ok('Nav', `"${link.name}" navigates correctly to ${url}`)
        }
        const pageText = await getMainText(page)
        checkForJunk(pageText, `Nav → ${link.name} page`)
      }
    }
  })

  test('Projects page and project creation', async ({ page }) => {
    log('PROJECTS', 'Creating a project and checking all tabs.')
    await signUpAndOnboard(page, uniqueEmail('audit-proj'), 'Audra')

    await page.getByRole('link', { name: 'Projects' }).click()
    await expect(page).toHaveURL(/app\/projects/, { timeout: 10000 })

    const projectsText = await getMainText(page)
    checkForJunk(projectsText, 'Projects list page')

    // Create project
    const titleInput = page.getByPlaceholder('Move house, birthday prep, leave request...')
    if (!await titleInput.isVisible().catch(() => false)) {
      issue('Projects', 'Project title input not found on projects page')
      return
    }
    const projectTitle = `Audit Project ${Date.now()}`
    await titleInput.fill(projectTitle)
    await page.getByRole('button', { name: 'Create project' }).click()
    await expect(page).toHaveURL(/app\/projects\/.+\/conversation/, { timeout: 10000 })

    // Extract project ID from URL
    projectId = page.url().match(/projects\/([^/]+)/)?.[1] ?? ''
    ok('Projects', `Project created, ID: ${projectId}`)

    const convText = await getMainText(page)
    checkForJunk(convText, 'Project conversation tab')

    // Check project title appears
    if (!convText.includes(projectTitle)) {
      issue('Projects — Conversation tab', `Project title "${projectTitle}" not visible on conversation page`)
    } else {
      ok('Projects — Conversation tab', 'Project title visible')
    }

    // Tab: Timeline
    const timelineLink = page.getByRole('main').getByRole('link', { name: 'Timeline', exact: true })
    if (await timelineLink.isVisible().catch(() => false)) {
      await timelineLink.click()
      await page.waitForLoadState('networkidle')
      const timelineText = await getMainText(page)
      checkForJunk(timelineText, 'Project Timeline tab')
      ok('Projects — Timeline tab', 'Timeline tab loads without junk text')

      // Check for seeded milestones
      if (timelineText.includes('Coordination sprint')) {
        issue('Projects — Timeline tab', '"Coordination sprint" old seed milestone name still appears — seed rename may not have applied')
      }
      if (timelineText.includes('Kickoff')) {
        ok('Projects — Timeline tab', 'New seed milestone "Kickoff" visible')
      }
    } else {
      issue('Projects', 'Timeline tab link not found in project shell')
    }

    // Tab: Calendar
    const calLink = page.getByRole('main').getByRole('link', { name: 'Calendar', exact: true })
    if (await calLink.isVisible().catch(() => false)) {
      await calLink.click()
      await page.waitForLoadState('networkidle')
      checkForJunk(await getMainText(page), 'Project Calendar tab')
      ok('Projects — Calendar tab', 'Calendar tab loads')
    } else {
      issue('Projects', 'Calendar tab not found in project shell')
    }

    // Tab: Store
    const storeLink = page.getByRole('main').getByRole('link', { name: 'Store', exact: true })
    if (await storeLink.isVisible().catch(() => false)) {
      await storeLink.click()
      await page.waitForLoadState('networkidle')
      const storeText = await getMainText(page)
      checkForJunk(storeText, 'Project Store tab')
      ok('Projects — Store tab', 'Store tab loads without junk text')
    } else {
      issue('Projects — Store tab', '"Store" tab not visible in project shell nav')
    }

    // Tab: People
    const peopleLink = page.getByRole('main').getByRole('link', { name: 'People', exact: true })
    if (await peopleLink.isVisible().catch(() => false)) {
      await peopleLink.click()
      await page.waitForLoadState('networkidle')
      checkForJunk(await getMainText(page), 'Project People tab')
      ok('Projects — People tab', 'People tab loads')
    } else {
      issue('Projects', 'People tab not found in project shell')
    }

    // Notes tab should be GONE
    const notesLink = page.getByRole('main').getByRole('link', { name: 'Notes', exact: true })
    if (await notesLink.isVisible().catch(() => false)) {
      issue('Projects', '"Notes" tab still visible — should have been removed')
    } else {
      ok('Projects', '"Notes" tab correctly removed from project shell')
    }
  })

  test('Project Gantt / Timeline page', async ({ page }) => {
    log('GANTT', 'Checking Gantt chart page, milestone names, inline editing.')
    await signUpAndOnboard(page, uniqueEmail('audit-gantt'), 'Audra')

    // Create project
    await page.getByRole('link', { name: 'Projects' }).click()
    const projectTitle = `Gantt Test ${Date.now()}`
    await page.getByPlaceholder('Move house, birthday prep, leave request...').fill(projectTitle)
    await page.getByRole('button', { name: 'Create project' }).click()
    await expect(page).toHaveURL(/app\/projects\/.+\/conversation/, { timeout: 10000 })

    await page.getByRole('main').getByRole('link', { name: 'Timeline', exact: true }).click()
    await page.waitForLoadState('networkidle')

    const ganttText = await getMainText(page)
    checkForJunk(ganttText, 'Gantt page')

    // Check for old bad seed names
    if (ganttText.includes('Coordination sprint')) {
      issue('Gantt', 'Old seed milestone "Coordination sprint" still showing — should be "Kickoff"')
    }
    if (ganttText.includes('General plan')) {
      issue('Gantt', 'Old seed milestone "General plan" still showing — should be "Delivery"')
    }
    if (ganttText.includes('Coordination') && !ganttText.includes('Coordination sprint')) {
      // "Coordination" might be the tab name, not a milestone — acceptable
    }
    if (ganttText.includes('Kickoff')) {
      ok('Gantt', '"Kickoff" seed milestone present')
    }
    if (ganttText.includes('Mid-point review')) {
      ok('Gantt', '"Mid-point review" seed milestone present')
    }
    if (ganttText.includes('Delivery')) {
      ok('Gantt', '"Delivery" seed milestone present')
    }

    // Check add task button
    const addTaskBtn = page.getByRole('button', { name: 'Add task' })
    if (!await addTaskBtn.isVisible().catch(() => false)) {
      issue('Gantt', '"Add task" button not visible')
    } else {
      ok('Gantt', '"Add task" button visible')
    }
  })

  test('Participants page', async ({ page }) => {
    log('PARTICIPANTS', 'Checking participants invite form and duplicate prevention.')
    await signUpAndOnboard(page, uniqueEmail('audit-part'), 'Audra')

    await page.getByRole('link', { name: 'Projects' }).click()
    const projectTitle = `Participants Test ${Date.now()}`
    await page.getByPlaceholder('Move house, birthday prep, leave request...').fill(projectTitle)
    await page.getByRole('button', { name: 'Create project' }).click()
    await expect(page).toHaveURL(/app\/projects\/.+\/conversation/, { timeout: 10000 })

    const currentUrl = page.url()
    const pid = currentUrl.match(/projects\/([^/]+)/)?.[1]
    await page.goto(`/app/projects/${pid}/participants`)
    await page.waitForLoadState('networkidle')

    const partText = await getMainText(page)
    checkForJunk(partText, 'Participants page')

    const nameInput = page.getByPlaceholder('Name or business')
    if (!await nameInput.isVisible().catch(() => false)) {
      issue('Participants', '"Name or business" input not found')
      return
    }
    ok('Participants', 'Participant invite form visible')

    // Add a participant
    await nameInput.fill('Jordan Smith')
    await page.getByRole('button', { name: 'Send invite' }).click()
    await expect(page.getByText('Jordan Smith')).toBeVisible({ timeout: 8000 })
    ok('Participants', 'Participant added successfully')

    // Try to add duplicate
    await nameInput.fill('Jordan Smith')
    await page.getByRole('button', { name: 'Send invite' }).click()
    await page.waitForTimeout(1500)
    const afterDupText = await getMainText(page)
    if (afterDupText.toLowerCase().includes('already') || afterDupText.toLowerCase().includes('duplicate')) {
      ok('Participants', 'Duplicate participant shows inline error message')
    } else {
      // Check if a second Jordan Smith appears (would be bad)
      const smithCount = (afterDupText.match(/Jordan Smith/g) || []).length
      if (smithCount > 1) {
        issue('Participants', 'Duplicate participant was added — no prevention triggered')
      } else {
        ok('Participants', 'Duplicate not added (silently rejected or error shown elsewhere)')
      }
    }
  })

  test('Marketplace pages', async ({ page }) => {
    log('MARKETPLACE', 'Checking marketplace browse, listing detail, and cart.')
    await signUpAndOnboard(page, uniqueEmail('audit-mkt'), 'Audra')

    await page.getByRole('link', { name: 'Marketplace' }).click()
    await page.waitForLoadState('networkidle')

    const mktText = await getMainText(page)
    checkForJunk(mktText, 'Marketplace browse')

    // Check marketplace tabs visible
    const templateTab = page.getByRole('link', { name: /Template/i }).first()
    const servicesTab = page.getByRole('link', { name: /Service/i }).first()
    if (!await templateTab.isVisible().catch(() => false)) {
      issue('Marketplace', 'Templates tab not visible')
    } else {
      ok('Marketplace', 'Templates tab visible')
    }

    // View a listing
    const viewDetails = page.getByRole('link', { name: 'View details' }).first()
    if (await viewDetails.isVisible().catch(() => false)) {
      await viewDetails.click()
      await page.waitForLoadState('networkidle')
      const detailText = await getMainText(page)
      checkForJunk(detailText, 'Marketplace listing detail')

      const hasAddToCart = await page.getByRole('button', { name: 'Add to cart' }).isVisible().catch(() => false)
      const hasImport = await page.getByRole('button', { name: 'Import template' }).isVisible().catch(() => false)
      if (!hasAddToCart && !hasImport) {
        issue('Marketplace — Listing detail', 'Neither "Add to cart" nor "Import template" button visible on listing detail page')
      } else {
        ok('Marketplace — Listing detail', `CTA button visible (Add to cart: ${hasAddToCart}, Import template: ${hasImport})`)
      }
    } else {
      issue('Marketplace', 'No "View details" links found — listings may not be loading')
    }
  })

  test('Wallet page', async ({ page }) => {
    log('WALLET', 'Checking wallet / transaction ledger.')
    await signUpAndOnboard(page, uniqueEmail('audit-wallet'), 'Audra')

    await page.getByRole('link', { name: 'Wallet' }).click()
    await expect(page).toHaveURL(/app\/wallet/, { timeout: 10000 })
    await page.waitForLoadState('networkidle')

    const walletText = await getMainText(page)
    checkForJunk(walletText, 'Wallet page')

    // Check for signed amount column in ledger (if transactions exist)
    // Look for +$ or -$ patterns
    if (walletText.includes('+$') || walletText.includes('-$')) {
      ok('Wallet', 'Signed amount format (+$/-$) visible in ledger')
    } else if (walletText.includes('$')) {
      // amounts exist but may be unsigned (no transactions yet — that's ok)
      ok('Wallet', 'Wallet page loads with currency values')
    }

    // Check headers
    if (walletText.toLowerCase().includes('total')) {
      ok('Wallet', '"Total" column visible in ledger')
    } else if (walletText.toLowerCase().includes('transaction') || walletText.toLowerCase().includes('balance')) {
      ok('Wallet', 'Wallet page has transaction/balance content')
    }
  })

  test('Calendar page', async ({ page }) => {
    log('CALENDAR', 'Checking calendar page.')
    await signUpAndOnboard(page, uniqueEmail('audit-cal'), 'Audra')

    await page.getByRole('link', { name: 'Calendar' }).click()
    await page.waitForLoadState('networkidle')

    const calText = await getMainText(page)
    checkForJunk(calText, 'Calendar page')

    const hasMonthView = calText.match(/January|February|March|April|May|June|July|August|September|October|November|December/)
    if (!hasMonthView) {
      issue('Calendar', 'No month name found on calendar page — calendar may not be rendering')
    } else {
      ok('Calendar', 'Calendar renders with visible month name')
    }
  })

  test('Integrations page', async ({ page }) => {
    log('INTEGRATIONS', 'Checking integrations page.')
    await signUpAndOnboard(page, uniqueEmail('audit-int'), 'Audra')

    await page.goto('/app/integrations')
    await page.waitForLoadState('networkidle')

    const intText = await getMainText(page)
    checkForJunk(intText, 'Integrations page')

    if (!intText || intText.trim().length < 20) {
      issue('Integrations', 'Integrations page appears empty or not rendered')
    } else {
      ok('Integrations', 'Integrations page renders content')
    }

    // Check for key sections
    const sections = ['Payment', 'API', 'Webhook']
    for (const s of sections) {
      if (intText.includes(s)) {
        ok('Integrations', `"${s}" section visible`)
      } else {
        issue('Integrations', `"${s}" section not found on integrations page`)
      }
    }

    // Check nav link for integrations exists
    await page.goto('/app/messages')
    await page.waitForLoadState('networkidle')
    const intNav = page.getByRole('link', { name: /Integration/i })
    if (!await intNav.isVisible().catch(() => false)) {
      issue('Integrations', '"Integrations" nav link not visible in sidebar/nav — page may be orphaned')
    } else {
      ok('Integrations', '"Integrations" nav link present')
    }
  })

  test('Settings page', async ({ page }) => {
    log('SETTINGS', 'Checking settings page.')
    await signUpAndOnboard(page, uniqueEmail('audit-settings'), 'Audra')

    await page.goto('/app/settings')
    await page.waitForLoadState('networkidle')

    const settingsText = await getMainText(page)
    checkForJunk(settingsText, 'Settings page')
    if (!settingsText || settingsText.trim().length < 10) {
      issue('Settings', 'Settings page appears empty')
    } else {
      ok('Settings', 'Settings page renders content')
    }
  })

  test('Social profile page', async ({ page }) => {
    log('SOCIAL PROFILE', 'Checking own social profile page.')
    await signUpAndOnboard(page, uniqueEmail('audit-profile'), 'Audra')

    // Post something then click through to own profile
    const composeBtn = page.getByRole('button', { name: "What's up?" })
    if (await composeBtn.isVisible().catch(() => false)) {
      await composeBtn.click()
      await page.getByPlaceholder("What's happening? Try @, #, or /").fill('Profile audit post')
      await page.getByRole('button', { name: 'Publish' }).click()
      await expect(page.getByText('Profile audit post')).toBeVisible({ timeout: 8000 })
    }

    // Find author link and click
    const authorLink = page.getByRole('link', { name: 'Audra' }).first()
    if (await authorLink.isVisible().catch(() => false)) {
      await authorLink.click()
      await page.waitForLoadState('networkidle')
      const profileText = await getMainText(page)
      checkForJunk(profileText, 'Social profile page')
      ok('Social profile', 'Profile page loads and shows content')
      if (!profileText.includes('Audra')) {
        issue('Social profile', 'Username "Audra" not visible on profile page')
      }
    } else {
      issue('Social profile', 'Could not find link to own profile from feed')
    }
  })

  test('Promote post to feed (is_promoted feature)', async ({ page }) => {
    log('PROMOTE POST', 'Checking promote/demote toggle on project posts.')
    await signUpAndOnboard(page, uniqueEmail('audit-promote'), 'Audra')

    // Create project
    await page.getByRole('link', { name: 'Projects' }).click()
    await page.getByPlaceholder('Move house, birthday prep, leave request...').fill(`Promote Test ${Date.now()}`)
    await page.getByRole('button', { name: 'Create project' }).click()
    await expect(page).toHaveURL(/app\/projects\/.+\/conversation/, { timeout: 10000 })

    // Post something in project conversation
    const msgInput = page.getByPlaceholder('Write a message...')
    if (await msgInput.isVisible().catch(() => false)) {
      await msgInput.fill('Project update for promotion test')
      await page.getByRole('button', { name: 'Send' }).click()
      await expect(page.getByText('Project update for promotion test')).toBeVisible({ timeout: 8000 })
      ok('Promote post', 'Message sent in project conversation')

      // Look for promote button
      const promoteBtn = page.getByRole('button', { name: /Promote|promote/i }).first()
      const globeBtn = page.locator('[data-testid="promote-btn"], button[title*="promote" i], button[aria-label*="promote" i]').first()
      const hasPromote = await promoteBtn.isVisible().catch(() => false) || await globeBtn.isVisible().catch(() => false)
      if (!hasPromote) {
        // Try hovering the message to reveal actions
        const msg = page.getByText('Project update for promotion test').first()
        await msg.hover()
        await page.waitForTimeout(500)
        const afterHover = await promoteBtn.isVisible().catch(() => false)
        if (!afterHover) {
          issue('Promote post', 'No promote/globe button found on project post — promote feature may not be wired up in the UI')
        } else {
          ok('Promote post', 'Promote button visible on hover')
        }
      } else {
        ok('Promote post', 'Promote button visible on project post')
      }
    } else {
      issue('Promote post', 'Message input not found on project conversation page')
    }
  })

  test('Sign out flow', async ({ page }) => {
    log('SIGN OUT', 'Checking sign out.')
    await signUpAndOnboard(page, uniqueEmail('audit-signout'), 'Audra')

    const signOutBtn = page.getByRole('button', { name: 'Sign out' })
    if (!await signOutBtn.isVisible().catch(() => false)) {
      issue('Sign out', '"Sign out" button not visible')
    } else {
      await signOutBtn.click()
      await expect(page).toHaveURL(/\/$/, { timeout: 8000 })
      ok('Sign out', 'Sign out redirects to landing page')
    }
  })
})
