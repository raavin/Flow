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
  await expect(page).toHaveURL(/app\/home/)
}

test('user can sign up, create a project, and add a task', async ({ page }) => {
  await signUpAndOnboard(page, uniqueEmail('project-flow'))

  await page.getByRole('link', { name: 'Projects' }).click()
  await expect(page).toHaveURL(/app\/projects/)

  const projectTitle = `Move plan ${Date.now()}`
  await page.getByLabel('Title').fill(projectTitle)
  await page.getByRole('button', { name: 'Create project' }).click()
  await expect(page).toHaveURL(/app\/projects\/.+/)
  await expect(page.getByText(projectTitle)).toBeVisible()
  await page.getByPlaceholder('Add a task').fill('Confirm helper arrivals')
  await page.getByRole('button', { name: 'Add task' }).click()

  await expect(page.getByText('Confirm helper arrivals')).toBeVisible()
})

test('user can add a marketplace listing to cart and confirm it', async ({ page }) => {
  await signUpAndOnboard(page, uniqueEmail('cart-flow'))

  await page.getByRole('link', { name: 'Marketplace' }).click()
  await expect(page.getByText('Whisker-Smooth Move Planner')).toBeVisible()
  await page.getByText('Whisker-Smooth Move Planner').click()
  await page.getByRole('button', { name: 'Book / add to cart' }).click()

  await page.goBack()
  await page.getByRole('link', { name: 'Cart review' }).first().click()
  await expect(page.getByText('Cart and booking review')).toBeVisible()
  await page.getByRole('button', { name: 'Confirm' }).first().click()

  await expect(page.getByRole('button', { name: 'Confirmed' }).first()).toBeVisible()
})

test('template import creates a real project plan', async ({ page }) => {
  await signUpAndOnboard(page, uniqueEmail('template-flow'))

  await page.getByRole('link', { name: 'Marketplace' }).click()
  await expect(page.getByText('Whisker-Smooth Move Planner')).toBeVisible()
  await page.getByText('Whisker-Smooth Move Planner').click()
  await page.getByRole('button', { name: 'Import template' }).click()

  await expect(page).toHaveURL(/app\/projects\//)
  await expect(page.getByText('Whisker-Smooth Move Planner')).toBeVisible()
  await expect(page.getByText('Confirm helpers')).toBeVisible()
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

  await expect(page).toHaveURL(/app\/home/)
  await expect(page.getByText('Pick a path')).toBeVisible()
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
  await firstPage.getByRole('link', { name: 'Messages' }).click()
  await firstPage.getByPlaceholder("What's happening?").fill(`Hello from ${firstName} #general`)
  await firstPage.getByRole('button', { name: 'Publish' }).click()
  await expect(firstPage.getByText(`Hello from ${firstName} #general`)).toBeVisible()

  await signUpAndOnboard(secondPage, secondEmail, 'Blake')
  await secondPage.getByRole('link', { name: 'Messages' }).click()
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
  await secondPage.getByPlaceholder("What's happening?").fill('Sharing this with the crew.')
  await secondPage.getByRole('button', { name: 'Publish' }).click()
  await expect(secondPage.getByText('Sharing this with the crew.')).toBeVisible()

  await firstContext.close()
  await secondContext.close()
})
