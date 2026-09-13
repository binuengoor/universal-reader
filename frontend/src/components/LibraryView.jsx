import React, { useState, useEffect, useMemo } from 'react';
import { 
  BookOpen, 
  Upload, 
  Link as LinkIcon, 
  FileText, 
  Trash2, 
  Clock, 
  Layers, 
  Plus, 
  Loader2, 
  AlertCircle,
  X,
  Settings,
  FileEdit,
  Search,
  CheckSquare,
  Square,
  ArrowUpDown,
  Tag,
  Headphones,
  Sparkles,
  Star,
  Archive,
  Inbox,
  HelpCircle,
  Type
} from 'lucide-react';
import TagInput from './TagInput';
import OmniIntakeModal from './OmniIntakeModal';
import { getTheme } from '../utils/theme';

export default function LibraryView({ onSelectDocument, onEditDocument, onOpenSettings, onOpenShortcuts, onOpenDisplaySettings, initialShareData, onClearShareData, theme = 'dark' }) {
  const t = getTheme(theme);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Search, Tags & Sorting
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState('all');
  const [statusTab, setStatusTab] = useState('all'); // 'all' | 'inbox' | 'reading' | 'archived' | 'favorites'
  const [sortBy, setSortBy] = useState('newest'); // 'newest' | 'oldest' | 'title' | 'length'

  const counts = useMemo(() => {
    let inbox = 0;
    let reading = 0;
    let archived = 0;
    let favorites = 0;
    documents.forEach((d) => {
      const s = d.status || 'inbox';
      if (s === 'inbox') inbox++;
      else if (s === 'reading') reading++;
      else if (s === 'archived') archived++;
      if (d.favorite) favorites++;
    });
    return { all: documents.length, inbox, reading, archived, favorites };
  }, [documents]);

  const handleToggleFavorite = async (docId, currentFavorite, e) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/documents/${docId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ favorite: !currentFavorite }),
      });
      if (res.ok) {
        setDocuments((prev) =>
          prev.map((d) => (d.id === docId ? { ...d, favorite: !currentFavorite } : d))
        );
      }
    } catch {
      // ignore
    }
  };

  const handleToggleArchive = async (docId, currentStatus, e) => {
    e.stopPropagation();
    const newStatus = currentStatus === 'archived' ? 'inbox' : 'archived';
    try {
      const res = await fetch(`/api/documents/${docId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setDocuments((prev) =>
          prev.map((d) => (d.id === docId ? { ...d, status: newStatus } : d))
        );
      }
    } catch {
      // ignore
    }
  };

  // Bulk selection
  const [selectedDocIds, setSelectedDocIds] = useState(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // Consolidated Omni-Intake modal
  const [isOmniModalOpen, setIsOmniModalOpen] = useState(false);

  // Handle incoming web share data
  useEffect(() => {
    if (initialShareData) {
      setIsOmniModalOpen(true);
    }
  }, [initialShareData]);

  const fetchDocuments = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      setError(null);
      const res = await fetch('/api/documents');
      if (!res.ok) throw new Error('Failed to load documents');
      const data = await res.json();
      setDocuments(data);
    } catch (err) {
      setError(err.message || 'Error fetching library');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    const load = async () => {
      try {
        const res = await fetch('/api/documents');
        if (!res.ok) throw new Error('Failed to load documents');
        const data = await res.json();
        if (!ignore) setDocuments(data);
      } catch (err) {
        if (!ignore) setError(err.message || 'Error fetching library');
      } finally {
        if (!ignore) setLoading(false);
      }
    };
    load();
    return () => { ignore = true; };
  }, []);

  // Compute all unique tags with count
  const allTagsWithCount = useMemo(() => {
    const map = new Map();
    documents.forEach((doc) => {
      if (doc.tags && Array.isArray(doc.tags)) {
        doc.tags.forEach((t) => {
          map.set(t, (map.get(t) || 0) + 1);
        });
      }
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [documents]);

  // Filter & Sort Documents
  const filteredAndSortedDocuments = useMemo(() => {
    return documents
      .filter((doc) => {
        // Status lifecycle / favorites filter
        if (statusTab === 'favorites') {
          if (!doc.favorite) return false;
        } else if (statusTab !== 'all') {
          const s = doc.status || 'inbox';
          if (s !== statusTab) return false;
        }

        // Tag filter
        if (selectedTag !== 'all') {
          if (!doc.tags || !doc.tags.includes(selectedTag)) {
            return false;
          }
        }
        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const title = (doc.title || '').toLowerCase();
          const excerpt = (doc.excerpt || '').toLowerCase();
          const tagsMatch = doc.tags && doc.tags.some((t) => t.toLowerCase().includes(q));
          return title.includes(q) || excerpt.includes(q) || tagsMatch;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'newest') {
          return new Date(b.created_at || 0) - new Date(a.created_at || 0);
        } else if (sortBy === 'oldest') {
          return new Date(a.created_at || 0) - new Date(b.created_at || 0);
        } else if (sortBy === 'title') {
          return (a.title || '').localeCompare(b.title || '');
        } else if (sortBy === 'length') {
          return (b.total_chars || 0) - (a.total_chars || 0);
        }
        return 0;
      });
  }, [documents, statusTab, selectedTag, searchQuery, sortBy]);

  // Bulk selection helpers
  const toggleSelectDoc = (id, e) => {
    e.stopPropagation();
    setSelectedDocIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAllVisible = () => {
    if (selectedDocIds.size === filteredAndSortedDocuments.length && filteredAndSortedDocuments.length > 0) {
      setSelectedDocIds(new Set());
    } else {
      setSelectedDocIds(new Set(filteredAndSortedDocuments.map((d) => d.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedDocIds.size === 0) return;
    const count = selectedDocIds.size;
    if (!window.confirm(`Are you sure you want to delete ${count} selected document${count > 1 ? 's' : ''}?`)) {
      return;
    }

    try {
      setIsBulkDeleting(true);
      const res = await fetch('/api/documents/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doc_ids: Array.from(selectedDocIds) }),
      });
      if (!res.ok) throw new Error('Bulk delete failed');

      setDocuments((prev) => prev.filter((d) => !selectedDocIds.has(d.id)));
      setSelectedDocIds(new Set());
    } catch (err) {
      alert(err.message || 'Error during bulk delete');
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const handleDelete = async (docId, title, e) => {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to delete "${title}"?`)) return;

    try {
      const res = await fetch(`/api/documents/${docId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete document');
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
      setSelectedDocIds((prev) => {
        const next = new Set(prev);
        next.delete(docId);
        return next;
      });
    } catch (err) {
      alert(err.message || 'Could not delete document');
    }
  };

  const formatDate = (isoStr) => {
    if (!isoStr) return '';
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return isoStr;
    }
  };

  const estimateListenTime = (totalChars) => {
    if (!totalChars) return '< 1 min';
    // ~5 chars per word, ~150 words per minute speech rate
    const words = totalChars / 5;
    const minutes = Math.max(1, Math.round(words / 150));
    return `${minutes} min`;
  };

  const getReadingProgress = (docId, totalBlocks) => {
    if (!totalBlocks || totalBlocks <= 0) return 0;
    try {
      const saved = localStorage.getItem(`read_progress_${docId}`);
      if (saved) {
        const lastBlock = parseInt(saved, 10);
        return Math.min(100, Math.round(((lastBlock + 1) / totalBlocks) * 100));
      }
    } catch {
      // ignore
    }
    return 0;
  };

  const getBadgeColor = (type) => {
    switch (type) {
      case 'pdf':
        return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'epub':
        return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      case 'docx':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'url':
        return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
      default:
        return 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20';
    }
  };

  return (
    <div className={`min-h-screen ${t.page} pb-20`}>
      {/* Top Navigation */}
      <header className={`${t.header} sticky top-0 z-30 px-3 sm:px-6 header-safe pb-3 sm:pb-4`}>
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="p-1.5 sm:p-2 bg-indigo-500/20 border border-indigo-500/30 rounded-xl text-indigo-400">
              <BookOpen className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <h1 className={`text-base sm:text-xl font-bold tracking-tight ${t.headerBrand}`}>Universal Reader</h1>
              <p className={`text-[10px] sm:text-xs ${t.headerSub}`}>Local TTS & Semantic Reader</p>
            </div>
          </div>

          {/* Consolidated Omni-Intake Action */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => setIsOmniModalOpen(true)}
              className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-semibold rounded-lg transition shadow-xs cursor-pointer active:scale-95"
              title="Add Document (Paste file, URL, or notes)"
            >
              <Plus className="w-4 h-4" />
              <span>Add Document</span>
            </button>
            {onOpenShortcuts && (
              <button
                type="button"
                onClick={onOpenShortcuts}
                className={`p-1.5 sm:p-2 rounded-lg transition border ml-0.5 cursor-pointer ${t.btnSecondary}`}
                title="Keyboard Shortcuts (?)"
              >
                <HelpCircle className="w-4 h-4" />
              </button>
            )}
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
            {onOpenSettings && (
              <button
                type="button"
                onClick={onOpenSettings}
                className={`p-1.5 sm:p-2 rounded-lg transition border cursor-pointer ${t.btnSecondary}`}
                title="TTS & Service Settings"
              >
                <Settings className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 pt-6">
        {/* Search, Filter & Bulk Action Toolbar */}
        <div className="space-y-4 mb-6">
          {/* Status Tabs (All, Inbox, Reading, Favorites, Archived) */}
          <div className={`flex items-center gap-1.5 overflow-x-auto pb-1 border-b ${t.divider} scrollbar-none`}>
            {[
              { id: 'all', label: 'All', count: counts.all },
              { id: 'inbox', label: 'Inbox', count: counts.inbox, icon: Inbox },
              { id: 'reading', label: 'Reading', count: counts.reading, icon: BookOpen },
              { id: 'favorites', label: 'Starred', count: counts.favorites, icon: Star },
              { id: 'archived', label: 'Archived', count: counts.archived, icon: Archive },
            ].map((tab) => {
              const isActive = statusTab === tab.id;
              const IconComponent = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition cursor-pointer flex-shrink-0 border ${
                    isActive
                      ? t.tabActive
                      : `${t.tabInactive} border-transparent`
                  }`}
                >
                  {IconComponent && (
                    <IconComponent
                      className={`w-3.5 h-3.5 ${
                        tab.id === 'favorites' && isActive
                          ? 'text-amber-500 fill-amber-500'
                          : tab.id === 'favorites'
                          ? 'text-amber-500'
                          : t.iconMuted
                      }`}
                    />
                  )}
                  <span>{tab.label}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                      isActive
                        ? (theme === 'sepia' ? 'bg-[#dfcaa3] text-[#2e2013]' : theme === 'light' ? 'bg-zinc-200 text-zinc-900' : 'bg-zinc-700 text-zinc-200')
                        : (theme === 'sepia' ? 'bg-[#ede0c8] text-[#7d654a]' : theme === 'light' ? 'bg-zinc-100 text-zinc-600' : 'bg-zinc-800/60 text-zinc-500')
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[240px] max-w-md">
              <Search className={`w-4 h-4 absolute left-3 top-2.5 ${t.iconMuted}`} />
              <input
                type="text"
                placeholder="Search by title, excerpt, or #tag..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full pl-9 pr-8 py-2 rounded-xl text-xs transition ${t.input}`}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className={`absolute right-2.5 top-2.5 ${t.iconMuted} hover:opacity-100 cursor-pointer`}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Sort & Bulk Select Toolbar */}
            <div className="flex items-center gap-2">
              <div className={`flex items-center rounded-xl px-2.5 py-1.5 text-xs ${t.btnSecondary}`}>
                <ArrowUpDown className={`w-3.5 h-3.5 mr-1.5 ${t.iconMuted}`} />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="bg-transparent text-xs focus:outline-none cursor-pointer"
                >
                  <option value="newest" className={theme === 'sepia' ? 'bg-[#fbf0d9] text-[#3b2a1a]' : theme === 'light' ? 'bg-white text-zinc-900' : 'bg-zinc-900 text-zinc-100'}>Newest First</option>
                  <option value="oldest" className={theme === 'sepia' ? 'bg-[#fbf0d9] text-[#3b2a1a]' : theme === 'light' ? 'bg-white text-zinc-900' : 'bg-zinc-900 text-zinc-100'}>Oldest First</option>
                  <option value="title" className={theme === 'sepia' ? 'bg-[#fbf0d9] text-[#3b2a1a]' : theme === 'light' ? 'bg-white text-zinc-900' : 'bg-zinc-900 text-zinc-100'}>Title (A–Z)</option>
                  <option value="length" className={theme === 'sepia' ? 'bg-[#fbf0d9] text-[#3b2a1a]' : theme === 'light' ? 'bg-white text-zinc-900' : 'bg-zinc-900 text-zinc-100'}>Length (Longest)</option>
                </select>
              </div>

              {filteredAndSortedDocuments.length > 0 && (
                <button
                  type="button"
                  onClick={handleSelectAllVisible}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer ${t.btnSecondary}`}
                  title="Select All Visible"
                >
                  {selectedDocIds.size === filteredAndSortedDocuments.length && filteredAndSortedDocuments.length > 0 ? (
                    <CheckSquare className="w-3.5 h-3.5 text-indigo-500" />
                  ) : (
                    <Square className={`w-3.5 h-3.5 ${t.iconMuted}`} />
                  )}
                  <span>Select All</span>
                </button>
              )}

              {selectedDocIds.size > 0 && (
                <button
                  type="button"
                  onClick={handleBulkDelete}
                  disabled={isBulkDeleting}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-500 dark:text-red-300 border border-red-500/30 rounded-xl text-xs font-semibold transition cursor-pointer"
                >
                  {isBulkDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  <span>Delete Selected ({selectedDocIds.size})</span>
                </button>
              )}
            </div>
          </div>

          {/* Tag Filter Pills */}
          {allTagsWithCount.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              <span className={`text-xs ${t.cardMeta} flex items-center gap-1 mr-1 flex-shrink-0`}>
                <Tag className="w-3 h-3" /> Tags:
              </span>
              <button
                type="button"
                onClick={() => setSelectedTag('all')}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer flex-shrink-0 border ${
                  selectedTag === 'all'
                    ? t.tagActive
                    : t.tag
                }`}
              >
                All ({documents.length})
              </button>
              {allTagsWithCount.map(([tag, count]) => {
                const isActive = selectedTag === tag;
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setSelectedTag(isActive ? 'all' : tag)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer flex-shrink-0 border ${
                      isActive
                        ? t.tagActive
                        : t.tag
                    }`}
                  >
                    #{tag} <span className="text-[10px] opacity-70">({count})</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Loading / Error States */}
        {loading && (
          <div className={`flex flex-col items-center justify-center py-20 gap-3 ${t.cardMeta}`}>
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            <p>Loading your library...</p>
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-950/40 border border-red-800/50 rounded-xl text-red-300 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && filteredAndSortedDocuments.length === 0 && (
          <div className={`border border-dashed rounded-2xl p-12 text-center flex flex-col items-center justify-center ${t.card}`}>
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 ${t.badge}`}>
              <Layers className="w-7 h-7" />
            </div>
            <h3 className={`text-lg font-medium ${t.cardTitle}`}>
              {documents.length === 0 ? 'No documents yet' : 'No matching documents'}
            </h3>
            <p className={`text-sm max-w-md mt-1 mb-6 ${t.cardSnippet}`}>
              {documents.length === 0
                ? 'Add a PDF, ePub, Word document, web article URL, or paste Markdown text to start reading and listening.'
                : 'Try clearing your search query or selecting a different tag filter.'}
            </p>
            {documents.length === 0 ? (
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsOmniModalOpen(true)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl transition shadow-md cursor-pointer active:scale-95"
                >
                  <Plus className="w-4 h-4" /> Add Document
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => { setSearchQuery(''); setSelectedTag('all'); }}
                className={`px-4 py-2 text-xs font-semibold rounded-lg transition cursor-pointer ${t.btnSecondary}`}
              >
                Reset Filters
              </button>
            )}
          </div>
        )}

        {/* Document Grid */}
        {!loading && !error && filteredAndSortedDocuments.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredAndSortedDocuments.map((doc) => {
              const isSelected = selectedDocIds.has(doc.id);
              const readProgress = getReadingProgress(doc.id, doc.block_count);

              return (
                <div
                  key={doc.id}
                  onClick={() => onSelectDocument && onSelectDocument(doc.id)}
                  className={`group relative rounded-2xl p-5 transition cursor-pointer flex flex-col justify-between shadow-xs hover:shadow-md ${t.card} ${
                    isSelected ? 'ring-2 ring-indigo-500 border-indigo-500' : ''
                  }`}
                >
                  <div>
                    {/* Card Top Row: Checkbox, Badge & Actions */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => toggleSelectDoc(doc.id, e)}
                          className={`${t.iconMuted} hover:text-indigo-500 transition cursor-pointer`}
                          title="Select document"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-indigo-500" />
                          ) : (
                            <Square className="w-4 h-4 opacity-40 group-hover:opacity-100" />
                          )}
                        </button>
                        <span
                          className={`text-xs px-2.5 py-0.5 rounded-full uppercase font-semibold tracking-wider border ${getBadgeColor(
                            doc.source_type
                          )}`}
                        >
                          {doc.source_type || 'text'}
                        </span>
                        {doc.status === 'reading' && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-amber-500/10 text-amber-500 border border-amber-500/20">
                            Reading
                          </span>
                        )}
                        {doc.status === 'archived' && (
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${t.badge}`}>
                            Archived
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        {/* Quick Favorite/Star Toggle */}
                        <button
                          type="button"
                          title={doc.favorite ? 'Unstar document' : 'Star document'}
                          onClick={(e) => handleToggleFavorite(doc.id, !!doc.favorite, e)}
                          className={`p-1.5 rounded-lg transition cursor-pointer ${
                            doc.favorite
                              ? 'text-amber-500 hover:text-amber-400 hover:bg-amber-500/10'
                              : `${t.iconMuted} hover:opacity-100 opacity-0 group-hover:opacity-100`
                          }`}
                        >
                          <Star className={`w-4 h-4 ${doc.favorite ? 'fill-amber-500' : ''}`} />
                        </button>

                        {/* Quick Archive Toggle */}
                        <button
                          type="button"
                          title={doc.status === 'archived' ? 'Unarchive (move to inbox)' : 'Archive document'}
                          onClick={(e) => handleToggleArchive(doc.id, doc.status, e)}
                          className={`p-1.5 rounded-lg transition cursor-pointer ${
                            doc.status === 'archived'
                              ? 'text-indigo-500 hover:text-indigo-400 hover:bg-indigo-500/10'
                              : `${t.iconMuted} hover:opacity-100 opacity-0 group-hover:opacity-100`
                          }`}
                        >
                          <Archive className="w-4 h-4" />
                        </button>

                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                          {onEditDocument && (
                            <button
                              type="button"
                              title="Edit document"
                              onClick={(e) => {
                                e.stopPropagation();
                                onEditDocument(doc.id);
                              }}
                              className={`p-1.5 ${t.iconMuted} hover:text-indigo-500 hover:bg-indigo-500/10 rounded-lg transition cursor-pointer`}
                            >
                              <FileEdit className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            type="button"
                            title="Delete document"
                            onClick={(e) => handleDelete(doc.id, doc.title, e)}
                            className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>

                    <h3 className={`font-semibold line-clamp-2 mb-2 transition ${t.cardTitle}`}>
                      {doc.title}
                    </h3>

                    <p className={`text-xs line-clamp-3 leading-relaxed mb-3 ${t.cardSnippet}`}>
                      {doc.synopsis || doc.excerpt || 'No preview available.'}
                    </p>

                    {/* Tags */}
                    {doc.tags && doc.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {doc.tags.map((tg) => (
                          <span
                            key={tg}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedTag(tg);
                            }}
                            className={`text-[11px] px-2 py-0.5 rounded-md transition ${t.badge} hover:opacity-80`}
                          >
                            #{tg}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    {/* Reading progress bar */}
                    {readProgress > 0 && (
                      <div className="mb-3">
                        <div className={`flex items-center justify-between text-[10px] mb-1 font-mono ${t.cardMeta}`}>
                          <span>Progress</span>
                          <span>{readProgress}% read</span>
                        </div>
                        <div className={`w-full h-1 rounded-full overflow-hidden ${t.progressBarBg}`}>
                          <div
                            className="h-full bg-indigo-500 rounded-full"
                            style={{ width: `${readProgress}%` }}
                          />
                        </div>
                      </div>
                    )}

                    <div className={`pt-3 border-t flex items-center justify-between text-xs ${t.divider} ${t.cardMeta}`}>
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{formatDate(doc.created_at)}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1" title="Estimated Listening Time">
                          <Headphones className="w-3.5 h-3.5 text-indigo-500" />
                          <span>~{estimateListenTime(doc.total_chars)}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Layers className="w-3.5 h-3.5" />
                          <span>{doc.block_count || 0} blk</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Unified Omni-Intake Modal */}
      <OmniIntakeModal
        isOpen={isOmniModalOpen}
        onClose={() => {
          setIsOmniModalOpen(false);
          if (onClearShareData) onClearShareData();
        }}
        onSuccess={async (newDocId) => {
          await fetchDocuments();
          if (newDocId && onSelectDocument) {
            onSelectDocument(newDocId);
          }
        }}
        availableTags={allTagsWithCount}
        initialShareData={initialShareData}
        theme={theme}
      />
    </div>
  );
}
