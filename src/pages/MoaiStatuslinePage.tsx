/**
 * MoAI Status Bar Page
 * Visual editor for .moai/config/sections/statusline.yaml
 * Auto-collects live output from the moai binary and reloads on project change.
 */

import { useCallback, useEffect, useState } from 'react';
import { useProject } from '../contexts/ProjectContext';
import { useCollect } from '../hooks/useCollect';
import type {
  MoaiSegmentsConfig,
  MoaiStatuslineConfig,
  MoaiStatuslinePreset,
  MoaiStatuslineState,
} from '../types/api/moai';
import styles from './MoaiStatuslinePage.module.css';

const PRESETS: MoaiStatuslinePreset[] = ['full', 'compact', 'minimal', 'custom'];

const PRESET_LABELS: Record<MoaiStatuslinePreset, string> = {
  full: 'Full',
  compact: 'Compact',
  minimal: 'Minimal',
  custom: 'Custom',
};

const PRESET_DESCRIPTIONS: Record<MoaiStatuslinePreset, string> = {
  full: 'All segments shown',
  compact: 'Essential segments only',
  minimal: 'Version and context only',
  custom: 'Custom segment selection',
};

const SEGMENT_LABELS: Record<keyof MoaiSegmentsConfig, string> = {
  model: 'Model',
  context: 'Context',
  output_style: 'Output Style',
  directory: 'Directory',
  git_status: 'Git Status',
  claude_version: 'Claude Version',
  moai_version: 'MoAI Version',
  git_branch: 'Git Branch',
};

const DEFAULT_CONFIG: MoaiStatuslineConfig = {
  preset: 'full',
  segments: {
    model: true,
    context: true,
    output_style: true,
    directory: true,
    git_status: true,
    claude_version: true,
    moai_version: true,
    git_branch: true,
  },
};

