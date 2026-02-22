
import React from 'react';
import { 
  ArrowLeft, Compass, Shield, Users, HeartPulse, 
  Fingerprint, Scale, HelpCircle,
  BookOpen, Star, Play
} from 'lucide-react';
import { Course } from '../types';

interface KnowledgePathwaysProps {
  onGoBack: () => void;
  onEnroll: (course: Course) => void;
}

const PATHWAYS_DATA = [
  {
    id: 'kp1',
    title: 'Conscious Autonomy: Reclaiming Agency in a Digitized World',
    provider: 'Sovereign Core Academy',
    description: 'Explores personal, psychological, and ethical autonomy in modern systems—technology, work, faith, and community. Learners examine consent, boundaries, data ownership, and self-governance while developing discernment skills that support empowered decision-making without isolation or ego inflation.',
    image: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&q=80&w=800',
    icon: <Shield className="w-6 h-6" />,
    tier: 'Elite' as const,
    enrolled: 1240
  },
  {
    id: 'kp2',
    title: 'Trust, Power, and Accountability in Human Systems',
    provider: 'Governance Research Lab',
    description: 'A deep dive into how power operates across organizations, institutions, and leadership structures. This course helps participants recognize healthy authority versus coercive control, integrating psychological insight, moral responsibility, and governance principles applicable to both digital and physical communities.',
    image: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&q=80&w=800',
    icon: <Users className="w-6 h-6" />,
    tier: 'Professional' as const,
    enrolled: 890
  },
  {
    id: 'kp3',
    title: 'Trauma-Informed Conscious Leadership',
    provider: 'Neural Ethics Institute',
    description: 'Designed for providers, facilitators, and organizational leaders, this course bridges clinical mental health principles with ethical leadership. Participants learn how unresolved trauma shapes authority, communication, and culture—and how conscious leadership restores safety, clarity, and integrity without over-spiritualizing harm.',
    image: 'https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&q=80&w=800',
    icon: <HeartPulse className="w-6 h-6" />,
    tier: 'Professional' as const,
    enrolled: 2150
  },
  {
    id: 'kp4',
    title: 'Identity, Integrity, and the Self Beyond Performance',
    provider: 'The Human Dignity Collective',
    description: 'Examines how identity becomes fragmented under performance-based systems (career, religion, productivity culture). Learners are guided to distinguish authentic selfhood from imposed roles, cultivating values-based integrity that supports psychological resilience, relational health, and long-term purpose.',
    image: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&q=80&w=800',
    icon: <Fingerprint className="w-6 h-6" />,
    tier: 'Basic' as const,
    enrolled: 3420
  },
  {
    id: 'kp5',
    title: 'Decentralized Ethics: Technology, Privacy, and Human Dignity',
    provider: 'Blockchain Wellness Group',
    description: 'Introduces participants to ethical frameworks behind decentralized systems and blockchain-enabled platforms. The course emphasizes data sovereignty, informed consent, and human dignity—helping users and institutions understand how technology can serve people rather than exploit them.',
    image: 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?auto=format&fit=crop&q=80&w=800',
    icon: <Scale className="w-6 h-6" />,
    tier: 'Elite' as const,
    enrolled: 1560
  },
  {
    id: 'kp6',
    title: 'Healing Without Dependency: Growth, Discernment, and Responsibility',
    provider: 'Autonomy Healing Circle',
    description: 'Challenges unhealthy models of healing that foster reliance on authority figures, platforms, or ideologies. Participants learn how sustainable growth requires accountability, community wisdom, and personal responsibility—balancing support with autonomy in both personal development and professional settings.',
    image: 'https://images.unsplash.com/photo-1518152006812-edab29b069ac?auto=format&fit=crop&q=80&w=800',
    icon: <HelpCircle className="w-6 h-6" />,
    tier: 'Basic' as const,
    enrolled: 2840
  }
];

