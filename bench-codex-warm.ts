// Simulates app restart: disk cache exists, in-memory cache does not
import { getAllCodexProjects } from './src/services/codexSessions';

// Disk cache already exists from previous run — this is the "warm restart" scenario
const t0 = Date.now();
const projects = getAllCodexProjects();
const t1 = Date.now();
const totalSessions = projects.reduce((s, p) => s + p.sessions.length, 0);
console.log(`Warm restart load: ${t1 - t0}ms | ${projects.length} projects, ${totalSessions} sessions`);

// Second call (in-memory hit)
const t2 = Date.now();
getAllCodexProjects();
const t3 = Date.now();
console.log(`In-memory hit:     ${t3 - t2}ms`);
