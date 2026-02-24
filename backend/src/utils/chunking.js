/**
 * Document Chunking Utility - PHASE 2
 * Splits documents into semantic chunks for embedding
 */

import logger from './logger.js';

// Get chunk settings from environment or use defaults
const DEFAULT_CHUNK_SIZE = 900;
const DEFAULT_CHUNK_OVERLAP = 100;

const CHUNK_SIZE = parseInt(process.env.CHUNK_SIZE || DEFAULT_CHUNK_SIZE, 10);
const CHUNK_OVERLAP = parseInt(process.env.CHUNK_OVERLAP || DEFAULT_CHUNK_OVERLAP, 10);

/**
 * Split text into chunks of approximately targetSize characters
 * Tries to break at sentence boundaries for better semantic coherence
 */
export function chunkText(text, targetSize = CHUNK_SIZE, overlap = CHUNK_OVERLAP) {
  if (!text || typeof text !== 'string') {
    return [];
  }

  // Clean whitespace
  const cleanedText = text
    .replace(/\s+/g, ' ')
    .replace(/\n+/g, '\n')
    .trim();

  if (cleanedText.length === 0) {
    return [];
  }

  // If text is smaller than target, return as single chunk
  if (cleanedText.length <= targetSize) {
    return [cleanedText];
  }

  const chunks = [];
  let startIndex = 0;

  while (startIndex < cleanedText.length) {
    let endIndex = startIndex + targetSize;

    // If this is the last chunk, take everything
    if (endIndex >= cleanedText.length) {
      chunks.push(cleanedText.slice(startIndex).trim());
      break;
    }

    // Try to find a sentence boundary (. ! ?)
    let sentenceEnd = -1;
    for (let i = endIndex; i > startIndex + targetSize / 2; i--) {
      const char = cleanedText[i];
      if (char === '.' || char === '!' || char === '?') {
        // Check if followed by space or end
        if (i === cleanedText.length - 1 || cleanedText[i + 1] === ' ') {
          sentenceEnd = i + 1;
          break;
        }
      }
    }

    // If found sentence boundary, use it
    if (sentenceEnd > 0) {
      endIndex = sentenceEnd;
    } else {
      // Otherwise, try to find a space
      let spaceIndex = cleanedText.lastIndexOf(' ', endIndex);
      if (spaceIndex > startIndex + targetSize / 2) {
        endIndex = spaceIndex;
      }
    }

    chunks.push(cleanedText.slice(startIndex, endIndex).trim());

    // Move start index with overlap
    startIndex = endIndex - overlap;
    if (startIndex < 0) startIndex = 0;
  }

  logger.debug('Text chunked', {
    originalLength: text.length,
    cleanedLength: cleanedText.length,
    chunkCount: chunks.length,
    targetSize,
    overlap
  });

  return chunks;
}

/**
 * Validate chunk size
 */
export function validateChunk(chunk, minSize = 50, maxSize = 2000) {
  if (!chunk || typeof chunk !== 'string') {
    return false;
  }

  const length = chunk.trim().length;
  return length >= minSize && length <= maxSize;
}
