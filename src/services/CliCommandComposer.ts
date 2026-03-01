import type {
  CLICommandCondition,
  CLICommandConditionalSegment,
  CLICommandFallbackSegment,
  CLICommandMappedSegment,
  CLICommandMcpLaunchSegment,
  CLICommandOptionSegment,
  CLICommandSegment,
  CLIOptionSchema,
  CLIToolDefinition,
} from '../types/cli-tool';

interface ResolvedMcpLaunchStrictConfig {
  key: string;
  flag: string;
  includeWhenConfigPresent: boolean;
  allowWithoutConfig: boolean;
}

interface ResolvedMcpLaunchStrategy {
  configKey: string;
  configFlag: string;
  strict: ResolvedMcpLaunchStrictConfig | null;
}

const SAFE_MCP_CONFIG_KEY = 'mcpConfig';
const SAFE_MCP_CONFIG_FLAG = '--mcp-config';
const SAFE_STRICT_MCP_KEY = 'strictMcpConfig';
const SAFE_STRICT_MCP_FLAG = '--strict-mcp-config';

function evaluateCondition(
  condition: CLICommandCondition | undefined,
  options: Record<string, unknown>,
): boolean {
  if (!condition) {
    return true;
  }

  switch (condition.op) {
    case 'exists':
      return options[condition.key] !== undefined && options[condition.key] !== null;
    case 'truthy':
      return Boolean(options[condition.key]);
    case 'nonEmpty': {
      const value = options[condition.key];
      return typeof value === 'string' ? value.trim().length > 0 : Boolean(value);
    }
    case 'equals':
      return options[condition.key] === condition.value;
    case 'notEquals':
      return options[condition.key] !== condition.value;
    case 'in':
      return condition.values.includes(options[condition.key]);
    case 'all':
      return condition.conditions.every((child) => evaluateCondition(child, options));
    case 'any':
      return condition.conditions.some((child) => evaluateCondition(child, options));
    default:
      return false;
  }
}

function mergeDefaultOptions(
  tool: CLIToolDefinition,
  rawOptions: Record<string, unknown>,
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...rawOptions };

  for (const option of tool.options) {
    if (merged[option.key] === undefined && option.defaultValue !== undefined) {
      merged[option.key] = option.defaultValue;
    }
  }

  return merged;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function findOptionByKey(tool: CLIToolDefinition, key: string): CLIOptionSchema | undefined {
  return tool.options.find((option) => option.key === key);
}

function findFirstExistingOption(
  tool: CLIToolDefinition,
  candidateKeys: string[],
): CLIOptionSchema | undefined {
  for (const key of candidateKeys) {
    const option = findOptionByKey(tool, key);
    if (option) {
      return option;
    }
  }
  return undefined;
}

function inferFlagFromOption(option: CLIOptionSchema | undefined): string | undefined {
  if (!option || !isNonEmptyString(option.cliFlag)) {
    return undefined;
  }

  const candidates = option.cliFlag
    .split('|')
    .map((token) => token.trim())
    .filter((token) => token.startsWith('-'));

  return candidates[0];
}

function resolveMcpLaunchStrategy(
  segment: CLICommandMcpLaunchSegment,
  tool: CLIToolDefinition,
  options: Record<string, unknown>,
): ResolvedMcpLaunchStrategy {
  const explicitConfigKey = isNonEmptyString(segment.config?.key)
    ? segment.config.key.trim()
    : null;
  const inferredConfigOption =
    findFirstExistingOption(tool, [SAFE_MCP_CONFIG_KEY]) ??
    (options[SAFE_MCP_CONFIG_KEY] !== undefined
      ? { key: SAFE_MCP_CONFIG_KEY, label: '', type: 'string' }
      : undefined);
  const configKey = explicitConfigKey ?? inferredConfigOption?.key ?? SAFE_MCP_CONFIG_KEY;

  const explicitConfigFlag = isNonEmptyString(segment.config?.flag)
    ? segment.config.flag.trim()
    : null;
  const inferredConfigFlag = inferFlagFromOption(findOptionByKey(tool, configKey));
  const configFlag = explicitConfigFlag ?? inferredConfigFlag ?? SAFE_MCP_CONFIG_FLAG;

  if (!segment.strict) {
    return {
      configKey,
      configFlag,
      strict: null,
    };
  }

  const explicitStrictKey = isNonEmptyString(segment.strict.key) ? segment.strict.key.trim() : null;
  const inferredStrictOption =
    findFirstExistingOption(tool, [SAFE_STRICT_MCP_KEY]) ??
    (options[SAFE_STRICT_MCP_KEY] !== undefined
      ? { key: SAFE_STRICT_MCP_KEY, label: '', type: 'boolean' }
      : undefined);
  const strictKey = explicitStrictKey ?? inferredStrictOption?.key ?? SAFE_STRICT_MCP_KEY;

  const explicitStrictFlag = isNonEmptyString(segment.strict.flag)
    ? segment.strict.flag.trim()
    : null;
  const inferredStrictFlag = inferFlagFromOption(findOptionByKey(tool, strictKey));
  const strictFlag = explicitStrictFlag ?? inferredStrictFlag ?? SAFE_STRICT_MCP_FLAG;

  const includeWhenConfigPresent =
    typeof segment.strict.includeWhenConfigPresent === 'boolean'
      ? segment.strict.includeWhenConfigPresent
      : inferredStrictOption !== undefined;
  const allowWithoutConfig =
    typeof segment.strict.allowWithoutConfig === 'boolean'
      ? segment.strict.allowWithoutConfig
      : false;

  return {
    configKey,
    configFlag,
    strict: {
      key: strictKey,
      flag: strictFlag,
      includeWhenConfigPresent,
      allowWithoutConfig,
    },
  };
}

