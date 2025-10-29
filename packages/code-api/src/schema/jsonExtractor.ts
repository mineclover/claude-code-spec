/**
 * JSON Extractor - Clean JSON extraction from Claude responses
 *
 * Handles common issues:
 * - Markdown code blocks (```json ... ```)
 * - Explanatory text before/after JSON
 * - Multiple JSON objects
 * - Invalid JSON with fixable issues
 */

export interface JSONExtractionResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  raw?: string;
  cleanedText?: string;
}

/**
 * Extract clean JSON from text that may contain markdown, explanations, etc.
 */
export function extractJSON<T = any>(text: string): JSONExtractionResult<T> {
  if (!text || text.trim() === '') {
    return {
      success: false,
      error: 'Empty input text',
      raw: text,
    };
  }

  // Step 1: Remove markdown code blocks
  const cleaned = removeMarkdownCodeBlocks(text);

  // Step 2: Try to parse directly
  const directParse = tryParse<T>(cleaned);
  if (directParse.success) {
    return {
      success: true,
      data: directParse.data,
      raw: text,
      cleanedText: cleaned,
    };
  }

  // Step 3: Try to extract JSON object/array from mixed content
  const extracted = extractJSONFromMixedContent(cleaned);
  if (extracted) {
    const extractedParse = tryParse<T>(extracted);
    if (extractedParse.success) {
      return {
        success: true,
        data: extractedParse.data,
        raw: text,
        cleanedText: extracted,
      };
    }
  }

  // Step 4: Try common fixes
  const fixed = tryCommonFixes(cleaned);
  if (fixed) {
    const fixedParse = tryParse<T>(fixed);
    if (fixedParse.success) {
      return {
        success: true,
        data: fixedParse.data,
        raw: text,
        cleanedText: fixed,
      };
    }
  }

  // Failed to extract valid JSON
  return {
    success: false,
    error: directParse.error || 'Could not extract valid JSON',
    raw: text,
    cleanedText: cleaned,
  };
}

/**
 * Remove markdown code blocks (```json ... ``` or ``` ... ```)
 */
function removeMarkdownCodeBlocks(text: string): string {
  // Remove ```json ... ```
  text = text.replace(/```json\s*\n?([\s\S]*?)```/g, '$1');

  // Remove ``` ... ```
  text = text.replace(/```\s*\n?([\s\S]*?)```/g, '$1');

  return text.trim();
}

/**
 * Try to parse text as JSON
 */
function tryParse<T>(text: string): { success: boolean; data?: T; error?: string } {
  try {
    const data = JSON.parse(text) as T;
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Extract JSON object or array from mixed content
 */
function extractJSONFromMixedContent(text: string): string | null {
  // Try to find JSON object
  const objectMatch = text.match(/\{[\s\S]*\}/);
  if (objectMatch) {
    return objectMatch[0];
  }

  // Try to find JSON array
  const arrayMatch = text.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    return arrayMatch[0];
  }

  return null;
}

/**
 * Try common fixes for almost-valid JSON
 */
function tryCommonFixes(text: string): string | null {
  let fixed = text;

  // Fix: Remove trailing commas in objects/arrays
  fixed = fixed.replace(/,(\s*[}\]])/g, '$1');

  // Fix: Unescaped quotes in strings (simple heuristic)
  // This is risky, so we only try it as a last resort

  // Fix: Missing quotes around keys (simple cases only)
  fixed = fixed.replace(/(\{|,)\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');

  // Only return if the fix changed something
  if (fixed !== text) {
    return fixed;
  }

  return null;
}

/**
 * Extract multiple JSON objects from text
 */
export function extractMultipleJSON<T = any>(text: string): JSONExtractionResult<T[]> {
  const cleaned = removeMarkdownCodeBlocks(text);

  // Try to parse as array directly
  const arrayParse = tryParse<T[]>(cleaned);
  if (arrayParse.success) {
    return {
      success: true,
      data: arrayParse.data,
      raw: text,
      cleanedText: cleaned,
    };
  }

  // Try to extract individual objects
  const objects: T[] = [];
  const objectRegex = /\{[\s\S]*?\}/g;

  let match = objectRegex.exec(cleaned);
  while (match !== null) {
    const parsed = tryParse<T>(match[0]);
    if (parsed.success && parsed.data) {
      objects.push(parsed.data);
    }
    match = objectRegex.exec(cleaned);
  }

  if (objects.length > 0) {
    return {
      success: true,
      data: objects,
      raw: text,
      cleanedText: cleaned,
    };
  }

  return {
    success: false,
    error: 'Could not extract any valid JSON objects',
    raw: text,
    cleanedText: cleaned,
  };
}

/**
 * Validate JSON against a schema (simple runtime check)
 */
export function validateJSONStructure<T extends Record<string, any>>(
  data: unknown,
  requiredFields: (keyof T)[],
): data is T {
  if (!data || typeof data !== 'object') {
    return false;
  }

  const obj = data as Record<string, any>;

  for (const field of requiredFields) {
    if (!(field in obj)) {
      return false;
    }
  }

  return true;
}

/**
 * Extract and validate structured JSON
 */
export function extractAndValidate<T extends Record<string, any>>(
  text: string,
  requiredFields: (keyof T)[],
): JSONExtractionResult<T> {
  const result = extractJSON<T>(text);

  if (!result.success || !result.data) {
    return result;
  }

  if (!validateJSONStructure<T>(result.data, requiredFields)) {
    return {
      success: false,
      error: `JSON missing required fields: ${requiredFields.join(', ')}`,
      raw: text,
      cleanedText: result.cleanedText,
    };
  }

  return result;
}

/**
 * Type guard for array data
 */
export function isArrayData<T>(data: unknown): data is T[] {
  return Array.isArray(data);
}

/**
 * Type guard for object data
 */
export function isObjectData<T extends Record<string, any>>(data: unknown): data is T {
  return typeof data === 'object' && data !== null && !Array.isArray(data);
}
