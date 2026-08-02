#!/usr/bin/env node

import { appendFile } from 'node:fs/promises'
import process from 'node:process'

const args = process.argv.slice(2)
const invocationLog = process.env.VOX_MOCK_INVOCATION_LOG

if (invocationLog) {
  await appendFile(invocationLog, `${JSON.stringify(args)}\n`, { mode: 0o600 })
}

if (args.length === 1 && args[0] === '--version') {
  process.stdout.write('0.1.0\n')
  process.exit(0)
}

if (args.length === 1 && args[0] === '--help') {
  process.stdout.write('Usage: vox <auth|transcribe|skill>\n')
  process.exit(0)
}

if (args[0] === 'auth' && args[1] === 'status') {
  process.stdout.write('Authenticated with VOX_API_KEY\n')
  process.exit(0)
}

if (args[0] === 'transcribe') {
  process.stderr.write('Transcription completed\n')
  process.stdout.write('Mock transcript: a precise single input was accepted.\n')
  process.exit(0)
}

process.stderr.write(`Unsupported mock command: ${args.join(' ')}\n`)
process.exit(2)
