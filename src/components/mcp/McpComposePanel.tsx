/**
 * McpComposePanel — per-execution MCP server selection UI.
 *
 * Sits on the ExecutePage. Reads the project's merged registry + policy, then
 * lets the user flip each server ON or OFF for this run. The difference
 * between the user's selection and the policy baseline becomes the
 * {@link McpExecutionOverride} that ExecutePage sends with the execution
 * request.
 *
 * Also exposes a tiny presets bar (load / save / delete) so common
 * combinations — e.g. "ralph without sequential-thinking" — can be reused
 * without re-checking boxes every time.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { groupByCategory } from '../../lib/mcp/grouping';
import type {
  McpExecutionOverride,
  McpPolicyFile,
  McpPreset,
  McpRegistryEntry,
  ResolvedMcpConfig,
  ResolvedRegistry,
} from '../../types/mcp-policy';
import { CategoryGroupedList } from './CategoryGroupedList';
import styles from './McpComposePanel.module.css';
import { McpOverrideDiff } from './McpOverrideDiff';
import { OverrideBadge } from './OverrideBadge';

interface McpComposePanelProps {
  projectPath: string;
  /** Notified whenever the current selection changes; null means "use default". */
  onOverrideChange: (override: McpExecutionOverride | null) => void;
}

interface ComputedOverride {
  override: McpExecutionOverride;
  nonEmpty: boolean;
}

function deriveOverride(
  enabledNow: ReadonlySet<string>,
  baseline: readonly string[],
): ComputedOverride {
  const baselineSet = new Set(baseline);
  const add: string[] = [];
  const remove: string[] = [];
  for (const id of enabledNow) {
    if (!baselineSet.has(id)) add.push(id);
  }
  for (const id of baselineSet) {
    if (!enabledNow.has(id)) remove.push(id);
  }
  add.sort();
  remove.sort();
  return { override: { add, remove }, nonEmpty: add.length > 0 || remove.length > 0 };
}

