// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type {
  InstalledSkillInfo,
  SkillActivationAuditEvent,
  SkillInstallPathInfo,
} from '../../types/tool-maintenance';
import { SkillsInstalledSection } from './SkillsInstalledSection';

function createSkillPath(): SkillInstallPathInfo {
  return {
    provider: 'codex',
    installRoot: '/Users/test/.codex/skills',
    disabledRoot: '/Users/test/.codex/skills-disabled',
    reference: 'references/vercel-labs-skills/src/agents.ts',
  };
}

function createInstalledSkill(partial?: Partial<InstalledSkillInfo>): InstalledSkillInfo {
  return {
    id: 'alpha-skill',
    name: 'Alpha Skill',
    description: 'test skill',
    path: '/Users/test/.codex/skills/alpha-skill',
    provider: 'codex',
    active: true,
    installRoot: '/Users/test/.codex/skills',
    disabledRoot: '/Users/test/.codex/skills-disabled',
    activePath: '/Users/test/.codex/skills/alpha-skill',
    disabledPath: '/Users/test/.codex/skills-disabled/alpha-skill',
    versionHint: '1.0.0',
    source: null,
    updatedAt: Date.now(),
    ...partial,
  };
}

function createActivationEvent(
  partial?: Partial<SkillActivationAuditEvent>,
): SkillActivationAuditEvent {
  return {
    provider: 'codex',
    skillId: 'alpha-skill',
    before: { active: false, path: '/Users/test/.codex/skills-disabled/alpha-skill' },
    after: { active: true, path: '/Users/test/.codex/skills/alpha-skill' },
    timestamp: Date.now(),
    ...partial,
  };
}

describe('SkillsInstalledSection', () => {
  it('renders installed skill list and triggers callbacks', async () => {
    const user = userEvent.setup();
    const onRefresh = vi.fn();
    const onToggleSkillActivation = vi.fn();
    const skill = createInstalledSkill();

    render(
      <SkillsInstalledSection
        skillInstallPaths={[createSkillPath()]}
        installedSkills={[skill]}
        activationEvents={[createActivationEvent()]}
        isSkillsLoading={false}
        togglingSkillKey={null}
        message={{ type: 'success', text: 'Done' }}
        onRefresh={onRefresh}
        onToggleSkillActivation={onToggleSkillActivation}
      />,
    );

    expect(screen.getByText('Alpha Skill')).toBeTruthy();
    expect(screen.getByText('Active')).toBeTruthy();
    expect(screen.getByText('Version: 1.0.0')).toBeTruthy();
    expect(screen.getByText('Recent Activation Events')).toBeTruthy();
    expect(screen.getByText('inactive -> active')).toBeTruthy();
    expect(screen.getByText('Done')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Refresh' }));
    await user.click(screen.getByRole('button', { name: 'Deactivate' }));

    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(onToggleSkillActivation).toHaveBeenCalledWith(skill);
  });

  it('shows empty state and loading/toggling state', () => {
    const skill = createInstalledSkill({ active: false });
    render(
      <SkillsInstalledSection
        skillInstallPaths={[]}
        installedSkills={[skill]}
        activationEvents={[]}
        isSkillsLoading={true}
        togglingSkillKey="codex:alpha-skill"
        message={null}
        onRefresh={vi.fn()}
        onToggleSkillActivation={vi.fn()}
      />,
    );

    const refreshButton = screen.getByRole('button', {
      name: 'Refreshing...',
    }) as HTMLButtonElement;
    expect(refreshButton.disabled).toBe(true);
    const toggleButton = screen.getByRole('button', { name: 'Updating...' }) as HTMLButtonElement;
    expect(toggleButton.disabled).toBe(true);
  });

  it('shows consistent version fallback label when version hint is missing', () => {
    render(
      <SkillsInstalledSection
        skillInstallPaths={[]}
        installedSkills={[createInstalledSkill({ versionHint: null })]}
        activationEvents={[]}
        isSkillsLoading={false}
        togglingSkillKey={null}
        message={null}
        onRefresh={vi.fn()}
        onToggleSkillActivation={vi.fn()}
      />,
    );

    expect(screen.getByText('Version: unknown')).toBeTruthy();
  });

  it('shows fallback when no skills are installed', () => {
    render(
      <SkillsInstalledSection
        skillInstallPaths={[]}
        installedSkills={[]}
        activationEvents={[]}
        isSkillsLoading={false}
        togglingSkillKey={null}
        message={null}
        onRefresh={vi.fn()}
        onToggleSkillActivation={vi.fn()}
      />,
    );

    expect(screen.getByText('No installed skills found.')).toBeTruthy();
    expect(screen.getByText('No activation events recorded.')).toBeTruthy();
  });
});
