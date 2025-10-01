export interface DocumentReview {
  id: string;
  timestamp: number;
  content: string;
  rating: number; // 1-5
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
  rating: number; // Average rating
}
