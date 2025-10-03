# Index Page Feature

## Overview

Index Page는 플랫폼의 모든 페이지와 기능에 빠르게 접근할 수 있는 카탈로그 시스템입니다.

**Route:** `/index`  
**Component:** `src/pages/IndexPage.tsx` (180 lines)

## Architecture

### Component Structure

```
IndexPage
├── Header (Title + Search)
├── Sidebar (Categories)
└── Main Content
    ├── Category Groups View (default)
    └── Search Results View (when searching)
```

### Data Model

```typescript
// src/data/pageIndex.ts:1-10
export interface PageIndex {
  id: string;
  name: string;
  displayName: string;
  description: string;
  route: string;
  icon: string;
  category: 'execution' | 'documentation' | 'management' | 'configuration';
  keywords: string[];
}
```

## How Page Indexing Works

### Page Registry

All pages are defined in `src/data/pageIndex.ts:12-110`:

```typescript
export const PAGE_INDEX: PageIndex[] = [
  {
    id: 'execute',
    name: 'Execute',
    displayName: 'Claude CLI 실행',
    description: 'Claude CLI 명령을 실행하고 실시간 스트림 응답을 확인합니다.',
    route: '/',
    icon: '▶️',
    category: 'execution',
    keywords: ['execute', 'run', 'command', 'cli', '실행', '명령', '쿼리']
  },
  // ... 7 more pages
];
```

### State Management

```typescript
// src/pages/IndexPage.tsx:10-11
const [searchQuery, setSearchQuery] = useState('');
const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
```

### Filtering Logic

```typescript
// src/pages/IndexPage.tsx:13-21
const filteredPages = useMemo(() => {
  if (searchQuery) {
    return searchPages(searchQuery);
  }
  if (selectedCategory) {
    return getPagesByCategory(selectedCategory as PageIndex['category']);
  }
  return PAGE_INDEX;
}, [searchQuery, selectedCategory]);
```

## Category System

### Categories

```typescript
// src/data/pageIndex.ts:112-133
export const CATEGORY_INFO = {
  execution: {
    name: '실행',
    icon: '⚡',
    description: 'Claude CLI 실행 및 세션 관리'
  },
  documentation: {
    name: '문서',
    icon: '📖',
    description: '가이드 및 참조 문서'
  },
  management: {
    name: '관리',
    icon: '🗂️',
    description: '프로젝트 및 로그 관리'
  },
  configuration: {
    name: '설정',
    icon: '🔧',
    description: '애플리케이션 설정'
  }
} as const;
```

### Category Filtering

```typescript
// src/data/pageIndex.ts:153-155
export function getPagesByCategory(category: PageIndex['category']): PageIndex[] {
  return PAGE_INDEX.filter(page => page.category === category);
}
```

## Search Functionality

### Search Algorithm

```typescript
// src/data/pageIndex.ts:136-145
export function searchPages(query: string): PageIndex[] {
  const lowerQuery = query.toLowerCase();
  return PAGE_INDEX.filter((page) => {
    const searchString = [page.name, page.displayName, page.description, ...page.keywords]
      .join(' ')
      .toLowerCase();

    return searchString.includes(lowerQuery);
  });
}
```

- **Case-insensitive** search
- Searches in: `name`, `displayName`, `description`, `keywords` (all fields joined into a single string)
- Returns all matching pages

### Search UI

```typescript
// src/pages/IndexPage.tsx:46-52
<input
  type="text"
  className={styles.searchInput}
  placeholder="페이지 검색... (이름, 설명, 키워드)"
  value={searchQuery}
  onChange={(e) => setSearchQuery(e.target.value)}
/>
```

### Search Results Display

```typescript
// src/pages/IndexPage.tsx:155-161
<div className={styles.pageTags}>
  {page.keywords.slice(0, 3).map((keyword) => (
    <span key={keyword} className={styles.pageTag}>
      {keyword}
    </span>
  ))}
</div>
```

## View Modes

### 1. Category Groups View (Default)

Shows all pages grouped by category:

```typescript
// src/pages/IndexPage.tsx:92-132
{categories.map((category) => {
  const info = CATEGORY_INFO[category];
  const pages = pagesByCategory[category];
  
  return (
    <div key={category} className={styles.categoryGroup}>
      <div className={styles.categoryHeader}>
        <h2>{info.name}</h2>
        <p>{info.description}</p>
      </div>
      <div className={styles.pageGrid}>
        {pages.map(page => <PageCard />)}
      </div>
    </div>
  );
})}
```

### 2. Search Results View

Shows filtered pages:

```typescript
// src/pages/IndexPage.tsx:135-173
<div className={styles.searchResults}>
  <p className={styles.resultsCount}>
    검색 결과: {filteredPages.length}개
  </p>
  <div className={styles.pageGrid}>
    {filteredPages.map(page => <PageCard />)}
  </div>
</div>
```

## Navigation

```typescript
// src/pages/IndexPage.tsx:3,9,25-27
import { useNavigate } from 'react-router-dom';

const navigate = useNavigate();

const handlePageClick = (route: string) => {
  navigate(route);
};
```

## How to Add New Pages to the Index

### Step 1: Add Page Entry to PAGE_INDEX

Edit `src/data/pageIndex.ts`:

```typescript
export const PAGE_INDEX: PageIndex[] = [
  // ... existing pages
  {
    id: 'new-feature',
    name: 'NewFeature',
    displayName: 'New Feature',
    description: 'Description of the new feature',
    route: '/new-feature',
    icon: '🆕',
    category: 'configuration', // Choose appropriate category
    keywords: ['new', 'feature', 'keywords']
  }
];
```

### Step 2: Choose the Right Category

- `execution`: Real-time operations, CLI execution
- `documentation`: Documentation browsers, viewers
- `management`: Data management, session tracking
- `configuration`: Settings, configurations, presets

### Step 3: Add Effective Keywords

Good keywords help users find your page:
- **Function-based**: 'edit', 'create', 'analyze'
- **Domain-based**: 'mcp', 'session', 'memory'
- **Korean + English**: '설정', 'settings'

### Step 4: Register Route in App.tsx

Add route to `src/App.tsx`:

```typescript
<Routes>
  {/* ... existing routes */}
  <Route path="/new-feature" element={<NewFeaturePage />} />
</Routes>
```

### Step 5: Verify

1. Reload the application
2. Navigate to `/index`
3. Check that new page appears in correct category
4. Test search functionality with keywords

## Styling

Uses CSS Modules (`IndexPage.module.css`):
- Grid layout for page cards
- Responsive design
- Category color coding
- Hover effects

## Performance Considerations

### Static Data
- `PAGE_INDEX` is static, no runtime fetching
- Fast initial load

### Memoization
```typescript
// src/pages/IndexPage.tsx:13,29
const filteredPages = useMemo(...);
const pagesByCategory = useMemo(...);
```

### Efficient Search
- Simple string matching (no regex)
- O(n) complexity where n = number of pages
- Fast for small datasets (<100 pages)

## Helper Functions

### searchPages()

```typescript
searchPages(query: string): PageIndex[]
```

Search pages by query string.

### getPageById()

```typescript
// src/data/pageIndex.ts:148-150
export function getPageById(id: string): PageIndex | undefined {
  return PAGE_INDEX.find(page => page.id === id);
}
```

### getPagesByCategory()

```typescript
// src/data/pageIndex.ts:153-155
export function getPagesByCategory(category: PageIndex['category']): PageIndex[]
```

## Integration with Other Features

- **Execute**: Quick navigation from any page
- **Settings**: Access system configuration
- **Memory**: Edit context management
- **MCP Configs**: Manage MCP presets
- **Claude Projects**: Browse sessions

All features are accessible through the Index Page, making it the central hub of the platform.

## Future Enhancements

1. **Recent Pages**: Track and show recently visited pages
2. **Favorites**: Pin frequently used pages
3. **Custom Categories**: User-defined categories
4. **Keyboard Shortcuts**: Quick access with hotkeys
5. **Page Analytics**: Track most visited pages
6. **Dynamic Icons**: Icon picker for custom pages