function normalizeMcpPath(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeBoolean(value: unknown): boolean {
  return value === true || value === 'true';
}

function renderOptionSegment(
  segment: CLICommandOptionSegment,
  options: Record<string, unknown>,
): string[] {
  if (!evaluateCondition(segment.when, options)) {
    return [];
  }

  const rawValue = options[segment.key];
  if (rawValue === undefined || rawValue === null) {
    return [];
  }

  const valueType = segment.valueType ?? 'string';
  if (valueType === 'number') {
    if (typeof rawValue !== 'number' || !Number.isFinite(rawValue)) {
      return [];
    }
    const value = String(rawValue);
    return segment.flag ? [segment.flag, value] : [value];
  }

  if (valueType === 'boolean') {
    if (typeof rawValue !== 'boolean') {
      return [];
    }
    const value = rawValue ? 'true' : 'false';
    return segment.flag ? [segment.flag, value] : [value];
  }

  let value = String(rawValue);
  if (segment.trim !== false) {
    value = value.trim();
  }
  if (!segment.includeIfEmpty && value.length === 0) {
    return [];
  }

  return segment.flag ? [segment.flag, value] : [value];
}

function renderMappedSegment(
  segment: CLICommandMappedSegment,
  options: Record<string, unknown>,
): string[] {
  if (!evaluateCondition(segment.when, options)) {
    return [];
  }

  const rawValue = options[segment.key];
  if (rawValue === undefined || rawValue === null) {
    return [];
  }

  const key = String(rawValue);
  const mapped = segment.map[key];
  return mapped ? [...mapped] : [];
}

function renderMcpLaunchSegment(
  segment: CLICommandMcpLaunchSegment,
  options: Record<string, unknown>,
  tool: CLIToolDefinition,
): string[] {
  if (!evaluateCondition(segment.when, options)) {
    return [];
  }

  const strategy = resolveMcpLaunchStrategy(segment, tool, options);
  const configPath = normalizeMcpPath(options[strategy.configKey]);
  const strictRequested = strategy.strict ? normalizeBoolean(options[strategy.strict.key]) : false;

  if (configPath) {
    const rendered = [strategy.configFlag, configPath];
    if (strategy.strict) {
      const includeStrict = strategy.strict.includeWhenConfigPresent || strictRequested;
      if (includeStrict) {
        rendered.push(strategy.strict.flag);
      }
    }
    return rendered;
  }

  if (strategy.strict && strictRequested && strategy.strict.allowWithoutConfig) {
    return [strategy.strict.flag];
  }

  return [];
}

function renderConditionalSegment(
  segment: CLICommandConditionalSegment,
  options: Record<string, unknown>,
  tool: CLIToolDefinition,
): string[] {
  if (!evaluateCondition(segment.when, options)) {
    return [];
  }

  const rendered: string[] = [];
  for (const child of segment.segments) {
    rendered.push(...renderSegment(child, options, tool));
  }
  return rendered;
}

function renderFallbackSegment(
  segment: CLICommandFallbackSegment,
  options: Record<string, unknown>,
  tool: CLIToolDefinition,
): string[] {
  if (!evaluateCondition(segment.when, options)) {
    return [];
  }

  for (const candidate of segment.segments) {
    const rendered = renderSegment(candidate, options, tool);
    if (rendered.length > 0) {
      return rendered;
    }
  }

  return [];
}

function renderSegment(
  segment: CLICommandSegment,
  options: Record<string, unknown>,
  tool: CLIToolDefinition,
): string[] {
  switch (segment.type) {
    case 'static':
      return evaluateCondition(segment.when, options) ? [...segment.args] : [];
    case 'option':
      return renderOptionSegment(segment, options);
    case 'mapped':
      return renderMappedSegment(segment, options);
    case 'mcpLaunch':
      return renderMcpLaunchSegment(segment, options, tool);
    case 'conditional':
      return renderConditionalSegment(segment, options, tool);
    case 'fallback':
      return renderFallbackSegment(segment, options, tool);
    default:
      return [];
  }
}

export function composeCliCommand(
  tool: CLIToolDefinition,
  rawOptions: Record<string, unknown>,
): string[] {
  const options = mergeDefaultOptions(tool, rawOptions);
  const composed: string[] = [tool.commandSpec.executable];

  for (const segment of tool.commandSpec.segments) {
    composed.push(...renderSegment(segment, options, tool));
  }

  return composed;
}

export function getCliStdinInput(
  tool: CLIToolDefinition,
  rawOptions: Record<string, unknown>,
): string | undefined {
  if (!tool.stdinOptionKey) {
    return undefined;
  }

  const value = rawOptions[tool.stdinOptionKey];
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
