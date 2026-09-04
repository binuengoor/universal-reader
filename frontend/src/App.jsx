import React, { useState } from 'react';
import LibraryView from './components/LibraryView';
import ReaderView from './components/ReaderView';

export default function App() {
  const [selectedDocId, setSelectedDocId] = useState(null);
  const [activeBlockId, setActiveBlockId] = useState(null);
  const [readerSettings] = useState({
    theme: 'dark',
    fontSize: 18,
    lineHeight: 1.7,
    fontFamily: 'serif',
  });

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
        />
      ) : (
        <LibraryView onSelectDocument={(id) => setSelectedDocId(id)} />
      )}
    </div>
  );
}
