import React, { useState, useRef, useEffect } from 'react';
import { X, GripVertical, Minimize2, Maximize2 } from 'lucide-react';
import { cn } from '../utils';

interface NoteBoxProps {
  key?: string;
  id: string;
  x: number;
  y: number;
  text: string;
  minimized: boolean;
  theme: 'light' | 'dark';
  onUpdate: (id: string, x: number, y: number, text: string, minimized: boolean) => void;
  onDelete: (id: string) => void;
}

export default function NoteBox({ id, x, y, text, minimized, theme, onUpdate, onDelete }: NoteBoxProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentText, setCurrentText] = useState(text);
  const [isMinimized, setIsMinimized] = useState(minimized);
  const [position, setPosition] = useState({ x, y });
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  
  const noteRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [isEditing]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).tagName === 'TEXTAREA') return;
    
    const rect = noteRef.current?.getBoundingClientRect();
    if (rect) {
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
      setIsDragging(true);
    }
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const container = noteRef.current?.parentElement;
      if (!container) return;

      const containerRect = container.getBoundingClientRect();
      const noteWidth = noteRef.current?.offsetWidth || 200;
      const noteHeight = noteRef.current?.offsetHeight || 100;

      let newX = e.clientX - containerRect.left - dragOffset.x;
      let newY = e.clientY - containerRect.top - dragOffset.y;

      newX = Math.max(0, Math.min(newX, containerRect.width - noteWidth));
      newY = Math.max(0, Math.min(newY, containerRect.height - noteHeight));

      setPosition({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      onUpdate(id, position.x, position.y, currentText, isMinimized);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset, position, id, currentText, isMinimized, onUpdate]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setCurrentText(e.target.value);
  };

  const handleBlur = () => {
    setIsEditing(false);
    onUpdate(id, position.x, position.y, currentText, isMinimized);
  };

  const handleClick = () => {
    if (!isDragging && !isMinimized) {
      setIsEditing(true);
    }
  };

  const toggleMinimize = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newMinimized = !isMinimized;
    setIsMinimized(newMinimized);
    setIsEditing(false);
    onUpdate(id, position.x, position.y, currentText, newMinimized);
  };

  const getPreviewText = () => {
    if (!currentText) return 'Note';
    const firstLine = currentText.split('\n')[0];
    return firstLine.length > 20 ? firstLine.substring(0, 20) + '...' : firstLine;
  };

  return (
    <div
      ref={noteRef}
      className={cn(
        "absolute rounded-lg border shadow-lg backdrop-blur-md transition-all",
        isDragging ? "cursor-grabbing shadow-2xl" : "cursor-grab",
        isMinimized ? "min-w-[180px]" : "min-w-[200px] max-w-[300px] min-h-[100px]",
        theme === 'light' 
          ? "bg-yellow-100/70 border-yellow-300/50" 
          : "bg-yellow-900/30 border-yellow-700/50"
      )}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        zIndex: 1000
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-2 border-b border-black/10 dark:border-white/10">
        <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
          <GripVertical size={14} />
          <span className="text-[11px] font-bold tracking-wider">NOTE</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={toggleMinimize}
            className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
            title={isMinimized ? "Maximize note" : "Minimize note"}
          >
            {isMinimized ? <Maximize2 size={12} /> : <Minimize2 size={12} />}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(id);
            }}
            className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
            title="Delete note"
          >
            <X size={12} />
          </button>
        </div>
      </div>

      {/* Content */}
      {!isMinimized && (
        <div className="p-3" onClick={handleClick}>
          {isEditing ? (
            <textarea
              ref={textareaRef}
              value={currentText}
              onChange={handleTextChange}
              onBlur={handleBlur}
              onMouseDown={(e) => e.stopPropagation()}
              className={cn(
                "w-full min-h-[60px] bg-transparent border-none outline-none resize-none",
                "text-[16px] font-medium",
                theme === 'light' ? "text-gray-800" : "text-gray-200"
              )}
              placeholder="Type your note here..."
            />
          ) : (
            <div className={cn(
              "text-[16px] font-medium whitespace-pre-wrap min-h-[60px]",
              theme === 'light' ? "text-gray-800" : "text-gray-200",
              !currentText && "text-gray-400 italic"
            )}>
              {currentText || "Click to edit..."}
            </div>
          )}
        </div>
      )}

      {/* Minimized Preview */}
      {isMinimized && (
        <div 
          className="p-2 cursor-pointer"
          onClick={toggleMinimize}
        >
          <div className={cn(
            "text-sm font-medium truncate",
            theme === 'light' ? "text-gray-700" : "text-gray-300"
          )}>
            {getPreviewText()}
          </div>
        </div>
      )}
    </div>
  );
}
