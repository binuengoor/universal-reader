/**
 * Prioritized Audio Generation & Prefetch Queue
 * 
 * Priorities:
 * 1 = Foreground playback / active click (Highest, preempts queue)
 * 5 = Lookahead sliding buffer (N+1, N+2)
 * 10 = Background full-note audio generation (Lowest priority)
 */

class PriorityAudioQueue {
  constructor() {
    this.queue = [];
    this.isProcessing = false;
    this.prefetchedSet = new Set();
    this.activeAbortController = null;
    this.listeners = new Set();
    this.fullDocTask = null; // { docId, total, completed, voice, model, speed, cancelled: false }
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

  getCacheKey(docId, blockId, voice, model, speed) {
    return `${docId}_${blockId}_${voice}_${model}_${speed}`;
  }

  isCached(docId, blockId, voice, model, speed) {
    const key = this.getCacheKey(docId, blockId, voice, model, speed);
    return this.prefetchedSet.has(key);
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
      onDone,
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
      speed,
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

    try {
      const url = `/api/documents/${item.docId}/blocks/${item.blockId}/audio?voice=${encodeURIComponent(
        item.voice
      )}&model=${encodeURIComponent(item.model)}&speed=${item.speed}`;

      this.activeAbortController = new AbortController();
      await fetch(url, {
        method: 'GET',
        headers: { 'X-Prefetch': 'true' },
        signal: this.activeAbortController.signal,
      });

      this.prefetchedSet.add(item.cacheKey);
      if (item.onDone) item.onDone(true);
    } catch {
      // Failed: can retry later
      if (item.onDone) item.onDone(false);
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
