import type React from 'react';
import styles from './Pagination.module.css';

interface PaginationProps {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  itemName?: string; // e.g., "projects", "sessions"
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  itemName = 'items',
}) => {
  const totalPages = Math.ceil(totalItems / pageSize);

  if (totalItems <= pageSize) {
    return null;
  }

  return (
    <div className={styles.paginationContainer}>
      <div className={styles.paginationInfo}>
        <span className={styles.itemCount}>
          Page {currentPage + 1} of {totalPages} • Total {totalItems} {itemName}
        </span>
      </div>
      <div className={styles.paginationControls}>
        <button
          type="button"
          onClick={() => onPageChange(0)}
          className={styles.paginationButton}
          disabled={currentPage === 0}
          aria-label="First page"
        >
          ««
        </button>
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          className={styles.paginationButton}
          disabled={currentPage === 0}
          aria-label="Previous page"
        >
          ‹ Prev
        </button>
        <div className={styles.pageNumbers}>
          {Array.from({ length: totalPages }, (_, i) => {
            const pageNum = i;
            // Show max 7 pages: current +/- 2
            if (
              pageNum === 0 ||
              pageNum === totalPages - 1 ||
              (pageNum >= currentPage - 2 && pageNum <= currentPage + 2)
            ) {
              return (
                <button
                  key={pageNum}
                  type="button"
                  onClick={() => onPageChange(pageNum)}
                  className={`${styles.pageNumber} ${pageNum === currentPage ? styles.active : ''}`}
                  aria-label={`Page ${pageNum + 1}`}
                  aria-current={pageNum === currentPage ? 'page' : undefined}
                >
                  {pageNum + 1}
                </button>
              );
            }
            if (pageNum === currentPage - 3 || pageNum === currentPage + 3) {
              return (
                <span key={`ellipsis-${pageNum}`} className={styles.ellipsis}>
                  ...
                </span>
              );
            }
            return null;
          })}
        </div>
        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          className={styles.paginationButton}
          disabled={currentPage >= totalPages - 1}
          aria-label="Next page"
        >
          Next ›
        </button>
        <button
          type="button"
          onClick={() => onPageChange(totalPages - 1)}
          className={styles.paginationButton}
          disabled={currentPage >= totalPages - 1}
          aria-label="Last page"
        >
          »»
        </button>
      </div>
    </div>
  );
};
