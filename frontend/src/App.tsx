import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import LandingPage from './landing/components/LandingPage';
import StandardAnalyticsApp from './StandardAnalyticsApp';
import CustomDashboardApp from './customdash/App';
import ProfilePage from './components/ProfilePage';

type RootView = 'landing' | 'standard' | 'custom' | 'profile';

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="fixed top-4 left-4 z-[500] rounded-full border border-white/10 bg-black/70 px-3 py-2 text-white backdrop-blur-sm transition-colors hover:bg-black/85"
      title="Back to landing page"
    >
      <span className="flex items-center gap-2 text-[12px] font-bold tracking-[0.2em] uppercase">
        <ArrowLeft size={14} />
        Back
      </span>
    </button>
  );
}

export default function App() {
  const [view, setView] = useState<RootView>('landing');
  const [profileReturnView, setProfileReturnView] = useState<'standard' | 'custom'>('standard');

  const openProfileFrom = (source: 'standard' | 'custom') => {
    setProfileReturnView(source);
    setView('profile');
  };

  if (view === 'landing') {
    return (
      <LandingPage
        onEnterDashboard={() => setView('standard')}
        onEnterCustomDashboard={() => setView('custom')}
      />
    );
  }

  if (view === 'custom') {
    return <CustomDashboardApp onBackToLanding={() => setView('landing')} onOpenProfile={() => openProfileFrom('custom')} />;
  }

  if (view === 'profile') {
    return <ProfilePage onBack={() => setView(profileReturnView)} />;
  }

  return (
    <div className="relative">
      <BackButton onClick={() => setView('landing')} />
      <StandardAnalyticsApp onOpenProfile={() => openProfileFrom('standard')} />
    </div>
  );
}
