/**
 * Prioritized Audio Generation & Prefetch Queue
 * 
 * Priorities:
 * 1 = Foreground playback / active click (Highest, preempts queue)
 * 5 = Lookahead sliding buffer (N+1, N+2)
 * 10 = Background full-note audio generation (Lowest priority)
 *
 * Audio is always synthesized at 1.0x; playback speed is applied client-side via
 * playbackRate, so one cached set of audio serves every speed. `speed` arguments are
 * accepted for backwards compatibility but ignored.
 */

/**
 * Build the URL for a block's audio. `audioKey` is the block's content version from the
 * API (chunks[i].audio_key); with it the server lets the browser cache the response forever,
 * and a text edit produces a new URL instead of replaying stale audio.
 */
export function buildBlockAudioUrl(docId, blockId, voice, model, audioKey) {
  const params = new URLSearchParams({ voice, model, speed: '1' });
  if (audioKey) params.set('v', audioKey);
  return `/api/documents/${docId}/blocks/${blockId}/audio?${params.toString()}`;
}

class PriorityAudioQueue {
  constructor() {
    this.queue = [];
    this.isProcessing = false;
    this.prefetchedSet = new Set();
    this.blobMap = new Map(); // cacheKey -> ObjectURL (in-memory audio blobs)
    this.activeAbortController = null;
    this.listeners = new Set();
    this.fullDocTask = null; // { docId, total, completed, voice, model, cancelled: false }
    this.audioKeys = new Map(); // docId -> [audio_key per block]
    this.pinnedUrl = null; // blob URL currently playing; never revoked by eviction
  }

  /** Register per-block content keys for a document; drops stale cached audio for it. */
  setAudioKeys(docId, keys) {
    if (!docId) return;
    const prev = this.audioKeys.get(docId);
    this.audioKeys.set(docId, Array.isArray(keys) ? keys : []);
    if (prev && JSON.stringify(prev) !== JSON.stringify(keys)) {
      this.forgetDocument(docId);
    }
  }

  getAudioKey(docId, blockId) {
    const keys = this.audioKeys.get(docId);
    return keys ? keys[blockId] || '' : '';
  }

  /** Forget prefetched/in-memory audio for a document (e.g. after its text changed). */
  forgetDocument(docId) {
    const prefix = `${docId}_`;
    for (const key of [...this.prefetchedSet]) {
      if (key.startsWith(prefix)) this.prefetchedSet.delete(key);
    }
    for (const [key, url] of [...this.blobMap]) {
      if (key.startsWith(prefix)) {
        if (url !== this.pinnedUrl) {
          try { URL.revokeObjectURL(url); } catch { /* ignore */ }
        }
        this.blobMap.delete(key);
      }
    }
    this.queue = this.queue.filter((item) => item.docId !== docId);
  }

  /** Mark the blob URL handed to the <audio> element so eviction never revokes it mid-play. */
  pin(url) {
    this.pinnedUrl = url && url.startsWith('blob:') ? url : null;
  }

  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  notify() {
    for (const listener of this.listeners) {
      listener(this.getStatus());
    }
  }

  getStatus() {
    return {
      isProcessing: this.isProcessing,
      queueLength: this.queue.length,
      fullDocTask: this.fullDocTask ? { ...this.fullDocTask } : null,
    };
  }

  getCacheKey(docId, blockId, voice, model) {
    return `${docId}_${blockId}_${voice}_${model}_${this.getAudioKey(docId, blockId)}`;
  }

  isCached(docId, blockId, voice, model, speed) {
    const key = this.getCacheKey(docId, blockId, voice, model, speed);
    return this.prefetchedSet.has(key);
  }

  getBlobUrl(docId, blockId, voice, model, speed) {
    const key = this.getCacheKey(docId, blockId, voice, model, speed);
    return this.blobMap.get(key) || null;
  }

  clearBlobUrls() {
    for (const url of this.blobMap.values()) {
      if (url === this.pinnedUrl) continue;
      try {
        URL.revokeObjectURL(url);
      } catch {
        // ignore
      }
    }
    this.blobMap.clear();
  }

