import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  ArrowLeft, 
  Loader2, 
  AlertCircle, 
  Search, 
  X, 
  ChevronUp, 
  ChevronDown,
  Type,
  Play,
  Pause,
  FileEdit,
  Tag,
  Clock,
  LocateFixed
} from 'lucide-react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import DisplaySettingsDrawer from './DisplaySettingsDrawer';

export default function ReaderView({
  docId,
  onBack,
  onEdit,
  activeBlockId,
  isPlaying = false,
  onSelectBlock,
  settings = { theme: 'dark', fontSize: 18, lineHeight: 1.7, fontFamily: 'serif' },
  onUpdateSettings,
}) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [docData, setDocData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Search state
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentMatchIdx, setCurrentMatchIdx] = useState(0);
  const searchInputRef = useRef(null);

  // Auto-scroll & Follow-along state
  const [isScrolledAway, setIsScrolledAway] = useState(false);
  const isProgrammaticScrollRef = useRef(false);
  const initialScrollDoneRef = useRef(false);

  useEffect(() => {
    let ignore = false;
    initialScrollDoneRef.current = false;
    setIsScrolledAway(false);
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

  // Find matching blocks
  const matchingBlockIds = useMemo(() => {
    if (!searchQuery.trim() || !docData?.chunks) return [];
    const q = searchQuery.toLowerCase();
    return docData.chunks
      .filter((chunk) => chunk.text.toLowerCase().includes(q))
      .map((chunk) => chunk.id);
  }, [searchQuery, docData]);

  const safeMatchIdx = matchingBlockIds.length > 0 ? Math.min(currentMatchIdx, matchingBlockIds.length - 1) : 0;

  // Auto-scroll to current search match
  useEffect(() => {
    if (matchingBlockIds.length > 0) {
      const targetId = matchingBlockIds[safeMatchIdx];
      const el = document.querySelector(`[data-block-id="${targetId}"]`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [matchingBlockIds, safeMatchIdx]);

  // Keyboard shortcut for Cmd+F / Ctrl+F
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setShowSearch(true);
        setTimeout(() => searchInputRef.current?.focus(), 50);
      } else if (e.key === 'Escape' && showSearch) {
        setShowSearch(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showSearch]);

  const goToNextMatch = () => {
    if (matchingBlockIds.length === 0) return;
    const nextIdx = (currentMatchIdx + 1) % matchingBlockIds.length;
    setCurrentMatchIdx(nextIdx);
    const targetId = matchingBlockIds[nextIdx];
    const el = document.querySelector(`[data-block-id="${targetId}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const goToPrevMatch = () => {
    if (matchingBlockIds.length === 0) return;
    const prevIdx = (currentMatchIdx - 1 + matchingBlockIds.length) % matchingBlockIds.length;
    setCurrentMatchIdx(prevIdx);
    const targetId = matchingBlockIds[prevIdx];
    const el = document.querySelector(`[data-block-id="${targetId}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) {
        goToPrevMatch();
      } else {
        goToNextMatch();
      }
    }
  };

  // Smooth scroll to active block helper
  const scrollToActiveBlock = (smooth = true) => {
    if (activeBlockId !== null && activeBlockId !== undefined) {
      const el = document.querySelector(`[data-block-id="${activeBlockId}"]`);
      if (el) {
        isProgrammaticScrollRef.current = true;
        el.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'center' });
        setIsScrolledAway(false);
        setTimeout(() => {
          isProgrammaticScrollRef.current = false;
        }, 650);
      }
    }
  };

  // Detect manual user scrolling to pause follow-along
  useEffect(() => {
    const handleUserScroll = () => {
      if (isProgrammaticScrollRef.current) return;
      if (activeBlockId === null || activeBlockId === undefined) return;

      const el = document.querySelector(`[data-block-id="${activeBlockId}"]`);
      if (el) {
        const rect = el.getBoundingClientRect();
        // If block is scrolled off screen
        const isOffScreen = rect.bottom < 80 || rect.top > window.innerHeight - 80;
        setIsScrolledAway(isOffScreen);
      }
    };

    window.addEventListener('wheel', handleUserScroll, { passive: true });
    window.addEventListener('touchmove', handleUserScroll, { passive: true });
    return () => {
      window.removeEventListener('wheel', handleUserScroll);
      window.removeEventListener('touchmove', handleUserScroll);
    };
  }, [activeBlockId]);

  // Auto-scroll to active block when it changes externally (unless user scrolled away)
  useEffect(() => {
    if (activeBlockId !== null && activeBlockId !== undefined && !isScrolledAway) {
      scrollToActiveBlock(true);
    }
  }, [activeBlockId]);

  // Auto-resume to last_block_index on initial document render
  useEffect(() => {
    if (docData && !initialScrollDoneRef.current) {
      initialScrollDoneRef.current = true;
      const targetId = activeBlockId !== null && activeBlockId !== undefined
        ? activeBlockId
        : (docData.meta?.last_block_index || 0);

      if (targetId > 0) {
        setTimeout(() => {
          const el = document.querySelector(`[data-block-id="${targetId}"]`);
          if (el) {
            isProgrammaticScrollRef.current = true;
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(() => {
              isProgrammaticScrollRef.current = false;
            }, 650);
          }
        }, 200);
      }
    }
  }, [docData, activeBlockId]);

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

  const highlightText = (text, query, isCurrentSearchBlock) => {
    if (!query || !query.trim()) return text;
    const parts = text.split(new RegExp(`(${query.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === query.toLowerCase() ? (
        <mark
          key={i}
          className={`${
            isCurrentSearchBlock
              ? 'bg-amber-400 text-black font-semibold ring-2 ring-amber-500'
              : 'bg-amber-300/80 text-black font-medium'
          } px-0.5 rounded-xs transition-colors`}
        >
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  // Configure marked for secure, seamless in-chunk rendering
  const renderMarkdownHtml = (rawText) => {
    if (!rawText) return '';
    try {
      const parsed = marked.parse(rawText, {
        gfm: true,
        breaks: true,
      });
      return DOMPurify.sanitize(parsed, {
        ADD_ATTR: ['target', 'rel'],
      });
    } catch {
      return DOMPurify.sanitize(rawText);
    }
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
  const currentSearchTargetBlockId = matchingBlockIds[safeMatchIdx];

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
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs opacity-65 mt-0.5">
              <span className="uppercase tracking-wider font-mono text-[10px]">{meta?.source_type || 'text'}</span>
              <span>•</span>
              <span>{chunks?.length || 0} blocks</span>
              <span>•</span>
              <span>{Math.round((meta?.total_chars || 0) / 5)} words</span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3 opacity-60" />
                ~{Math.max(1, Math.round((meta?.total_chars || 0) / 1000))} min read
              </span>
              {meta?.tags && meta.tags.length > 0 && (
                <>
                  <span>•</span>
                  <div className="inline-flex items-center gap-1">
                    {meta.tags.map((t) => (
                      <span
                        key={t}
                        className="px-1.5 py-0.2 text-[10px] rounded-sm bg-indigo-500/20 text-indigo-300 font-mono"
                      >
                        #{t}
                      </span>
                    ))}
                  </div>
                </>
              )}
              {activeBlockId !== null && (
                <>
                  <span>•</span>
                  <span className="font-medium text-indigo-400">
                    Playing block {activeBlockId + 1}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-2">
          {!showSearch && (
            <button
              onClick={() => {
                setShowSearch(true);
                setTimeout(() => searchInputRef.current?.focus(), 50);
              }}
              className="p-2 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 transition text-inherit flex items-center gap-1.5 text-xs font-medium"
              title="Search Document (Cmd+F / Ctrl+F)"
            >
              <Search className="w-4 h-4" />
              <span className="hidden sm:inline">Search</span>
            </button>
          )}

          {onEdit && (
            <button
              onClick={onEdit}
              className="p-2 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 transition text-inherit flex items-center gap-1.5 text-xs font-medium border border-current/10"
              title="Edit Document Markdown"
            >
              <FileEdit className="w-4 h-4 text-indigo-400" />
              <span className="hidden sm:inline">Edit</span>
            </button>
          )}

          <button
            onClick={() => setIsDrawerOpen(true)}
            className="p-2 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 transition text-inherit flex items-center gap-1.5 text-xs font-medium border border-current/10"
            title="Display Options (Aa)"
          >
            <Type className="w-4 h-4 text-indigo-400" />
            <span className="font-serif font-bold text-sm leading-none">Aa</span>
          </button>
        </div>
      </header>

      {/* Inline Search Bar */}
      {showSearch && (
        <div className={`sticky top-[57px] z-20 border-b px-6 py-2.5 flex items-center justify-between gap-3 shadow-xs transition-colors ${
          settings.theme === 'light'
            ? 'bg-zinc-100 border-zinc-200'
            : settings.theme === 'sepia'
            ? 'bg-[#eedcb8] border-[#dfcaa3]'
            : 'bg-zinc-900 border-zinc-800'
        }`}>
          <div className="flex items-center gap-2 max-w-md w-full">
            <Search className="w-4 h-4 opacity-50 flex-shrink-0" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search text in document..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentMatchIdx(0); }}
              onKeyDown={handleSearchKeyDown}
              className="bg-transparent border-0 text-sm focus:outline-none w-full"
            />
          </div>

          <div className="flex items-center gap-2 text-xs">
            {searchQuery && (
              <span className="opacity-70 whitespace-nowrap">
                {matchingBlockIds.length > 0
                  ? `${safeMatchIdx + 1} of ${matchingBlockIds.length} blocks`
                  : 'No matches'}
              </span>
            )}
            <button
              onClick={goToPrevMatch}
              disabled={matchingBlockIds.length <= 1}
              className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-30"
              title="Previous match (Shift+Enter)"
            >
              <ChevronUp className="w-4 h-4" />
            </button>
            <button
              onClick={goToNextMatch}
              disabled={matchingBlockIds.length <= 1}
              className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-30"
              title="Next match (Enter)"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                setShowSearch(false);
                setSearchQuery('');
              }}
              className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 ml-2"
              title="Close search (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Reader Content Column */}
      <main className={`${settings.contentWidth || 'max-w-3xl'} mx-auto px-3 sm:px-6 pt-6 sm:pt-10`}>
        <div className="space-y-4">
          {chunks?.map((chunk) => {
            const isActive = activeBlockId === chunk.id;
            const isCurrentSearchBlock = currentSearchTargetBlockId === chunk.id;
            const isMatchBlock = matchingBlockIds.includes(chunk.id);

            return (
              <div
                key={chunk.id}
                data-block-id={chunk.id}
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
                className={`relative group rounded-xl p-3.5 sm:p-4 transition-all duration-150 cursor-pointer border ${
                  isCurrentSearchBlock
                    ? 'ring-2 ring-amber-400 bg-amber-500/10 border-amber-400'
                    : isActive
                    ? getActiveBlockClasses()
                    : isMatchBlock
                    ? 'border-amber-400/40 bg-amber-500/5'
                    : getBlockHoverClasses()
                }`}
              >
                {/* Desktop Left Gutter play button */}
                <div className="hidden sm:flex absolute -left-12 top-3 items-center justify-end w-10 select-none">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onSelectBlock) onSelectBlock(chunk.id);
                    }}
                    className={`w-6 h-6 rounded-full transition-all flex items-center justify-center cursor-pointer ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-400/30'
                        : 'text-zinc-500 opacity-0 group-hover:opacity-100 hover:bg-zinc-800 hover:text-zinc-200'
                    }`}
                    title={isActive && isPlaying ? 'Pause' : `Play block ${chunk.id + 1}`}
                  >
                    {isActive && isPlaying ? (
                      <Pause className="w-3 h-3 fill-current" />
                    ) : (
                      <Play className="w-3 h-3 fill-current ml-0.5" />
                    )}
                  </button>
                  {!isActive && (
                    <span className="text-[10px] font-mono tracking-tighter opacity-40 group-hover:hidden text-right w-full pr-1">
                      #{chunk.id + 1}
                    </span>
                  )}
                </div>

                {/* Mobile block header (inline play button and badge) */}
                <div className="flex sm:hidden items-center justify-between gap-2 mb-2 pb-1 border-b border-current/10 select-none">
                  <span className="text-[11px] font-mono opacity-50">
                    Block #{chunk.id + 1}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onSelectBlock) onSelectBlock(chunk.id);
                    }}
                    className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition ${
                      isActive
                        ? 'bg-indigo-600 text-white'
                        : 'bg-zinc-800/80 text-zinc-300 hover:bg-zinc-700'
                    }`}
                  >
                    {isActive && isPlaying ? (
                      <>
                        <Pause className="w-3 h-3 fill-current" />
                        <span>Pause</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3 h-3 fill-current" />
                        <span>Play</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Rendered content */}
                {searchQuery && searchQuery.trim() ? (
                  <p className="select-text whitespace-pre-wrap leading-relaxed">
                    {highlightText(chunk.text, searchQuery, isCurrentSearchBlock)}
                  </p>
                ) : (
                  <div
                    className="select-text reader-markdown leading-relaxed break-words"
                    dangerouslySetInnerHTML={{ __html: renderMarkdownHtml(chunk.text) }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </main>

      {/* Floating Follow-Along Resume Pill */}
      {isScrolledAway && activeBlockId !== null && activeBlockId !== undefined && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-30 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <button
            type="button"
            onClick={() => scrollToActiveBlock(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-full shadow-2xl transition cursor-pointer active:scale-95 border border-indigo-400/40"
          >
            <LocateFixed className="w-3.5 h-3.5 animate-pulse" />
            <span>Follow along paused • Jump to Block {activeBlockId + 1}</span>
          </button>
        </div>
      )}

      {/* Kindle Display Options Drawer */}
      <DisplaySettingsDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        settings={settings}
        onUpdateSettings={onUpdateSettings || (() => {})}
      />
    </div>
  );
}
