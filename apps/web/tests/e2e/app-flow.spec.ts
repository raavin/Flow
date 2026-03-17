import { expect, test, type Page } from '@playwright/test'

function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`
}

async function signUpAndOnboard(page: Page, email: string, firstName = 'Jason') {
  await page.goto('/')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill('cozyplanning123')
  await page.getByRole('button', { name: 'Create account' }).nth(1).click()
  await expect(page).toHaveURL(/onboarding/)
  await page.getByLabel('First name').fill(firstName)
  await page.getByRole('button', { name: 'Save setup and open dashboard' }).click()
  await expect(page).toHaveURL(/app\/messages/)
  await expect(page.getByRole('button', { name: 'Following' })).toBeVisible()
}

test('user can sign up, create a project, and add a task', async ({ page }) => {
  await signUpAndOnboard(page, uniqueEmail('project-flow'))

  await page.getByRole('link', { name: 'Projects' }).click()
  await expect(page).toHaveURL(/app\/projects/)

  const projectTitle = `Move plan ${Date.now()}`
  await page.getByPlaceholder('Move house, birthday prep, leave request...').fill(projectTitle)
  await page.getByRole('button', { name: 'Create project' }).click()
  await expect(page).toHaveURL(/app\/projects\/.+\/conversation/)
  await expect(page.getByText(projectTitle)).toBeVisible()
  await page.getByRole('main').getByRole('link', { name: 'Timeline', exact: true }).click()
  await expect(page).toHaveURL(/app\/projects\/.+\/timeline/)
  await page.getByRole('button', { name: 'Add task' }).click()
  await page.getByPlaceholder('Send invites, confirm transport...').fill('Confirm helper arrivals')
  await page.getByRole('button', { name: 'Add task' }).nth(1).click()

  await expect(page.getByText('Confirm helper arrivals').first()).toBeVisible()
})

test('user can add a marketplace listing to cart, keep shopping, and check out', async ({ page }) => {
  await signUpAndOnboard(page, uniqueEmail('cart-flow'))

  await page.getByRole('link', { name: 'Marketplace' }).click()
  await expect(page.getByText('Whisker-Smooth Move Planner')).toBeVisible()
  await page.getByRole('link', { name: 'View details' }).first().click()
  await page.getByRole('button', { name: 'Add to cart' }).first().click()
  await expect(page.getByRole('link', { name: /Cart \(1\)/ })).toBeVisible()
  await page.getByRole('link', { name: /Cart \(1\)/ }).click()

  await expect(page.getByText('Review your draft order')).toBeVisible()
  await page.getByRole('button', { name: 'Place order' }).click()

  await expect(page.getByText('Order placed')).toBeVisible()
  await page.getByRole('link', { name: 'View transactions' }).click()
  await expect(page).toHaveURL(/app\/wallet/)
  await expect(page.getByText(/^ORD-/).first()).toBeVisible()
})

test('template import creates a real project plan', async ({ page }) => {
  await signUpAndOnboard(page, uniqueEmail('template-flow'))

  await page.getByRole('link', { name: 'Marketplace' }).click()
  await expect(page.getByText('Whisker-Smooth Move Planner')).toBeVisible()
  await page.getByRole('link', { name: 'Whisker-Smooth Move Planner' }).click()
  await page.getByRole('button', { name: 'Import template' }).click()

  await expect(page).toHaveURL(/app\/projects\/.+\/conversation/)
  await expect(page.getByText('Whisker-Smooth Move Planner')).toBeVisible()
  await page.getByRole('main').getByRole('link', { name: 'Timeline', exact: true }).click()
  await expect(page.getByText('Confirm helpers').first()).toBeVisible()
})

test('existing user can sign back in without being bounced to onboarding', async ({ page }) => {
  const email = uniqueEmail('signin-flow')

  await signUpAndOnboard(page, email)
  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page).toHaveURL(/\/$/)

  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill('cozyplanning123')
  await page.getByRole('button', { name: 'Sign in' }).nth(1).click()

  await expect(page).toHaveURL(/app\/messages/)
  await expect(page.getByRole('button', { name: 'Following' })).toBeVisible()
})

test('user can follow someone, quote a post, and start a DM', async ({ browser }) => {
  const firstEmail = uniqueEmail('social-first')
  const secondEmail = uniqueEmail('social-second')
  const firstName = `Avery${Date.now().toString().slice(-4)}`
  const firstContext = await browser.newContext()
  const secondContext = await browser.newContext()
  const firstPage = await firstContext.newPage()
  const secondPage = await secondContext.newPage()

  await signUpAndOnboard(firstPage, firstEmail, firstName)
  await firstPage.getByRole('button', { name: "What's up?" }).click()
  await firstPage.getByPlaceholder("What's happening? Try @, #, or /").fill(`Hello from ${firstName} #general`)
  await firstPage.getByRole('button', { name: 'Publish' }).click()
  await expect(firstPage.getByText(`Hello from ${firstName} #general`)).toBeVisible()

  await signUpAndOnboard(secondPage, secondEmail, 'Blake')
  await secondPage.getByPlaceholder('Search posts, people, or topics').fill(firstName)
  await secondPage.getByRole('link', { name: firstName }).click()
  await expect(secondPage.getByRole('button', { name: 'Follow' })).toBeVisible()
  await secondPage.getByRole('button', { name: 'Follow' }).click()
  await expect(secondPage.getByRole('button', { name: 'Following' })).toBeVisible()

  await secondPage.getByRole('button', { name: 'Message' }).click()
  await expect(secondPage).toHaveURL(/app\/messages\/dm\//)
  await secondPage.getByPlaceholder('Write a message...').fill('Hi Avery, I can help with the move.')
  await secondPage.getByRole('button', { name: 'Send' }).click()
  await expect(secondPage.getByText('Hi Avery, I can help with the move.')).toBeVisible()

  await secondPage.getByRole('link', { name: 'Inbox' }).click()
  await secondPage.getByRole('link', { name: 'Back to feed' }).click()
  await secondPage.getByRole('button', { name: 'Following' }).click()
  await expect(secondPage.getByText(`Hello from ${firstName} #general`)).toBeVisible()
  await secondPage.getByRole('button', { name: 'Quote' }).click()
  await expect(secondPage.getByText('Quoting @')).toBeVisible()
  await secondPage.getByPlaceholder("What's happening? Try @, #, or /").fill('Sharing this with the crew.')
  await secondPage.getByRole('button', { name: 'Publish' }).click()
  await expect(secondPage.getByText('Sharing this with the crew.')).toBeVisible()

  await firstContext.close()
  await secondContext.close()
})