  enqueue({ docId, blockId, voice, model, speed, priority = 5, onDone }) {
    if (!docId || blockId === null || blockId === undefined) return;
    const cacheKey = this.getCacheKey(docId, blockId, voice, model, speed);

    if (this.prefetchedSet.has(cacheKey)) {
      if (onDone) onDone(true);
      return;
    }

    // Check if already in queue
    const existing = this.queue.find((item) => item.cacheKey === cacheKey);
    if (existing) {
      if (priority < existing.priority) {
        existing.priority = priority; // Elevate priority
        this.queue.sort((a, b) => a.priority - b.priority);
      }
      if (onDone) existing.callbacks.push(onDone);
      return;
    }

    this.queue.push({
      docId,
      blockId,
      voice,
      model,
      speed,
      priority,
      cacheKey,
      callbacks: onDone ? [onDone] : [],
    });

    // Sort ascending: lower number = higher priority
    this.queue.sort((a, b) => a.priority - b.priority);
    this.notify();
    this.processNext();
  }

  // Enqueue whole document for background generation
  enqueueFullDocument(docId, totalBlocks, voice, model, speed) {
    if (!docId || totalBlocks <= 0) return;

    this.fullDocTask = {
      docId,
      total: totalBlocks,
      completed: 0,
      voice,
      model,
      cancelled: false,
    };

    for (let i = 0; i < totalBlocks; i++) {
      const cacheKey = this.getCacheKey(docId, i, voice, model, speed);
      if (this.prefetchedSet.has(cacheKey)) {
        this.fullDocTask.completed += 1;
        continue;
      }

      this.enqueue({
        docId,
        blockId: i,
        voice,
        model,
        speed,
        priority: 10, // Lowest priority: never starves playback
        onDone: () => {
          if (this.fullDocTask && this.fullDocTask.docId === docId && !this.fullDocTask.cancelled) {
            this.fullDocTask.completed += 1;
            if (this.fullDocTask.completed >= this.fullDocTask.total) {
              this.fullDocTask = null;
            }
            this.notify();
          }
        },
      });
    }

    if (this.fullDocTask && this.fullDocTask.completed >= this.fullDocTask.total) {
      this.fullDocTask = null;
    }
    this.notify();
  }

  cancelFullDocument(docId) {
    if (this.fullDocTask && this.fullDocTask.docId === docId) {
      this.fullDocTask.cancelled = true;
      this.fullDocTask = null;
    }
    // Remove all background tasks for this document
    this.queue = this.queue.filter((item) => !(item.docId === docId && item.priority === 10));
    this.notify();
  }

  async processNext() {
    if (this.isProcessing || this.queue.length === 0) return;
    this.isProcessing = true;

    const item = this.queue.shift();
    this.notify();

    const finish = (ok) => {
      for (const cb of item.callbacks) {
        try { cb(ok); } catch { /* ignore */ }
      }
    };

    try {
      const url = buildBlockAudioUrl(
        item.docId,
        item.blockId,
        item.voice,
        item.model,
        this.getAudioKey(item.docId, item.blockId)
      );

      this.activeAbortController = new AbortController();
      const res = await fetch(url, {
        method: 'GET',
        headers: { 'X-Prefetch': 'true' },
        signal: this.activeAbortController.signal,
      });

      // Substitute audio from the gateway's fallback voice is not worth keeping.
      const isFallback = res.headers.get('X-Fallback') === 'true';
      if (res.ok && !isFallback) {
        // For lookahead sliding window (priority <= 5), create a local Blob URL
        // so lock-screen transitions are instantaneous and zero-network from memory
        if (item.priority <= 5) {
          const blob = await res.blob();
          const blobUrl = URL.createObjectURL(blob);

          // Bounded cache (up to 30 items) to prevent high memory usage.
          // Never evict the blob that is currently playing.
          if (this.blobMap.size >= 30) {
            for (const [oldKey, oldUrl] of this.blobMap) {
              if (oldUrl === this.pinnedUrl) continue;
              try { URL.revokeObjectURL(oldUrl); } catch { /* ignore */ }
              this.blobMap.delete(oldKey);
              break;
            }
          }

          this.blobMap.set(item.cacheKey, blobUrl);
        }

        this.prefetchedSet.add(item.cacheKey);
        finish(true);
      } else {
        finish(false);
      }
    } catch {
      // Failed: can retry later
      finish(false);
    } finally {
      this.activeAbortController = null;
      this.isProcessing = false;
      this.notify();
      if (this.queue.length > 0) {
        this.processNext();
      }
    }
  }
}

export const priorityAudioQueue = new PriorityAudioQueue();
