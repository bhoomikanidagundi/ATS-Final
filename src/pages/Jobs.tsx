import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { Briefcase, MapPin, DollarSign, Calendar, Search, Filter, Loader2, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';
import { cn } from '../lib/utils';

interface Job {
  id: string;
  title: string;
  description: string;
  required_skills: string[];
  experience_required: string;
  created_at: string;
}

interface Resume {
  id: string;
  filename: string;
}

export default function Jobs() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isApplying, setIsApplying] = useState<string | null>(null);
  const [selectedResume, setSelectedResume] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const apiUrl = import.meta.env.VITE_APP_URL || '';
        const [jobsRes, resumesRes] = await Promise.all([
          fetch(`${apiUrl}/api/jobs`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${apiUrl}/api/resumes`, { headers: { Authorization: `Bearer ${token}` } })
        ]);

        if (jobsRes.ok) {
          const jobsData = await jobsRes.json();
          setJobs(jobsData);
        }
        if (resumesRes.ok) {
          const resumesData = await resumesRes.json();
          setResumes(resumesData.resumes || []);
          if (resumesData.resumes?.length > 0) {
            setSelectedResume(resumesData.resumes[0].id);
          }
        }
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [token]);

  const handleApply = async (jobId: string) => {
    if (!selectedResume) {
      setErrorMessage("Please upload a resume first.");
      return;
    }

    setIsApplying(jobId);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const apiUrl = import.meta.env.VITE_APP_URL || '';
      const res = await fetch(`${apiUrl}/api/applications`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          job_id: jobId,
          resume_id: selectedResume
        })
      });

      if (res.ok) {
        setSuccessMessage("Application submitted successfully!");
        setTimeout(() => navigate('/applications'), 1500);
      } else {
        const data = await res.json();
        setErrorMessage(data.error || "Failed to apply.");
      }
    } catch (e) {
      setErrorMessage("Something went wrong. Please try again.");
    } finally {
      setIsApplying(null);
    }
  };

  const filteredJobs = jobs.filter(job => 
    job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    job.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-6xl mx-auto pb-20">
      <header className="mb-12">
        <h2 className="text-4xl sm:text-5xl font-black tracking-tight text-slate-900 dark:text-white leading-none mb-4 transition-colors">Find Your Next Role</h2>
        <p className="text-slate-500 font-medium text-lg">Browse curated opportunities and apply instantly with your optimized resumes.</p>
        
        <div className="mt-8 flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search jobs by title or keyword..." 
              className="w-full pl-12 pr-4 py-4 bg-white dark:bg-slate-900 border-2 border-slate-900 dark:border-slate-800 rounded-2xl text-slate-900 dark:text-white font-bold placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button className="px-8 py-4 bg-white dark:bg-slate-900 border-2 border-slate-900 dark:border-slate-800 rounded-2xl font-black text-slate-900 dark:text-white flex items-center justify-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">
            <Filter className="w-5 h-5" /> Filters
          </button>
        </div>
      </header>

      {successMessage && (
        <div className="mb-8 p-4 bg-emerald-50 dark:bg-emerald-950/30 border-2 border-emerald-200 dark:border-emerald-800/30 rounded-2xl flex items-center text-emerald-700 dark:text-emerald-400 animate-in fade-in slide-in-from-top-4 duration-300">
          <CheckCircle2 className="w-5 h-5 mr-3 flex-shrink-0" />
          <p className="text-sm font-bold">{successMessage}</p>
        </div>
      )}

      {errorMessage && (
        <div className="mb-8 p-4 bg-rose-50 dark:bg-rose-950/30 border-2 border-rose-200 dark:border-rose-800/30 rounded-2xl flex items-center text-rose-700 dark:text-rose-400 animate-in fade-in slide-in-from-top-4 duration-300">
          <AlertCircle className="w-5 h-5 mr-3 flex-shrink-0" />
          <p className="text-sm font-bold">{errorMessage}</p>
        </div>
      )}

      {isLoading ? (
        <div className="py-20 flex flex-col items-center justify-center text-slate-500 font-bold uppercase tracking-widest">
          <Loader2 className="w-12 h-12 animate-spin mb-4 text-indigo-600" />
          <p>Loading Jobs...</p>
        </div>
      ) : filteredJobs.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border-2 border-slate-900 dark:border-slate-800 rounded-[32px] p-16 text-center shadow-[8px_8px_0px_0px_rgba(15,23,42,1)] transition-colors">
          <Briefcase className="w-16 h-16 text-slate-200 dark:text-slate-800 mx-auto mb-6" />
          <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2 uppercase">No jobs found</h3>
          <p className="text-slate-500 font-medium">Try adjusting your search or check back later.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {filteredJobs.map((job) => (
            <div 
              key={job.id} 
              className="group bg-white dark:bg-slate-900 border-2 border-slate-900 dark:border-slate-800 rounded-[32px] p-8 shadow-[8px_8px_0px_0px_rgba(15,23,42,1)] dark:shadow-[8px_8px_0px_0px_rgba(15,23,42,0.5)] transition-all hover:translate-x-1 hover:-translate-y-1"
            >
              <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="px-3 py-1 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 text-[10px] font-black rounded-lg uppercase tracking-wider">
                      New Opportunity
                    </span>
                    <span className="text-slate-400 text-xs font-bold flex items-center">
                      <Calendar className="w-3 h-3 mr-1" />
                      {new Date(job.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-3 tracking-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                    {job.title}
                  </h3>
                  <div className="flex flex-wrap items-center gap-4 text-sm font-bold text-slate-500 mb-6">
                    <span className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-xl">
                      <Briefcase className="w-4 h-4" /> Full-Time
                    </span>
                    <span className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-xl">
                      <MapPin className="w-4 h-4" /> Remote
                    </span>
                    <span className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-xl">
                      <DollarSign className="w-4 h-4" /> Competitive
                    </span>
                  </div>
                  
                  <p className="text-slate-600 dark:text-slate-400 font-medium mb-6 line-clamp-3">
                    {job.description}
                  </p>

                  <div className="flex flex-wrap gap-2">
                    {job.required_skills?.map((skill, i) => (
                      <span key={i} className="px-3 py-1 bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="lg:w-72 flex flex-col gap-4">
                  <div className="bg-slate-50 dark:bg-slate-950 p-6 rounded-2xl border-2 border-slate-100 dark:border-slate-800">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-3">
                      Apply with Resume
                    </label>
                    <select 
                      className="w-full bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                      value={selectedResume}
                      onChange={(e) => setSelectedResume(e.target.value)}
                    >
                      {resumes.length > 0 ? (
                        resumes.map(r => (
                          <option key={r.id} value={r.id}>{r.filename}</option>
                        ))
                      ) : (
                        <option value="">No resumes found</option>
                      )}
                    </select>
                    
                    <button 
                      onClick={() => handleApply(job.id)}
                      disabled={isApplying !== null || resumes.length === 0}
                      className={cn(
                        "w-full mt-6 py-4 rounded-xl font-black text-sm uppercase tracking-widest transition-all flex items-center justify-center gap-2",
                        isApplying === job.id 
                          ? "bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed" 
                          : resumes.length === 0
                            ? "bg-slate-100 dark:bg-slate-800 text-slate-300 cursor-not-allowed border-2 border-slate-200 dark:border-slate-700"
                            : "bg-slate-900 dark:bg-indigo-600 text-white hover:bg-indigo-600 dark:hover:bg-indigo-500 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)] hover:translate-y-[-2px] hover:shadow-[4px_6px_0px_0px_rgba(0,0,0,0.15)]"
                      )}
                    >
                      {isApplying === job.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>Quick Apply <ArrowRight className="w-4 h-4" /></>
                      )}
                    </button>
                    {resumes.length === 0 && (
                      <p className="mt-3 text-[10px] text-center font-bold text-rose-500 uppercase tracking-tighter">
                        Please upload a resume first
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
