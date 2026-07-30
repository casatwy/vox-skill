#!/usr/bin/env node

import { access, readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { parse as parseYaml } from 'yaml'
import { assertStableSemver, hashTree, validateReleaseNotes } from './release-core.mjs'
import { checkProviders } from './generate-providers.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(root, relativePath), 'utf8'))
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

async function validateSkillFrontmatter(relativePath) {
  const content = await readFile(path.join(root, relativePath), 'utf8')
  const match = content.match(/^---\n([\s\S]*?)\n---\n/)
  assert(match, `${relativePath} must start with YAML frontmatter`)
  const frontmatter = parseYaml(match[1])
  assert(frontmatter && typeof frontmatter === 'object', `${relativePath} frontmatter must be an object`)
  assert(Object.keys(frontmatter).sort().join(',') === 'description,name', `${relativePath} frontmatter may contain only name and description`)
  assert(frontmatter.name === 'vox', `${relativePath} frontmatter name must be vox`)
  assert(typeof frontmatter.description === 'string' && frontmatter.description.length > 40, `${relativePath} description is invalid`)
  assert(!/^\s*version:/m.test(match[1]), `${relativePath} frontmatter must not contain version`)
}

async function validateYaml(relativePath) {
  const value = parseYaml(await readFile(path.join(root, relativePath), 'utf8'))
  assert(value && typeof value === 'object', `${relativePath} must contain YAML metadata`)
  return value
}

function assertVersion(value, expected, label) {
  assertStableSemver(value, label)
  assert(value === expected, `${label} ${value} does not match canonical ${expected}`)
}

async function validatePluginSkill(relativePath, canonicalHash) {
  assert(await hashTree(path.join(root, relativePath)) === canonicalHash, `${relativePath} does not match canonical vox tree`)
}

export async function validateArtifacts() {
  await checkProviders()
  validateReleaseNotes(await readFile(path.join(root, 'release/next.md')))
  const canonical = await readJson('vox/manifest.json')
  const version = canonical.skillVersion
  assertVersion(version, version, 'canonical Skill version')
  assertStableSemver(canonical.minimumCliVersion, 'minimum CLI version')
  assert(canonical.minimumCliVersion === '0.1.0', 'Skill minimum CLI version must be 0.1.0')

  await validateSkillFrontmatter('vox/SKILL.md')
  const canonicalSkill = await readFile(path.join(root, 'vox/SKILL.md'), 'utf8')
  assert(!/--language zh\b/.test(canonicalSkill), 'canonical Skill must not hardcode --language zh')
  assert(/automatic language detection/.test(canonicalSkill), 'canonical Skill must explain automatic language detection')
  assert(/Authorization boundary/i.test(canonicalSkill), 'canonical Skill must define an explicit authorization boundary')
  assert(/vox transcribe/.test(canonicalSkill), 'canonical Skill must use the explicit vox transcribe command')
  assert(!/vox auth login\s+--api-key/.test(canonicalSkill), 'canonical Skill must keep interactive API keys out of argv')
  assert(!/install -m 600 \/dev\/null/.test(canonicalSkill), 'canonical Skill must not pre-create a no-clobber CLI output')
  assert(/raw output path that does not yet exist/.test(canonicalSkill), 'canonical Skill must reserve an absent raw output path')
  assert(/VOX_API_KEY/.test(canonicalSkill), 'canonical Skill must document the automation-only VOX_API_KEY')
  assert(canonicalSkill.includes('~/.config/vox'), 'canonical Skill must document isolated Vox configuration')
  const [openaiAgent, claudeAgent] = await Promise.all([
    validateYaml('vox/agents/openai.yaml'),
    validateYaml('vox/agents/claude.yaml'),
    validateYaml('vox/agents/gemini.yaml'),
  ])
  assert(openaiAgent.policy?.allow_implicit_invocation === false, 'OpenAI implicit invocation must be disabled')
  assert(claudeAgent.claude_code?.invocation?.implicit === false, 'Claude implicit invocation must be disabled')
  assert(claudeAgent.policy?.allow_implicit_invocation === false, 'Claude implicit invocation policy must be disabled')

  const [codex, claude, gemini, metadata, codexMarketplace, claudeMarketplace] = await Promise.all([
    readJson('plugins/vox/.codex-plugin/plugin.json'),
    readJson('plugins/vox/.claude-plugin/plugin.json'),
    readJson('gemini-extension.json'),
    readJson('providers/metadata.json'),
    readJson('.agents/plugins/marketplace.json'),
    readJson('.claude-plugin/marketplace.json'),
  ])

  assertVersion(codex.version, version, 'Codex plugin version')
  assertVersion(claude.version, version, 'Claude plugin version')
  assertVersion(gemini.version, version, 'Gemini extension version')
  assertVersion(metadata.skillVersion, version, 'provider metadata version')
  assert(metadata.minimumCliVersion === canonical.minimumCliVersion, 'provider minimum CLI version mismatch')

  assert(codex.name === 'vox' && claude.name === 'vox' && gemini.name === 'vox', 'provider name mismatch')
  assert(codex.skills === './skills/' && claude.skills === './skills/', 'plugin skill paths must remain self-contained')
  assert(codex.license === 'UNLICENSED' && claude.license === 'UNLICENSED', 'non-ClawHub provider license changed')
  assert(codex.repository === 'https://github.com/casatwy/vox-skill', 'Codex repository mismatch')
  assert(claude.repository === 'https://github.com/casatwy/vox-skill', 'Claude repository mismatch')

  assert(codexMarketplace.name === 'vox-official', 'Codex marketplace must be vox-official')
  assert(codexMarketplace.plugins?.length === 1, 'Codex marketplace must contain exactly one plugin')
  const codexEntry = codexMarketplace.plugins[0]
  assert(codexEntry.name === 'vox', 'Codex plugin must be vox')
  assert(codexEntry.source?.source === 'local' && codexEntry.source?.path === './plugins/vox', 'Codex plugin source mismatch')
  assert(codexEntry.policy?.installation === 'AVAILABLE', 'Codex install policy mismatch')
  assert(codexEntry.policy?.authentication === 'ON_INSTALL', 'Codex auth policy mismatch')
  assert(typeof codexEntry.category === 'string' && codexEntry.category.length > 0, 'Codex category is required')

  assert(claudeMarketplace.name === 'vox-official', 'Claude marketplace must be vox-official')
  assert(claudeMarketplace.plugins?.length === 1, 'Claude marketplace must contain exactly one plugin')
  assert(claudeMarketplace.plugins[0].name === 'vox', 'Claude plugin must be vox')
  assert(claudeMarketplace.plugins[0].source === './plugins/vox', 'Claude plugin source mismatch')

  const canonicalHash = await hashTree(path.join(root, 'vox'))
  assert(metadata.canonicalTreeHash === canonicalHash, 'canonical tree hash metadata is stale')
  assert(metadata.source?.repository === 'https://github.com/casatwy/vox-skill.git', 'provider source repository mismatch')
  assert(metadata.source?.ref === `v${version}`, 'provider source ref mismatch')
  assert(metadata.providers?.codex?.marketplace === 'vox-official', 'Codex metadata marketplace mismatch')
  assert(metadata.providers?.codex?.plugin === 'vox@vox-official', 'Codex metadata plugin mismatch')
  assert(metadata.providers?.claude?.plugin === 'vox@vox-official', 'Claude metadata plugin mismatch')
  assert(metadata.providers?.openclaw?.registry === '@casatwy/vox', 'OpenClaw registry mismatch')
  assert(metadata.providers?.openclaw?.license === 'MIT-0', 'OpenClaw/ClawHub license must be MIT-0')
  assert(metadata.providers?.openclaw?.artifactProjection === 'openclaw-v2', 'OpenClaw projection metadata mismatch')
  assert(metadata.providers?.openclaw?.projectionSince === '0.1.0', 'OpenClaw projection version mismatch')
  assert(JSON.stringify(metadata.providers?.openclaw?.excludedPaths) === JSON.stringify(['agents/**', 'scripts/openclaw-auto-update.mjs']), 'OpenClaw excluded paths mismatch')
  assert(metadata.providers?.openclaw?.userInvocable === true, 'OpenClaw must be user-invocable')
  assert(metadata.providers?.openclaw?.disableModelInvocation === true, 'OpenClaw model invocation must be disabled')
  assert(JSON.stringify(metadata.providers?.openclaw?.requiresBins) === JSON.stringify(['vox', 'openclaw']), 'OpenClaw required binaries mismatch')
  assert(metadata.providers?.openclaw?.updateTransport === 'npm-cli', 'OpenClaw update transport must be npm-cli')
  await validatePluginSkill('plugins/vox/skills/vox', canonicalHash)
  await validatePluginSkill('skills/vox', canonicalHash)

  await Promise.all([
    access(path.join(root, 'vox/scripts/publish-cleaned.mjs')),
    access(path.join(root, 'release/next.md')),
    access(path.join(root, 'vox/scripts/openclaw-auto-update.mjs')).then(
      () => { throw new Error('canonical Skill must not contain the legacy OpenClaw updater') },
      error => {
        if (error?.code !== 'ENOENT') throw error
      },
    ),
  ])
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await validateArtifacts()
  process.stdout.write('Vox Skill artifacts are valid and in parity.\n')
}
