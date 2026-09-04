import React, { useState } from 'react';
import LibraryView from './components/LibraryView';
import ReaderView from './components/ReaderView';

export default function App() {
  const [selectedDocId, setSelectedDocId] = useState(null);
  const [activeBlockId, setActiveBlockId] = useState(null);
  const [readerSettings, setReaderSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('universal_reader_settings');
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return {
      theme: 'dark',
      fontSize: 18,
      lineHeight: 1.7,
      fontFamily: 'serif',
      contentWidth: 'max-w-3xl',
    };
  });

  const handleUpdateSettings = (newSettings) => {
    setReaderSettings(newSettings);
    try {
      localStorage.setItem('universal_reader_settings', JSON.stringify(newSettings));
    } catch {
      // ignore
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {selectedDocId ? (
        <ReaderView
          docId={selectedDocId}
          onBack={() => {
            setSelectedDocId(null);
            setActiveBlockId(null);
          }}
          activeBlockId={activeBlockId}
          onSelectBlock={(id) => setActiveBlockId(id)}
          settings={readerSettings}
          onUpdateSettings={handleUpdateSettings}
        />
      ) : (
        <LibraryView onSelectDocument={(id) => setSelectedDocId(id)} />
      )}
    </div>
  );
}