const KnowledgePathways: React.FC<KnowledgePathwaysProps> = ({ onGoBack, onEnroll }) => {
  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700 pb-32">
      <header className="space-y-6">
        <button 
          onClick={onGoBack} 
          className="flex items-center gap-2 text-slate-500 hover:text-white transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span className="text-[10px] font-black uppercase tracking-[0.4em]">Sovereign Learning</span>
        </button>
        
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-2">
            <h2 className="text-4xl font-black text-white uppercase tracking-tighter leading-none">Knowledge Pathways</h2>
            <p className="text-blue-400/60 text-[10px] font-black uppercase tracking-[0.4em]">Discovering Autonomy & Ethical Growth</p>
          </div>
          <div className="flex items-center gap-4 p-4 glass-panel rounded-2xl border-white/5 shadow-2xl">
            <Compass className="w-6 h-6 text-teal-400" />
            <div className="text-left">
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Active Discovery</p>
              <p className="text-xs font-bold text-white uppercase">6 Sovereign Modules Identified</p>
            </div>
          </div>
        </div>
      </header>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {PATHWAYS_DATA.map((pathway) => (
          <div 
            key={pathway.id} 
            className="glass-panel group rounded-[3rem] overflow-hidden flex flex-col border-white/5 hover:border-blue-500/30 transition-all duration-500 shadow-2xl"
          >
            <div className="h-64 relative overflow-hidden shrink-0">
              <img 
                src={pathway.image} 
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-[4s] ease-out" 
                alt={pathway.title}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#05070a] via-transparent to-transparent opacity-60" />
              <div className="absolute top-6 left-6">
                <div className="p-3 bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl text-blue-400 group-hover:scale-110 transition-transform">
                  {pathway.icon}
                </div>
              </div>
              <div className="absolute top-6 right-6">
                 <div className="px-4 py-2 bg-blue-600/80 backdrop-blur-md rounded-full border border-white/10 flex items-center gap-2">
                    <span className="text-[9px] font-black text-white uppercase tracking-widest">{pathway.tier} PATHWAY</span>
                 </div>
              </div>
            </div>

            <div className="p-10 space-y-6 flex-1 flex flex-col">
              <div className="space-y-2">
                <span className="text-teal-400 text-[9px] font-black uppercase tracking-[0.4em]">{pathway.provider}</span>
                <h3 className="text-2xl font-black text-white tracking-tighter uppercase leading-tight group-hover:text-blue-400 transition-colors">
                  {pathway.title}
                </h3>
              </div>

              <p className="text-sm text-slate-400 leading-relaxed font-light flex-1">
                {pathway.description}
              </p>

              <div className="pt-6 border-t border-white/5 space-y-6">
                <div className="flex justify-between items-center">
                   <div className="flex items-center gap-2">
                     <Users className="w-4 h-4 text-slate-600" />
                     <span className="text-[10px] font-mono font-bold text-slate-500">{pathway.enrolled.toLocaleString()} Nodes Enrolled</span>
                   </div>
                   <div className="flex gap-1">
                     {[...Array(5)].map((_, i) => <Star key={i} className={`w-3 h-3 ${i < 4 ? 'text-yellow-500 fill-yellow-500' : 'text-slate-700'}`} />)}
                   </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <button 
                    onClick={() => onEnroll({
                      id: pathway.id,
                      title: pathway.title,
                      provider: pathway.provider,
                      tier: pathway.tier,
                      enrolled: pathway.enrolled,
                      image: pathway.image,
                      progress: 0
                    })}
                    className="flex items-center justify-center gap-3 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all shadow-xl hover:-translate-y-1 active:scale-95"
                  >
                    <Play className="w-4 h-4 fill-white" /> Enroll Node
                  </button>
                  <button className="flex items-center justify-center gap-3 py-4 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95">
                    <BookOpen className="w-4 h-4" /> Syllabus
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </section>

      <div className="glass-panel p-10 rounded-[2.5rem] bg-gradient-to-r from-teal-900/10 to-blue-900/10 border border-white/10 text-center space-y-4">
        <h4 className="text-xl font-black text-white uppercase tracking-tighter">Sovereign Certification Layer</h4>
        <p className="text-slate-400 text-sm max-w-2xl mx-auto font-light">
          Each completed pathway generates a unique verifiable credential anchored to your Conscious Identity node. These tokens of achievement represent deep work in personal and professional autonomy.
        </p>
      </div>
    </div>
  );
};

export default KnowledgePathways;