export function MoaiStatuslinePage() {
  const { projectPath } = useProject();

  const [state, setState] = useState<MoaiStatuslineState | null>(null);
  const [config, setConfig] = useState<MoaiStatuslineConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [togglingClaude, setTogglingClaude] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const {
    output: liveOutput,
    collecting: collectingPreview,
    error: previewError,
    collect: collectPreview,
    abortRef: previewAbortRef,
  } = useCollect(() => window.moaiAPI.runPreview());

  // Load config + auto-collect preview; re-runs on project change
  const load = useCallback(async () => {
    setLoading(true);
    previewAbortRef.current = true; // abort any in-flight preview
    try {
      const s = await window.moaiAPI.getStatusline();
      setState(s);
      if (s.config) setConfig(s.config);
    } finally {
      setLoading(false);
    }
    // Auto-collect after config load
    collectPreview();
  }, [collectPreview]);

  // Re-run whenever project changes
  useEffect(() => {
    load();
    return () => {
      previewAbortRef.current = true;
    };
  }, [load, projectPath]);

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const result = await window.moaiAPI.saveStatuslineConfig(config);
      if (result.success) {
        showMessage('success', 'Saved to statusline.yaml');
        // Re-collect live preview after save
        collectPreview();
        await load();
      } else {
        showMessage('error', result.error ?? 'Save failed');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleToggleClaude = async () => {
    const currentlyEnabled = state?.claudeSettingsStatusLine !== null;
    setTogglingClaude(true);
    try {
      const result = await window.moaiAPI.setClaudeStatusLine(!currentlyEnabled);
      if (result.success) {
        showMessage(
          'success',
          currentlyEnabled
            ? 'Removed from .claude/settings.json'
            : 'Set in .claude/settings.json',
        );
        await load();
      } else {
        showMessage('error', result.error ?? 'Failed');
      }
    } finally {
      setTogglingClaude(false);
    }
  };

  const handlePreset = (preset: MoaiStatuslinePreset) => {
    setConfig((prev) => ({ ...prev, preset }));
  };

  const handleSegmentToggle = (key: keyof MoaiSegmentsConfig) => {
    setConfig((prev) => ({
      ...prev,
      segments: { ...prev.segments, [key]: !prev.segments[key] },
    }));
  };

  const claudeEnabled = state?.claudeSettingsStatusLine !== null && state !== null;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h2 className={styles.title}>MoAI Status Bar</h2>
        {state?.projectPath && (
          <span className={styles.projectPath} title={state.projectPath}>
            {state.projectPath.split('/').slice(-2).join('/')}
          </span>
        )}
      </div>

      {loading ? (
        <div className={styles.loadingState}>Loading…</div>
      ) : (
        <>
          {!state?.projectPath && (
            <div className={styles.noProjectWarning}>
              No project selected. Select a project to edit its statusline config.
            </div>
          )}

          {/* Direct dependency: .claude/settings.json */}
          <div className={styles.depGroup}>
            <span className={styles.depGroupLabel}>.claude/settings.json</span>

            {/* Claude Code Integration */}
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <span className={styles.sectionTitle}>Claude Code Integration</span>
              </div>
              <div className={styles.integrationRow}>
                <div className={styles.integrationStatus}>
                  <span className={claudeEnabled ? styles.dotEnabled : styles.dotDisabled} />
                  <span className={styles.integrationLabel}>
                    {claudeEnabled ? 'Active' : 'Inactive'} in .claude/settings.json
                  </span>
                  {claudeEnabled && state?.claudeSettingsStatusLine && (
                    <code className={styles.scriptCode}>{state.claudeSettingsStatusLine}</code>
                  )}
                </div>
                <button
                  type="button"
                  className={claudeEnabled ? styles.btnDisable : styles.btnEnable}
                  onClick={handleToggleClaude}
                  disabled={togglingClaude || !state?.scriptPath}
                  title={
                    !state?.scriptPath
                      ? 'Select a project with a .moai directory first'
                      : claudeEnabled
                        ? 'Remove statusLine from .claude/settings.json'
                        : 'Set statusLine in .claude/settings.json'
                  }
                >
                  {togglingClaude ? 'Updating…' : claudeEnabled ? 'Disable' : 'Enable'}
                </button>
              </div>
              {state?.scriptPath && (
                <div className={styles.scriptPathRow}>
                  <span className={styles.scriptLabel}>Script:</span>
                  <code className={styles.scriptCode}>{state.scriptPath}</code>
                </div>
              )}
            </section>

            {/* Live Preview — auto-collected from moai binary */}
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <span className={styles.sectionTitle}>Live Preview</span>
                <button
                  type="button"
                  className={styles.btnSmall}
                  onClick={collectPreview}
                  disabled={collectingPreview}
                >
                  {collectingPreview ? 'Collecting…' : 'Refresh'}
                </button>
              </div>
              <div className={styles.previewBar}>
                {collectingPreview ? (
                  <span className={styles.previewMuted}>Collecting from moai binary…</span>
                ) : liveOutput ? (
                  <span className={styles.previewLive}>{liveOutput}</span>
                ) : (
                  <span className={styles.previewMuted}>
                    {previewError ? `moai not available: ${previewError}` : 'No output'}
                  </span>
                )}
              </div>
            </section>
          </div>

          {/* Indirect dependency: .moai/config/sections/statusline.yaml — only when project selected */}
          {state?.configPath && (
            <div className={styles.depGroup}>
              <span className={styles.depGroupLabel}>.moai/config/sections/statusline.yaml</span>

              {/* Preset */}
              <section className={styles.section}>
                <div className={styles.sectionHeader}>
                  <span className={styles.sectionTitle}>Preset</span>
                </div>
                <div className={styles.presetGrid}>
                  {PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      className={`${styles.presetCard} ${config.preset === preset ? styles.presetCardActive : ''}`}
                      onClick={() => handlePreset(preset)}
                    >
                      <span className={styles.presetName}>{PRESET_LABELS[preset]}</span>
                      <span className={styles.presetDesc}>{PRESET_DESCRIPTIONS[preset]}</span>
                    </button>
                  ))}
                </div>
              </section>

              {/* Segments */}
              <section className={styles.section}>
                <div className={styles.sectionHeader}>
                  <span className={styles.sectionTitle}>Segments</span>
                  <div className={styles.sectionActions}>
                    <button
                      type="button"
                      className={styles.btnSmall}
                      onClick={() =>
                        setConfig((prev) => ({
                          ...prev,
                          segments: Object.fromEntries(
                            Object.keys(prev.segments).map((k) => [k, true]),
                          ) as unknown as MoaiSegmentsConfig,
                        }))
                      }
                    >
                      All On
                    </button>
                    <button
                      type="button"
                      className={styles.btnSmall}
                      onClick={() =>
                        setConfig((prev) => ({
                          ...prev,
                          segments: Object.fromEntries(
                            Object.keys(prev.segments).map((k) => [k, false]),
                          ) as unknown as MoaiSegmentsConfig,
                        }))
                      }
                    >
                      All Off
                    </button>
                  </div>
                </div>
                <div className={styles.segmentGrid}>
                  {(Object.keys(SEGMENT_LABELS) as (keyof MoaiSegmentsConfig)[]).map((key) => (
                    <label key={key} className={styles.segmentToggle}>
                      <input
                        type="checkbox"
                        checked={config.segments[key]}
                        onChange={() => handleSegmentToggle(key)}
                        className={styles.segmentCheckbox}
                      />
                      <span className={styles.segmentLabel}>{SEGMENT_LABELS[key]}</span>
                    </label>
                  ))}
                </div>
              </section>

              {/* Config path + Save */}
              <div className={styles.configPathInfo}>
                <span className={styles.configPathLabel}>Config file:</span>
                <code className={styles.configPathCode}>{state.configPath}</code>
              </div>
              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.btnSave}
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? 'Saving…' : 'Save Config'}
                </button>
              </div>
            </div>
          )}

          {/* Global actions */}
          <div className={styles.actions}>
            <button type="button" className={styles.btnSecondary} onClick={load}>
              Reload
            </button>
          </div>

          {message && (
            <div className={message.type === 'success' ? styles.msgSuccess : styles.msgError}>
              {message.text}
            </div>
          )}
        </>
      )}
    </div>
  );
}
