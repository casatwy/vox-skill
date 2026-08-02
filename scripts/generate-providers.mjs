#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { chmod, cp, lstat, mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const canonical = path.join(root, 'vox')
const generatedDirectories = ['.agents', '.claude-plugin', 'plugins', 'providers', 'skills']
const generatedFiles = ['gemini-extension.json']
const canonicalLayout = new Map([
  ['SKILL.md', 'file'],
  ['agents', 'directory'],
  ['agents/openai.yaml', 'file'],
  ['manifest.json', 'file'],
])

const PRODUCT = Object.freeze({
  id: 'vox',
  displayName: 'Vox',
  marketplace: 'vox-official',
  repository: 'https://github.com/casatwy/vox-skill',
  repositoryGit: 'https://github.com/casatwy/vox-skill.git',
  registry: '@casatwy/vox',
  docs: 'https://vox.reka.cc/docs',
})

function json(value) {
  return `${JSON.stringify(value, null, 2)}\n`
}

function assertStableSemver(value, label) {
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(value)) {
    throw new Error(`${label} must be a stable three-part SemVer`)
  }
}

async function describeTree(directory, base = directory) {
  const entries = []
  for (const name of (await readdir(directory)).sort()) {
    const absolute = path.join(directory, name)
    const relative = path.relative(base, absolute).split(path.sep).join('/')
    const info = await lstat(absolute)
    if (info.isSymbolicLink()) entries.push({ path: relative, type: 'symlink' })
    else if (info.isDirectory()) {
      entries.push({ path: relative, type: 'directory' })
      entries.push(...await describeTree(absolute, base))
    }
    else if (info.isFile()) {
      const content = await readFile(absolute)
      entries.push({
        path: relative,
        type: 'file',
        mode: info.mode & 0o777,
        size: content.length,
        sha256: createHash('sha256').update(content).digest('hex'),
      })
    }
    else entries.push({ path: relative, type: 'special' })
  }
  return entries
}

async function hashTree(directory) {
  return createHash('sha256').update(JSON.stringify(await describeTree(directory))).digest('hex')
}

async function readManifest() {
  const manifest = JSON.parse(await readFile(path.join(canonical, 'manifest.json'), 'utf8'))
  if (Object.keys(manifest).sort().join(',') !== 'minimumCliVersion,skillVersion') {
    throw new Error('vox/manifest.json must contain only skillVersion and minimumCliVersion')
  }
  assertStableSemver(manifest.skillVersion, 'Skill version')
  assertStableSemver(manifest.minimumCliVersion, 'Minimum CLI version')
  return manifest
}

export async function assertCanonicalLayout(directory = canonical) {
  const actual = new Map((await describeTree(directory)).map(entry => [entry.path, entry.type]))
  for (const [entryPath, entryType] of actual) {
    if (canonicalLayout.get(entryPath) !== entryType) {
      throw new Error(`Unexpected canonical Vox entry: ${entryPath} (${entryType})`)
    }
  }
  for (const [entryPath, entryType] of canonicalLayout) {
    if (actual.get(entryPath) !== entryType) {
      throw new Error(`Missing canonical Vox entry: ${entryPath} (${entryType})`)
    }
  }
}

async function replaceDirectory(source, target) {
  await rm(target, { recursive: true, force: true })
  await mkdir(path.dirname(target), { recursive: true })
  await cp(source, target, { recursive: true, dereference: false, preserveTimestamps: false })
}

async function writeJson(target, value) {
  await mkdir(path.dirname(target), { recursive: true })
  await writeFile(target, json(value), { mode: 0o644 })
  await chmod(target, 0o644)
}

function openClawSkill(source) {
  const frontmatter = source.match(/^---\n([\s\S]*?)\n---\n/)
  if (!frontmatter) throw new Error('Canonical SKILL.md is missing frontmatter')
  if (/^(?:user-invocable|disable-model-invocation|metadata):/m.test(frontmatter[1])) {
    throw new Error('OpenClaw projection fields must not exist in canonical frontmatter')
  }
  const extra = [
    'user-invocable: true',
    'disable-model-invocation: true',
    'metadata:',
    '  openclaw:',
    '    requires:',
    '      bins:',
    '        - vox',
  ].join('\n')
  return source.replace(frontmatter[0], `---\n${frontmatter[1]}\n${extra}\n---\n`)
}

