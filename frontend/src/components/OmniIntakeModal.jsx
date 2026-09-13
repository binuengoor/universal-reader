import React, { useState, useRef, useEffect } from 'react';
import { 
  X, 
  Upload, 
  Link as LinkIcon, 
  FileText, 
  Plus, 
  Loader2, 
  AlertCircle, 
  FileUp, 
  Globe, 
  Check, 
  Sparkles,
  ClipboardPaste
} from 'lucide-react';
import TagInput from './TagInput';
import { getTheme } from '../utils/theme';

export default function OmniIntakeModal({
  isOpen,
  onClose,
  onSuccess,
  availableTags = [],
  initialShareData = null,
  theme = 'dark'
}) {
  if (!isOpen) return null;

  const t = getTheme(theme);
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);

  // Mode: 'auto' | 'file' | 'url' | 'text'
  const [activeTab, setActiveTab] = useState('auto');
  const [detectedType, setDetectedType] = useState('text'); // 'file' | 'url' | 'text'

  // Input states
  const [rawInput, setRawInput] = useState('');
  const [fileToUpload, setFileToUpload] = useState(null);
  const [customTitle, setCustomTitle] = useState('');
  const [tags, setTags] = useState([]);

  // UI state
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Pre-fill if Web Share Target data was supplied
  useEffect(() => {
    if (initialShareData) {
      if (initialShareData.title) setCustomTitle(initialShareData.title);
      if (initialShareData.url) {
        setRawInput(initialShareData.url);
        setDetectedType('url');
      } else if (initialShareData.text) {
        if (/^https?:\/\/[^\s]+$/i.test(initialShareData.text.trim())) {
          setRawInput(initialShareData.text.trim());
          setDetectedType('url');
        } else {
          setRawInput(initialShareData.text);
          setDetectedType('text');
        }
      }
    }
  }, [initialShareData]);

  // Focus input on mount
  useEffect(() => {
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    }, 100);
  }, []);

  // Detect whether string is an article URL or text
  const analyzeText = (text) => {
    const trimmed = text.trim();
    if (!trimmed) {
      setDetectedType('text');
      return;
    }
    const isSingleUrl = /^https?:\/\/[^\s]+$/i.test(trimmed) && !trimmed.includes('\n');
    if (isSingleUrl) {
      setDetectedType('url');
    } else {
      setDetectedType('text');
    }
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    setRawInput(val);
    if (activeTab === 'auto') {
      analyzeText(val);
    }
  };

  // Clipboard Paste Handler: intercepts files (from mobile Files app / desktop clipboard)
  const handlePaste = (e) => {
    const clipboardData = e.clipboardData;
    if (!clipboardData) return;

    // 1. Check if files are pasted (e.g. copied PDF from iOS Files, Mac Finder, Android)
    if (clipboardData.files && clipboardData.files.length > 0) {
      const pastedFile = clipboardData.files[0];
      const validExtensions = ['.pdf', '.docx', '.epub', '.txt', '.md'];
      const fileExt = '.' + pastedFile.name.split('.').pop().toLowerCase();

      if (validExtensions.includes(fileExt) || pastedFile.type.includes('pdf') || pastedFile.type.includes('text')) {
        e.preventDefault();
        setFileToUpload(pastedFile);
        setDetectedType('file');
        setActiveTab('file');
        if (!customTitle) {
          const baseName = pastedFile.name.replace(/\.[^/.]+$/, '');
          setCustomTitle(baseName);
        }
        return;
      }
    }

    // 2. Check if pasted text is a URL
    const pastedText = clipboardData.getData('text');
    if (pastedText && /^https?:\/\/[^\s]+$/i.test(pastedText.trim()) && !pastedText.trim().includes('\n')) {
      if (activeTab === 'auto') {
        setDetectedType('url');
      }
    }
  };

  // Drag and drop handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      setFileToUpload(droppedFile);
      setDetectedType('file');
      setActiveTab('file');
      if (!customTitle) {
        const baseName = droppedFile.name.replace(/\.[^/.]+$/, '');
        setCustomTitle(baseName);
      }
      return;
    }

    const droppedText = e.dataTransfer.getData('text');
    if (droppedText) {
      setRawInput(droppedText);
      analyzeText(droppedText);
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const selected = e.target.files[0];
      setFileToUpload(selected);
      setDetectedType('file');
      setActiveTab('file');
      if (!customTitle) {
        const baseName = selected.name.replace(/\.[^/.]+$/, '');
        setCustomTitle(baseName);
      }
    }
  };

  const clearSelectedFile = () => {
    setFileToUpload(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setDetectedType('text');
    setActiveTab('auto');
  };

  const effectiveType = activeTab === 'auto' ? detectedType : activeTab;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      let endpoint = '';
      let fetchOptions = {};

      if (effectiveType === 'file') {
        if (!fileToUpload) {
          throw new Error('Please select or paste a document file');
        }
        endpoint = '/api/documents/upload';
        const formData = new FormData();
        formData.append('file', fileToUpload);
        if (customTitle.trim()) formData.append('title', customTitle.trim());
        if (tags.length > 0) formData.append('tags', tags.join(','));

        fetchOptions = {
          method: 'POST',
          body: formData,
        };
      } else if (effectiveType === 'url') {
        const targetUrl = rawInput.trim();
        if (!targetUrl) {
          throw new Error('Please enter or paste an article URL');
        }
        endpoint = '/api/documents/url';
        fetchOptions = {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: targetUrl,
            title: customTitle.trim() || undefined,
            tags: tags.length > 0 ? tags : undefined,
          }),
        };
      } else {
        // Text / Markdown mode
        const content = rawInput.trim();
        if (!content) {
          throw new Error('Please write or paste note content');
        }
        endpoint = '/api/documents/create';
        fetchOptions = {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content,
            title: customTitle.trim() || undefined,
            tags: tags.length > 0 ? tags : undefined,
          }),
        };
      }

      const res = await fetch(endpoint, fetchOptions);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || data.message || 'Intake failed');
      }

      onClose();
      if (onSuccess) {
        onSuccess(data.id);
      }
    } catch (err) {
      setError(err.message || 'An error occurred during document intake');
    } finally {
      setIsSubmitting(false);
    }
  };

  const wordCount = rawInput.trim() ? rawInput.trim().split(/\s+/).length : 0;
  const charCount = rawInput.length;

  return (
    <div className={`fixed inset-0 z-50 ${t.modalBackdrop} flex items-center justify-center p-3 sm:p-4`}>
      <div 
        className={`${t.modalSurface} border rounded-2xl max-w-xl w-full p-5 sm:p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150 max-h-[95vh] flex flex-col`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-current/10">
          <div className="flex items-center gap-2">
            <div className="p-1.5 sm:p-2 bg-indigo-500/20 border border-indigo-500/30 rounded-xl text-indigo-500 dark:text-indigo-400">
              <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <h3 className={`text-base sm:text-lg font-bold ${t.cardTitle}`}>Add Document</h3>
              <p className={`text-[11px] sm:text-xs ${t.cardMeta}`}>Paste file, drop article URL, or write note</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`p-1.5 rounded-lg ${t.iconMuted} hover:opacity-100 transition cursor-pointer`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mt-3 p-3 bg-red-950/40 border border-red-800/50 rounded-xl text-xs text-red-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Type / Detection Selector Tabs */}
        <div className="flex items-center gap-1 mt-3 mb-3 p-1 rounded-xl bg-black/5 dark:bg-white/5 border border-current/10 text-xs font-medium">
          {[
            { id: 'auto', label: 'Smart Auto', icon: Sparkles },
            { id: 'file', label: 'File', icon: FileUp },
            { id: 'url', label: 'Web URL', icon: Globe },
            { id: 'text', label: 'Text / Note', icon: FileText },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTab(tab.id);
                  if (tab.id !== 'auto') setDetectedType(tab.id);
                }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg transition cursor-pointer ${
                  isActive
                    ? 'bg-indigo-600 text-white font-semibold shadow-xs'
                    : `${t.cardMeta} hover:opacity-100`
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="text-[11px] sm:text-xs">{tab.label}</span>
              </button>
            );
          })}
        </div>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col gap-3 overflow-y-auto pr-1">
          {/* Main Omni-Input Box */}
          {fileToUpload ? (
            /* Selected / Pasted File Preview Card */
            <div className={`p-4 rounded-xl border flex items-center justify-between gap-3 ${t.card}`}>
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2.5 rounded-lg bg-indigo-500/20 border border-indigo-500/30 text-indigo-500">
                  <FileUp className="w-6 h-6" />
                </div>
                <div className="min-w-0">
                  <p className={`text-xs sm:text-sm font-semibold truncate ${t.cardTitle}`}>
                    {fileToUpload.name}
                  </p>
                  <p className={`text-[11px] font-mono ${t.cardMeta}`}>
                    {(fileToUpload.size / 1024).toFixed(1)} KB • {fileToUpload.name.split('.').pop().toUpperCase()}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={clearSelectedFile}
                className={`p-1.5 rounded-lg border ${t.btnSecondary} transition cursor-pointer text-xs`}
                title="Remove file"
              >
                <X className="w-4 h-4 text-red-400" />
              </button>
            </div>
          ) : (
            /* Universal Drop & Paste Zone */
            <div 
              className={`relative rounded-xl border-2 border-dashed transition-all ${
                isDragging 
                  ? 'border-indigo-500 bg-indigo-500/10 scale-[1.01]' 
                  : `border-current/15 ${t.card}`
              }`}
            >
              <textarea
                ref={textareaRef}
                rows={effectiveType === 'url' ? 3 : 6}
                value={rawInput}
                onChange={handleInputChange}
                onPaste={handlePaste}
                placeholder={
                  effectiveType === 'url'
                    ? 'https://example.com/article...'
                    : 'Paste copied file, drop document, paste article URL, or write notes here...'
                }
                className={`w-full p-3.5 bg-transparent border-0 text-xs sm:text-sm focus:outline-none resize-none font-mono ${
                  effectiveType === 'url' ? 'font-sans' : ''
                }`}
              />

              {/* Bottom bar inside input zone */}
              <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-t border-current/10 bg-black/5 dark:bg-white/5 rounded-b-xl text-[11px]">
                <div className="flex items-center gap-2">
                  {/* Mode pill */}
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-mono text-[10px] font-semibold uppercase ${
                    effectiveType === 'url'
                      ? 'bg-purple-500/20 text-purple-600 dark:text-purple-300 border border-purple-500/30'
                      : effectiveType === 'file'
                      ? 'bg-blue-500/20 text-blue-600 dark:text-blue-300 border border-blue-500/30'
                      : 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30'
                  }`}>
                    {effectiveType === 'url' ? <Globe className="w-3 h-3" /> : effectiveType === 'file' ? <FileUp className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
                    {effectiveType === 'url' ? 'Article URL' : effectiveType === 'file' ? 'File Mode' : 'Markdown Text'}
                  </span>

                  {effectiveType === 'text' && rawInput.trim() && (
                    <span className={t.cardMeta}>
                      {wordCount} words • {charCount} chars
                    </span>
                  )}
                </div>

                {/* Choose file fallback button */}
                <div className="flex items-center gap-1.5">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.docx,.epub,.txt,.md"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className={`flex items-center gap-1 px-2 py-1 rounded-md border ${t.btnSecondary} transition cursor-pointer text-[10px]`}
                  >
                    <Upload className="w-3 h-3" />
                    <span>Browse Device</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Optional Title Override */}
          <div>
            <label className={`block text-xs font-medium mb-1 ${t.cardMeta}`}>
              Title (Optional)
            </label>
            <input
              type="text"
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              placeholder="Auto-generated by AI if left blank"
              className={`w-full px-3 py-2 rounded-lg text-xs sm:text-sm transition ${t.input}`}
            />
          </div>

          {/* Category Tags */}
          <div>
            <label className={`block text-xs font-medium mb-1 flex items-center justify-between ${t.cardMeta}`}>
              <span>Category Tags</span>
              <span className="text-[10px] opacity-75">Max 50 Global (Auto-assigned if blank)</span>
            </label>
            <TagInput
              tags={tags}
              onChange={setTags}
              availableTags={availableTags}
              placeholder="Select or create category tags..."
              theme={theme}
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-current/10 mt-1">
            <button
              type="button"
              onClick={onClose}
              className={`px-4 py-2 text-xs sm:text-sm font-medium rounded-lg transition cursor-pointer ${t.btnSecondary}`}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || (!fileToUpload && !rawInput.trim())}
              className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs sm:text-sm font-semibold rounded-lg transition shadow-md cursor-pointer active:scale-95"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>Process Document</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
