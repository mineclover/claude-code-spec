export interface DocumentReview {
  id: string;
  timestamp: number;
  content: string;
  rating: number;
  author?: string;
}

export interface DocumentImprovement {
  id: string;
  timestamp: number;
  content: string;
  status: 'pending' | 'in-progress' | 'completed';
}

export interface DocumentMetadata {
  filePath: string;
  tags: string[];
  reviews: DocumentReview[];
  improvements: DocumentImprovement[];
  searchKeywords: string[];
  lastUpdated: number;
  rating: number;
}

export interface MetadataAPI {
  get: (filePath: string) => Promise<DocumentMetadata>;
  save: (metadata: DocumentMetadata) => Promise<{ success: boolean; error?: string }>;
  addReview: (
    filePath: string,
    review: Omit<DocumentReview, 'id' | 'timestamp'>,
  ) => Promise<{ success: boolean; review?: DocumentReview; error?: string }>;
  addImprovement: (
    filePath: string,
    improvement: Omit<DocumentImprovement, 'id' | 'timestamp'>,
  ) => Promise<{ success: boolean; improvement?: DocumentImprovement; error?: string }>;
  updateTags: (filePath: string, tags: string[]) => Promise<{ success: boolean; error?: string }>;
  updateKeywords: (
    filePath: string,
    keywords: string[],
  ) => Promise<{ success: boolean; error?: string }>;
  updateImprovementStatus: (
    filePath: string,
    improvementId: string,
    status: 'pending' | 'in-progress' | 'completed',
  ) => Promise<{ success: boolean; error?: string }>;
  search: (query: string) => Promise<Array<{ filePath: string; metadata: DocumentMetadata }>>;
}
