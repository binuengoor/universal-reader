import React, { useState } from 'react';
import LibraryView from './components/LibraryView';

export default function App() {
  const [selectedDocId, setSelectedDocId] = useState(null);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {selectedDocId ? (
        <div className="p-8 text-center">
          <p>Document selected: {selectedDocId}</p>
          <button
            onClick={() => setSelectedDocId(null)}
            className="mt-4 px-4 py-2 bg-zinc-800 text-zinc-200 rounded"
          >
            Back to Library
          </button>
        </div>
      ) : (
        <LibraryView onSelectDocument={(id) => setSelectedDocId(id)} />
      )}
    </div>
  );
}
