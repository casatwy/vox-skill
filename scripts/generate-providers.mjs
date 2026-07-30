#!/usr/bin/env node

import { chmod, cp, mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { assertStableSemver, describeTree, hashTree } from './release-core.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const canonicalDirectory = path.join(root, 'vox')
const GENERATED_DIRECTORIES = ['.agents', '.claude-plugin', 'plugins', 'providers', 'skills']
const CANONICAL_LAYOUT = new Map([
  ['SKILL.md', 'file'],
  ['agents', 'directory'],
  ['agents/claude.yaml', 'file'],
  ['agents/gemini.yaml', 'file'],
  ['agents/openai.yaml', 'file'],
  ['manifest.json', 'file'],
  ['scripts', 'directory'],
  ['scripts/publish-cleaned.mjs', 'file'],
])

function json(value) {
  return `${JSON.stringify(value, null, 2)}\n`
}

async function readManifest(sourceDirectory) {
  const manifest = JSON.parse(await readFile(path.join(sourceDirectory, 'manifest.json'), 'utf8'))
  assertStableSemver(manifest.skillVersion, 'canonical skill version')
  assertStableSemver(manifest.minimumCliVersion, 'minimum CLI version')
  if (Object.keys(manifest).sort().join(',') !== 'minimumCliVersion,skillVersion') {
    throw new Error('vox/manifest.json must contain only skillVersion and minimumCliVersion')
  }
  return manifest
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

export async function assertCanonicalLayout(sourceDirectory = canonicalDirectory) {
  const entries = await describeTree(sourceDirectory)
  const actual = new Map(entries.map(entry => [entry.path, entry.type]))
  for (const entry of entries) {
    const expectedType = CANONICAL_LAYOUT.get(entry.path)
    if (!expectedType || expectedType !== entry.type) {
      throw new Error(`Unexpected canonical Vox entry: ${entry.path} (${entry.type})`)
    }
  }
  for (const [expectedPath, expectedType] of CANONICAL_LAYOUT) {
    if (actual.get(expectedPath) !== expectedType) {
      throw new Error(`Missing canonical Vox entry: ${expectedPath} (${expectedType})`)
    }
  }
}

export async function generateProviders(outputRoot = root, sourceDirectory = canonicalDirectory) {
  await assertCanonicalLayout(sourceDirectory)
  const manifest = await readManifest(sourceDirectory)
  const version = manifest.skillVersion
  const canonicalTreeHash = await hashTree(sourceDirectory)
  const openClawProjection = {
    artifactProjection: 'openclaw-v2',
    projectionSince: '0.1.0',
    excludedPaths: ['agents/**', 'scripts/openclaw-auto-update.mjs'],
    userInvocable: true,
    disableModelInvocation: true,
    requiresBins: ['vox', 'openclaw'],
    updateTransport: 'npm-cli',
  }

  for (const directory of GENERATED_DIRECTORIES) {
    await rm(path.join(outputRoot, directory), { recursive: true, force: true })
  }
  await rm(path.join(outputRoot, 'gemini-extension.json'), { force: true })

  await replaceDirectory(sourceDirectory, path.join(outputRoot, 'plugins/vox/skills/vox'))
  await replaceDirectory(sourceDirectory, path.join(outputRoot, 'skills/vox'))

  await writeJson(path.join(outputRoot, 'plugins/vox/.codex-plugin/plugin.json'), {
    name: 'vox',
    version,
    description: 'Official Vox plugin for reliable link and local-media transcription through the vox CLI.',
    author: {
      name: 'Vox',
      url: 'https://github.com/casatwy',
    },
    homepage: 'https://vox.reka.cc/docs',
    repository: 'https://github.com/casatwy/vox-skill',
    license: 'UNLICENSED',
    keywords: ['vox', 'transcription', 'cli', 'audio', 'video'],
    skills: './skills/',
    interface: {
      displayName: 'Vox',
      shortDescription: 'Transcribe links and local media with Vox',
      longDescription: 'Use the Vox CLI for authenticated link or local-media transcription, reliable progress, cleaned text, and exact raw or subtitle output.',
      developerName: 'Vox',
      category: 'Productivity',
      capabilities: ['Interactive', 'Write'],
      websiteURL: 'https://vox.reka.cc/docs',
      defaultPrompt: [
        'Transcribe this link with Vox and save cleaned text.',
        'Transcribe this local media file with Vox.',
      ],
    },
  })

  await writeJson(path.join(outputRoot, 'plugins/vox/.claude-plugin/plugin.json'), {
    name: 'vox',
    version,
    description: 'Official Vox Claude plugin for reliable link and local-media transcription through the vox CLI.',
    author: {
      name: 'Vox',
      url: 'https://github.com/casatwy',
    },
    homepage: 'https://vox.reka.cc/docs',
    repository: 'https://github.com/casatwy/vox-skill',
    license: 'UNLICENSED',
    keywords: ['vox', 'transcription', 'cli', 'audio', 'video'],
    skills: './skills/',
  })

  await writeJson(path.join(outputRoot, '.agents/plugins/marketplace.json'), {
    name: 'vox-official',
    interface: {
      displayName: 'Vox Official',
    },
    plugins: [{
      name: 'vox',
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
    name: 'vox-official',
    owner: {
      name: 'Vox',
    },
    metadata: {
      description: 'Official Vox plugins',
    },
    plugins: [{
      name: 'vox',
      source: './plugins/vox',
      description: 'Transcribe links and local media with the Vox CLI.',
    }],
  })

  await writeJson(path.join(outputRoot, 'gemini-extension.json'), {
    name: 'vox',
    version,
    description: 'Official Vox Gemini extension for reliable link and local-media transcription through the vox CLI.',
  })

  await writeJson(path.join(outputRoot, 'providers/metadata.json'), {
    schema: 1,
    skillVersion: version,
    minimumCliVersion: manifest.minimumCliVersion,
    canonicalTreeHash,
    source: {
      repository: 'https://github.com/casatwy/vox-skill.git',
      ref: `v${version}`,
    },
    providers: {
      codex: {
        marketplace: 'vox-official',
        plugin: 'vox@vox-official',
        skillPath: 'plugins/vox/skills/vox',
      },
      claude: {
        marketplace: 'vox-official',
        plugin: 'vox@vox-official',
        skillPath: 'plugins/vox/skills/vox',
      },
      gemini: {
        extension: 'vox',
        skillPath: 'skills/vox',
      },
      openclaw: {
        registry: '@casatwy/vox',
        license: 'MIT-0',
        skillPath: 'vox',
        ...openClawProjection,
      },
    },
  })

  return { ...manifest, canonicalTreeHash }
}

async function assertFileEqual(expected, actual) {
  const [expectedBytes, actualBytes] = await Promise.all([readFile(expected), readFile(actual)])
  if (!expectedBytes.equals(actualBytes)) throw new Error(`Generated file is stale: ${path.relative(root, actual)}`)
}

async function assertDirectoryEqual(expected, actual) {
  const [expectedEntries, actualEntries] = await Promise.all([describeTree(expected), describeTree(actual)])
  if (JSON.stringify(expectedEntries) !== JSON.stringify(actualEntries)) {
    throw new Error(`Generated directory is stale: ${path.relative(root, actual)}`)
  }
}

export async function checkProviders() {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'vox-providers-'))
  try {
    await generateProviders(temporaryRoot)
    const files = ['gemini-extension.json']
    const directories = GENERATED_DIRECTORIES
    for (const file of files) await assertFileEqual(path.join(temporaryRoot, file), path.join(root, file))
    for (const directory of directories) {
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