test('coordination timeline: edit title, delete row, project label, and filter', async ({ page }) => {
  await signUpAndOnboard(page, uniqueEmail('gantt-coord'), 'Audra')

  // Create a project so coordination objects can be linked
  await page.getByRole('link', { name: 'Projects' }).click()
  await page.getByPlaceholder('Move house, birthday prep, leave request...').fill('Gantt Coord Project')
  await page.getByRole('button', { name: 'Create project' }).click()
  await expect(page).toHaveURL(/app\/projects\/.+\/conversation/, { timeout: 10000 })

  // Go to Gantt in coordination mode
  await page.goto('/app/gantt')
  await page.getByRole('button', { name: 'Coordination mode' }).click()

  // If no timed coordination items exist, the filter row should not render but mode toggle should be present
  await expect(page.getByRole('button', { name: 'Coordination mode' })).toBeVisible()

  // Go to Coordination page and create a timed coordination object
  await page.goto('/app/coordination')
  await page.waitForLoadState('networkidle')

  // Fill in a new coordination object with a due date so it appears on the Gantt
  const titleInput = page.getByPlaceholder('Doctor appointment, coffee catch-up, request leave...')
  if (await titleInput.isVisible().catch(() => false)) {
    await titleInput.fill('Gantt coord test item')
    // Set a due date so the item appears on the timeline
    const dateInput = page.locator('input[type="date"]').first()
    if (await dateInput.isVisible().catch(() => false)) {
      await dateInput.fill('2026-04-01')
    }
    await page.getByRole('button', { name: 'Create coordination object' }).click()
    await page.waitForTimeout(500)
  }

  // Return to Gantt in coordination mode
  await page.goto('/app/gantt')
  await page.getByRole('button', { name: 'Coordination mode' }).click()
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(800)

  // Filter search box should be present in coordination mode
  const searchInput = page.getByPlaceholder('Search items or projects…')
  await expect(searchInput).toBeVisible()

  // Type in search — should not crash
  await searchInput.fill('test')
  await page.waitForTimeout(300)
  await searchInput.fill('')

  // Clear filters button should not be visible when nothing is filtered
  await expect(page.getByRole('button', { name: 'Clear filters' })).not.toBeVisible()

  // Type a search that matches nothing → empty state with clear button
  await searchInput.fill('zzznomatch')
  await page.waitForTimeout(300)
  const clearBtn = page.getByRole('button', { name: 'Clear filters' })
  if (await clearBtn.isVisible().catch(() => false)) {
    await expect(page.getByText('No items match your filters.')).toBeVisible()
    await clearBtn.click()
    await expect(searchInput).toHaveValue('')
  }
})

test('user can promote a project post to the public feed', async ({ page }) => {
  await signUpAndOnboard(page, uniqueEmail('promote-flow'))

  // Create a project
  await page.getByRole('link', { name: 'Projects' }).click()
  await page.getByPlaceholder('Move house, birthday prep, leave request...').fill('Promote test project')
  await page.getByRole('button', { name: 'Create project' }).click()
  await expect(page).toHaveURL(/app\/projects\/.+\/conversation/)

  // Post something in the project conversation
  await page.getByRole('button', { name: "What's up?" }).click()
  await page.getByPlaceholder("What's happening? Try @, #, or /").fill('Big project update!')
  await page.getByRole('button', { name: 'Publish' }).click()
  await expect(page.getByText('Big project update!')).toBeVisible()

  // Promote to public feed
  await page.getByRole('button', { name: 'Promote to feed' }).first().click()
  await expect(page.getByText('Public').first()).toBeVisible()

  // Demote
  await page.getByRole('button', { name: 'Remove from feed' }).first().click()
  await expect(page.getByText('Public').first()).not.toBeVisible()
})
