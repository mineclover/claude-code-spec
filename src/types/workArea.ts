/**
 * Work Area types for task categorization
 */

export interface WorkArea {
  id: string; // Unique identifier (e.g., "frontend-pages")
  category: string; // Main category (e.g., "Frontend")
  subcategory: string; // Subcategory (e.g., "Pages")
  displayName: string; // Display name (e.g., "Frontend/Pages")
  description: string; // Description of this work area
}

export interface WorkAreasConfig {
  areas: WorkArea[];
}
