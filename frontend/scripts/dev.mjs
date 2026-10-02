// `npm run dev` starts the backend and the frontend together. Ctrl+C stops both.
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.dirname(fileURLToPath(import.meta.url))
const serverDir = path.resolve(root, '../../server')

const procs = [
  spawn('npm', ['run', 'dev'], { stdio: 'inherit', cwd: serverDir }),
  spawn('npx', ['vite'], { stdio: 'inherit', cwd: path.resolve(root, '..') }),
]

let stopping = false
function stop(code = 0) {
  if (stopping) return
  stopping = true
  procs.forEach((p) => p.kill('SIGTERM'))
  setTimeout(() => process.exit(code), 500)
}
procs.forEach((p) => p.on('exit', (code) => stop(code ?? 0)))
process.on('SIGINT', () => stop())
process.on('SIGTERM', () => stop())
