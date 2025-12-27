
import React from 'react';
import { BookOpen, PlayCircle, Clock, ChevronRight, Trophy, Search } from 'lucide-react';
import { Course } from '../types';

interface MyCoursesProps {
  enrolledCourses: Course[];
  onNavigateToUniversity: () => void;
}

const MyCourses: React.FC<MyCoursesProps> = ({ enrolledCourses, onNavigateToUniversity }) => {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-white mb-2">My Sovereign Learning</h2>
          <p className="text-slate-400">Manage your active knowledge pathways and track your progress.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-4 py-2 bg-blue-600/10 border border-blue-500/20 rounded-xl flex items-center gap-2">
            <Trophy className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-bold text-blue-100">{enrolledCourses.length} Enrolled</span>
          </div>
        </div>
      </header>

      {enrolledCourses.length === 0 ? (
        <div className="glass-panel p-12 rounded-[2.5rem] text-center space-y-6 flex flex-col items-center border-dashed border-white/20">
          <div className="w-20 h-20 bg-blue-600/10 rounded-full flex items-center justify-center">
            <BookOpen className="w-10 h-10 text-blue-400" />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-white mb-2">Your Knowledge Vault is Empty</h3>
            <p className="text-slate-400 max-w-md mx-auto">Explore the hub to find courses on decentralization, wellness, and ethical technology.</p>
          </div>
          <button 
            onClick={onNavigateToUniversity}
            className="px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold transition-all shadow-xl shadow-blue-900/30 flex items-center gap-2"
          >
            Explore Knowledge Pathways <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {enrolledCourses.map((course) => (
            <div key={course.id} className="glass-panel rounded-3xl overflow-hidden flex flex-col sm:flex-row group border-blue-500/10 hover:border-blue-500/30 transition-all">
              <div className="w-full sm:w-48 h-48 sm:h-auto relative overflow-hidden">
                <img 
                  src={course.image} 
                  alt={course.title} 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                />
                <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors" />
                <div className="absolute top-3 left-3 px-2 py-1 bg-blue-600 text-[10px] font-bold text-white rounded-lg uppercase tracking-widest">
                  {course.tier}
                </div>
              </div>
              <div className="flex-1 p-6 flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold text-teal-400 uppercase tracking-widest">{course.provider}</span>
                    <span className="text-[10px] text-slate-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> 2h left
                    </span>
                  </div>
                  <h4 className="text-xl font-bold text-white mb-3 leading-tight group-hover:text-blue-400 transition-colors">{course.title}</h4>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] uppercase font-bold tracking-widest">
                      <span className="text-slate-400">Progress</span>
                      <span className="text-blue-400">{course.progress || 0}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-blue-600 to-teal-400 transition-all duration-1000" 
                        style={{ width: `${course.progress || 0}%` }}
                      />
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <button className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 transition-all">
                    <PlayCircle className="w-4 h-4" /> Resume Module
                  </button>
                  <button className="p-3 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 transition-colors">
                    <Search className="w-4 h-4 text-slate-400" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Recommended for You Section */}
      {enrolledCourses.length > 0 && (
        <section className="pt-8">
          <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <Trophy className="text-teal-400 w-5 h-5" /> Suggested Next Steps
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="glass-panel p-5 rounded-3xl border-white/5 hover:bg-white/10 transition-colors cursor-pointer group">
                <div className="w-full aspect-video rounded-2xl overflow-hidden mb-4">
                  <img src={`https://picsum.photos/seed/suggest${i}/400/225`} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                </div>
                <h5 className="font-bold text-white text-sm mb-1 group-hover:text-blue-400 transition-colors">Advanced Node Security {i}</h5>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Provider Alpha</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default MyCourses;