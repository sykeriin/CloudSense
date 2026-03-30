import { useState, useEffect, type ChangeEvent, type KeyboardEvent } from 'react';
import { User, Sun, Moon, Plus, X, Edit, StickyNote, ArrowLeft } from 'lucide-react';
import { cn } from './utils';
import { WidgetConfig, DashboardLayout, Note } from './types';
import WidgetBuilder from './components/WidgetBuilder';
import WidgetRenderer from './components/WidgetRenderer';
import NoteBox from './components/NoteBox';

const STORAGE_KEY = 'dashboard_layout';
const NOTES_STORAGE_KEY = 'dashboard_notes';
const TITLE_STORAGE_KEY = 'dashboard_title';

function getWidgetShellClass(metric: WidgetConfig['metric']) {
  switch (metric) {
    case 'total_cost':
    case 'anomalies':
    case 'text_block':
      return 'col-span-12 md:col-span-6 xl:col-span-3 h-[20rem]';
    case 'logs':
      return 'col-span-12 md:col-span-6 xl:col-span-3 h-[20rem]';
    case 'ai_current_situation':
      return 'col-span-12 md:col-span-6 xl:col-span-4 h-[28rem]';
    case 'forecast':
    case 'cost_trend':
    case 'cost_by_service':
    case 'cost_by_team':
    case 'shared_costs':
    default:
      return 'col-span-12 xl:col-span-6 h-[23rem]';
  }
}

