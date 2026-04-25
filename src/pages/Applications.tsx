import React, { useEffect, useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { FileText, Clock, BarChart, CheckCircle, Clock3, XCircle, Loader2, ArrowUpRight } from 'lucide-react';
import { cn } from '../lib/utils';
import { Link } from 'react-router-dom';

interface Application {
  id: string;
  job_id: string;
  job_title: string;
  job_description: string;
  status: 'applied' | 'shortlisted' | 'interview' | 'rejected';
  match_score: number;
  applied_at: string;
}

export default function Applications() {
  const { token } = useAuth();
  const [applications, setApplications] = useState<Application[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchApplications = async () => {
      try {
        const apiUrl = import.meta.env.VITE_APP_URL || '';
        const res = await fetch(`${apiUrl}/api/applications`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setApplications(data);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchApplications();
  }, [token]);

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'applied':
        return { 
          icon: Clock3, 
          label: 'Applied', 
          color: 'text-blue-500 bg-blue-50 dark:bg-blue-950/30 border-blue-100 dark:border-blue-900/50' 
        };
      case 'shortlisted':
        return { 
          icon: CheckCircle, 
          label: 'Shortlisted', 
          color: 'text-indigo-500 bg-indigo-50 dark:bg-indigo-950/30 border-indigo-100 dark:border-indigo-900/50' 
        };
      case 'interview':
        return { 
          icon: BarChart, 
          label: 'Interviewing', 
          color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-100 dark:border-emerald-900/50' 
        };
      case 'rejected':
        return { 
          icon: XCircle, 
          label: 'Not Selected', 
          color: 'text-rose-500 bg-rose-50 dark:bg-rose-950/30 border-rose-100 dark:border-rose-900/50' 
        };
      default:
        return { 
          icon: Clock, 
          label: status, 
          color: 'text-slate-500 bg-slate-50 border-slate-100' 
        };
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-500';
    if (score >= 60) return 'text-amber-500';
    return 'text-rose-500';
  };

  return (
    <div className="max-w-5xl mx-auto pb-20">
      <header className="mb-12">
        <h2 className="text-4xl sm:text-5xl font-black tracking-tight text-slate-900 dark:text-white leading-none mb-4 transition-colors uppercase">Track Applications</h2>
        <p className="text-slate-500 font-medium text-lg">Monitor your journey from application to interview.</p>
      </header>

      {isLoading ? (
        <div className="py-20 flex flex-col items-center justify-center text-slate-500 font-bold uppercase tracking-widest">
          <Loader2 className="w-12 h-12 animate-spin mb-4 text-indigo-600" />
          <p>Loading History...</p>
        </div>
      ) : applications.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border-2 border-slate-900 dark:border-slate-800 rounded-[32px] p-16 text-center shadow-[8px_8px_0px_0px_rgba(15,23,42,1)] transition-colors">
          <FileText className="w-16 h-16 text-slate-200 dark:text-slate-800 mx-auto mb-6" />
          <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2 uppercase">No applications yet</h3>
          <p className="text-slate-500 font-medium mb-8">Start applying to jobs to see them tracked here.</p>
          <Link to="/jobs" className="inline-flex items-center px-8 py-4 bg-indigo-600 text-white font-black rounded-xl hover:bg-indigo-700 transition-all uppercase tracking-widest text-sm shadow-[4px_4px_0px_0px_rgba(49,46,129,1)]">
            Browse Jobs <ArrowUpRight className="ml-2 w-5 h-5" />
          </Link>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border-2 border-slate-900 dark:border-slate-800 rounded-[32px] shadow-[8px_8px_0px_0px_rgba(15,23,42,1)] dark:shadow-[8px_8px_0px_0px_rgba(15,23,42,0.5)] overflow-hidden transition-colors">
          <div className="hidden md:grid grid-cols-12 gap-4 p-6 border-b-2 border-slate-900 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-black text-[10px] uppercase tracking-widest text-slate-400">
            <div className="col-span-5">Job Details</div>
            <div className="col-span-3 text-center">Status</div>
            <div className="col-span-2 text-center">Match Score</div>
            <div className="col-span-2 text-right">Applied On</div>
          </div>
          
          <div className="divide-y-2 divide-slate-100 dark:divide-slate-800">
            {applications.map((app) => {
              const status = getStatusConfig(app.status);
              return (
                <div key={app.id} className="p-6 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/30">
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                    <div className="col-span-1 md:col-span-5">
                      <h4 className="text-lg font-black text-slate-900 dark:text-white mb-1 group-hover:text-indigo-600 transition-colors">
                        {app.job_title}
                      </h4>
                      <p className="text-sm text-slate-500 font-medium line-clamp-1">{app.job_description}</p>
                    </div>
                    
                    <div className="col-span-1 md:col-span-3 flex justify-center">
                      <span className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-xl border-2 text-xs font-black uppercase tracking-widest",
                        status.color
                      )}>
                        <status.icon className="w-4 h-4" />
                        {status.label}
                      </span>
                    </div>

                    <div className="col-span-1 md:col-span-2 text-center">
                      <div className="flex flex-col items-center">
                        <span className={cn("text-2xl font-black", getScoreColor(app.match_score))}>
                          {app.match_score}%
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">ATS Match</span>
                      </div>
                    </div>

                    <div className="col-span-1 md:col-span-2 text-right">
                      <div className="text-sm font-bold text-slate-600 dark:text-slate-400 flex items-center justify-end gap-2">
                        <Clock className="w-4 h-4 text-slate-300" />
                        {new Date(app.applied_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
