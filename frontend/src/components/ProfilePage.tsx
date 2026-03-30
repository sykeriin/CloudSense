import { ArrowLeft, Mail, ShieldCheck, Sparkles, User } from 'lucide-react';

export default function ProfilePage({ onBack }: { onBack: () => void }) {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-6">
      <div className="mx-auto max-w-[1200px]">
        <div className="flex items-center justify-between gap-4 mb-8">
          <button
            onClick={onBack}
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[12px] font-bold tracking-[0.2em] uppercase hover:bg-white/10 transition-colors flex items-center gap-2"
          >
            <ArrowLeft size={14} />
            Back
          </button>
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-[#111111] p-8 shadow-2xl">
          <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-6">
            <div className="rounded-[1.5rem] border border-white/10 bg-[#181818] p-8">
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-full bg-white/10 border border-white/10 flex items-center justify-center">
                  <User size={34} />
                </div>
                <div>
                  <div className="text-[12px] font-bold tracking-[0.3em] uppercase text-gray-500">Profile</div>
                  <h1 className="mt-2 text-5xl font-serif font-light">Durva Sharma</h1>
                  <div className="mt-2 text-[15px] text-gray-400">CloudSense dashboard owner and AWS cost intelligence operator.</div>
                </div>
              </div>

              <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="text-[11px] font-bold tracking-[0.2em] uppercase text-gray-500">Role</div>
                  <div className="mt-2 text-2xl font-serif">Admin</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="text-[11px] font-bold tracking-[0.2em] uppercase text-gray-500">Workspace</div>
                  <div className="mt-2 text-2xl font-serif">CloudSense</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="text-[11px] font-bold tracking-[0.2em] uppercase text-gray-500">Focus</div>
                  <div className="mt-2 text-2xl font-serif">FinOps</div>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="rounded-[1.5rem] border border-white/10 bg-[#181818] p-6">
                <div className="flex items-center gap-3 text-gray-300">
                  <Mail size={16} />
                  <span className="text-[13px] font-bold tracking-[0.2em] uppercase">Contact</span>
                </div>
                <div className="mt-4 text-lg">durva.sharma@cloudsense.ai</div>
              </div>

              <div className="rounded-[1.5rem] border border-white/10 bg-[#181818] p-6">
                <div className="flex items-center gap-3 text-gray-300">
                  <ShieldCheck size={16} />
                  <span className="text-[13px] font-bold tracking-[0.2em] uppercase">Access</span>
                </div>
                <div className="mt-4 text-lg">Standard dashboard, customizable dashboard, profile settings</div>
              </div>

              <div className="rounded-[1.5rem] border border-white/10 bg-[#181818] p-6">
                <div className="flex items-center gap-3 text-gray-300">
                  <Sparkles size={16} />
                  <span className="text-[13px] font-bold tracking-[0.2em] uppercase">Preferences</span>
                </div>
                <div className="mt-4 text-lg">Real-time cost monitoring, AI summaries, interactive widgets</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
