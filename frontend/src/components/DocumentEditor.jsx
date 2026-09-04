import React, { useState, useEffect } from 'react';
import { ArrowLeft, Save, Loader2, AlertCircle, FileEdit, Undo2, Tag, X, Plus } from 'lucide-react';

export default function DocumentEditor({ docId, onBack, onSaved }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState('');
  
  const [originalTitle, setOriginalTitle] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [originalTags, setOriginalTags] = useState([]);

  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let ignore = false;
    const fetchRaw = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/documents/${docId}/raw`);
        if (!res.ok) throw new Error('Failed to load raw document content');
        const data = await res.json();
        if (!ignore) {
          setTitle(data.title || '');
          setContent(data.content || '');
          const loadedTags = data.meta?.tags || [];
          setTags(loadedTags);

          setOriginalTitle(data.title || '');
          setOriginalContent(data.content || '');
          setOriginalTags(loadedTags);
        }
      } catch (err) {
        if (!ignore) setError(err.message || 'Error loading document');
      } finally {
        if (!ignore) setLoading(false);
      }
    };

    if (docId) {
      fetchRaw();
    }
    return () => {
      ignore = true;
    };
  }, [docId]);

  const hasChanges = 
    title !== originalTitle || 
    content !== originalContent || 
    JSON.stringify(tags) !== JSON.stringify(originalTags);

  const handleAddTag = () => {
    const clean = tagInput.trim().toLowerCase().replace(/^#/, '');
    if (clean && !tags.includes(clean)) {
      setTags([...tags, clean]);
      setTagInput('');
    }
  };

  const handleTagKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      handleAddTag();
    }
  };

  const handleRemoveTag = (tagToRemove) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleSave = async (e) => {
    e?.preventDefault();
    if (!content.trim()) {
      setError('Content cannot be empty');
      return;
    }

    try {
      setIsSaving(true);
      setError(null);
      const res = await fetch(`/api/documents/${docId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim() || undefined,
          content: content,
          tags: tags,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to update document');
      }

      setOriginalTitle(data.title);
      setOriginalContent(content);
      setOriginalTags(tags);

      if (onSaved) {
        onSaved(docId);
      }
    } catch (err) {
      setError(err.message || 'Error updating document');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setTitle(originalTitle);
    setContent(originalContent);
    setTags(originalTags);
  };

  const charCount = content.length;
  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
  const lineCount = content.length ? content.split('\n').length : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        <p className="text-sm text-zinc-400">Loading document editor...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      {/* Top Bar */}
      <header className="border-b border-zinc-800 bg-zinc-900/60 backdrop-blur sticky top-0 z-30 px-6 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition cursor-pointer"
            title="Cancel and return"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 min-w-0">
            <FileEdit className="w-5 h-5 text-indigo-400 flex-shrink-0" />
            <h1 className="font-semibold text-sm truncate">Edit Document</h1>
            {hasChanges && (
              <span className="text-[11px] bg-amber-500/15 text-amber-400 border border-amber-500/25 px-2 py-0.5 rounded-full font-medium">
                Unsaved changes
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {hasChanges && (
            <button
              type="button"
              onClick={handleReset}
              disabled={isSaving}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition cursor-pointer"
              title="Reset changes"
            >
              <Undo2 className="w-3.5 h-3.5" />
              Reset
            </button>
          )}

          <button
            type="button"
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
            className="flex items-center gap-2 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition shadow-sm cursor-pointer"
          >
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save & Re-chunk
          </button>
        </div>
      </header>

      {/* Error alert if any */}
      {error && (
        <div className="max-w-5xl mx-auto w-full px-6 pt-4">
          <div className="p-3 bg-red-950/40 border border-red-800/60 rounded-xl text-xs text-red-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Editor Body */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-6 flex flex-col gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <label htmlFor="document-title-input" className="block text-xs font-medium text-zinc-400 mb-1.5">Document Title</label>
            <input
              id="document-title-input"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Document title"
              className="w-full px-4 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-base font-semibold text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-zinc-400" />
              Tags (e.g. ai, tech, news)
            </label>
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                placeholder="Add tag and press Enter"
                className="flex-1 px-3 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 transition"
              />
              <button
                type="button"
                onClick={handleAddTag}
                disabled={!tagInput.trim()}
                className="px-3 py-2.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-xs font-semibold rounded-xl text-zinc-300 transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Tag pills display */}
        {tags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-zinc-500 mr-1">Tags:</span>
            {tags.map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs bg-indigo-500/10 text-indigo-300 border border-indigo-500/20"
              >
                #{t}
                <button
                  type="button"
                  onClick={() => handleRemoveTag(t)}
                  className="p-0.5 hover:bg-indigo-500/20 rounded-md text-indigo-400 hover:text-indigo-200 transition cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="flex-1 flex flex-col min-h-[450px]">
          <div className="flex items-center justify-between mb-1.5 text-xs text-zinc-400">
            <label htmlFor="markdown-content-input">Markdown Content</label>
            <div className="flex items-center gap-3 font-mono text-[11px] opacity-70">
              <span>{charCount} chars</span>
              <span>•</span>
              <span>{wordCount} words</span>
              <span>•</span>
              <span>{lineCount} lines</span>
            </div>
          </div>
          <textarea
            id="markdown-content-input"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Document markdown text..."
            className="flex-1 w-full p-4 bg-zinc-900 border border-zinc-800 rounded-xl text-sm font-mono leading-relaxed text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-indigo-500 resize-y min-h-[400px] transition"
          />
        </div>

        <p className="text-xs text-zinc-500 leading-normal">
          Tip: When you save changes, the document is re-chunked semantically (250–500 chars per block). The cached audio for previous blocks will be automatically flushed so newly requested audio reflects your edits.
        </p>
      </main>
    </div>
  );
}
