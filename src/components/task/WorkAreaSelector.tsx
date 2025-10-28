import { useEffect, useId, useState } from 'react';
import type { WorkArea } from '../../types/workArea';
import styles from './WorkAreaSelector.module.css';

interface WorkAreaSelectorProps {
  projectPath: string;
  selectedArea: string;
  onAreaChange: (area: string) => void;
}

export function WorkAreaSelector({
  projectPath,
  selectedArea,
  onAreaChange,
}: WorkAreaSelectorProps) {
  const [workAreas, setWorkAreas] = useState<WorkArea[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!projectPath) return;

    setLoading(true);
    window.workAreaAPI
      .getWorkAreas(projectPath)
      .then((areas) => {
        setWorkAreas(areas);
      })
      .catch((error) => {
        console.error('Failed to load work areas:', error);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [projectPath]);

  // Group areas by category
  const categorizedAreas = workAreas.reduce(
    (acc, area) => {
      if (!acc[area.category]) {
        acc[area.category] = [];
      }
      acc[area.category].push(area);
      return acc;
    },
    {} as Record<string, WorkArea[]>,
  );

  const workAreaSelectId = useId();

  return (
    <div className={styles.container}>
      <label htmlFor={workAreaSelectId} className={styles.label}>
        Work Area
      </label>
      <select
        id={workAreaSelectId}
        value={selectedArea}
        onChange={(e) => onAreaChange(e.target.value)}
        className={styles.select}
        disabled={loading}
      >
        <option value="">Select work area...</option>
        {Object.entries(categorizedAreas).map(([category, areas]) => (
          <optgroup key={category} label={category}>
            {areas.map((area) => (
              <option key={area.id} value={area.displayName}>
                {area.subcategory} - {area.description}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      {selectedArea && (
        <div className={styles.selectedInfo}>
          <span className={styles.selectedBadge}>{selectedArea}</span>
        </div>
      )}
    </div>
  );
}
