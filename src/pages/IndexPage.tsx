import type React from 'react';
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { PAGE_INDEX, CATEGORY_INFO, searchPages, getPagesByCategory } from '../data/pageIndex';
import type { PageIndex } from '../data/pageIndex';
import styles from './IndexPage.module.css';

export const IndexPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const filteredPages = useMemo(() => {
    if (searchQuery) {
      return searchPages(searchQuery);
    }
    if (selectedCategory) {
      return getPagesByCategory(selectedCategory as PageIndex['category']);
    }
    return PAGE_INDEX;
  }, [searchQuery, selectedCategory]);

  const categories = Object.keys(CATEGORY_INFO) as Array<keyof typeof CATEGORY_INFO>;

  const handlePageClick = (route: string) => {
    navigate(route);
  };

  const pagesByCategory = useMemo(() => {
    const result: Record<string, PageIndex[]> = {};
    categories.forEach(category => {
      result[category] = getPagesByCategory(category);
    });
    return result;
  }, []);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.titleSection}>
          <h1>📇 Index</h1>
          <p className={styles.subtitle}>모든 페이지 및 기능에 빠르게 접근</p>
        </div>

        <div className={styles.searchSection}>
          <input
            type="text"
            className={styles.searchInput}
            placeholder="페이지 검색... (이름, 설명, 키워드)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className={styles.content}>
        <div className={styles.sidebar}>
          <div className={styles.categoryList}>
            <div
              className={`${styles.categoryItem} ${!selectedCategory ? styles.active : ''}`}
              onClick={() => setSelectedCategory(null)}
            >
              <span className={styles.categoryIcon}>📋</span>
              <span>전체</span>
              <span className={styles.categoryCount}>{PAGE_INDEX.length}</span>
            </div>

            {categories.map((category) => {
              const info = CATEGORY_INFO[category];
              const count = pagesByCategory[category]?.length || 0;

              return (
                <div
                  key={category}
                  className={`${styles.categoryItem} ${selectedCategory === category ? styles.active : ''}`}
                  onClick={() => setSelectedCategory(category)}
                >
                  <span className={styles.categoryIcon}>{info.icon}</span>
                  <span>{info.name}</span>
                  <span className={styles.categoryCount}>{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className={styles.main}>
          {!searchQuery && !selectedCategory ? (
            // Show by category
            <div className={styles.categoryGroups}>
              {categories.map((category) => {
                const info = CATEGORY_INFO[category];
                const pages = pagesByCategory[category];

                if (pages.length === 0) return null;

                return (
                  <div key={category} className={styles.categoryGroup}>
                    <div className={styles.categoryHeader}>
                      <span className={styles.categoryHeaderIcon}>{info.icon}</span>
                      <div>
                        <h2 className={styles.categoryTitle}>{info.name}</h2>
                        <p className={styles.categoryDescription}>{info.description}</p>
                      </div>
                    </div>

                    <div className={styles.pageGrid}>
                      {pages.map((page) => (
                        <div
                          key={page.id}
                          className={styles.pageCard}
                          onClick={() => handlePageClick(page.route)}
                        >
                          <div className={styles.pageIcon}>{page.icon}</div>
                          <div className={styles.pageInfo}>
                            <h3 className={styles.pageName}>{page.displayName}</h3>
                            <p className={styles.pageDescription}>{page.description}</p>
                          </div>
                          <div className={styles.pageRoute}>{page.route}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            // Show filtered results
            <div className={styles.searchResults}>
              <div className={styles.resultsHeader}>
                {searchQuery && (
                  <p className={styles.resultsCount}>
                    검색 결과: {filteredPages.length}개
                  </p>
                )}
              </div>

              <div className={styles.pageGrid}>
                {filteredPages.map((page) => (
                  <div
                    key={page.id}
                    className={styles.pageCard}
                    onClick={() => handlePageClick(page.route)}
                  >
                    <div className={styles.pageIcon}>{page.icon}</div>
                    <div className={styles.pageInfo}>
                      <h3 className={styles.pageName}>{page.displayName}</h3>
                      <p className={styles.pageDescription}>{page.description}</p>
                      <div className={styles.pageTags}>
                        {page.keywords.slice(0, 3).map((keyword, idx) => (
                          <span key={idx} className={styles.pageTag}>{keyword}</span>
                        ))}
                      </div>
                    </div>
                    <div className={styles.pageRoute}>{page.route}</div>
                  </div>
                ))}
              </div>

              {filteredPages.length === 0 && (
                <div className={styles.emptyState}>
                  <p>검색 결과가 없습니다.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
