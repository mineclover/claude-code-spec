import type { SkillProvider } from '../../types/tool-maintenance';
import type {
  ExecutionAdapter,
  MaintenanceServiceAdapter,
  McpAdapter,
  SkillStoreAdapter,
  ToolAdapter,
} from './serviceIntegrations';

export const CORE_COMPATIBILITY_SCENARIOS = [
  {
    id: 'version-check',
    title: 'Version check',
    description: 'Managed CLI must expose a version command for regression checks.',
  },
  {
    id: 'update',
    title: 'Update',
    description: 'Managed CLI must expose an update command for release workflows.',
  },
  {
    id: 'mcp-launch',
    title: 'MCP launch',
    description: 'Execution + MCP contracts must be compatible for MCP launch.',
  },
  {
    id: 'skill-scan',
    title: 'Skill scan',
    description: 'Skill store contract must support fixture-based provider scans.',
  },
] as const;

export type CompatibilityScenarioId = (typeof CORE_COMPATIBILITY_SCENARIOS)[number]['id'];
export type CompatibilityScenarioStatus = 'pass' | 'fail' | 'skip';

export interface CompatibilityImpactScope {
  adapters: string[];
  tools: string[];
  providers: SkillProvider[];
}

export interface CompatibilityScenarioEvaluation {
  scenarioId: CompatibilityScenarioId;
  status: CompatibilityScenarioStatus;
  reason: string;
  impactScope: CompatibilityImpactScope;
}

export interface CompatibilityMatrixRow {
  adapterId: string;
  displayName: string;
  toolIds: string[];
  providerIds: SkillProvider[];
  scenarios: Record<CompatibilityScenarioId, CompatibilityScenarioEvaluation>;
}

export interface CompatibilityScenarioFailure {
  adapterId: string;
  displayName: string;
  scenarioId: CompatibilityScenarioId;
  reason: string;
  impactScope: CompatibilityImpactScope;
}

export interface CompatibilityTestReportSummary {
  totalAdapters: number;
  totalScenarioChecks: number;
  passed: number;
  failed: number;
  skipped: number;
  failedScenarios: CompatibilityScenarioId[];
  impactedAdapters: string[];
  impactedTools: string[];
  impactedProviders: SkillProvider[];
}

export interface CompatibilityTestReport {
  generatedAt: number;
  scenarioIds: CompatibilityScenarioId[];
  rows: CompatibilityMatrixRow[];
  failures: CompatibilityScenarioFailure[];
  summary: CompatibilityTestReportSummary;
}

