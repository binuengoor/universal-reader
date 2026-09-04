const prefetchedSet = new Set();
const queue = [];
let isProcessing = false;

async function processQueue() {
  if (isProcessing || queue.length === 0) return;
  isProcessing = true;

  while (queue.length > 0) {
    const item = queue.shift();
    try {
      const url = `/api/documents/${item.docId}/blocks/${item.blockId}/audio?voice=${encodeURIComponent(
        item.voice
      )}&model=${encodeURIComponent(item.model)}&speed=${item.speed}`;

      await fetch(url, {
        method: 'GET',
        headers: {
          'X-Prefetch': 'true',
        },
      });
    } catch {
      prefetchedSet.delete(item.cacheKey);
    }
  }

  isProcessing = false;
}

/**
 * Sequential background prefetch queue for lookahead blocks.
 * Enqueues synthesis requests one by one to avoid saturating upstream TTS.
 */
export function prefetchBlockAudio(docId, blockId, voice, model, speed) {
  if (!docId || blockId === null || blockId === undefined) return;

  const cacheKey = `${docId}_${blockId}_${voice}_${model}_${speed}`;
  if (prefetchedSet.has(cacheKey)) {
    return;
  }

  prefetchedSet.add(cacheKey);
  queue.push({ docId, blockId, voice, model, speed, cacheKey });
  processQueue();
}
