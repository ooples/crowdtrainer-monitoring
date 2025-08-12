/**
 * Type definitions for similarity module
 */
declare module 'similarity' {
  /**
   * Calculate similarity between two strings
   * @param str1 First string
   * @param str2 Second string
   * @returns Similarity score between 0 and 1
   */
  function similarity(str1: string, str2: string): number;
  export = similarity;
}