import assert from 'node:assert/strict'
import { access, cp, mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { assertCanonicalLayout, generateProviders } from '../scripts/generate-providers.mjs'

const root = fileURLToPath(new URL('..', import.meta.url))
const canonical = path.join(root, 'vox')

test('generates consistent metadata and all four platform artifacts', async () => {
  const output = await mkdtemp(path.join(os.tmpdir(), 'vox-provider-output-'))
  try {
    const result = await generateProviders(output)
    assert.equal(result.skillVersion, '1.0.12')
    assert.equal(result.minimumCliVersion, '0.1.0')
    assert.match(result.canonicalTreeHash, /^[a-f0-9]{64}$/)

    const metadata = JSON.parse(await readFile(path.join(output, 'providers/metadata.json'), 'utf8'))
    assert.deepEqual(Object.keys(metadata.providers).sort(), ['claude', 'codex', 'gemini', 'openclaw'])
    assert.equal(metadata.skill.id, 'vox')
    assert.equal(metadata.skill.version, '1.0.12')
    assert.equal(metadata.skill.minimumCliVersion, '0.1.0')
    assert.equal(metadata.providers.codex.marketplace, 'vox-official')
    assert.equal(metadata.providers.claude.marketplace, 'vox-official')
    assert.equal(metadata.providers.gemini.repository, 'https://github.com/casatwy/vox-skill.git')
    assert.equal(metadata.providers.openclaw.registry, '@casatwy/vox')

    await access(path.join(output, 'plugins/vox/.codex-plugin/plugin.json'))
    await access(path.join(output, 'plugins/vox/.claude-plugin/plugin.json'))
    await access(path.join(output, 'skills/vox/SKILL.md'))
    const openClaw = await readFile(path.join(output, 'providers/openclaw/vox/SKILL.md'), 'utf8')
    assert.match(openClaw, /^user-invocable: true$/m)
    assert.match(openClaw, /^disable-model-invocation: true$/m)
    assert.match(openClaw, /^        - vox$/m)
    await assert.rejects(access(path.join(output, 'providers/openclaw/vox/agents')), { code: 'ENOENT' })
  }
  finally {
    await rm(output, { recursive: true, force: true })
  }
})

test('generation removes stale provider artifacts', async () => {
  const output = await mkdtemp(path.join(os.tmpdir(), 'vox-provider-stale-'))
  try {
    await mkdir(path.join(output, 'providers/stale'), { recursive: true })
    await writeFile(path.join(output, 'providers/stale/junk'), 'stale')
    await generateProviders(output)
    await assert.rejects(access(path.join(output, 'providers/stale/junk')), { code: 'ENOENT' })
  }
  finally {
    await rm(output, { recursive: true, force: true })
  }
})

test('canonical layout rejects extra entries and symlinks', async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'vox-canonical-layout-'))
  const copy = path.join(temporary, 'vox')
  try {
    await cp(canonical, copy, { recursive: true, dereference: false, preserveTimestamps: false })
    await writeFile(path.join(copy, '.DS_Store'), 'junk')
    await assert.rejects(assertCanonicalLayout(copy), /Unexpected canonical Vox entry: \.DS_Store/)
    await rm(path.join(copy, '.DS_Store'))
    await symlink('SKILL.md', path.join(copy, 'SKILL-link.md'))
    await assert.rejects(assertCanonicalLayout(copy), /Unexpected canonical Vox entry: SKILL-link\.md \(symlink\)/)
  }
  finally {
    await rm(temporary, { recursive: true, force: true })
  }
})
