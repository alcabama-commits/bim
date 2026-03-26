import React from 'react';

interface LevelGridProps {
  levels: string[];
  selectedLevels: string[];
  onToggleLevel: (level: string) => void;
}

export default function LevelGrid({ levels, selectedLevels, onToggleLevel }: LevelGridProps) {
  // Sort levels naturally if possible
  const sortedLevels = [...levels].sort((a, b) => {
    const aNum = parseFloat(a.match(/-?\d+(\.\d+)?/)?.[0] || '0');
    const bNum = parseFloat(b.match(/-?\d+(\.\d+)?/)?.[0] || '0');
    return aNum - bNum;
  });

  return (
    <div className="bg-slate-100 p-4 border-y border-slate-200">
      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-2">
        {sortedLevels.map(level => {
          const isSelected = selectedLevels.includes(level);
          return (
            <button
              key={level}
              onClick={() => onToggleLevel(level)}
              className={`px-2 py-3 text-[10px] font-medium rounded transition-all border text-center flex items-center justify-center min-h-[50px] leading-tight ${
                isSelected 
                  ? 'bg-blue-600 border-blue-700 text-white shadow-sm' 
                  : 'bg-slate-200 border-slate-300 text-slate-600 hover:bg-slate-300'
              }`}
            >
              {level || '(En blanco)'}
            </button>
          );
        })}
      </div>
    </div>
  );
}
