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
  Inbox
} from 'lucide-react';
import TagInput from './TagInput';

export default function LibraryView({ onSelectDocument, onEditDocument, onOpenSettings }) {
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

  // Intake modals
  const [activeModal, setActiveModal] = useState(null); // 'upload' | 'url' | 'scratch'
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState(null);

  // Form states
  const [fileToUpload, setFileToUpload] = useState(null);
  const [customTitle, setCustomTitle] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [scratchContent, setScratchContent] = useState('');
  const [modalTags, setModalTags] = useState([]);

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

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!fileToUpload) return;

    setIsSubmitting(true);
    setModalError(null);
    try {
      const formData = new FormData();
      formData.append('file', fileToUpload);
      if (customTitle.trim()) {
        formData.append('title', customTitle.trim());
      }
      if (modalTags && modalTags.length > 0) {
        formData.append('tags', modalTags.join(','));
      }
      const res = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Upload failed');

      closeModal();
      await fetchDocuments();
      if (data.id && onSelectDocument) {
        onSelectDocument(data.id);
      }
    } catch (err) {
      setModalError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUrlSubmit = async (e) => {
    e.preventDefault();
    if (!urlInput.trim()) return;

    setIsSubmitting(true);
    setModalError(null);
    try {
      const res = await fetch('/api/documents/url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: urlInput.trim(),
          title: customTitle.trim() || undefined,
          tags: modalTags.length > 0 ? modalTags : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Extraction failed');

      closeModal();
      await fetchDocuments();
      if (data.id && onSelectDocument) {
        onSelectDocument(data.id);
      }
    } catch (err) {
      setModalError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleScratchSubmit = async (e) => {
    e.preventDefault();
    if (!scratchContent.trim()) return;

    setIsSubmitting(true);
    setModalError(null);
    try {
      const res = await fetch('/api/documents/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: scratchContent.trim(),
          title: customTitle.trim() || undefined,
          tags: modalTags.length > 0 ? modalTags : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Creation failed');

      closeModal();
      await fetchDocuments();
      if (data.id && onSelectDocument) {
        onSelectDocument(data.id);
      }
    } catch (err) {
      setModalError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const closeModal = () => {
    setActiveModal(null);
    setModalError(null);
    setFileToUpload(null);
    setCustomTitle('');
    setUrlInput('');
    setScratchContent('');
    setModalTags([]);
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
    <div className="min-h-screen bg-zinc-950 text-zinc-100 pb-20">
      {/* Top Navigation */}
      <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur sticky top-0 z-30 px-3 sm:px-6 py-3 sm:py-4">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="p-1.5 sm:p-2 bg-indigo-500/20 border border-indigo-500/30 rounded-xl text-indigo-400">
              <BookOpen className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <h1 className="text-base sm:text-xl font-bold tracking-tight">Universal Reader</h1>
              <p className="text-[10px] sm:text-xs text-zinc-400">Local TTS & Semantic Reader</p>
            </div>
          </div>

          {/* Quick Intake Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => setActiveModal('upload')}
              className="flex items-center gap-1 sm:gap-2 px-2.5 sm:px-3.5 py-1.5 sm:py-2 bg-zinc-800 hover:bg-zinc-700 text-xs sm:text-sm font-medium rounded-lg transition border border-zinc-700 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-zinc-300" />
              <span className="hidden sm:inline">Upload File</span>
              <span className="inline sm:hidden">Upload</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveModal('url')}
              className="flex items-center gap-1 sm:gap-2 px-2.5 sm:px-3.5 py-1.5 sm:py-2 bg-zinc-800 hover:bg-zinc-700 text-xs sm:text-sm font-medium rounded-lg transition border border-zinc-700 cursor-pointer"
            >
              <LinkIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-400" />
              <span className="hidden sm:inline">Ingest URL</span>
              <span className="inline sm:hidden">URL</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveModal('scratch')}
              className="flex items-center gap-1 sm:gap-2 px-2.5 sm:px-3.5 py-1.5 sm:py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-medium rounded-lg transition shadow-sm cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">New Text</span>
              <span className="inline sm:hidden">New</span>
            </button>
            {onOpenSettings && (
              <button
                type="button"
                onClick={onOpenSettings}
                className="p-1.5 sm:p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-lg transition border border-zinc-700 ml-0.5 cursor-pointer"
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
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-zinc-800/80 scrollbar-none">
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
                      ? 'bg-zinc-800 text-white border-zinc-700 shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200 border-transparent hover:bg-zinc-900/60'
                  }`}
                >
                  {IconComponent && (
                    <IconComponent
                      className={`w-3.5 h-3.5 ${
                        tab.id === 'favorites' && isActive
                          ? 'text-amber-400 fill-amber-400'
                          : tab.id === 'favorites'
                          ? 'text-amber-400'
                          : 'text-zinc-400'
                      }`}
                    />
                  )}
                  <span>{tab.label}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                      isActive ? 'bg-zinc-700 text-zinc-200' : 'bg-zinc-800/60 text-zinc-500'
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
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-zinc-400" />
              <input
                type="text"
                placeholder="Search by title, excerpt, or #tag..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 transition"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2.5 text-zinc-400 hover:text-zinc-200 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Sort & Bulk Select Toolbar */}
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-xl px-2.5 py-1.5 text-xs text-zinc-300">
                <ArrowUpDown className="w-3.5 h-3.5 text-zinc-400 mr-1.5" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="bg-transparent text-xs text-zinc-200 focus:outline-none cursor-pointer"
                >
                  <option value="newest" className="bg-zinc-900">Newest First</option>
                  <option value="oldest" className="bg-zinc-900">Oldest First</option>
                  <option value="title" className="bg-zinc-900">Title (A–Z)</option>
                  <option value="length" className="bg-zinc-900">Length (Longest)</option>
                </select>
              </div>

              {filteredAndSortedDocuments.length > 0 && (
                <button
                  type="button"
                  onClick={handleSelectAllVisible}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-xs font-medium text-zinc-300 transition cursor-pointer"
                  title="Select All Visible"
                >
                  {selectedDocIds.size === filteredAndSortedDocuments.length && filteredAndSortedDocuments.length > 0 ? (
                    <CheckSquare className="w-3.5 h-3.5 text-indigo-400" />
                  ) : (
                    <Square className="w-3.5 h-3.5 text-zinc-400" />
                  )}
                  <span>Select All</span>
                </button>
              )}

              {selectedDocIds.size > 0 && (
                <button
                  type="button"
                  onClick={handleBulkDelete}
                  disabled={isBulkDeleting}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/30 rounded-xl text-xs font-semibold transition cursor-pointer"
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
              <span className="text-xs text-zinc-500 flex items-center gap-1 mr-1 flex-shrink-0">
                <Tag className="w-3 h-3" /> Tags:
              </span>
              <button
                type="button"
                onClick={() => setSelectedTag('all')}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer flex-shrink-0 border ${
                  selectedTag === 'all'
                    ? 'bg-indigo-600 border-indigo-500 text-white'
                    : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
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
                        ? 'bg-indigo-600 border-indigo-500 text-white'
                        : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                    }`}
                  >
                    #{tag} <span className="text-[10px] opacity-60">({count})</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Loading / Error States */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 text-zinc-500 gap-3">
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
          <div className="border border-dashed border-zinc-800 rounded-2xl p-12 text-center flex flex-col items-center justify-center bg-zinc-900/20">
            <div className="w-14 h-14 rounded-2xl bg-zinc-800/80 flex items-center justify-center text-zinc-400 mb-4">
              <Layers className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-medium text-zinc-200">
              {documents.length === 0 ? 'No documents yet' : 'No matching documents'}
            </h3>
            <p className="text-sm text-zinc-400 max-w-md mt-1 mb-6">
              {documents.length === 0
                ? 'Add a PDF, ePub, Word document, web article URL, or paste Markdown text to start reading and listening.'
                : 'Try clearing your search query or selecting a different tag filter.'}
            </p>
            {documents.length === 0 ? (
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setActiveModal('upload')}
                  className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-sm font-medium rounded-lg transition border border-zinc-700 cursor-pointer"
                >
                  <Upload className="w-4 h-4" /> Upload Document
                </button>
                <button
                  type="button"
                  onClick={() => setActiveModal('url')}
                  className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-sm font-medium rounded-lg transition border border-zinc-700 cursor-pointer"
                >
                  <LinkIcon className="w-4 h-4 text-purple-400" /> Ingest Article URL
                </button>
                <button
                  type="button"
                  onClick={() => setActiveModal('scratch')}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition cursor-pointer"
                >
                  <FileText className="w-4 h-4" /> Paste Text
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => { setSearchQuery(''); setSelectedTag('all'); }}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold rounded-lg text-zinc-200 transition cursor-pointer"
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
                  className={`group relative bg-zinc-900/60 hover:bg-zinc-900 border rounded-2xl p-5 transition cursor-pointer flex flex-col justify-between shadow-sm hover:shadow-md ${
                    isSelected ? 'border-indigo-500 ring-2 ring-indigo-500/30' : 'border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  <div>
                    {/* Card Top Row: Checkbox, Badge & Actions */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => toggleSelectDoc(doc.id, e)}
                          className="text-zinc-500 hover:text-indigo-400 transition cursor-pointer"
                          title="Select document"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-indigo-400" />
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
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            Reading
                          </span>
                        )}
                        {doc.status === 'archived' && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-zinc-800 text-zinc-400 border border-zinc-700">
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
                              ? 'text-amber-400 hover:text-amber-300 hover:bg-amber-400/10'
                              : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 opacity-0 group-hover:opacity-100'
                          }`}
                        >
                          <Star className={`w-4 h-4 ${doc.favorite ? 'fill-amber-400' : ''}`} />
                        </button>

                        {/* Quick Archive Toggle */}
                        <button
                          type="button"
                          title={doc.status === 'archived' ? 'Unarchive (move to inbox)' : 'Archive document'}
                          onClick={(e) => handleToggleArchive(doc.id, doc.status, e)}
                          className={`p-1.5 rounded-lg transition cursor-pointer ${
                            doc.status === 'archived'
                              ? 'text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10'
                              : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 opacity-0 group-hover:opacity-100'
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
                              className="p-1.5 text-zinc-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition cursor-pointer"
                            >
                              <FileEdit className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            type="button"
                            title="Delete document"
                            onClick={(e) => handleDelete(doc.id, doc.title, e)}
                            className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>

                    <h3 className="font-semibold text-zinc-100 group-hover:text-indigo-400 transition line-clamp-2 mb-2">
                      {doc.title}
                    </h3>

                    <p className="text-xs text-zinc-400 line-clamp-3 leading-relaxed mb-3">
                      {doc.excerpt || 'No preview available.'}
                    </p>

                    {/* Tags */}
                    {doc.tags && doc.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {doc.tags.map((t) => (
                          <span
                            key={t}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedTag(t);
                            }}
                            className="text-[11px] px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-400 hover:bg-indigo-500/20 hover:text-indigo-300 transition"
                          >
                            #{t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    {/* Reading progress bar */}
                    {readProgress > 0 && (
                      <div className="mb-3">
                        <div className="flex items-center justify-between text-[10px] text-zinc-500 mb-1 font-mono">
                          <span>Progress</span>
                          <span>{readProgress}% read</span>
                        </div>
                        <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-indigo-500 rounded-full"
                            style={{ width: `${readProgress}%` }}
                          />
                        </div>
                      </div>
                    )}

                    <div className="pt-3 border-t border-zinc-800/60 flex items-center justify-between text-xs text-zinc-500">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{formatDate(doc.created_at)}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1" title="Estimated Listening Time">
                          <Headphones className="w-3.5 h-3.5 text-indigo-400" />
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

      {/* Upload Modal */}
      {activeModal === 'upload' && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <button
              type="button"
              onClick={closeModal}
              className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-200 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-bold text-zinc-100 mb-1">Upload Document</h3>
            <p className="text-xs text-zinc-400 mb-4">Supported formats: PDF, DOCX, ePub, Markdown (.md), and TXT.</p>

            {modalError && (
              <div className="mb-4 p-3 bg-red-950/50 border border-red-800 rounded-lg text-xs text-red-300">
                {modalError}
              </div>
            )}

            <form onSubmit={handleUploadSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Select File</label>
                <input
                  type="file"
                  required
                  accept=".pdf,.docx,.epub,.txt,.md"
                  onChange={(e) => setFileToUpload(e.target.files[0] || null)}
                  className="w-full text-xs text-zinc-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-zinc-800 file:text-zinc-200 hover:file:bg-zinc-700 cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Optional Title Override</label>
                <input
                  type="text"
                  placeholder="e.g. My Important Article (AI generated if blank)"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-800/80 border border-zinc-700 rounded-lg text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Category Tags (Max 50 Global)</label>
                <TagInput
                  tags={modalTags}
                  onChange={setModalTags}
                  availableTags={allTagsWithCount}
                  placeholder="Choose or create category (AI generated if blank)..."
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-sm font-medium rounded-lg text-zinc-300 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!fileToUpload || isSubmitting}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-sm font-medium rounded-lg text-white transition cursor-pointer"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  Upload & Process
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* URL Modal */}
      {activeModal === 'url' && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <button
              type="button"
              onClick={closeModal}
              className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-200 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-bold text-zinc-100 mb-1">Ingest Web Article</h3>
            <p className="text-xs text-zinc-400 mb-4">Extract clean article text and metadata via trafilatura.</p>

            {modalError && (
              <div className="mb-4 p-3 bg-red-950/50 border border-red-800 rounded-lg text-xs text-red-300">
                {modalError}
              </div>
            )}

            <form onSubmit={handleUrlSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Article URL</label>
                <input
                  type="url"
                  required
                  placeholder="https://example.com/article"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-800/80 border border-zinc-700 rounded-lg text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Optional Title Override</label>
                <input
                  type="text"
                  placeholder="Auto-extracted or AI-generated if blank"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-800/80 border border-zinc-700 rounded-lg text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Category Tags (Max 50 Global)</label>
                <TagInput
                  tags={modalTags}
                  onChange={setModalTags}
                  availableTags={allTagsWithCount}
                  placeholder="Select or type category (AI generated if blank)..."
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-sm font-medium rounded-lg text-zinc-300 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!urlInput.trim() || isSubmitting}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-sm font-medium rounded-lg text-white transition cursor-pointer"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <LinkIcon className="w-4 h-4" />}
                  Fetch & Parse
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Scratchpad Modal */}
      {activeModal === 'scratch' && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative">
            <button
              type="button"
              onClick={closeModal}
              className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-200 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-bold text-zinc-100 mb-1">Paste or Write Text</h3>
            <p className="text-xs text-zinc-400 mb-4">Paste notes, transcripts, or raw text to chunk and listen.</p>

            {modalError && (
              <div className="mb-4 p-3 bg-red-950/50 border border-red-800 rounded-lg text-xs text-red-300">
                {modalError}
              </div>
            )}

            <form onSubmit={handleScratchSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Title (Optional)</label>
                <input
                  type="text"
                  placeholder="Doc title (AI generated if blank)"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-800/80 border border-zinc-700 rounded-lg text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Category Tags (Max 50 Global)</label>
                <TagInput
                  tags={modalTags}
                  onChange={setModalTags}
                  availableTags={allTagsWithCount}
                  placeholder="Select or type category (AI generated if blank)..."
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Text Content</label>
                <textarea
                  required
                  rows={8}
                  placeholder="Paste your markdown or text here..."
                  value={scratchContent}
                  onChange={(e) => setScratchContent(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-800/80 border border-zinc-700 rounded-lg text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 resize-none font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-sm font-medium rounded-lg text-zinc-300 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!scratchContent.trim() || isSubmitting}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-sm font-medium rounded-lg text-white transition cursor-pointer"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Save to Library
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