export default function App({ onBackToLanding, onOpenProfile }: { onBackToLanding?: () => void; onOpenProfile?: () => void }) {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [layout, setLayout] = useState<DashboardLayout>({ widgets: [] });
  const [notes, setNotes] = useState<Note[]>([]);
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingWidget, setEditingWidget] = useState<WidgetConfig | null>(null);
  const [dashboardTitle, setDashboardTitle] = useState('Customizable Dashboard');
  const [isEditingTitle, setIsEditingTitle] = useState(false);

  // Load layout from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setLayout(parsed);
      } catch (e) {
        console.error('Failed to parse saved layout');
      }
    }
  }, []);

  // Load notes from localStorage on mount
  useEffect(() => {
    const savedNotes = localStorage.getItem(NOTES_STORAGE_KEY);
    if (savedNotes) {
      try {
        const parsed = JSON.parse(savedNotes);
        setNotes(parsed);
      } catch (e) {
        console.error('Failed to parse saved notes');
      }
    }
  }, []);

  // Load dashboard title from localStorage on mount
  useEffect(() => {
    const savedTitle = localStorage.getItem(TITLE_STORAGE_KEY);
    if (savedTitle) {
      setDashboardTitle(savedTitle);
    }
  }, []);

  // Save layout to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  }, [layout]);

  // Save notes to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(notes));
  }, [notes]);

  // Save dashboard title to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem(TITLE_STORAGE_KEY, dashboardTitle);
  }, [dashboardTitle]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const handleSaveWidget = (config: WidgetConfig) => {
    if (editingWidget) {
      // Update existing widget
      setLayout(prev => ({
        widgets: prev.widgets.map(w => w.id === config.id ? config : w)
      }));
      setEditingWidget(null);
    } else {
      // Add new widget
      setLayout(prev => ({
        widgets: [...prev.widgets, config]
      }));
    }
    setShowBuilder(false);
  };

  const updateWidget = (config: WidgetConfig) => {
    setLayout(prev => ({
      widgets: prev.widgets.map(w => w.id === config.id ? config : w)
    }));
  };

  const removeWidget = (id: string) => {
    setLayout(prev => ({
      widgets: prev.widgets.filter(w => w.id !== id)
    }));
  };

  const startEditWidget = (widget: WidgetConfig) => {
    setEditingWidget(widget);
    setShowBuilder(true);
  };

  const handleCancelBuilder = () => {
    setShowBuilder(false);
    setEditingWidget(null);
  };

  const addNote = () => {
    const newNote: Note = {
      id: `note-${Date.now()}`,
      x: 100,
      y: 100,
      text: '',
      minimized: false
    };
    setNotes(prev => [...prev, newNote]);
  };

  const updateNote = (id: string, x: number, y: number, text: string, minimized: boolean) => {
    setNotes(prev => prev.map(note => 
      note.id === id ? { ...note, x, y, text, minimized } : note
    ));
  };

  const deleteNote = (id: string) => {
    setNotes(prev => prev.filter(note => note.id !== id));
  };

  const handleTitleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setDashboardTitle(e.target.value);
  };

  const handleTitleBlur = () => {
    setIsEditingTitle(false);
  };

  const handleTitleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      setIsEditingTitle(false);
    }
  };

  return (
    <div className={cn(
      "min-h-screen w-full p-3 font-sans overflow-x-hidden flex flex-col gap-3 transition-colors duration-300 sm:p-4 lg:h-screen lg:overflow-hidden",
      theme === 'light' ? 'light' : 'dark'
    )}>
      {/* Header */}
      <header className="flex flex-col gap-4 shrink-0 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-6">
          <div className="flex items-center gap-2">
            {onBackToLanding && (
              <button
                onClick={onBackToLanding}
                className={cn(
                  "p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors",
                  theme === 'light' ? "text-black" : "text-white"
                )}
                title="Back to landing page"
              >
                <ArrowLeft size={14} />
              </button>
            )}
            <div className={cn("w-5 h-5 border-2 flex items-center justify-center", theme === 'light' ? "border-black" : "border-white")}>
              <div className={cn("w-1.5 h-1.5", theme === 'light' ? "bg-black" : "bg-white")} />
            </div>
            <span className="text-lg font-medium tracking-tight sm:text-xl">CloudSense Analytics</span>
          </div>
          <nav className="flex flex-wrap items-center gap-4 text-[11px] font-bold tracking-widest text-gray-500 sm:text-[12px]">
            <a href="#" className={cn("pb-0.5", theme === 'light' ? "text-black border-b border-black" : "text-white border-b border-white")}>DASHBOARD</a>
            <a href="#" className="hover:text-gray-400 transition-colors">WIDGETS</a>
            <a href="#" className="hover:text-gray-400 transition-colors">SETTINGS</a>
          </nav>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-[11px] font-bold tracking-widest text-gray-500">
          <button 
            onClick={toggleTheme}
            className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            {theme === 'light' ? <Moon size={14} className="text-black" /> : <Sun size={14} className="text-white" />}
          </button>
          <span>ACCOUNT</span>
          <button
            type="button"
            onClick={onOpenProfile}
            className={cn("flex items-center gap-2 rounded-full px-2 py-1 transition-colors hover:bg-black/5 dark:hover:bg-white/5", theme === 'light' ? "text-black" : "text-white")}
          >
            <span>Durva Sharma</span>
            <div className="w-7 h-7 rounded-full bg-zinc-800/20 dark:bg-zinc-800 flex items-center justify-center">
              <User size={14} />
            </div>
          </button>
        </div>
      </header>

      {/* Title Section */}
      <div className="grid grid-cols-1 gap-4 shrink-0 xl:grid-cols-3 xl:items-baseline">
        <div className="flex flex-wrap items-center gap-4">
          {isEditingTitle ? (
            <input
              type="text"
              value={dashboardTitle}
              onChange={handleTitleChange}
              onBlur={handleTitleBlur}
              onKeyDown={handleTitleKeyDown}
              autoFocus
              className={cn(
              "text-3xl sm:text-4xl xl:text-5xl font-serif font-light bg-transparent border-b-2 outline-none w-full sm:w-auto",
                theme === 'light' ? "border-gray-300" : "border-gray-700"
              )}
            />
          ) : (
            <h1 
              className="text-3xl sm:text-4xl xl:text-5xl font-serif font-light cursor-pointer hover:opacity-70 transition-opacity"
              onClick={() => setIsEditingTitle(true)}
            >
              {dashboardTitle}
            </h1>
          )}
          <button
            onClick={addNote}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold transition-colors",
              theme === 'light' 
                ? "bg-yellow-100 hover:bg-yellow-200 text-yellow-800 border border-yellow-300" 
                : "bg-yellow-900/30 hover:bg-yellow-900/50 text-yellow-200 border border-yellow-700/50"
            )}
            title="Add a note to the dashboard"
          >
            <StickyNote size={14} />
            Add Note
          </button>
        </div>
        <div className="text-left text-2xl font-serif font-light opacity-40 sm:text-3xl xl:text-center xl:text-4xl">
          {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })} UTC
        </div>
        <div className="text-left text-2xl font-serif font-light opacity-40 sm:text-3xl xl:text-right xl:text-4xl">
          {new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}
        </div>
      </div>

      {/* Widget Grid */}
      <div className="grid grid-cols-12 gap-3 flex-1 min-h-0 overflow-y-auto custom-scrollbar relative pr-0 sm:pr-1 auto-rows-auto content-start">
        {/* Render existing widgets */}
        {layout.widgets.map((widget) => (
          <div 
            key={widget.id}
            className={cn(
              "min-w-0 min-h-0 rounded-xl border border-black/5 dark:border-white/5 relative group overflow-hidden",
              getWidgetShellClass(widget.metric),
              theme === 'light' ? "bg-[#e5e5e5]" : "bg-[#2a2422]"
            )}
          >
            <div className="absolute top-2 right-2 flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity z-10">
              <button
                onClick={() => startEditWidget(widget)}
                className="p-1 rounded-full bg-blue-500/80 hover:bg-blue-500 text-white"
                title="Edit widget"
              >
                <Edit size={12} />
              </button>
              <button
                onClick={() => removeWidget(widget.id)}
                className="p-1 rounded-full bg-red-500/80 hover:bg-red-500 text-white"
                title="Remove widget"
              >
                <X size={12} />
              </button>
            </div>
            <WidgetRenderer config={widget} theme={theme} onUpdate={updateWidget} />
          </div>
        ))}

        <button
          type="button"
          className={cn(
            "col-span-12 md:col-span-6 xl:col-span-3 h-[20rem] rounded-xl border-2 border-dashed border-black/10 dark:border-white/10 flex items-center justify-center cursor-pointer hover:border-black/30 dark:hover:border-white/30 transition-colors",
            theme === 'light' ? "bg-white/50" : "bg-[#1a1a1a]/50"
          )}
          onClick={() => setShowBuilder(true)}
        >
          <div className="text-center">
            <Plus size={32} className="mx-auto mb-2 opacity-40" />
            <div className="text-[14px] font-bold tracking-widest text-gray-500">ADD WIDGET</div>
          </div>
        </button>

        {/* Render notes */}
        {!showBuilder && notes.map((note) => (
          <NoteBox
            key={note.id}
            id={note.id}
            x={note.x}
            y={note.y}
            text={note.text}
            minimized={note.minimized}
            theme={theme}
            onUpdate={updateNote}
            onDelete={deleteNote}
          />
        ))}
      </div>

      {/* Widget Builder Modal */}
      {showBuilder && (
        <WidgetBuilder
          theme={theme}
          onSave={handleSaveWidget}
          onCancel={handleCancelBuilder}
          existingConfig={editingWidget || undefined}
        />
      )}
    </div>
  );
}
