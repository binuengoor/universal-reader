const prefetchedSet = new Set();

/**
 * Prefetches audio for a specific block in the background.
 * Triggers backend synthesis and caching in audio_cache/ if not yet cached.
 */
export async function prefetchBlockAudio(docId, blockId, voice, model, speed) {
  if (!docId || blockId === null || blockId === undefined) return;
  
  const cacheKey = `${docId}_${blockId}_${voice}_${model}_${speed}`;
  if (prefetchedSet.has(cacheKey)) {
    return;
  }

  prefetchedSet.add(cacheKey);

  try {
    const url = `/api/documents/${docId}/blocks/${blockId}/audio?voice=${encodeURIComponent(
      voice
    )}&model=${encodeURIComponent(model)}&speed=${speed}`;
    
    await fetch(url, {
      method: 'GET',
      headers: {
        'X-Prefetch': 'true',
      },
    });
  } catch {
    // Allow retry on error
    prefetchedSet.delete(cacheKey);
  }
}
