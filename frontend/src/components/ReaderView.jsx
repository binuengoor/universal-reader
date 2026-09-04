import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Loader2, AlertCircle } from 'lucide-react';

export default function ReaderView({
  docId,
  onBack,
  activeBlockId,
  onSelectBlock,
  settings = { theme: 'dark', fontSize: 18, lineHeight: 1.7, fontFamily: 'serif' },
  searchQuery = '',
}) {
  const [docData, setDocData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const activeBlockRef = useRef(null);

  useEffect(() => {
    let ignore = false;
    const fetchDoc = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/documents/${docId}`);
        if (!res.ok) throw new Error('Failed to load document');
        const data = await res.json();
        if (!ignore) {
          setDocData(data);
        }
      } catch (err) {
        if (!ignore) setError(err.message);
      } finally {
        if (!ignore) setLoading(false);
      }
    };
    if (docId) {
      fetchDoc();
    }
    return () => {
      ignore = true;
    };
  }, [docId]);

  // Auto-scroll to active block when it changes
  useEffect(() => {
    if (activeBlockId !== null && activeBlockId !== undefined) {
      const el = document.querySelector(`[data-block-id="${activeBlockId}"]`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [activeBlockId]);

  const getThemeClasses = () => {
    switch (settings.theme) {
      case 'light':
        return 'bg-white text-zinc-900 border-zinc-200';
      case 'sepia':
        return 'bg-[#fbf0d9] text-[#433422] border-[#e8d5b5]';
      case 'dark':
      default:
        return 'bg-black text-zinc-200 border-zinc-800';
    }
  };

  const getActiveBlockClasses = () => {
    switch (settings.theme) {
      case 'light':
        return 'bg-indigo-50 border-indigo-400 text-indigo-950 shadow-xs ring-1 ring-indigo-200';
      case 'sepia':
        return 'bg-[#eedcb8] border-[#936e39] text-[#2b1f11] shadow-xs ring-1 ring-[#cbb489]';
      case 'dark':
      default:
        return 'bg-zinc-900/90 border-indigo-500 text-white shadow-xs ring-1 ring-indigo-500/40';
    }
  };

  const getBlockHoverClasses = () => {
    switch (settings.theme) {
      case 'light':
        return 'hover:bg-zinc-50 border-transparent';
      case 'sepia':
        return 'hover:bg-[#f4e6c9] border-transparent';
      case 'dark':
      default:
        return 'hover:bg-zinc-900/40 border-transparent';
    }
  };

  const highlightText = (text, query) => {
    if (!query || !query.trim()) return text;
    const parts = text.split(new RegExp(`(${query.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === query.toLowerCase() ? (
        <mark key={i} className="bg-amber-400 text-black px-0.5 rounded-xs font-semibold">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  if (loading) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center gap-3 ${getThemeClasses()}`}>
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        <p className="text-sm opacity-60">Opening document...</p>
      </div>
    );
  }

  if (error || !docData) {
    return (
      <div className={`min-h-screen p-8 flex flex-col items-center justify-center gap-4 ${getThemeClasses()}`}>
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 flex items-center gap-3 max-w-md">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error || 'Document not found'}</span>
        </div>
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-4 py-2 bg-zinc-800 text-zinc-200 rounded-lg text-sm hover:bg-zinc-700 transition"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Library
        </button>
      </div>
    );
  }

  const { meta, chunks } = docData;

  return (
    <div className={`min-h-screen transition-colors duration-200 ${getThemeClasses()} pb-32`}>
      {/* Top Header */}
      <header className={`sticky top-0 z-20 backdrop-blur-md border-b px-6 py-3 flex items-center justify-between gap-4 transition-colors duration-200 ${
        settings.theme === 'light'
          ? 'bg-white/85 border-zinc-200'
          : settings.theme === 'sepia'
          ? 'bg-[#fbf0d9]/85 border-[#e8d5b5]'
          : 'bg-black/85 border-zinc-800'
      }`}>
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onBack}
            className="p-2 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 transition text-inherit flex-shrink-0"
            title="Back to Library"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h1 className="font-semibold text-base truncate">{meta?.title || 'Untitled Document'}</h1>
            <div className="flex items-center gap-3 text-xs opacity-60">
              <span className="uppercase tracking-wider font-mono">{meta?.source_type || 'text'}</span>
              <span>•</span>
              <span>{chunks?.length || 0} blocks</span>
              {activeBlockId !== null && (
                <>
                  <span>•</span>
                  <span className="font-medium text-indigo-400">
                    Block {activeBlockId + 1} of {chunks?.length || 0}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Reader Content Column */}
      <main className="max-w-3xl mx-auto px-6 pt-10">
        <div className="space-y-4">
          {chunks?.map((chunk) => {
            const isActive = activeBlockId === chunk.id;
            return (
              <div
                key={chunk.id}
                data-block-id={chunk.id}
                ref={isActive ? activeBlockRef : null}
                onClick={() => onSelectBlock && onSelectBlock(chunk.id)}
                style={{
                  fontSize: `${settings.fontSize || 18}px`,
                  lineHeight: settings.lineHeight || 1.7,
                  fontFamily:
                    settings.fontFamily === 'serif'
                      ? 'Georgia, Cambria, "Times New Roman", Times, serif'
                      : settings.fontFamily === 'mono'
                      ? 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
                      : 'system-ui, -apple-system, sans-serif',
                }}
                className={`relative group rounded-xl p-4 transition-all duration-150 cursor-pointer border ${
                  isActive ? getActiveBlockClasses() : getBlockHoverClasses()
                }`}
              >
                {/* Block index indicator */}
                <div
                  className={`absolute -left-10 top-4 text-[10px] font-mono tracking-tighter w-8 text-right opacity-0 group-hover:opacity-40 transition-opacity select-none ${
                    isActive ? '!opacity-80 font-bold text-indigo-400' : ''
                  }`}
                >
                  #{chunk.id + 1}
                </div>

                <p className="select-text whitespace-pre-wrap leading-relaxed">
                  {highlightText(chunk.text, searchQuery)}
                </p>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
