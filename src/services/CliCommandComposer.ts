import type {
  CLICommandCondition,
  CLICommandConditionalSegment,
  CLICommandFallbackSegment,
  CLICommandMappedSegment,
  CLICommandOptionSegment,
  CLICommandSegment,
  CLIToolDefinition,
} from '../types/cli-tool';

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

function renderConditionalSegment(
  segment: CLICommandConditionalSegment,
  options: Record<string, unknown>,
): string[] {
  if (!evaluateCondition(segment.when, options)) {
    return [];
  }

  const rendered: string[] = [];
  for (const child of segment.segments) {
    rendered.push(...renderSegment(child, options));
  }
  return rendered;
}

function renderFallbackSegment(
  segment: CLICommandFallbackSegment,
  options: Record<string, unknown>,
): string[] {
  if (!evaluateCondition(segment.when, options)) {
    return [];
  }

  for (const candidate of segment.segments) {
    const rendered = renderSegment(candidate, options);
    if (rendered.length > 0) {
      return rendered;
    }
  }

  return [];
}

function renderSegment(segment: CLICommandSegment, options: Record<string, unknown>): string[] {
  switch (segment.type) {
    case 'static':
      return evaluateCondition(segment.when, options) ? [...segment.args] : [];
    case 'option':
      return renderOptionSegment(segment, options);
    case 'mapped':
      return renderMappedSegment(segment, options);
    case 'conditional':
      return renderConditionalSegment(segment, options);
    case 'fallback':
      return renderFallbackSegment(segment, options);
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
    composed.push(...renderSegment(segment, options));
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
