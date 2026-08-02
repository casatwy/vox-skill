#!/usr/bin/env node

import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { checkProviders } from './generate-providers.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const manifest = JSON.parse(await readFile(path.join(root, 'vox/manifest.json'), 'utf8'))
const metadata = JSON.parse(await readFile(path.join(root, 'providers/metadata.json'), 'utf8'))
const skill = await readFile(path.join(root, 'vox/SKILL.md'), 'utf8')
const openai = await readFile(path.join(root, 'vox/agents/openai.yaml'), 'utf8')

assert.deepEqual(manifest, {
  skillVersion: '1.0.12',
  minimumCliVersion: '0.1.0',
})
assert.equal(metadata.skill.id, 'vox')
assert.equal(metadata.skill.version, manifest.skillVersion)
assert.equal(metadata.skill.minimumCliVersion, manifest.minimumCliVersion)
assert.equal(metadata.source.repository, 'https://github.com/reka-cc/vox-skill.git')
assert.equal(metadata.providers.codex.marketplace, 'vox-official')
assert.equal(metadata.providers.claude.marketplace, 'vox-official')
assert.equal(metadata.providers.gemini.extension, 'vox')
assert.equal(metadata.providers.openclaw.registry, '@casatwy/vox')
assert.deepEqual(Object.keys(metadata.providers).sort(), ['claude', 'codex', 'gemini', 'openclaw'])

for (const [platform, provider] of Object.entries(metadata.providers)) {
  assert.equal(provider.install, `vox skill install --platform ${platform}`)
  assert.equal(provider.status, `vox skill status --platform ${platform}`)
}

assert.match(skill, /^---\nname: vox\n/)
assert.doesNotMatch(skill, /\bdeyo\b|DEYO_|~\/\.config\/deyo/i)
assert.match(skill, /Do not maintain, enumerate, or infer a source allowlist\./)
assert.match(skill, /Omit `--language` unless the current user explicitly selects/)
assert.match(openai, /default_prompt: "Use \$vox /)
assert.match(openai, /allow_implicit_invocation: false/)

await checkProviders()
process.stdout.write('Vox Skill artifacts are valid.\n')
