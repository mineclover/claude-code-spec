import type { ReactNode } from 'react';
import type { ReferenceAssetType, ReferenceProvider } from '../../types/reference-assets';
import styles from './ReferenceProviderSectionFramework.module.css';

export interface ReferenceProviderSectionCard {
  id: ReferenceAssetType;
  title: string;
  description: string;
  count: number;
  actionLabel?: string;
  onOpen: () => void;
}

export interface ReferenceProviderSectionGroup {
  provider: ReferenceProvider;
  displayName: string;
  description: string;
  sections: ReferenceProviderSectionCard[];
}

interface ReferenceProviderSectionFrameworkProps {
  groups: ReferenceProviderSectionGroup[];
  isLoading: boolean;
  message: { type: 'success' | 'error'; text: string } | null;
  onRefresh: () => void;
  emptyText?: string;
  renderSectionAction?: (
    group: ReferenceProviderSectionGroup,
    section: ReferenceProviderSectionCard,
  ) => ReactNode;
}

function defaultAction(
  group: ReferenceProviderSectionGroup,
  section: ReferenceProviderSectionCard,
): ReactNode {
  return (
    <button type="button" className={styles.sectionButton} onClick={section.onOpen}>
      {section.actionLabel ?? `Open ${group.displayName} ${section.title}`}
    </button>
  );
}

export function ReferenceProviderSectionFramework({
  groups,
  isLoading,
  message,
  onRefresh,
  emptyText = 'No provider sections available.',
  renderSectionAction,
}: ReferenceProviderSectionFrameworkProps) {
  const renderAction = renderSectionAction ?? defaultAction;

  return (
    <div className={styles.wrapper}>
      <div className={styles.headerActions}>
        <button
          type="button"
          className={styles.refreshButton}
          onClick={onRefresh}
          disabled={isLoading}
        >
          {isLoading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {message && (
        <div className={message.type === 'error' ? styles.error : styles.success}>
          {message.text}
        </div>
      )}

      {groups.length === 0 ? (
        <div className={styles.empty}>{emptyText}</div>
      ) : (
        <div className={styles.groupGrid}>
          {groups.map((group) => (
            <section key={group.provider} className={styles.groupCard}>
              <header className={styles.groupHeader}>
                <h3>{group.displayName}</h3>
                <p>{group.description}</p>
              </header>
              <div className={styles.sectionGrid}>
                {group.sections.map((section) => (
                  <article key={`${group.provider}-${section.id}`} className={styles.sectionCard}>
                    <div className={styles.sectionTopRow}>
                      <span className={styles.sectionTitle}>{section.title}</span>
                      <span className={styles.sectionCount}>{section.count}</span>
                    </div>
                    <p className={styles.sectionDescription}>{section.description}</p>
                    <div className={styles.sectionAction}>{renderAction(group, section)}</div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
