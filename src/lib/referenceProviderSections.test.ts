import { describe, expect, it } from 'vitest';
import { resolveReferenceProviderSections } from './referenceProviderSections';

describe('referenceProviderSections', () => {
  it('uses explicit capability before inferred counts', () => {
    const [resolved] = resolveReferenceProviderSections({
      registrations: [
        {
          provider: 'claude',
          displayName: 'Claude Code',
          description: 'desc',
          capability: {
            hooks: { enabled: false },
          },
        },
      ],
      countsByProvider: {
        claude: {
          hooks: 4,
          outputStyles: 2,
          skills: 1,
        },
      },
    });

    expect(resolved.capability.hooks.enabled).toBe(false);
    expect(resolved.capability.outputStyles.enabled).toBe(true);
    expect(resolved.capability.skills.enabled).toBe(true);
  });

  it('infers capability from section counts when explicit value is missing', () => {
    const [resolved] = resolveReferenceProviderSections({
      registrations: [
        {
          provider: 'claude',
          displayName: 'Claude Code',
          description: 'desc',
        },
      ],
      countsByProvider: {
        claude: {
          hooks: 0,
          outputStyles: 2,
          skills: 0,
        },
      },
    });

    expect(resolved.capability.hooks.enabled).toBe(false);
    expect(resolved.capability.outputStyles.enabled).toBe(true);
    expect(resolved.capability.skills.enabled).toBe(false);
  });

  it('falls back to safe defaults when neither explicit nor inferred values exist', () => {
    const [resolved] = resolveReferenceProviderSections({
      registrations: [
        {
          provider: 'claude',
          displayName: 'Claude Code',
          description: 'desc',
        },
      ],
    });

    expect(resolved.capability.hooks.enabled).toBe(false);
    expect(resolved.capability.outputStyles.enabled).toBe(false);
    expect(resolved.capability.skills.enabled).toBe(false);
    expect(resolved.counts).toEqual({
      hooks: 0,
      outputStyles: 0,
      skills: 0,
    });
  });

  it('marks sections as supported: true by default', () => {
    const [resolved] = resolveReferenceProviderSections({
      registrations: [
        {
          provider: 'claude',
          displayName: 'Claude Code',
          description: 'desc',
        },
      ],
    });

    expect(resolved.capability.hooks.supported).toBe(true);
    expect(resolved.capability.outputStyles.supported).toBe(true);
    expect(resolved.capability.skills.supported).toBe(true);
  });

  it('marks sections as supported: false when explicitly declared', () => {
    const [resolved] = resolveReferenceProviderSections({
      registrations: [
        {
          provider: 'gemini',
          displayName: 'Gemini CLI',
          description: 'desc',
          capability: {
            hooks: { supported: false, enabled: false },
            outputStyles: { supported: false, enabled: false },
            skills: { supported: false, enabled: false },
          },
        },
      ],
      countsByProvider: {
        gemini: { hooks: 5, outputStyles: 3, skills: 2 },
      },
    });

    // supported: false overrides inferred enabled even when counts are high
    expect(resolved.capability.hooks.supported).toBe(false);
    expect(resolved.capability.hooks.enabled).toBe(false);
    expect(resolved.capability.outputStyles.supported).toBe(false);
    expect(resolved.capability.skills.supported).toBe(false);
  });

  it('default registrations include claude, gemini, codex', () => {
    const results = resolveReferenceProviderSections();

    const providers = results.map((r) => r.provider);
    expect(providers).toContain('claude');
    expect(providers).toContain('gemini');
    expect(providers).toContain('codex');
  });

  it('gemini and codex have supported: false for all sections by default', () => {
    const results = resolveReferenceProviderSections();

    for (const providerName of ['gemini', 'codex'] as const) {
      const resolved = results.find((r) => r.provider === providerName);
      expect(resolved).toBeDefined();
      expect(resolved?.capability.hooks.supported).toBe(false);
      expect(resolved?.capability.outputStyles.supported).toBe(false);
      expect(resolved?.capability.skills.supported).toBe(false);
    }
  });
});
