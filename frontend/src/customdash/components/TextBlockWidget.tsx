import { useState, useRef, useEffect, type ChangeEvent, type KeyboardEvent } from 'react';
import { cn } from '../utils';

interface TextBlockWidgetProps {
  content: string;
  widgetTitle?: string;
  theme: 'light' | 'dark';
  onUpdate: (content: string, widgetTitle: string) => void;
}

export default function TextBlockWidget({ content, widgetTitle = '', theme, onUpdate }: TextBlockWidgetProps) {
  const [isEditingContent, setIsEditingContent] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [currentContent, setCurrentContent] = useState(content);
  const [currentTitle, setCurrentTitle] = useState(widgetTitle);
  
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditingContent && contentRef.current) {
      contentRef.current.focus();
    }
  }, [isEditingContent]);

  useEffect(() => {
    if (isEditingTitle && titleRef.current) {
      titleRef.current.focus();
      titleRef.current.select();
    }
  }, [isEditingTitle]);

  const handleContentChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setCurrentContent(e.target.value);
  };

  const handleTitleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setCurrentTitle(e.target.value);
  };

  const handleContentBlur = () => {
    setIsEditingContent(false);
    onUpdate(currentContent, currentTitle);
  };

  const handleTitleBlur = () => {
    setIsEditingTitle(false);
    onUpdate(currentContent, currentTitle);
  };

  const handleTitleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleTitleBlur();
    }
  };

  return (
    <div className="h-full flex flex-col p-4">
      {/* Title */}
      <div className="mb-3">
        {isEditingTitle ? (
          <input
            ref={titleRef}
            type="text"
            value={currentTitle}
            onChange={handleTitleChange}
            onBlur={handleTitleBlur}
            onKeyDown={handleTitleKeyDown}
            className={cn(
              "w-full text-[14px] font-bold tracking-[0.2em] uppercase bg-transparent border-b outline-none",
              theme === 'light' ? "text-gray-600 border-gray-300" : "text-gray-400 border-gray-600"
            )}
            placeholder="WIDGET TITLE"
          />
        ) : (
          <h2 
            className={cn(
              "text-[14px] font-bold tracking-[0.2em] cursor-pointer hover:opacity-70 transition-opacity",
              theme === 'light' ? "text-gray-600" : "text-gray-400"
            )}
            onClick={() => setIsEditingTitle(true)}
          >
            {currentTitle || 'TEXT BLOCK'}
          </h2>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {isEditingContent ? (
          <textarea
            ref={contentRef}
            value={currentContent}
            onChange={handleContentChange}
            onBlur={handleContentBlur}
            className={cn(
              "w-full h-full bg-transparent border-none outline-none resize-none text-[18px]",
              theme === 'light' ? "text-gray-800" : "text-gray-200"
            )}
            placeholder="Click to add text..."
          />
        ) : (
          <div 
            className={cn(
              "w-full h-full overflow-y-auto text-[18px] whitespace-pre-wrap cursor-pointer hover:opacity-70 transition-opacity",
              theme === 'light' ? "text-gray-800" : "text-gray-200",
              !currentContent && "text-gray-400 italic"
            )}
            onClick={() => setIsEditingContent(true)}
          >
            {currentContent || "Click to add text..."}
          </div>
        )}
      </div>
    </div>
  );
}
