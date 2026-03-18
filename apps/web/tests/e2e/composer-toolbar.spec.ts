import { test, expect } from '@playwright/test'

// Credentials — uses the local Supabase dev instance
const EMAIL = 'playwright@test.com'
const PASSWORD = 'Playwright123!'

test.describe('Composer toolbar', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    // Switch to sign-in mode if needed
    const signInTab = page.getByRole('button', { name: /sign.?in/i }).first()
    if (await signInTab.isVisible()) await signInTab.click()
    await page.getByPlaceholder(/you@example\.com/i).fill(EMAIL)
    await page.getByPlaceholder(/password/i).fill(PASSWORD)
    await page.getByRole('button', { name: /^sign.?in$/i }).first().click()
    await page.waitForURL(/\/app\//)
  })

  async function openComposer(page: import('@playwright/test').Page) {
    await page.goto('/app/messages')
    // Find and click the compose / new post button
    await page.getByRole('button', { name: /new post|compose|write|post/i }).first().click()
    await expect(page.getByTitle('bold')).toBeVisible({ timeout: 10_000 })
  }

  test('heading button applies H3 to typed text', async ({ page }) => {
    await openComposer(page)

    const editor = page.locator('[contenteditable="true"]').first()
    await editor.click()
    await editor.type('Hello heading')

    // Log what the editor contains before clicking heading
    const beforeHtml = await editor.innerHTML()
    console.log('Before heading click:', beforeHtml)

    // Check selection exists
    const hasSel = await page.evaluate(() => {
      const sel = window.getSelection()
      return sel ? sel.rangeCount : 0
    })
    console.log('Selection rangeCount before click:', hasSel)

    await page.getByTitle('heading').click()

    const afterHtml = await editor.innerHTML()
    console.log('After heading click:', afterHtml)

    // Check what the selection looks like after
    const afterSel = await page.evaluate(() => {
      const sel = window.getSelection()
      if (!sel || !sel.rangeCount) return 'no selection'
      const range = sel.getRangeAt(0)
      return `container: ${(range.startContainer as Element).tagName ?? 'text'}, parent: ${(range.startContainer.parentElement?.tagName ?? 'none')}`
    })
    console.log('Selection after click:', afterSel)

    await expect(editor.locator('h3')).toBeVisible()
  })

  test('list button wraps text in UL', async ({ page }) => {
    await openComposer(page)

    const editor = page.locator('[contenteditable="true"]').first()
    await editor.click()
    await editor.type('List item one')

    const beforeHtml = await editor.innerHTML()
    console.log('Before list click:', beforeHtml)

    await page.getByTitle('list').click()

    const afterHtml = await editor.innerHTML()
    console.log('After list click:', afterHtml)

    await expect(editor.locator('ul li')).toBeVisible()
  })

  test('toolbar buttons keep editor focused (mousedown preventDefault)', async ({ page }) => {
    await openComposer(page)

    const editor = page.locator('[contenteditable="true"]').first()
    await editor.click()
    await editor.type('test focus')

    // Use mouse.down + mouse.up on the button to simulate the full click
    const headingBtn = page.getByTitle('heading')
    const box = await headingBtn.boundingBox()
    if (!box) throw new Error('No bounding box')

    // mousedown on the button - check if editor still has selection
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()

    const selAfterMousedown = await page.evaluate(() => {
      const sel = window.getSelection()
      return sel ? sel.rangeCount : 0
    })
    console.log('Selection rangeCount after mousedown on button:', selAfterMousedown)

    await page.mouse.up()

    const afterHtml = await editor.innerHTML()
    console.log('After full click:', afterHtml)
  })
})
