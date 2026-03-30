import React, { useEffect } from 'react';
import { motion, useMotionValue, useSpring } from 'motion/react';
import { 
  ArrowRight, 
  Terminal, 
  ShieldCheck, 
  Activity, 
  Cpu, 
  Database, 
  Bell, 
  CheckCircle2,
  ChevronRight,
  Zap
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  ResponsiveContainer, 
  XAxis, 
  YAxis, 
  Tooltip,
  ReferenceDot
} from 'recharts';

const chartData = [
  { time: '00:00', value: 30 },
  { time: '04:00', value: 32 },
  { time: '08:00', value: 28 },
  { time: '12:00', value: 35 },
  { time: '16:00', value: 31 },
  { time: '20:00', value: 65 }, // Anomaly
  { time: '24:00', value: 33 },
];

const stats = [
  { label: 'PROBES DEPLOYED', value: '42,901' },
  { label: 'WASTE RECLAIMED', value: '$14.2M' },
  { label: 'TELEMETRY LATENCY', value: '< 15MS' },
  { label: 'COST ATTRIBUTION', value: '100%' },
];

const pipelineSteps = [
  { id: '01', title: 'INGESTION', desc: 'Harvesting CloudWatch telemetry and CUR files at sub-second intervals.' },
  { id: '02', title: 'ANALYSIS', desc: 'Neural modeling of historical spend patterns vs deployment metadata.' },
  { id: '03', title: 'DETECTION', desc: 'Real-time isolation of cost spikes linked to specific commit IDs.' },
  { id: '04', title: 'ALERTING', desc: 'Multi-channel routing via Slack, PagerDuty, and CLI triggers.' },
  { id: '05', title: 'RESOLUTION', desc: 'Automated resource lifecycle actions or manual override confirmation.' },
];