function toSortedUnique(values: readonly string[]): string[] {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function listManagedTools(adapter: MaintenanceServiceAdapter): ToolAdapter[] {
  return adapter.capability.maintenance.enabled ? (adapter.getManagedTools?.() ?? []) : [];
}

function readExecution(adapter: MaintenanceServiceAdapter): ExecutionAdapter | null {
  return adapter.capability.execution.enabled ? (adapter.getExecution?.() ?? null) : null;
}

function readMcp(adapter: MaintenanceServiceAdapter): McpAdapter | null {
  return adapter.capability.mcp.enabled ? (adapter.getMcp?.() ?? null) : null;
}

function readSkillStore(adapter: MaintenanceServiceAdapter): SkillStoreAdapter | null {
  return adapter.capability.skills.enabled ? (adapter.getSkillStore?.() ?? null) : null;
}

function createImpactScope({
  adapterId,
  toolIds,
  providerIds,
}: {
  adapterId: string;
  toolIds: string[];
  providerIds: SkillProvider[];
}): CompatibilityImpactScope {
  return {
    adapters: [adapterId],
    tools: toSortedUnique(toolIds),
    providers: toSortedUnique(providerIds) as SkillProvider[],
  };
}

function createScenarioEvaluation(
  scenarioId: CompatibilityScenarioId,
  status: CompatibilityScenarioStatus,
  reason: string,
  impactScope: CompatibilityImpactScope,
): CompatibilityScenarioEvaluation {
  return {
    scenarioId,
    status,
    reason,
    impactScope,
  };
}

function evaluateVersionCheckScenario({
  adapter,
  toolIds,
  baseImpact,
}: {
  adapter: MaintenanceServiceAdapter;
  toolIds: string[];
  baseImpact: CompatibilityImpactScope;
}): CompatibilityScenarioEvaluation {
  if (!adapter.capability.maintenance.enabled) {
    return createScenarioEvaluation(
      'version-check',
      'skip',
      'maintenance capability disabled',
      baseImpact,
    );
  }

  if (toolIds.length === 0) {
    return createScenarioEvaluation(
      'version-check',
      'fail',
      'maintenance enabled but no managed tools are registered',
      baseImpact,
    );
  }

  return createScenarioEvaluation(
    'version-check',
    'pass',
    'managed tools provide version checks',
    baseImpact,
  );
}

function evaluateUpdateScenario({
  adapter,
  toolIds,
  baseImpact,
}: {
  adapter: MaintenanceServiceAdapter;
  toolIds: string[];
  baseImpact: CompatibilityImpactScope;
}): CompatibilityScenarioEvaluation {
  if (!adapter.capability.maintenance.enabled) {
    return createScenarioEvaluation(
      'update',
      'skip',
      'maintenance capability disabled',
      baseImpact,
    );
  }

  if (toolIds.length === 0) {
    return createScenarioEvaluation(
      'update',
      'fail',
      'maintenance enabled but no managed tools are registered',
      baseImpact,
    );
  }

  return createScenarioEvaluation(
    'update',
    'pass',
    'managed tools provide update commands',
    baseImpact,
  );
}

function evaluateMcpLaunchScenario({
  adapter,
  toolIds,
  execution,
  mcp,
  providerIds,
}: {
  adapter: MaintenanceServiceAdapter;
  toolIds: string[];
  execution: ExecutionAdapter | null;
  mcp: McpAdapter | null;
  providerIds: SkillProvider[];
}): CompatibilityScenarioEvaluation {
  const executionToolId = asNonEmptyString(execution?.toolId) ?? null;
  const impact = createImpactScope({
    adapterId: adapter.id,
    toolIds: toSortedUnique([...toolIds, ...(executionToolId ? [executionToolId] : [])]),
    providerIds,
  });

  if (!adapter.capability.mcp.enabled) {
    return createScenarioEvaluation('mcp-launch', 'skip', 'mcp capability disabled', impact);
  }

  if (!adapter.capability.execution.enabled) {
    return createScenarioEvaluation(
      'mcp-launch',
      'fail',
      'mcp capability enabled but execution capability is disabled',
      impact,
    );
  }

  if (!executionToolId) {
    return createScenarioEvaluation(
      'mcp-launch',
      'fail',
      'mcp launch requires execution.toolId contract',
      impact,
    );
  }

  if (!mcp) {
    return createScenarioEvaluation(
      'mcp-launch',
      'fail',
      'mcp capability enabled but mcp adapter contract is missing',
      impact,
    );
  }

  if (mcp.defaultTargets.length === 0) {
    return createScenarioEvaluation(
      'mcp-launch',
      'fail',
      'mcp contract requires at least one default target',
      impact,
    );
  }

  if (toolIds.length > 0 && !toolIds.includes(executionToolId)) {
    return createScenarioEvaluation(
      'mcp-launch',
      'fail',
      'execution.toolId must reference one of the managed tools',
      impact,
    );
  }

  return createScenarioEvaluation(
    'mcp-launch',
    'pass',
    `execution tool "${executionToolId}" supports MCP launch`,
    impact,
  );
}

function evaluateSkillScanScenario({
  adapter,
  skillStore,
  baseImpact,
}: {
  adapter: MaintenanceServiceAdapter;
  skillStore: SkillStoreAdapter | null;
  baseImpact: CompatibilityImpactScope;
}): CompatibilityScenarioEvaluation {
  if (!adapter.capability.skills.enabled) {
    return createScenarioEvaluation('skill-scan', 'skip', 'skills capability disabled', baseImpact);
  }

  if (!skillStore) {
    return createScenarioEvaluation(
      'skill-scan',
      'fail',
      'skills capability enabled but skillStore contract is missing',
      baseImpact,
    );
  }

  if (!asNonEmptyString(skillStore.provider)) {
    return createScenarioEvaluation(
      'skill-scan',
      'fail',
      'skillStore.provider must be a non-empty string',
      baseImpact,
    );
  }

  if (!asNonEmptyString(skillStore.installRoot)) {
    return createScenarioEvaluation(
      'skill-scan',
      'fail',
      'skillStore.installRoot must be a non-empty string',
      baseImpact,
    );
  }

  if (!asNonEmptyString(skillStore.disabledRoot)) {
    return createScenarioEvaluation(
      'skill-scan',
      'fail',
      'skillStore.disabledRoot must be a non-empty string',
      baseImpact,
    );
  }

  return createScenarioEvaluation(
    'skill-scan',
    'pass',
    `skill store provider "${skillStore.provider}" supports scan roots`,
    baseImpact,
  );
}

export function buildCompatibilityMatrix(
  adapters: MaintenanceServiceAdapter[],
): CompatibilityMatrixRow[] {
  return adapters
    .map((adapter) => {
      const managedTools = listManagedTools(adapter);
      const toolIds = toSortedUnique(managedTools.map((tool) => tool.id));
      const skillStore = readSkillStore(adapter);
      const providerIds = toSortedUnique(
        skillStore ? [skillStore.provider] : adapter.capability.skills.enabled ? [adapter.id] : [],
      ) as SkillProvider[];
      const baseImpact = createImpactScope({
        adapterId: adapter.id,
        toolIds,
        providerIds,
      });
      const execution = readExecution(adapter);
      const mcp = readMcp(adapter);

      return {
        adapterId: adapter.id,
        displayName: adapter.displayName,
        toolIds,
        providerIds,
        scenarios: {
          'version-check': evaluateVersionCheckScenario({
            adapter,
            toolIds,
            baseImpact,
          }),
          update: evaluateUpdateScenario({
            adapter,
            toolIds,
            baseImpact,
          }),
          'mcp-launch': evaluateMcpLaunchScenario({
            adapter,
            toolIds,
            execution,
            mcp,
            providerIds,
          }),
          'skill-scan': evaluateSkillScanScenario({
            adapter,
            skillStore,
            baseImpact,
          }),
        },
      } satisfies CompatibilityMatrixRow;
    })
    .sort((a, b) => a.adapterId.localeCompare(b.adapterId));
}

function formatList(values: readonly string[]): string {
  return values.length > 0 ? values.join(', ') : 'none';
}

export function createCompatibilityTestReport(
  adapters: MaintenanceServiceAdapter[],
): CompatibilityTestReport {
  const rows = buildCompatibilityMatrix(adapters);
  const scenarioIds = CORE_COMPATIBILITY_SCENARIOS.map((scenario) => scenario.id);

  const failures: CompatibilityScenarioFailure[] = [];
  let passed = 0;
  let failed = 0;
  let skipped = 0;

  for (const row of rows) {
    for (const scenarioId of scenarioIds) {
      const evaluation = row.scenarios[scenarioId];
      switch (evaluation.status) {
        case 'pass':
          passed += 1;
          break;
        case 'fail':
          failed += 1;
          failures.push({
            adapterId: row.adapterId,
            displayName: row.displayName,
            scenarioId,
            reason: evaluation.reason,
            impactScope: evaluation.impactScope,
          });
          break;
        default:
          skipped += 1;
          break;
      }
    }
  }

  const failedScenarios = scenarioIds.filter((scenarioId) =>
    failures.some((failure) => failure.scenarioId === scenarioId),
  );
  const impactedAdapters = toSortedUnique(
    failures.flatMap((failure) => failure.impactScope.adapters),
  );
  const impactedTools = toSortedUnique(failures.flatMap((failure) => failure.impactScope.tools));
  const impactedProviders = toSortedUnique(
    failures.flatMap((failure) => failure.impactScope.providers),
  ) as SkillProvider[];

  return {
    generatedAt: Date.now(),
    scenarioIds,
    rows,
    failures,
    summary: {
      totalAdapters: rows.length,
      totalScenarioChecks: rows.length * scenarioIds.length,
      passed,
      failed,
      skipped,
      failedScenarios,
      impactedAdapters,
      impactedTools,
      impactedProviders,
    },
  };
}

export function formatCompatibilityTestReport(report: CompatibilityTestReport): string {
  const lines = [
    'Compatibility Test Report',
    `Generated at: ${new Date(report.generatedAt).toISOString()}`,
    `Total adapters: ${report.summary.totalAdapters}`,
    `Scenario checks: ${report.summary.totalScenarioChecks}`,
    `Result counts: pass=${report.summary.passed}, fail=${report.summary.failed}, skip=${report.summary.skipped}`,
    `Failed scenarios: ${formatList(report.summary.failedScenarios)}`,
    `Impact scope adapters: ${formatList(report.summary.impactedAdapters)}`,
    `Impact scope tools: ${formatList(report.summary.impactedTools)}`,
    `Impact scope providers: ${formatList(report.summary.impactedProviders)}`,
  ];

  if (report.failures.length === 0) {
    lines.push('Failure details: none');
    return lines.join('\n');
  }

  lines.push('Failure details:');
  for (const failure of report.failures) {
    lines.push(
      `- [${failure.adapterId}] ${failure.scenarioId}: ${failure.reason} ` +
        `(impact adapters=${formatList(failure.impactScope.adapters)}; ` +
        `tools=${formatList(failure.impactScope.tools)}; ` +
        `providers=${formatList(failure.impactScope.providers)})`,
    );
  }

  return lines.join('\n');
}
