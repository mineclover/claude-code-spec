/**
 * Extracts the observed prefix fingerprint from a SystemInitEvent.
 *
 * The observed tier captures what the CLI actually reports loading. Comparing
 * its sub-hashes to the static tier (see FingerprintService) surfaces
 * component-level drift: e.g. an MCP server declared in the config but
 * reported `failed` in system/init shows up as a mismatch on `mcpServers`.
 */

import type {
  FingerprintDrift,
  ObservedFingerprint,
  StaticFingerprint,
} from '../types/prefix-fingerprint';
import type { SystemInitEvent } from '../types/stream-events';
import { sha256Hex, sha256OfCanonicalJson, sha256OfSortedList } from './prefixHashing';

export function extractObservedFingerprint(event: SystemInitEvent): ObservedFingerprint {
  const tools = [...event.tools].sort();
  const slashCommands = [...event.slash_commands].sort();
  const agents = [...event.agents].sort();
  // MCP server objects canonicalized so both name and status contribute.
  const mcpServersSorted = [...event.mcp_servers].sort((a, b) =>
    a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
  );

  const components = {
    tools: sha256OfSortedList(tools),
    mcpServers: sha256OfCanonicalJson(mcpServersSorted),
    agents: sha256OfSortedList(agents),
    slashCommands: sha256OfSortedList(slashCommands),
    model: sha256Hex(event.model),
    permissionMode: sha256Hex(event.permissionMode),
    outputStyle: sha256Hex(event.output_style),
  };

  return {
    kind: 'observed',
    total: sha256OfCanonicalJson(components),
    components,
    details: {
      tools,
      mcpServers: mcpServersSorted,
      agents,
      slashCommands,
      model: event.model,
      permissionMode: event.permissionMode,
      outputStyle: event.output_style,
    },
    sessionId: event.session_id,
    observedAt: Date.now(),
  };
}

/**
 * Best-effort drift detection between static and observed fingerprints.
 *
 * Only components that have a natural correspondence are compared:
 *   static.mcpResolved  <->  observed.mcpServers
 *   static.agents       <->  observed.agents
 *
 * Other static components (claudeMd, imports, skills, systemPromptVersion) do
 * not appear in system/init and therefore cannot be cross-checked here. They
 * are still recorded in the static fingerprint for trend and drift tracking
 * against the same component in a prior execution.
 */
export function detectDrift(
  staticFp: StaticFingerprint,
  observed: ObservedFingerprint,
): FingerprintDrift {
  const differing: FingerprintDrift['differingComponents'] = [];

  // Note: staticFp.components.mcpResolved is the hash of the CLI MCP config
  // file, while observed.components.mcpServers is the hash of the server
  // {name,status} list reported at runtime. They are different object shapes,
  // so we compare presence-vs-absence only: empty vs non-empty.
  const staticHasMcp = staticFp.components.mcpResolved !== '';
  const observedHasMcp = observed.components.mcpServers !== sha256OfCanonicalJson([]);
  if (staticHasMcp !== observedHasMcp) {
    differing.push('mcpResolved');
  }

  // Agents: if the static hash is empty (no files) but observed reports
  // agents, or vice versa, treat as drift. Hash equality check is meaningless
  // here because the two sides hash different shapes (file contents vs names).
  const staticHasAgents = staticFp.components.agents !== '';
  const observedHasAgents = observed.details.agents.length > 0;
  if (staticHasAgents !== observedHasAgents) {
    differing.push('agents');
  }

  return {
    detected: differing.length > 0,
    differingComponents: differing,
    note:
      differing.length > 0
        ? 'Presence/absence mismatch; deeper semantic drift detection pending.'
        : undefined,
  };
}
