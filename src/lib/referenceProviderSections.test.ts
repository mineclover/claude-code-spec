import { describe, expect, it } from 'vitest';
import { resolveReferenceProviderSections } from './referenceProviderSections';

describe('referenceProviderSections', () => {
  it('uses explicit capability before inferred counts', () => {
    const [resolved] = resolveReferenceProviderSections({
      registrations: [
        {
          provider: 'moai',
          displayName: 'MoAI',
          description: 'desc',
          capability: {
            hooks: { enabled: false },
          },
        },
      ],
      countsByProvider: {
        moai: {
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
          provider: 'ralph',
          displayName: 'Ralph',
          description: 'desc',
        },
      ],
      countsByProvider: {
        ralph: {
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
          provider: 'moai',
          displayName: 'MoAI',
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
});
