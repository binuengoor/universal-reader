import React, { useState, useEffect } from 'react';
import { ArrowLeft, Save, Loader2, AlertCircle, FileEdit, Undo2, Tag, X, Plus, Sparkles, Type } from 'lucide-react';
import TagInput from './TagInput';
import { getTheme } from '../utils/theme';

export default function DocumentEditor({ docId, onBack, onSaved, onOpenDisplaySettings, theme = 'dark' }) {
  const t = getTheme(theme);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState('');
  
  const [originalTitle, setOriginalTitle] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [originalTags, setOriginalTags] = useState([]);

  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [availableTags, setAvailableTags] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    let ignore = false;
    const fetchRaw = async () => {
      try {
        setLoading(true);
        setError(null);
        const [rawRes, tagsRes] = await Promise.all([
          fetch(`/api/documents/${docId}/raw`),
          fetch('/api/tags')
        ]);
        if (!rawRes.ok) throw new Error('Failed to load raw document content');
        const data = await rawRes.json();
        
        let fetchedTags = [];
        if (tagsRes.ok) {
          const tData = await tagsRes.json();
          fetchedTags = tData.tags || [];
        }

        if (!ignore) {
          setTitle(data.title || '');
          setContent(data.content || '');
          const loadedTags = data.meta?.tags || [];
          setTags(loadedTags);
          setAvailableTags(fetchedTags);

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

  const handleAiSuggest = async () => {
    if (!content.trim()) return;
    try {
      setIsGeneratingAi(true);
      setError(null);
      const res = await fetch('/api/documents/batch-llm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_type: 'all',
          doc_ids: [docId],
          overwrite: true
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'AI generation failed');
      const item = data.results && data.results[0];
      if (item) {
        if (item.new_title) setTitle(item.new_title);
        if (item.new_tags) setTags(item.new_tags);
      }
    } catch (err) {
      setError(err.message || 'Failed to generate AI title and tags');
    } finally {
      setIsGeneratingAi(false);
    }
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
      <div className={`min-h-screen ${t.page} flex flex-col items-center justify-center gap-3`}>
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        <p className={`text-sm ${t.cardMeta}`}>Loading document for editing...</p>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${t.page} flex flex-col`}>
      {/* Header */}
      <header className={`sticky top-0 z-20 ${t.header} px-6 py-3 flex items-center justify-between gap-4`}>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className={`p-2 rounded-lg ${t.iconMuted} hover:opacity-100 transition cursor-pointer`}
            title="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <FileEdit className="w-5 h-5 text-indigo-500" />
            <h1 className={`font-semibold text-sm sm:text-base ${t.cardTitle}`}>Edit Document</h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onOpenDisplaySettings && (
            <button
              type="button"
              onClick={onOpenDisplaySettings}
              className={`p-1.5 sm:p-2 rounded-lg transition border cursor-pointer flex items-center gap-1 ${t.btnSecondary}`}
              title="Theme & Display Options (Aa)"
            >
              <Type className="w-4 h-4 text-indigo-500" />
              <span className="font-serif font-bold text-xs leading-none hidden sm:inline">Aa</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleAiSuggest}
            disabled={isGeneratingAi || !content.trim()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 text-indigo-500 dark:text-indigo-300 text-xs font-semibold rounded-lg transition shadow-xs cursor-pointer disabled:opacity-50"
            title="Use LLM to suggest title and category tags"
          >
            {isGeneratingAi ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            <span>AI Suggest</span>
          </button>

          {hasChanges && (
            <button
              type="button"
              onClick={handleReset}
              disabled={isSaving}
              className={`flex items-center gap-1.5 px-3 py-1.5 ${t.btnSecondary} text-xs font-medium rounded-lg transition cursor-pointer`}
            >
              <Undo2 className="w-3.5 h-3.5" />
              <span>Reset</span>
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
            <label htmlFor="document-title-input" className={`block text-xs font-medium ${t.cardMeta} mb-1.5`}>Document Title</label>
            <input
              id="document-title-input"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Document title"
              className={`w-full px-4 py-2.5 rounded-xl text-base font-semibold transition ${t.input}`}
            />
          </div>

          <div>
            <label className={`block text-xs font-medium ${t.cardMeta} mb-1.5 flex items-center justify-between`}>
              <span className="flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 opacity-60" />
                Category Tags
              </span>
              <span className="text-[10px] opacity-70">Max 50 Global</span>
            </label>
            <TagInput
              tags={tags}
              onChange={setTags}
              availableTags={availableTags}
              placeholder="Add category tag..."
              theme={theme}
            />
          </div>
        </div>

        <div className="flex-1 flex flex-col min-h-[450px]">
          <div className={`flex items-center justify-between mb-1.5 text-xs ${t.cardMeta}`}>
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
            className={`flex-1 w-full p-4 rounded-xl text-sm font-mono leading-relaxed resize-y min-h-[400px] transition ${t.input}`}
          />
        </div>

        <p className={`text-xs ${t.cardMeta} leading-normal`}>
          Tip: When you save changes, the document is re-chunked semantically (250–500 chars per block). The cached audio for previous blocks will be automatically flushed so newly requested audio reflects your edits.
        </p>
      </main>
    </div>
  );
}
