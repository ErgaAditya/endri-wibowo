import React, { useRef, useState } from 'react';
import { MediaItem } from '../types';
import { Play, ChevronRight, GripVertical } from 'lucide-react';

interface TimelineProps {
  items: MediaItem[];
  currentIndex: number;
  nextIndex: number;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onSelect: (index: number) => void;
}

export const Timeline: React.FC<TimelineProps> = ({ items, currentIndex, nextIndex, onReorder, onSelect }) => {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
    // Optional: Set transparent drag image
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== targetIndex) {
      onReorder(draggedIndex, targetIndex);
    }
    setDraggedIndex(null);
  };

  if (items.length === 0) return (
      <div className="h-28 bg-gray-950 border-t border-gray-800 flex items-center justify-center text-gray-600 text-xs">
          Drop files to main background area to populate timeline
      </div>
  );

  return (
    <div className="h-28 bg-gray-950 border-t border-gray-800 flex flex-col shrink-0 select-none">
      <div className="px-4 py-1.5 text-[10px] text-gray-500 font-bold uppercase tracking-wider flex justify-between items-center bg-gray-900/50 border-b border-gray-800/50">
        <span className="flex items-center gap-2"><GripVertical size={10}/> Video Timeline Playlist</span>
        <span className="bg-gray-800 px-2 rounded text-gray-400">{items.length} CLIPS</span>
      </div>
      <div 
        className="flex-1 overflow-x-auto flex items-center px-4 gap-2 custom-scrollbar py-2"
      >
        {items.map((item, idx) => {
          const isActive = idx === currentIndex;
          const isNext = idx === nextIndex;
          
          return (
            <div
              key={item.id}
              draggable
              onDragStart={(e) => handleDragStart(e, idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDrop={(e) => handleDrop(e, idx)}
              onClick={() => onSelect(idx)}
              className={`
                relative group flex-shrink-0 w-32 h-20 rounded-md border-2 overflow-hidden cursor-pointer transition-all bg-gray-900
                ${isActive ? 'border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.3)] scale-105 z-10' : isNext ? 'border-yellow-500/70' : 'border-gray-800 hover:border-gray-600'}
                ${draggedIndex === idx ? 'opacity-30' : 'opacity-100'}
              `}
            >
              {/* Thumbnail / Placeholder */}
              {item.type === 'video' ? (
                <video src={item.url} className="w-full h-full object-cover pointer-events-none opacity-80 group-hover:opacity-100 transition-opacity" />
              ) : (
                <img src={item.url} className="w-full h-full object-cover pointer-events-none opacity-80 group-hover:opacity-100 transition-opacity" />
              )}
              
              {/* Overlay Info */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent flex flex-col justify-between p-1.5">
                 <div className="flex justify-between items-start">
                    <span className="bg-black/60 text-[9px] text-gray-200 px-1.5 py-0.5 rounded truncate max-w-[80px] backdrop-blur-md border border-white/10 font-mono">
                        {idx + 1}.
                    </span>
                 </div>
                 
                 <div className="flex justify-between items-end">
                    <span className="text-[9px] text-gray-400 truncate w-20">{item.name}</span>
                    <div className="flex gap-1">
                        {isActive && <Play size={12} className="text-blue-400 fill-current drop-shadow-md" />}
                        {isNext && <ChevronRight size={14} className="text-yellow-400 drop-shadow-md" />}
                    </div>
                 </div>
              </div>

              {/* Interaction Hint */}
              <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
            </div>
          );
        })}
      </div>
    </div>
  );
};