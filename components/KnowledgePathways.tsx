import React, { useEffect, useState } from 'react';
import {
  ArrowLeft, Compass, Shield, Users, HeartPulse,
  Fingerprint, Scale, HelpCircle,
  BookOpen, Star, Play, X
} from 'lucide-react';
import { Course } from '../types';

interface KnowledgePathwaysProps {
  onGoBack: () => void;
  onEnroll: (course: Course) => void;
  backendUrl: string;
}

const normalizeCourse = (rawCourse: any): Course => ({
  id: String(rawCourse?.id || ''),
  title: String(rawCourse?.title || 'Untitled pathway'),
  provider: String(rawCourse?.provider || 'Conscious Network'),
  description: rawCourse?.description ? String(rawCourse.description) : undefined,
  image: String(rawCourse?.image || ''),
  tier:
    rawCourse?.tier === 'Elite' || rawCourse?.tier === 'Professional' || rawCourse?.tier === 'Basic'
      ? rawCourse.tier
      : 'Basic',
  enrolled: Number(rawCourse?.enrolled || rawCourse?.enrolledCount || 0),
  progress: Number(rawCourse?.progress ?? rawCourse?.progressScore ?? 0),
  progressScore: Number(rawCourse?.progressScore ?? rawCourse?.progress ?? 0),
  status: rawCourse?.status ? String(rawCourse.status) : undefined,
  enrollmentStatus: rawCourse?.enrollmentStatus || null,
});

const getCourseIcon = (courseId: string) => {
  switch (courseId) {
    case 'kp1':
      return <Shield className="w-6 h-6" />;
    case 'kp2':
      return <Users className="w-6 h-6" />;
    case 'kp3':
      return <HeartPulse className="w-6 h-6" />;
    case 'kp4':
      return <Fingerprint className="w-6 h-6" />;
    case 'kp5':
      return <Scale className="w-6 h-6" />;
    default:
      return <HelpCircle className="w-6 h-6" />;
  }
};

const KnowledgePathways: React.FC<KnowledgePathwaysProps> = ({ onGoBack, onEnroll, backendUrl }) => {
  const [selectedSyllabusId, setSelectedSyllabusId] = useState<string | null>(null);
  const [pathways, setPathways] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const selectedSyllabus = pathways.find((pathway) => pathway.id === selectedSyllabusId) || null;

  useEffect(() => {
    let isMounted = true;

    const loadPathways = async () => {
      setIsLoading(true);
      setLoadError('');
      try {
        const response = await fetch(`${backendUrl}/api/courses`);
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data?.error || 'Unable to load courses');
        }
        if (isMounted) {
          setPathways(Array.isArray(data.courses) ? data.courses.map(normalizeCourse) : []);
        }
      } catch (error) {
        if (isMounted) {
          setPathways([]);
          setLoadError(error instanceof Error ? error.message : 'Unable to load courses');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadPathways();
    return () => {
      isMounted = false;
    };
  }, [backendUrl]);

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
              <p className="text-xs font-bold text-white uppercase">
                {isLoading ? 'Loading modules' : `${pathways.length} Sovereign Modules Identified`}
              </p>
            </div>
          </div>
        </div>
      </header>

      {isLoading && (
        <div className="glass-panel p-10 rounded-[2rem] border-white/10 text-center text-slate-300">
          Loading live course pathways...
        </div>
      )}

      {!isLoading && loadError && (
        <div className="glass-panel p-10 rounded-[2rem] border-red-500/20 bg-red-500/5 text-center">
          <h3 className="text-lg font-black text-white uppercase tracking-tight">Courses unavailable</h3>
          <p className="text-sm text-slate-400 mt-2">{loadError}</p>
        </div>
      )}

      {!isLoading && !loadError && pathways.length === 0 && (
        <div className="glass-panel p-10 rounded-[2rem] border-white/10 text-center">
          <h3 className="text-lg font-black text-white uppercase tracking-tight">No courses published yet</h3>
          <p className="text-sm text-slate-400 mt-2">Published provider and admin courses will appear here.</p>
        </div>
      )}

      {!isLoading && !loadError && pathways.length > 0 && (
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          {pathways.map((pathway) => (
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
                    {getCourseIcon(pathway.id)}
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
                  {pathway.description || 'Course details are being prepared by the owner.'}
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
                      onClick={() => onEnroll({ ...pathway, progress: 0 })}
                      className="flex items-center justify-center gap-3 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all shadow-xl hover:-translate-y-1 active:scale-95"
                    >
                      <Play className="w-4 h-4 fill-white" /> Enroll Node
                    </button>
                    <button
                      onClick={() => setSelectedSyllabusId(pathway.id)}
                      className="flex items-center justify-center gap-3 py-4 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95"
                    >
                      <BookOpen className="w-4 h-4" /> Syllabus
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </section>
      )}

      <div className="glass-panel p-10 rounded-[2.5rem] bg-gradient-to-r from-teal-900/10 to-blue-900/10 border border-white/10 text-center space-y-4">
        <h4 className="text-xl font-black text-white uppercase tracking-tighter">Sovereign Certification Layer</h4>
        <p className="text-slate-400 text-sm max-w-2xl mx-auto font-light">
          Each completed pathway generates a unique verifiable credential anchored to your Conscious Identity node. These achievement records represent deep work in personal and professional autonomy.
        </p>
      </div>

      {selectedSyllabus && (
        <div className="fixed inset-0 z-[180] bg-black/85 backdrop-blur-sm p-4 flex items-center justify-center">
          <div className="glass-panel w-full max-w-3xl rounded-[2rem] border border-white/10 shadow-2xl overflow-hidden animate-in zoom-in duration-300">
            <div className="relative h-56 sm:h-64">
              <img src={selectedSyllabus.image} alt={selectedSyllabus.title} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#05070a] via-black/30 to-transparent" />
              <button
                onClick={() => setSelectedSyllabusId(null)}
                className="absolute top-4 right-4 p-2 rounded-xl bg-black/50 hover:bg-black/70 text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="absolute bottom-4 left-4 right-4">
                <p className="text-[10px] uppercase tracking-widest text-blue-300 font-black">{selectedSyllabus.provider}</p>
                <h4 className="text-2xl sm:text-3xl font-black text-white tracking-tight mt-1">{selectedSyllabus.title}</h4>
              </div>
            </div>
            <div className="p-6 sm:p-8 space-y-5">
              <h5 className="text-[11px] uppercase tracking-widest text-slate-400 font-black">Syllabus Preview</h5>
              <ul className="space-y-3">
                <li className="p-3 bg-white/5 border border-white/10 rounded-xl text-sm text-slate-200">Module 1: Foundations and Context</li>
                <li className="p-3 bg-white/5 border border-white/10 rounded-xl text-sm text-slate-200">Module 2: Applied Frameworks and Case Labs</li>
                <li className="p-3 bg-white/5 border border-white/10 rounded-xl text-sm text-slate-200">Module 3: Personal Integration and Governance Practice</li>
              </ul>
              <p className="text-xs text-slate-400 leading-relaxed">
                Full syllabus expands after enrollment and includes assessments, guided prompts, and completion criteria.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => {
                    onEnroll({ ...selectedSyllabus, progress: 0 });
                    setSelectedSyllabusId(null);
                  }}
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black text-[11px] uppercase tracking-widest transition-colors"
                >
                  Enroll Pathway
                </button>
                <button
                  onClick={() => setSelectedSyllabusId(null)}
                  className="flex-1 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 rounded-xl font-black text-[11px] uppercase tracking-widest transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default KnowledgePathways;
