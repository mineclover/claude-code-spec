import { readdirSync, readFileSync } from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CORE_COMPATIBILITY_SCENARIOS,
  type CompatibilityScenarioId,
  type CompatibilityScenarioStatus,
  createCompatibilityTestReport,
  formatCompatibilityTestReport,
} from './compatibilityMatrix';
import {
  createCustomMaintenanceAdapters,
  createDefaultMaintenanceAdapters,
} from './serviceIntegrations';

const scenarioIds = CORE_COMPATIBILITY_SCENARIOS.map((scenario) => scenario.id);

interface FixtureSummaryExpectation {
  failed?: number;
  failedScenarios?: CompatibilityScenarioId[];
  impactedAdapters?: string[];
  impactedTools?: string[];
  impactedProviders?: string[];
}

interface FixtureExpectations {
  adapterId: string;
  scenarios: Partial<Record<CompatibilityScenarioId, CompatibilityScenarioStatus>>;
  summary?: FixtureSummaryExpectation;
  reportIncludes?: string[];
}

interface CompatibilityContractFixture {
  id: string;
  description?: string;
  services: unknown[];
  expect: FixtureExpectations;
}

function readContractFixtures(): CompatibilityContractFixture[] {
  const fixturesDir = path.join(__dirname, '__fixtures__', 'compatibility-matrix');
  const fixtureFiles = readdirSync(fixturesDir)
    .filter((fileName) => fileName.endsWith('.json'))
    .sort((a, b) => a.localeCompare(b));

  return fixtureFiles.map((fileName) => {
    const fixturePath = path.join(fixturesDir, fileName);
    const content = readFileSync(fixturePath, 'utf-8');
    return JSON.parse(content) as CompatibilityContractFixture;
  });
}

const fixtures = readContractFixtures();

describe('compatibilityMatrix core release scenarios', () => {
  it('defines built-in matrix rows for all core CLI/provider combinations', () => {
    const report = createCompatibilityTestReport(createDefaultMaintenanceAdapters());
    const rows = new Map(report.rows.map((row) => [row.adapterId, row]));

    expect(report.scenarioIds).toEqual(scenarioIds);

    expect(rows.get('claude')?.scenarios['version-check'].status).toBe('pass');
    expect(rows.get('claude')?.scenarios.update.status).toBe('pass');
    expect(rows.get('claude')?.scenarios['mcp-launch'].status).toBe('pass');
    expect(rows.get('claude')?.scenarios['skill-scan'].status).toBe('pass');

    expect(rows.get('codex')?.scenarios['mcp-launch'].status).toBe('pass');
    expect(rows.get('gemini')?.scenarios['skill-scan'].status).toBe('pass');

    expect(rows.get('agents')?.scenarios['version-check'].status).toBe('skip');
    expect(rows.get('agents')?.scenarios.update.status).toBe('skip');
    expect(rows.get('agents')?.scenarios['mcp-launch'].status).toBe('skip');
    expect(rows.get('agents')?.scenarios['skill-scan'].status).toBe('pass');

    expect(rows.get('skills')?.scenarios['version-check'].status).toBe('pass');
    expect(rows.get('skills')?.scenarios.update.status).toBe('pass');
    expect(rows.get('skills')?.scenarios['mcp-launch'].status).toBe('skip');
    expect(rows.get('skills')?.scenarios['skill-scan'].status).toBe('skip');

    expect(report.summary.failed).toBe(0);
    expect(report.summary.failedScenarios).toEqual([]);
  });
});

describe('compatibilityMatrix fixture contract pipeline', () => {
  it('loads provider fixtures for automatic contract checks', () => {
    expect(fixtures.length).toBeGreaterThan(0);
  });

  for (const fixture of fixtures) {
    it(`validates fixture contract: ${fixture.id}`, () => {
      const adapters = createCustomMaintenanceAdapters(fixture.services);
      const report = createCompatibilityTestReport(adapters);
      const row = report.rows.find((item) => item.adapterId === fixture.expect.adapterId);

      expect(row, `Missing adapter matrix row: ${fixture.expect.adapterId}`).toBeDefined();

      for (const scenarioId of scenarioIds) {
        const expectedStatus = fixture.expect.scenarios[scenarioId];
        if (!expectedStatus) {
          continue;
        }
        expect(
          row?.scenarios[scenarioId].status,
          `${fixture.id} scenario ${scenarioId} status mismatch`,
        ).toBe(expectedStatus);
      }

      const expectedSummary = fixture.expect.summary;
      if (expectedSummary) {
        if (typeof expectedSummary.failed === 'number') {
          expect(report.summary.failed).toBe(expectedSummary.failed);
        }

        if (expectedSummary.failedScenarios) {
          expect(report.summary.failedScenarios).toEqual(expectedSummary.failedScenarios);
        }

        if (expectedSummary.impactedAdapters) {
          expect(report.summary.impactedAdapters).toEqual(expectedSummary.impactedAdapters);
        }

        if (expectedSummary.impactedTools) {
          expect(report.summary.impactedTools).toEqual(expectedSummary.impactedTools);
        }

        if (expectedSummary.impactedProviders) {
          expect(report.summary.impactedProviders).toEqual(expectedSummary.impactedProviders);
        }
      }

      const reportIncludes = fixture.expect.reportIncludes;
      if (reportIncludes && reportIncludes.length > 0) {
        const reportText = formatCompatibilityTestReport(report);
        for (const snippet of reportIncludes) {
          expect(reportText).toContain(snippet);
        }
      }
    });
  }

  it('summarizes failure scenarios and impact scope in release report output', () => {
    const failingFixture = fixtures.find((fixture) => fixture.id === 'mcp-without-execution');
    expect(failingFixture).toBeDefined();

    const adapters = createCustomMaintenanceAdapters(failingFixture?.services ?? []);
    const report = createCompatibilityTestReport(adapters);
    const reportText = formatCompatibilityTestReport(report);

    expect(reportText).toContain('Failed scenarios: mcp-launch');
    expect(reportText).toContain('Impact scope adapters: mcp-without-execution');
    expect(reportText).toContain('Impact scope tools: mcp-without-execution');
    expect(reportText).toContain('Failure details:');
    expect(reportText).toContain('[mcp-without-execution] mcp-launch');
  });
});
