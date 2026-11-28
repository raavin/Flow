import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'

const manifest = JSON.parse(readFileSync(new URL('../dist/.vite/manifest.json', import.meta.url), 'utf8'))
const eager = new Set()
function visit(key) {
  if (eager.has(key)) return
  eager.add(key)
  for (const dependency of manifest[key].imports ?? []) visit(dependency)
}
for (const [key, chunk] of Object.entries(manifest)) if (chunk.isEntry) visit(key)
for (const key of eager) {
  assert(!key.startsWith('src/pages/'), `Page included in initial download: ${key}`)
  assert(!key.includes('rich-post-editor'), 'Rich text editor included in initial download')
}
const pages = Object.keys(manifest).filter((key) => key.startsWith('src/pages/'))
assert(pages.length >= 20, `Expected feature chunks; found only ${pages.length}`)
assert(manifest['src/components/rich-post-editor.tsx']?.isDynamicEntry, 'Editor must load on demand')
console.log(`Verified ${pages.length} lazy page modules and a separate editor chunk.`)
