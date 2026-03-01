import { getAllCodexProjects } from './src/services/codexSessions';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const CACHE_PATH = path.join(os.homedir(), '.codex', '.cwd-cache.json');

// Clean cache for fair first-load test
try { fs.unlinkSync(CACHE_PATH); } catch {}

// First load (cold: no cache)
const t0 = Date.now();
const projects1 = getAllCodexProjects();
const t1 = Date.now();
const totalSessions1 = projects1.reduce((s, p) => s + p.sessions.length, 0);
console.log(`First load (cold):  ${t1 - t0}ms | ${projects1.length} projects, ${totalSessions1} sessions`);

// Check cache was created
try {
  const cacheSize = fs.statSync(CACHE_PATH).size;
  console.log(`Cache file created: ${(cacheSize / 1024).toFixed(0)}KB`);
} catch {
  console.log('Cache file NOT created');
}

// Second load (warm: in-memory project cache)
const t2 = Date.now();
const projects2 = getAllCodexProjects();
const t3 = Date.now();
console.log(`Second load (mem):  ${t3 - t2}ms | ${projects2.length} projects`);

// Measure disk cache read time
const t4 = Date.now();
const diskCache = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf-8'));
const cacheEntries = Object.keys(diskCache).length;
const t5 = Date.now();
console.log(`Cache read (disk):  ${t5 - t4}ms | ${cacheEntries} entries`);

console.log('\n=== Comparison ===');
console.log(`Before optimization: ~16,000ms`);
console.log(`After (cold, no cache): ${t1 - t0}ms`);
console.log(`After (warm, in-memory): ${t3 - t2}ms`);
console.log(`After (warm, disk cache): ~${229 + (t5 - t4)}ms estimated`);
