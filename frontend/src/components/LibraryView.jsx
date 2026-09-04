import React, { useState, useEffect } from 'react';
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
  X
} from 'lucide-react';

export default function LibraryView({ onSelectDocument }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Intake modals
  const [activeModal, setActiveModal] = useState(null); // 'upload' | 'url' | 'scratch'
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState(null);

  // Form states
  const [fileToUpload, setFileToUpload] = useState(null);
  const [customTitle, setCustomTitle] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [scratchContent, setScratchContent] = useState('');

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

  const handleDelete = async (docId, title, e) => {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to delete "${title}"?`)) return;

    try {
      const res = await fetch(`/api/documents/${docId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete document');
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
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
  };

  const formatDate = (isoStr) => {
    if (!isoStr) return '';
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoStr;
    }
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
    <div className="min-h-screen bg-zinc-950 text-zinc-100 pb-16">
      {/* Top Navigation */}
      <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur sticky top-0 z-30 px-6 py-4">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/20 border border-indigo-500/30 rounded-xl text-indigo-400">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Universal Reader</h1>
              <p className="text-xs text-zinc-400">Local TTS & Semantic Reader</p>
            </div>
          </div>

          {/* Quick Intake Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveModal('upload')}
              className="flex items-center gap-2 px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-sm font-medium rounded-lg transition border border-zinc-700"
            >
              <Upload className="w-4 h-4 text-zinc-300" />
              Upload File
            </button>
            <button
              onClick={() => setActiveModal('url')}
              className="flex items-center gap-2 px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-sm font-medium rounded-lg transition border border-zinc-700"
            >
              <LinkIcon className="w-4 h-4 text-purple-400" />
              Ingest URL
            </button>
            <button
              onClick={() => setActiveModal('scratch')}
              className="flex items-center gap-2 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition shadow-sm"
            >
              <Plus className="w-4 h-4" />
              New Text
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 pt-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-semibold">Library</h2>
            <p className="text-sm text-zinc-400">
              {documents.length} document{documents.length === 1 ? '' : 's'} available
            </p>
          </div>
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
        {!loading && !error && documents.length === 0 && (
          <div className="border border-dashed border-zinc-800 rounded-2xl p-12 text-center flex flex-col items-center justify-center bg-zinc-900/20">
            <div className="w-14 h-14 rounded-2xl bg-zinc-800/80 flex items-center justify-center text-zinc-400 mb-4">
              <Layers className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-medium text-zinc-200">No documents yet</h3>
            <p className="text-sm text-zinc-400 max-w-md mt-1 mb-6">
              Add a PDF, ePub, Word document, web article URL, or paste Markdown text to start reading and listening.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={() => setActiveModal('upload')}
                className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-sm font-medium rounded-lg transition border border-zinc-700"
              >
                <Upload className="w-4 h-4" /> Upload Document
              </button>
              <button
                onClick={() => setActiveModal('url')}
                className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-sm font-medium rounded-lg transition border border-zinc-700"
              >
                <LinkIcon className="w-4 h-4 text-purple-400" /> Ingest Article URL
              </button>
              <button
                onClick={() => setActiveModal('scratch')}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition"
              >
                <FileText className="w-4 h-4" /> Paste Text
              </button>
            </div>
          </div>
        )}

        {/* Document Grid */}
        {!loading && !error && documents.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {documents.map((doc) => (
              <div
                key={doc.id}
                onClick={() => onSelectDocument && onSelectDocument(doc.id)}
                className="group relative bg-zinc-900/60 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-xl p-5 transition cursor-pointer flex flex-col justify-between shadow-sm hover:shadow-md"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span
                      className={`text-xs px-2.5 py-0.5 rounded-full uppercase font-semibold tracking-wider border ${getBadgeColor(
                        doc.source_type
                      )}`}
                    >
                      {doc.source_type || 'text'}
                    </span>
                    <button
                      title="Delete document"
                      onClick={(e) => handleDelete(doc.id, doc.title, e)}
                      className="opacity-0 group-hover:opacity-100 p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <h3 className="font-semibold text-zinc-100 group-hover:text-indigo-400 transition line-clamp-2 mb-2">
                    {doc.title}
                  </h3>

                  <p className="text-xs text-zinc-400 line-clamp-3 leading-relaxed mb-4">
                    {doc.excerpt || 'No preview available.'}
                  </p>
                </div>

                <div className="pt-3 border-t border-zinc-800/60 flex items-center justify-between text-xs text-zinc-500">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{formatDate(doc.created_at)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5" />
                    <span>{doc.block_count || 0} blocks</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Upload Modal */}
      {activeModal === 'upload' && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <button
              onClick={closeModal}
              className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-200"
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
                  placeholder="e.g. My Important Article"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-800/80 border border-zinc-700 rounded-lg text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-sm font-medium rounded-lg text-zinc-300 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!fileToUpload || isSubmitting}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-sm font-medium rounded-lg text-white transition"
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
              onClick={closeModal}
              className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-200"
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
                  placeholder="Auto-extracted if blank"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-800/80 border border-zinc-700 rounded-lg text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-sm font-medium rounded-lg text-zinc-300 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!urlInput.trim() || isSubmitting}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-sm font-medium rounded-lg text-white transition"
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
              onClick={closeModal}
              className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-200"
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
                  placeholder="Doc - YYYY-MM-DD HH:mm"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-800/80 border border-zinc-700 rounded-lg text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
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
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-sm font-medium rounded-lg text-zinc-300 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!scratchContent.trim() || isSubmitting}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-sm font-medium rounded-lg text-white transition"
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
