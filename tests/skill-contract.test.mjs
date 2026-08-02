import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))

test('canonical instructions preserve the explicit single-input boundary', async () => {
  const skill = await readFile(path.join(root, 'vox/SKILL.md'), 'utf8')
  assert.match(skill, /one URL written in the request or one exact local audio\/video file path/)
  assert.match(skill, /Never browse a directory/)
  assert.match(skill, /Reject directories, globs, stdin, special files, multiple inputs, batches/)
  assert.match(skill, /Do not maintain, enumerate, or infer a source allowlist/)
  assert.match(skill, /Omit `--language` unless the current user explicitly selects/)
  assert.match(skill, /vox transcribe '<url>'/)
  assert.match(skill, /vox transcribe --file '<path>'/)
  assert.doesNotMatch(skill, /\bdeyo\b|DEYO_|~\/\.config\/deyo/i)
})

test('authentication guidance never embeds a key in argv', async () => {
  const skill = await readFile(path.join(root, 'vox/SKILL.md'), 'utf8')
  assert.match(skill, /vox auth login\n/)
  assert.doesNotMatch(skill, /auth login\s+--api-key/)
  assert.doesNotMatch(skill, /vox_sk_[A-Za-z0-9]/)
  assert.match(skill, /VOX_API_KEY/)
})

test('all generated providers expose the same identity, version, and CLI floor', async () => {
  const manifest = JSON.parse(await readFile(path.join(root, 'vox/manifest.json'), 'utf8'))
  const metadata = JSON.parse(await readFile(path.join(root, 'providers/metadata.json'), 'utf8'))
  for (const provider of Object.values(metadata.providers)) {
    assert.match(provider.install, /^vox skill install --platform /)
    assert.match(provider.status, /^vox skill status --platform /)
  }
  assert.deepEqual(metadata.skill, {
    id: 'vox',
    version: manifest.skillVersion,
    minimumCliVersion: manifest.minimumCliVersion,
    canonicalTreeHash: metadata.skill.canonicalTreeHash,
  })
})