export function McpComposePanel({ projectPath, onOverrideChange }: McpComposePanelProps) {
  const [registry, setRegistry] = useState<ResolvedRegistry | null>(null);
  const [policy, setPolicy] = useState<McpPolicyFile | null>(null);
  const [enabled, setEnabled] = useState<Set<string>>(new Set());
  const [resolved, setResolved] = useState<ResolvedMcpConfig | null>(null);
  const [presets, setPresets] = useState<McpPreset[]>([]);
  const [presetName, setPresetName] = useState('');
  const [expanded, setExpanded] = useState(false);

  const reload = useCallback(async () => {
    try {
      const [r, p, presetsFile] = await Promise.all([
        window.mcpAPI.getRegistry(projectPath),
        window.mcpAPI.getPolicy(projectPath),
        window.mcpAPI.listPresets(projectPath),
      ]);
      setRegistry(r);
      setPolicy(p);
      setPresets(presetsFile.presets);
      // Reset the per-run selection to the policy baseline intersected with
      // the registry (ids in defaultEnabled but missing from registry are
      // silently skipped here; the resolver's disallowed audit surfaces them).
      const registryIds = new Set(r.entries.map((e) => e.id));
      setEnabled(new Set(p.defaultEnabled.filter((id) => registryIds.has(id))));
    } catch (error) {
      toast.error(`MCP load failed: ${error instanceof Error ? error.message : ''}`);
    }
  }, [projectPath]);

  useEffect(() => {
    reload();
  }, [reload]);

  const grouped = useMemo(
    () => (registry ? groupByCategory(registry.entries) : []),
    [registry],
  );

  const computed = useMemo<ComputedOverride>(() => {
    if (!policy) return { override: { add: [], remove: [] }, nonEmpty: false };
    return deriveOverride(enabled, policy.defaultEnabled);
  }, [enabled, policy]);

  // Notify ExecutePage of the current override — null when selection matches
  // baseline exactly, so the resolver isn't invoked unnecessarily.
  useEffect(() => {
    onOverrideChange(computed.nonEmpty ? computed.override : null);
  }, [computed, onOverrideChange]);

  // Resolve against the server so the user sees the authoritative hash.
  useEffect(() => {
    if (!policy) return;
    let cancelled = false;
    (async () => {
      try {
        const result = await window.mcpAPI.resolve({
          projectPath,
          override: computed.override,
        });
        if (!cancelled) setResolved(result.resolved);
      } catch {
        if (!cancelled) setResolved(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectPath, policy, computed]);

  const toggle = (id: string) => {
    const next = new Set(enabled);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setEnabled(next);
  };

  const resetToBaseline = () => {
    if (!policy || !registry) return;
    const registryIds = new Set(registry.entries.map((e) => e.id));
    setEnabled(new Set(policy.defaultEnabled.filter((id) => registryIds.has(id))));
  };

  const applyPreset = (preset: McpPreset) => {
    if (!policy || !registry) return;
    const registryIds = new Set(registry.entries.map((e) => e.id));
    const baselineSet = new Set(policy.defaultEnabled.filter((id) => registryIds.has(id)));
    for (const id of preset.override.add) {
      if (registryIds.has(id)) baselineSet.add(id);
    }
    for (const id of preset.override.remove) {
      baselineSet.delete(id);
    }
    setEnabled(baselineSet);
    toast.success(`Applied preset "${preset.name}"`);
  };

  const savePreset = async () => {
    const name = presetName.trim();
    if (!name) {
      toast.error('Preset name required');
      return;
    }
    const preset: McpPreset = {
      id: `preset-${Date.now()}`,
      name,
      override: computed.override,
      createdAt: Date.now(),
    };
    const res = await window.mcpAPI.savePreset(projectPath, preset);
    if (!res.success) {
      toast.error(res.error ?? 'Save failed');
      return;
    }
    toast.success(`Saved preset "${name}"`);
    setPresetName('');
    await reload();
  };

  const deletePreset = async (id: string, name: string) => {
    const confirmed = window.confirm(`Delete preset "${name}"?`);
    if (!confirmed) return;
    const res = await window.mcpAPI.deletePreset(projectPath, id);
    if (!res.success) {
      toast.error(res.error ?? 'Delete failed');
      return;
    }
    await reload();
  };

  if (!registry || !policy) {
    return <div className={styles.panel}>Loading MCP state…</div>;
  }

  if (registry.entries.length === 0) {
    return (
      <div className={styles.panel}>
        <p className={styles.hint}>
          No MCP registry entries. Add some under MCP Registry to enable compose.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      <button
        type="button"
        className={styles.summaryRow}
        onClick={() => setExpanded(!expanded)}
      >
        <span className={styles.summaryLabel}>MCP ({enabled.size} enabled)</span>
        <code className={styles.summaryHash}>
          {resolved ? resolved.hash.slice(0, 12) : '—'}
        </code>
        {computed.nonEmpty && (
          <span className={styles.overrideBadge} title="Differs from policy baseline">
            override
          </span>
        )}
        <span className={styles.chevron}>{expanded ? '▾' : '▸'}</span>
      </button>

      {expanded && (
        <div className={styles.body}>
          <div className={styles.presetsRow}>
            <label className={styles.presetsLabel}>Presets:</label>
            {presets.length === 0 && <span className={styles.hint}>(none)</span>}
            {presets.map((preset) => (
              <span key={preset.id} className={styles.presetChip}>
                <button
                  type="button"
                  className={styles.presetApply}
                  onClick={() => applyPreset(preset)}
                  title={`add: [${preset.override.add.join(', ')}], remove: [${preset.override.remove.join(', ')}]`}
                >
                  {preset.name}
                </button>
                <button
                  type="button"
                  className={styles.presetDelete}
                  onClick={() => deletePreset(preset.id, preset.name)}
                  title="Delete preset"
                >
                  ×
                </button>
              </span>
            ))}
          </div>

          <div className={styles.savePresetRow}>
            <input
              type="text"
              value={presetName}
              placeholder="Save current selection as preset…"
              onChange={(e) => setPresetName(e.target.value)}
              className={styles.presetNameInput}
            />
            <button
              type="button"
              onClick={savePreset}
              disabled={!computed.nonEmpty || !presetName.trim()}
              title={
                !computed.nonEmpty
                  ? 'Current selection matches baseline; no override to save'
                  : ''
              }
            >
              Save
            </button>
            <button type="button" onClick={resetToBaseline}>
              Reset to baseline
            </button>
          </div>

          {computed.nonEmpty && (
            <McpOverrideDiff
              baseline={policy.defaultEnabled}
              current={Array.from(enabled)}
            />
          )}

          <CategoryGroupedList<McpRegistryEntry>
            groups={grouped}
            renderItem={(entry) => {
              const isEnabled = enabled.has(entry.id);
              const inBaseline = policy.defaultEnabled.includes(entry.id);
              return (
                <label className={styles.row}>
                  <input
                    type="checkbox"
                    checked={isEnabled}
                    onChange={() => toggle(entry.id)}
                  />
                  <code className={styles.rowId}>{entry.id}</code>
                  {inBaseline && <OverrideBadge kind="baseline">baseline</OverrideBadge>}
                  {isEnabled && !inBaseline && (
                    <OverrideBadge kind="added">+add</OverrideBadge>
                  )}
                  {!isEnabled && inBaseline && (
                    <OverrideBadge kind="removed">−remove</OverrideBadge>
                  )}
                </label>
              );
            }}
          />


          {resolved && resolved.disallowed.length > 0 && (
            <p className={styles.disallowed}>
              Disallowed:{' '}
              {resolved.disallowed.map((d) => `${d.id} (${d.reason})`).join(', ')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