export default function LandingPage({
  onEnterDashboard,
  onEnterCustomDashboard,
}: {
  onEnterDashboard: () => void;
  onEnterCustomDashboard: () => void;
}) {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const springConfig = { damping: 25, stiffness: 150 };
  const glowX = useSpring(mouseX, springConfig);
  const glowY = useSpring(mouseY, springConfig);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mouseX.set(e.clientX);
      mouseY.set(e.clientY);
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [mouseX, mouseY]);

  return (
    <div className="min-h-screen celestial-bg text-white font-sans selection:bg-[#820263] selection:text-white overflow-x-hidden relative">
      {/* Mouse Glow */}
      <motion.div
        style={{
          x: glowX,
          y: glowY,
          translateX: '-50%',
          translateY: '-50%',
        }}
        className="fixed top-0 left-0 w-[600px] h-[600px] bg-[#820263]/10 rounded-full blur-[120px] pointer-events-none z-0"
      />
      {/* Header */}
      <header className="fixed top-0 left-0 w-full z-50 px-6 py-4 flex items-center justify-between backdrop-blur-md border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 border-2 border-[#ff00ff] flex items-center justify-center shadow-[0_0_10px_#ff00ff]">
            <div className="w-1.5 h-1.5 bg-[#ff00ff] shadow-[0_0_5px_#ff00ff]" />
          </div>
          <span className="text-xl font-bold tracking-tighter uppercase font-brand text-[#ff00ff] drop-shadow-[0_0_8px_#ff00ff]">CloudSense</span>
        </div>
        
        <nav className="hidden md:flex items-center gap-8 text-[10px] font-bold tracking-[0.2em] text-gray-400">
          <a href="#" className="hover:text-white transition-colors">DASHBOARD</a>
          <a href="#" className="hover:text-white transition-colors">MONITORING</a>
          <a href="#" className="hover:text-white transition-colors">PIPELINE</a>
          <a href="#" className="hover:text-white transition-colors">DOCS</a>
        </nav>

        <button 
          onClick={onEnterDashboard}
          className="bg-[#820263] hover:bg-[#820263]/80 text-[10px] font-bold tracking-widest px-4 py-2 rounded flex items-center gap-2 transition-all group"
        >
          DASHBOARD <ArrowRight size={12} className="group-hover:translate-x-1 transition-transform" />
        </button>
      </header>

      {/* Hero Section */}
      <section className="pt-40 pb-20 px-6 max-w-7xl mx-auto text-center">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-block px-3 py-1 border border-[#820263]/30 bg-[#820263]/10 rounded-full text-[9px] font-bold tracking-[0.3em] text-[#820263] mb-8"
        >
          AWS COST INTELLIGENCE
        </motion.div>
        
        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tighter leading-[0.9] mb-8 uppercase"
        >
          Your AWS costs don't lie.<br />
          <span className="text-gray-500">You just can't hear them.</span>
        </motion.h1>

        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-gray-400 text-sm md:text-base max-w-2xl mx-auto mb-12 font-medium tracking-tight"
        >
          Real-time cost telemetry for modern cloud architectures. Eliminate the lag between deployment and billing surprises.
        </motion.p>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mb-24 space-y-10"
        >
          <div className="text-sm font-bold tracking-[0.8em] text-[#820263] uppercase drop-shadow-[0_0_10px_rgba(130,2,99,0.5)]">Get Started</div>
          <div className="flex flex-col md:flex-row justify-center gap-6 max-w-3xl mx-auto">
            <button 
              onClick={onEnterDashboard}
              className="flex-1 bg-[#820263] hover:bg-[#820263]/80 py-5 rounded text-[11px] font-bold tracking-[0.2em] transition-all shadow-xl shadow-[#820263]/20 uppercase"
            >
              Standard Data Analytics
            </button>
            <button 
              onClick={onEnterCustomDashboard}
              className="flex-1 border border-[#820263]/40 hover:border-[#820263] py-5 rounded text-[11px] font-bold tracking-[0.2em] transition-all backdrop-blur-sm uppercase"
            >
              Customizable Dashboard
            </button>
          </div>
        </motion.div>

        {/* Hero Graphic */}
        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="relative max-w-4xl mx-auto bg-[#1a1a1a]/80 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden shadow-2xl"
        >
          <div className="p-4 border-b border-white/5 flex justify-between items-center bg-black/20">
            <div className="flex items-center gap-2">
              <Activity size={12} className="text-[#820263]" />
              <span className="text-[9px] font-bold tracking-widest text-gray-400 uppercase">Cost Monitor / Region: US-EAST-1</span>
            </div>
            <span className="text-[8px] font-bold tracking-widest text-gray-600 uppercase">Live-stream: 12ms lag</span>
          </div>
          
          <div className="h-64 w-full p-8 relative">
            <div className="absolute top-8 right-8 z-10">
              <div className="text-[10px] font-bold tracking-widest text-[#820263] uppercase flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-[#820263] rounded-full animate-pulse" />
                Anomaly Detected:
              </div>
            </div>
            
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <Line 
                  type="monotone" 
                  dataKey="value" 
                  stroke="#ffffff" 
                  strokeWidth={2} 
                  dot={false}
                  animationDuration={2000}
                />
                <ReferenceDot 
                  x="20:00" 
                  y={65} 
                  r={4} 
                  fill="#820263" 
                  stroke="none" 
                />
                <XAxis hide dataKey="time" />
                <YAxis hide domain={[0, 100]} />
                <Tooltip 
                  content={({ payload }) => {
                    if (payload && payload.length) {
                      return (
                        <div className="bg-black border border-white/10 p-2 rounded text-[10px] font-bold">
                          ${payload[0].value}k
                        </div>
                      );
                    }
                    return null;
                  }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-3 border-t border-white/5">
            <div className="p-6 border-r border-white/5 bg-black/10">
              <div className="text-[8px] font-bold text-gray-500 tracking-widest uppercase mb-1">Run Rate (Daily)</div>
              <div className="text-2xl font-bold tracking-tighter">$1,402.12</div>
            </div>
            <div className="p-6 border-r border-white/5 bg-black/10">
              <div className="text-[8px] font-bold text-gray-500 tracking-widest uppercase mb-1">Anomaly Gap</div>
              <div className="text-2xl font-bold tracking-tighter text-[#820263]">+$4,210.00</div>
            </div>
            <div className="p-6 bg-black/10">
              <div className="text-[8px] font-bold text-gray-500 tracking-widest uppercase mb-1">Est. Monthly</div>
              <div className="text-2xl font-bold tracking-tighter">$42.8k</div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Pipeline Section */}
      <section className="py-32 px-6 max-w-7xl mx-auto">
        <div className="flex justify-between items-end mb-24">
          <h2 className="text-5xl font-bold tracking-tighter uppercase">Data Ingestion Pipeline</h2>
          <span className="text-[9px] font-bold tracking-[0.3em] text-gray-600 uppercase">5-Stage Validation</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-24 gap-y-20 relative max-w-3xl mx-auto">
          {pipelineSteps.map((step, i) => {
            const isLeft = i % 2 === 0;
            const isLast = i === pipelineSteps.length - 1;
            
            return (
              <div key={i} className={`relative ${isLast && isLeft ? 'md:col-span-2 md:max-w-[calc(50%-48px)]' : ''}`}>
                <motion.div 
                  whileHover={{ y: -5 }}
                  className="h-full p-6 bg-[#820263] border border-[#820263]/60 rounded-lg relative group overflow-hidden shadow-[0_0_20px_rgba(130,2,99,0.4)] hover:shadow-[0_0_40px_rgba(130,2,99,0.6)] transition-all"
                >
                  <div className="absolute top-0 left-0 w-full h-1 bg-[#820263]/0 group-hover:bg-white transition-all shadow-[0_0_15px_#fff]" />
                  <div className="text-3xl font-bold text-white/20 mb-3 group-hover:text-white/40 transition-colors">{step.id}</div>
                  <h3 className="text-xs font-bold tracking-widest mb-2 uppercase text-white">{step.title}</h3>
                  <p className="text-[10px] text-white/70 leading-relaxed font-medium">{step.desc}</p>
                </motion.div>

                {/* Horizontal Arrow (Right) */}
                {!isLast && isLeft && (
                  <div className="hidden md:flex absolute top-1/2 -right-24 -translate-y-1/2 items-center text-[#820263] z-10">
                    <div className="w-24 h-0.5 bg-[#820263]/30" />
                    <ChevronRight size={20} className="drop-shadow-[0_0_8px_#820263]" />
                  </div>
                )}

                {/* Snake Connector (Down -> Left -> Down) */}
                {!isLast && !isLeft && (
                  <div className="hidden md:block absolute -bottom-20 left-1/2 w-[calc(100%+96px)] h-20 pointer-events-none -translate-x-full">
                    <div className="absolute top-0 right-0 w-0.5 h-10 bg-[#820263]/30" />
                    <div className="absolute top-10 right-0 w-full h-0.5 bg-[#820263]/30">
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[#820263]">
                        <ChevronRight size={24} className="rotate-180 drop-shadow-[0_0_8px_#820263]" />
                      </div>
                    </div>
                    <div className="absolute top-10 left-0 w-0.5 h-10 bg-[#820263]/30" />
                  </div>
                )}

                {/* Mobile Arrow */}
                {!isLast && (
                  <div className="md:hidden flex justify-center py-8 text-[#820263]">
                    <ChevronRight size={24} className="rotate-90 drop-shadow-[0_0_8px_#820263]" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Terminal Section */}
      <section className="py-32 px-6 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-16 items-center">
        <div className="lg:col-span-4 space-y-12">
          <div className="space-y-4">
            <div className="w-10 h-10 bg-[#820263]/20 rounded flex items-center justify-center border border-[#820263]/30">
              <Terminal size={20} className="text-[#820263]" />
            </div>
            <h3 className="text-2xl font-bold tracking-tighter uppercase">CLI First</h3>
            <p className="text-gray-500 text-sm leading-relaxed font-medium">
              Command every aspect of your cost stack from the terminal. No GUI overhead required for power users.
            </p>
          </div>

          <div className="space-y-4">
            <div className="w-10 h-10 bg-[#820263]/20 rounded flex items-center justify-center border border-[#820263]/30">
              <Zap size={20} className="text-[#820263]" />
            </div>
            <h3 className="text-2xl font-bold tracking-tighter uppercase">Closed Loop Automation</h3>
            <p className="text-gray-500 text-sm leading-relaxed font-medium">
              The system performs a closed-loop action by detecting an idle instance and automatically stopping or tagging it through the cloud SDK.
            </p>
          </div>
        </div>

        <div className="lg:col-span-8">
          <div className="bg-[#0a0a0a] border border-white/10 rounded-xl overflow-hidden shadow-2xl font-mono text-[10px] md:text-[12px]">
            <div className="px-4 py-2 bg-white/5 border-b border-white/5 flex items-center gap-2">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]" />
                <div className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]" />
                <div className="w-2.5 h-2.5 rounded-full bg-[#27c93f]" />
              </div>
              <span className="text-gray-500 ml-4">sense_probe --region us-west-2 --detailed-audit</span>
            </div>
            <div className="p-6 space-y-1.5">
              <div className="text-gray-500">[2023-11-24 14:02:11] INITIALIZING CLOUDSENSE CLUSTER AGENT...</div>
              <div className="text-green-500">[OK] Connected to CUR_S3_PROXIMA_01</div>
              <div className="text-green-500">[OK] CloudWatch Logs Stream Established</div>
              <div className="text-yellow-500">[WARN] Unused NAT Gateway detected in VPC-84921 (Cost: $1.08/hr)</div>
              <div className="text-yellow-500">[WARN] Idle RDS Instance: db.r5.xlarge (Cost: $0.34/hr)</div>
              <div className="text-[#820263]">[INFO] Calculating optimization path...</div>
              <div className="text-white font-bold mt-4">&gt;&gt;&gt; POTENTIAL MONTHLY SAVINGS: $1,022.40</div>
              <div className="text-gray-500">--- Execution complete. Waiting for next polling cycle. ---</div>
              <motion.div 
                animate={{ opacity: [1, 0] }}
                transition={{ repeat: Infinity, duration: 0.8 }}
                className="w-2 h-4 bg-white inline-block"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-20 px-6 border-t border-white/5 bg-black">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex gap-8 text-[9px] font-bold tracking-[0.2em] text-gray-500 uppercase order-2 md:order-1">
            <a href="#" className="hover:text-white transition-colors">Documentation</a>
            <a href="#" className="hover:text-white transition-colors">System Status</a>
            <a href="#" className="hover:text-white transition-colors">Security</a>
          </div>

          <div className="text-[9px] font-bold tracking-[0.2em] text-gray-700 uppercase order-3 md:order-2">
            © 2024 CLOUDSENSE INTELLIGENCE.
          </div>

          <div className="space-y-2 text-center md:text-right order-1 md:order-3">
            <div className="flex items-center justify-center md:justify-end gap-2">
              <div className="w-4 h-4 border-2 border-[#ff00ff] flex items-center justify-center shadow-[0_0_8px_#ff00ff]">
                <div className="w-1 h-1 bg-[#ff00ff] shadow-[0_0_4px_#ff00ff]" />
              </div>
              <span className="text-lg font-bold tracking-tighter uppercase font-brand text-[#ff00ff] drop-shadow-[0_0_8px_#ff00ff]">CloudSense</span>
            </div>
            <p className="text-[9px] font-bold tracking-[0.2em] text-gray-600 uppercase">Built for AWS. Built for speed.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