export async function generateProviders(outputRoot = root) {
  await assertCanonicalLayout()
  const manifest = await readManifest()
  const canonicalTreeHash = await hashTree(canonical)

  for (const directory of generatedDirectories) {
    await rm(path.join(outputRoot, directory), { recursive: true, force: true })
  }
  for (const file of generatedFiles) await rm(path.join(outputRoot, file), { force: true })

  await replaceDirectory(canonical, path.join(outputRoot, 'plugins/vox/skills/vox'))
  await replaceDirectory(canonical, path.join(outputRoot, 'skills/vox'))
  await replaceDirectory(canonical, path.join(outputRoot, 'providers/openclaw/vox'))
  await rm(path.join(outputRoot, 'providers/openclaw/vox/agents'), { recursive: true, force: true })
  await writeFile(
    path.join(outputRoot, 'providers/openclaw/vox/SKILL.md'),
    openClawSkill(await readFile(path.join(canonical, 'SKILL.md'), 'utf8')),
    { mode: 0o644 },
  )

  const plugin = {
    name: PRODUCT.id,
    version: manifest.skillVersion,
    description: 'Official Vox plugin for transcribing one explicit link or local media file through the vox CLI.',
    author: {
      name: PRODUCT.displayName,
      url: 'https://github.com/casatwy',
    },
    homepage: PRODUCT.docs,
    repository: PRODUCT.repository,
    license: 'MIT-0',
    keywords: ['vox', 'transcription', 'cli', 'audio', 'video'],
    skills: './skills/',
  }

  await writeJson(path.join(outputRoot, 'plugins/vox/.codex-plugin/plugin.json'), {
    ...plugin,
    interface: {
      displayName: PRODUCT.displayName,
      shortDescription: 'Transcribe one explicit link or local media file with Vox',
      developerName: PRODUCT.displayName,
      category: 'Productivity',
      capabilities: ['Interactive', 'Write'],
      websiteURL: PRODUCT.docs,
      defaultPrompt: [
        'Transcribe this one link with Vox.',
        'Transcribe this exact local media file with Vox.',
      ],
    },
  })
  await writeJson(path.join(outputRoot, 'plugins/vox/.claude-plugin/plugin.json'), plugin)
  await writeJson(path.join(outputRoot, '.agents/plugins/marketplace.json'), {
    name: PRODUCT.marketplace,
    interface: {
      displayName: 'Vox Official',
    },
    plugins: [{
      name: PRODUCT.id,
      source: {
        source: 'local',
        path: './plugins/vox',
      },
      policy: {
        installation: 'AVAILABLE',
        authentication: 'ON_INSTALL',
      },
      category: 'Productivity',
    }],
  })
  await writeJson(path.join(outputRoot, '.claude-plugin/marketplace.json'), {
    name: PRODUCT.marketplace,
    owner: {
      name: PRODUCT.displayName,
    },
    metadata: {
      description: 'Official Vox plugins',
    },
    plugins: [{
      name: PRODUCT.id,
      source: './plugins/vox',
      description: 'Transcribe one explicit link or local media file with the Vox CLI.',
    }],
  })
  await writeJson(path.join(outputRoot, 'gemini-extension.json'), {
    name: PRODUCT.id,
    version: manifest.skillVersion,
    description: 'Official Vox Gemini extension for transcribing one explicit link or local media file.',
  })

  await writeJson(path.join(outputRoot, 'providers/metadata.json'), {
    schema: 1,
    skill: {
      id: PRODUCT.id,
      version: manifest.skillVersion,
      minimumCliVersion: manifest.minimumCliVersion,
      canonicalTreeHash,
    },
    source: {
      repository: PRODUCT.repositoryGit,
      ref: `v${manifest.skillVersion}`,
    },
    providers: {
      codex: {
        marketplace: PRODUCT.marketplace,
        plugin: `${PRODUCT.id}@${PRODUCT.marketplace}`,
        skillPath: 'plugins/vox/skills/vox',
        install: 'vox skill install --platform codex',
        status: 'vox skill status --platform codex',
      },
      claude: {
        marketplace: PRODUCT.marketplace,
        plugin: `${PRODUCT.id}@${PRODUCT.marketplace}`,
        skillPath: 'plugins/vox/skills/vox',
        install: 'vox skill install --platform claude',
        status: 'vox skill status --platform claude',
      },
      gemini: {
        extension: PRODUCT.id,
        repository: PRODUCT.repositoryGit,
        skillPath: 'skills/vox',
        install: 'vox skill install --platform gemini',
        status: 'vox skill status --platform gemini',
      },
      openclaw: {
        registry: PRODUCT.registry,
        license: 'MIT-0',
        skillPath: 'providers/openclaw/vox',
        install: 'vox skill install --platform openclaw',
        status: 'vox skill status --platform openclaw',
        userInvocable: true,
        disableModelInvocation: true,
        requiresBins: ['vox'],
      },
    },
  })

  return { ...manifest, canonicalTreeHash }
}

async function assertFileEqual(expected, actual) {
  const [expectedBytes, actualBytes] = await Promise.all([readFile(expected), readFile(actual)])
  if (!expectedBytes.equals(actualBytes)) {
    throw new Error(`Generated file is stale: ${path.relative(root, actual)}`)
  }
}

async function assertDirectoryEqual(expected, actual) {
  const [expectedTree, actualTree] = await Promise.all([describeTree(expected), describeTree(actual)])
  if (JSON.stringify(expectedTree) !== JSON.stringify(actualTree)) {
    throw new Error(`Generated directory is stale: ${path.relative(root, actual)}`)
  }
}

export async function checkProviders() {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'vox-providers-'))
  try {
    await generateProviders(temporaryRoot)
    for (const file of generatedFiles) {
      await assertFileEqual(path.join(temporaryRoot, file), path.join(root, file))
    }
    for (const directory of generatedDirectories) {
      await stat(path.join(root, directory))
      await assertDirectoryEqual(path.join(temporaryRoot, directory), path.join(root, directory))
    }
  }
  finally {
    await rm(temporaryRoot, { recursive: true, force: true })
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2)
  if (args.length > 1 || (args.length === 1 && args[0] !== '--check')) {
    throw new Error('Usage: generate-providers.mjs [--check]')
  }
  if (args[0] === '--check') await checkProviders()
  else await generateProviders()
}
