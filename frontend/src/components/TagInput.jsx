import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Tag, X, Plus } from 'lucide-react';

/**
 * Reusable TagInput with live suggestion matching against library tags
 * and enforcing the 50-tag global limit.
 */
export default function TagInput({
  tags = [],
  onChange,
  availableTags = [], // array of strings or [tag, count]
  placeholder = "Add category tag...",
  maxTags = 50,
  maxTagsPerDoc = 5
}) {
  const [inputValue, setInputValue] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const inputRef = useRef(null);
  const containerRef = useRef(null);

  // Normalize available tags into simple strings
  const normalizedAvailable = useMemo(() => {
    const set = new Set();
    availableTags.forEach((item) => {
      if (typeof item === 'string') {
        if (item.trim()) set.add(item.trim().toLowerCase());
      } else if (Array.isArray(item) && item[0]) {
        set.add(String(item[0]).trim().toLowerCase());
      } else if (item && item.tag) {
        set.add(String(item.tag).trim().toLowerCase());
      }
    });
    return Array.from(set).sort();
  }, [availableTags]);

  // Compute suggestions based on current input
  const suggestions = useMemo(() => {
    const q = inputValue.trim().toLowerCase().replace(/^#/, '');
    return normalizedAvailable
      .filter((t) => !tags.includes(t))
      .filter((t) => (!q ? true : t.includes(q)))
      .slice(0, 8);
  }, [inputValue, normalizedAvailable, tags]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const addTag = (tagToAdd) => {
    const clean = tagToAdd.trim().toLowerCase().replace(/^#/, '').replace(/[^a-z0-9\-]/g, '');
    if (!clean) return;

    if (tags.includes(clean)) {
      setInputValue('');
      return;
    }

    // Check 50-tag constraint if this tag is completely new to library
    const isNewToLibrary = !normalizedAvailable.includes(clean);
    if (isNewToLibrary && normalizedAvailable.length >= maxTags) {
      alert(`The library has reached its maximum capacity of ${maxTags} categories. Please pick from existing tags.`);
      return;
    }

    onChange([...tags, clean]);
    setInputValue('');
    setIsDropdownOpen(false);
    setHighlightedIndex(0);
    inputRef.current?.focus();
  };

  const removeTag = (tagToRemove) => {
    onChange(tags.filter((t) => t !== tagToRemove));
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (suggestions.length > 0) {
        setHighlightedIndex((prev) => (prev + 1) % suggestions.length);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (suggestions.length > 0) {
        setHighlightedIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
      }
    } else if (e.key === 'Enter' || e.key === ',' || e.key === 'Tab') {
      if (isDropdownOpen && suggestions.length > 0 && highlightedIndex < suggestions.length) {
        e.preventDefault();
        addTag(suggestions[highlightedIndex]);
      } else if (inputValue.trim()) {
        e.preventDefault();
        addTag(inputValue);
      }
    } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
      e.preventDefault();
      removeTag(tags[tags.length - 1]);
    } else if (e.key === 'Escape') {
      setIsDropdownOpen(false);
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <div 
        onClick={() => inputRef.current?.focus()}
        className="flex flex-wrap items-center gap-1.5 p-2 bg-zinc-800/80 border border-zinc-700 rounded-lg min-h-[42px] focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500/30 cursor-text transition"
      >
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-md text-xs font-medium"
          >
            #{tag}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeTag(tag);
              }}
              className="text-indigo-400 hover:text-indigo-100 hover:bg-indigo-500/40 rounded-xs p-0.5 cursor-pointer transition"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}

        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setIsDropdownOpen(true);
            setHighlightedIndex(0);
          }}
          onFocus={() => setIsDropdownOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={tags.length === 0 ? placeholder : 'Add more...'}
          className="flex-1 min-w-[120px] bg-transparent border-0 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-0 p-0.5"
        />
      </div>

      {/* Suggestion Dropdown */}
      {isDropdownOpen && suggestions.length > 0 && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-zinc-900 border border-zinc-700 rounded-xl shadow-xl overflow-hidden max-h-48 overflow-y-auto">
          <div className="px-3 py-1.5 text-[10px] uppercase font-semibold tracking-wider text-zinc-500 border-b border-zinc-800 flex justify-between">
            <span>Existing Library Categories</span>
            <span>{normalizedAvailable.length}/{maxTags} used</span>
          </div>
          {suggestions.map((suggestion, idx) => (
            <div
              key={suggestion}
              onMouseDown={(e) => {
                e.preventDefault();
                addTag(suggestion);
              }}
              onMouseEnter={() => setHighlightedIndex(idx)}
              className={`px-3 py-2 text-xs flex items-center justify-between cursor-pointer transition ${
                idx === highlightedIndex
                  ? 'bg-indigo-600 text-white font-medium'
                  : 'text-zinc-300 hover:bg-zinc-800'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <Tag className="w-3 h-3 opacity-70" />
                #{suggestion}
              </span>
              <span className="text-[10px] opacity-60">Select</span>
            </div>
          ))}
        </div>
      )}

      {/* When input has text not in suggestions and library has capacity */}
      {isDropdownOpen && inputValue.trim() && !suggestions.some(s => s === inputValue.trim().toLowerCase()) && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-zinc-900 border border-zinc-700 rounded-xl shadow-xl p-2">
          <div
            onMouseDown={(e) => {
              e.preventDefault();
              addTag(inputValue);
            }}
            className="px-3 py-1.5 text-xs text-indigo-300 hover:bg-zinc-800 rounded-lg cursor-pointer flex items-center justify-between"
          >
            <span className="flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5" />
              Create new category #{inputValue.trim().toLowerCase()}
            </span>
            <span className="text-[10px] text-zinc-500">
              {normalizedAvailable.length >= maxTags ? 'Limit Reached' : `${normalizedAvailable.length}/${maxTags}`}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
