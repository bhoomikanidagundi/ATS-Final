import React, { useEffect, useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { 
  Briefcase, Users, Calendar, CheckCircle, XCircle, Clock, 
  Search, Loader2, ArrowUpRight, BarChart3, Filter, ChevronRight,
  MoreVertical, Mail, FileText, Send, CalendarPlus
} from 'lucide-react';
import { cn } from '../lib/utils';

interface Application {
  id: string;
  job_id: string;
  job_title: string;
  user_id: string;
  candidate_name: string;
  candidate_email: string;
  status: 'applied' | 'shortlisted' | 'interview' | 'rejected';
  match_score: number;
  applied_at: string;
}

interface Interview {
  id: string;
  application_id: string;
  candidate_name: string;
  date: string;
  status: string;
}

export default function RecruiterDashboard() {
  const { token, user } = useAuth();
  const [applications, setApplications] = useState<Application[]>([]);
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState<string | null>(null);
  const [showScheduleModal, setShowScheduleModal] = useState<string | null>(null);
  const [interviewDate, setInterviewDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const [currentTab, setCurrentTab] = useState<'candidates' | 'jobs'>('candidates');
  const [jobs, setJobs] = useState<any[]>([]);
  const [isJobsLoading, setIsJobsLoading] = useState(false);
  const [showCreateJobModal, setShowCreateJobModal] = useState(false);
  const [jobSearchQuery, setJobSearchQuery] = useState('');
  
  const [jobForm, setJobForm] = useState({
    title: '',
    experience_required: '',
    salary: '',
    location: 'Remote',
    description: '',
    required_skills: ''
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const apiUrl = import.meta.env.VITE_APP_URL || '';
        const [appsRes, intsRes] = await Promise.all([
          fetch(`${apiUrl}/api/applications`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${apiUrl}/api/interviews`, { headers: { Authorization: `Bearer ${token}` } })
        ]);

        if (appsRes.ok) setApplications(await appsRes.json());
        if (intsRes.ok) setInterviews(await intsRes.json());
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [token]);

  useEffect(() => {
    if (currentTab === 'jobs') {
      fetchJobs();
    }
  }, [currentTab, token]);

  const fetchJobs = async () => {
    setIsJobsLoading(true);
    try {
      const apiUrl = import.meta.env.VITE_APP_URL || '';
      const res = await fetch(`${apiUrl}/api/jobs`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setJobs(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setIsJobsLoading(false);
    }
  };

  const handleCreateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsActionLoading('creating_job');
    try {
      const apiUrl = import.meta.env.VITE_APP_URL || '';
      const skillsArray = jobForm.required_skills.split(',').map(s => s.trim()).filter(s => s);
      const res = await fetch(`${apiUrl}/api/jobs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ ...jobForm, required_skills: skillsArray })
      });

      if (res.ok) {
        setShowCreateJobModal(false);
        setJobForm({ title: '', experience_required: '', salary: '', location: 'Remote', description: '', required_skills: '' });
        fetchJobs();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsActionLoading(null);
    }
  };

  const handleAction = async (appId: string, action: 'shortlist' | 'reject') => {
    setIsActionLoading(appId);
    try {
      const apiUrl = import.meta.env.VITE_APP_URL || '';
      const res = await fetch(`${apiUrl}/api/recruiter/${action}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ application_id: appId })
      });

      if (res.ok) {
        setApplications(apps => apps.map(a => 
          a.id === appId ? { ...a, status: action === 'shortlist' ? 'shortlisted' : 'rejected' } : a
        ));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsActionLoading(null);
    }
  };

  const handleSchedule = async () => {
    if (!showScheduleModal || !interviewDate) return;
    
    setIsActionLoading(showScheduleModal);
    try {
      const apiUrl = import.meta.env.VITE_APP_URL || '';
      const res = await fetch(`${apiUrl}/api/recruiter/schedule-interview`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ 
          application_id: showScheduleModal, 
          date: interviewDate 
        })
      });

      if (res.ok) {
        setApplications(apps => apps.map(a => 
          a.id === showScheduleModal ? { ...a, status: 'interview' } : a
        ));
        // Refresh interviews
        const intsRes = await fetch(`${apiUrl}/api/interviews`, { headers: { Authorization: `Bearer ${token}` } });
        if (intsRes.ok) setInterviews(await intsRes.json());
        setShowScheduleModal(null);
        setInterviewDate('');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsActionLoading(null);
    }
  };

  const filteredApps = applications.filter(a => 
    a.candidate_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.job_title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredJobs = jobs.filter(j => 
    j.title.toLowerCase().includes(jobSearchQuery.toLowerCase()) ||
    j.description.toLowerCase().includes(jobSearchQuery.toLowerCase())
  );

  const stats = [
    { label: 'Active Jobs', value: Array.from(new Set(applications.map(a => a.job_id))).length, icon: Briefcase, color: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/30' },
    { label: 'Total Applicants', value: applications.length, icon: Users, color: 'text-blue-600 bg-blue-50 dark:bg-blue-950/30' },
    { label: 'Pending Review', value: applications.filter(a => a.status === 'applied').length, icon: Clock, color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/30' },
    { label: 'Upcoming Interviews', value: interviews.length, icon: Calendar, color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30' },
  ];

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-[#0a0a10]">
      {/* Sidebar */}
      <aside className="w-64 bg-white dark:bg-[#0f0f18] border-r-2 border-slate-200 dark:border-slate-800 hidden md:flex flex-col p-6 fixed h-full z-30 transition-colors">
        <div className="mb-10">
          <h2 className="text-xl font-black text-indigo-600 uppercase tracking-tighter italic">Shortlistify</h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] -mt-1">Recruiter Hub</p>
        </div>

        <nav className="space-y-2">
          <button 
            onClick={() => setCurrentTab('candidates')}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all",
              currentTab === 'candidates' 
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20" 
                : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800/50"
            )}
          >
            <Users className="w-5 h-5" /> Candidates
          </button>
          <button 
            onClick={() => setCurrentTab('jobs')}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all",
              currentTab === 'jobs' 
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20" 
                : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800/50"
            )}
          >
            <Briefcase className="w-5 h-5" /> Jobs
          </button>
        </nav>

        <div className="mt-auto pt-6 border-t dark:border-slate-800">
           <div className="flex items-center gap-3 p-2 bg-slate-50 dark:bg-slate-900 rounded-2xl">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 font-black">
                {user?.name[0]}
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-black text-slate-900 dark:text-white truncate">{user?.name}</p>
                <p className="text-[10px] font-bold text-slate-400 truncate uppercase">Recruiter</p>
              </div>
           </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 md:ml-64 p-8">
        <div className="max-w-7xl mx-auto pb-20">
          {currentTab === 'candidates' ? (
            <>
              <header className="mb-10">
                <div className="flex items-center gap-3 mb-2">
                  <span className="px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 text-[10px] font-black rounded uppercase tracking-widest">
                    Recruiter Dashboard
                  </span>
                  <span className="text-slate-400 text-xs font-bold">{new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                </div>
                <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-slate-900 dark:text-white leading-none transition-colors">
                  Welcome back, {user?.name.split(' ')[0]}
                </h1>
                <p className="text-slate-500 font-medium mt-2 text-lg">Manage your hiring pipeline and candidate potential.</p>
              </header>

              {/* Stats Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                {stats.map((stat, i) => (
                  <div key={i} className="bg-white dark:bg-slate-900 border-2 border-slate-900 dark:border-slate-800 p-6 rounded-[24px] shadow-[6px_6px_0px_0px_rgba(15,23,42,1)] dark:shadow-[6px_6px_0px_0px_rgba(15,23,42,0.5)] transition-all hover:translate-x-1 hover:-translate-y-1">
                    <div className="flex items-center justify-between mb-4">
                      <div className={cn("p-3 rounded-2xl", stat.color)}>
                        <stat.icon className="w-6 h-6" />
                      </div>
                      <BarChart3 className="w-5 h-5 text-slate-200 dark:text-slate-700" />
                    </div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{stat.label}</p>
                    <p className="text-3xl font-black text-slate-900 dark:text-white leading-none">{stat.value}</p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Application Pipeline */}
                <div className="lg:col-span-2 space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight transition-colors">Candidate Pipeline</h2>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input 
                        type="text" 
                        placeholder="Search candidates..." 
                        className="pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-xl text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 transition-all w-full sm:w-64"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>
                  </div>

                  {isLoading ? (
                    <div className="py-20 flex flex-col items-center justify-center text-slate-500 font-bold uppercase tracking-widest">
                      <Loader2 className="w-12 h-12 animate-spin mb-4 text-indigo-600" />
                      <p>Loading Pipeline...</p>
                    </div>
                  ) : filteredApps.length === 0 ? (
                    <div className="bg-white dark:bg-slate-900 border-2 border-slate-900 dark:border-slate-800 rounded-[32px] p-16 text-center shadow-[8px_8px_0px_0px_rgba(15,23,42,1)] transition-colors">
                      <Users className="w-16 h-16 text-slate-200 dark:text-slate-800 mx-auto mb-6" />
                      <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2 uppercase tracking-tight">No candidates found</h3>
                      <p className="text-slate-500 font-medium">Your applicant tracking will appear here.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {filteredApps.map((app) => (
                        <div key={app.id} className="group bg-white dark:bg-slate-900 border-2 border-slate-900 dark:border-slate-800 rounded-[24px] p-6 shadow-[6px_6px_0px_0px_rgba(15,23,42,1)] dark:shadow-[6px_6px_0px_0px_rgba(15,23,42,0.5)] transition-all hover:translate-x-1 hover:-translate-y-1">
                          <div className="flex flex-col md:flex-row justify-between gap-6">
                            <div className="flex items-start gap-4">
                              <div className="w-14 h-14 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center border-2 border-slate-50 dark:border-slate-800 group-hover:border-indigo-100 dark:group-hover:border-indigo-900 transition-colors">
                                <UserIcon name={app.candidate_name} />
                              </div>
                              <div>
                                <h4 className="text-lg font-black text-slate-900 dark:text-white tracking-tight mb-1">{app.candidate_name}</h4>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">{app.job_title}</p>
                                <div className="flex items-center gap-3">
                                  <span className={cn(
                                    "px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border-2",
                                    app.status === 'applied' ? 'text-blue-600 bg-blue-50 border-blue-100 dark:bg-blue-900/30 dark:border-blue-800' :
                                    app.status === 'shortlisted' ? 'text-indigo-600 bg-indigo-50 border-indigo-100 dark:bg-indigo-900/30 dark:border-indigo-800' :
                                    app.status === 'interview' ? 'text-emerald-600 bg-emerald-50 border-emerald-100 dark:bg-emerald-900/30 dark:border-emerald-800' :
                                    'text-rose-600 bg-rose-50 border-rose-100 dark:bg-rose-900/30 dark:border-rose-800'
                                  )}>
                                    {app.status}
                                  </span>
                                  <span className="flex items-center gap-1 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                    <Clock className="w-3 h-3" /> {new Date(app.applied_at).toLocaleDateString()}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="flex flex-col md:items-end justify-center gap-4">
                              <div className="flex items-center gap-6">
                                <div className="text-center">
                                  <p className={cn(
                                    "text-2xl font-black leading-none mb-1",
                                    app.match_score >= 80 ? 'text-emerald-500' : app.match_score >= 60 ? 'text-amber-500' : 'text-rose-500'
                                  )}>{app.match_score}%</p>
                                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Match Score</p>
                                </div>
                                <div className="h-10 w-[2px] bg-slate-100 dark:bg-slate-800"></div>
                                <div className="flex gap-2">
                                  {app.status === 'applied' && (
                                    <>
                                      <button 
                                        onClick={() => handleAction(app.id, 'shortlist')}
                                        disabled={isActionLoading === app.id}
                                        className="p-3 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-xl hover:bg-emerald-600 hover:text-white transition-all border-2 border-emerald-100 dark:border-emerald-800"
                                        title="Shortlist"
                                      >
                                        <CheckCircle className="w-5 h-5" />
                                      </button>
                                      <button 
                                        onClick={() => handleAction(app.id, 'reject')}
                                        disabled={isActionLoading === app.id}
                                        className="p-3 bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 rounded-xl hover:bg-rose-600 hover:text-white transition-all border-2 border-rose-100 dark:border-rose-800"
                                        title="Reject"
                                      >
                                        <XCircle className="w-5 h-5" />
                                      </button>
                                    </>
                                  )}
                                  {app.status === 'shortlisted' && (
                                    <button 
                                      onClick={() => setShowScheduleModal(app.id)}
                                      className="px-4 py-3 bg-indigo-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all flex items-center gap-2 shadow-[4px_4px_0px_0px_rgba(49,46,129,1)] hover:translate-y-[-2px]"
                                    >
                                      <CalendarPlus className="w-4 h-4" /> Schedule Interview
                                    </button>
                                  )}
                                  <button className="p-3 bg-slate-50 dark:bg-slate-800 text-slate-400 rounded-xl hover:text-slate-900 dark:hover:text-white transition-all border-2 border-slate-100 dark:border-slate-700">
                                     <Mail className="w-5 h-5" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Upcoming Interviews & Sidebar */}
                <div className="space-y-8">
                  <div className="bg-indigo-600 dark:bg-indigo-900 rounded-[32px] p-8 text-white shadow-[8px_8px_0px_0px_rgba(49,46,129,1)] transition-colors">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-6 h-6" />
                        <h3 className="text-lg font-black uppercase tracking-tight">Interviews</h3>
                      </div>
                      <span className="text-[10px] font-black bg-white/20 px-2 py-1 rounded uppercase tracking-widest">Upcoming</span>
                    </div>

                    <div className="space-y-4">
                      {interviews.length > 0 ? (
                        interviews.map((int) => (
                          <div key={int.id} className="p-4 bg-white/10 rounded-2xl border border-white/10 hover:bg-white/20 transition-colors">
                            <p className="font-black text-white">{int.candidate_name}</p>
                            <div className="flex items-center justify-between mt-2">
                              <p className="text-xs text-indigo-200 font-bold flex items-center gap-1">
                                <Clock className="w-3 h-3" /> {new Date(int.date).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </p>
                              <button className="text-white/40 hover:text-white transition-colors">
                                <MoreVertical className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-8">
                          <p className="text-indigo-200 text-sm font-medium italic">No interviews scheduled.</p>
                        </div>
                      )}
                    </div>
                    
                    <button className="w-full mt-8 py-4 bg-white text-indigo-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-50 transition-all flex items-center justify-center gap-2">
                      View Calendar <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="bg-white dark:bg-slate-900 border-2 border-slate-900 dark:border-slate-800 rounded-[32px] p-8 shadow-[8px_8px_0px_0px_rgba(15,23,42,1)] transition-colors">
                    <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight mb-6">Recent Activity</h3>
                    <div className="space-y-6">
                      {[1, 2, 3].map(i => (
                        <div key={i} className="flex gap-4">
                          <div className="w-1 h-10 bg-slate-100 dark:bg-slate-800 rounded-full mt-1"></div>
                          <div>
                            <p className="text-sm font-bold text-slate-900 dark:text-white leading-tight">New application received for Senior Developer</p>
                            <p className="text-[10px] text-slate-400 font-black uppercase mt-1">2 hours ago</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-8 animate-in fade-in duration-500">
               <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <span className="px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 text-[10px] font-black rounded uppercase tracking-widest mb-2 inline-block">Job Management</span>
                    <h1 className="text-4xl font-black tracking-tight text-slate-900 dark:text-white uppercase">Active Jobs</h1>
                    <p className="text-slate-500 font-medium">Create and manage your organization's open positions.</p>
                  </div>
                  <button 
                    onClick={() => setShowCreateJobModal(true)}
                    className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold text-sm uppercase tracking-widest hover:bg-indigo-700 transition shadow-lg flex items-center gap-2"
                  >
                    <Briefcase className="w-4 h-4" /> Create New Job
                  </button>
               </div>

               <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input 
                    type="text" 
                    placeholder="Search your jobs..." 
                    className="w-full pl-12 pr-4 py-4 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-2xl text-slate-900 dark:text-white font-bold focus:outline-none focus:border-indigo-500 transition-all"
                    value={jobSearchQuery}
                    onChange={(e) => setJobSearchQuery(e.target.value)}
                  />
               </div>

               {isJobsLoading ? (
                  <div className="py-20 flex flex-col items-center justify-center text-slate-500">
                    <Loader2 className="w-12 h-12 animate-spin mb-4" />
                    <p className="font-bold uppercase tracking-widest">Fetching Jobs...</p>
                  </div>
               ) : filteredJobs.length === 0 ? (
                  <div className="bg-white dark:bg-slate-900 border-2 border-slate-900 dark:border-slate-800 rounded-[40px] p-20 text-center shadow-[12px_12px_0px_0px_rgba(15,23,42,1)] transition-colors">
                    <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-3xl flex items-center justify-center mx-auto mb-8 border-2 border-slate-50 dark:border-slate-700">
                      <Briefcase className="w-10 h-10 text-slate-300 dark:text-slate-600" />
                    </div>
                    <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-3 uppercase tracking-tight">No jobs found</h3>
                    <p className="text-slate-500 font-medium mb-8">Click "Create New Job" to get started.</p>
                    <button 
                      onClick={() => setShowCreateJobModal(true)}
                      className="text-indigo-600 font-black uppercase text-xs tracking-widest hover:underline"
                    >
                      Initialize Pipeline
                    </button>
                  </div>
               ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {filteredJobs.map(job => (
                      <div key={job.id} className="bg-white dark:bg-slate-900 border-2 border-slate-900 dark:border-slate-800 p-8 rounded-[32px] shadow-[8px_8px_0px_0px_rgba(15,23,42,1)] transition-all hover:translate-x-1 hover:-translate-y-1">
                        <div className="flex justify-between items-start mb-6">
                          <div>
                            <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight uppercase mb-1">{job.title}</h3>
                            <div className="flex items-center gap-3">
                              <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[10px] font-black rounded uppercase tracking-widest">{job.location}</span>
                              <span className="text-[10px] font-black text-slate-300 uppercase">{job.experience_required}</span>
                            </div>
                          </div>
                          <div className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer text-slate-400 hover:text-slate-900 dark:hover:text-white">
                            <MoreVertical className="w-5 h-5" />
                          </div>
                        </div>
                        <p className="text-slate-500 font-medium text-sm line-clamp-2 mb-6">{job.description}</p>
                        <div className="flex items-center justify-between pt-6 border-t dark:border-slate-800">
                           <div className="flex items-center gap-2">
                              <div className="flex -space-x-2">
                                {[1,2,3].map(i => (
                                  <div key={i} className="w-8 h-8 rounded-full border-2 border-white dark:border-slate-900 bg-slate-200 dark:bg-slate-800"></div>
                                ))}
                              </div>
                              <span className="text-[10px] font-black text-slate-400 uppercase">Applicants</span>
                           </div>
                           <button className="flex items-center gap-1 text-xs font-black text-indigo-600 dark:text-indigo-400 hover:gap-2 transition-all">
                              View Pipeline <ArrowUpRight className="w-4 h-4" />
                           </button>
                        </div>
                      </div>
                    ))}
                  </div>
               )}
            </div>
          )}
        </div>
      </main>

      {/* Create Job Modal */}
      {showCreateJobModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in duration-300">
           <div className="bg-white dark:bg-[#0f0f18] border-4 border-slate-900 dark:border-slate-800 rounded-[40px] p-8 w-full max-w-2xl shadow-[16px_16px_0px_0px_rgba(15,23,42,1)] animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
              <div className="mb-8">
                <h3 className="text-3xl font-black text-slate-900 dark:text-white uppercase mb-1 tracking-tight">Create New Position</h3>
                <p className="text-slate-500 font-medium">Define the role and target skills to find the perfect match.</p>
              </div>

              <form onSubmit={handleCreateJob} className="space-y-6">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Job Title</label>
                      <input 
                        required
                        type="text" 
                        placeholder="e.g. Senior Frontend Engineer"
                        className="w-full bg-slate-50 dark:bg-slate-900/50 border-2 border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-4 text-slate-900 dark:text-white font-bold focus:outline-none focus:border-indigo-500"
                        value={jobForm.title}
                        onChange={(e) => setJobForm({...jobForm, title: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Experience Required</label>
                      <input 
                        required
                        type="text" 
                        placeholder="e.g. 5+ years"
                        className="w-full bg-slate-50 dark:bg-slate-900/50 border-2 border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-4 text-slate-900 dark:text-white font-bold focus:outline-none focus:border-indigo-500"
                        value={jobForm.experience_required}
                        onChange={(e) => setJobForm({...jobForm, experience_required: e.target.value})}
                      />
                    </div>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Annual Salary (Rs.)</label>
                      <input 
                        type="text" 
                        placeholder="e.g. 15,00,000"
                        className="w-full bg-slate-50 dark:bg-slate-900/50 border-2 border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-4 text-slate-900 dark:text-white font-bold focus:outline-none focus:border-indigo-500"
                        value={jobForm.salary}
                        onChange={(e) => setJobForm({...jobForm, salary: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Work Type</label>
                      <div className="flex gap-2">
                        {['Remote', 'Hybrid', 'On-site'].map(type => (
                          <button 
                            key={type}
                            type="button"
                            onClick={() => setJobForm({...jobForm, location: type})}
                            className={cn(
                              "flex-1 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest border-2 transition-all",
                              jobForm.location === type 
                                ? "bg-indigo-600 border-indigo-600 text-white" 
                                : "bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 text-slate-400"
                            )}
                          >
                            {type}
                          </button>
                        ))}
                      </div>
                    </div>
                 </div>

                 <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Job Description</label>
                    <textarea 
                      required
                      rows={4}
                      placeholder="Describe the role, responsibilities, and team..."
                      className="w-full bg-slate-50 dark:bg-slate-900/50 border-2 border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-4 text-slate-900 dark:text-white font-bold focus:outline-none focus:border-indigo-500 resize-none"
                      value={jobForm.description}
                      onChange={(e) => setJobForm({...jobForm, description: e.target.value})}
                    />
                 </div>

                 <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Required Skills (Comma Separated)</label>
                    <input 
                      required
                      type="text" 
                      placeholder="React, TypeScript, Tailwind CSS..."
                      className="w-full bg-slate-50 dark:bg-slate-900/50 border-2 border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-4 text-slate-900 dark:text-white font-bold focus:outline-none focus:border-indigo-500"
                      value={jobForm.required_skills}
                      onChange={(e) => setJobForm({...jobForm, required_skills: e.target.value})}
                    />
                 </div>

                 <div className="flex gap-4 pt-4">
                    <button 
                      type="button"
                      onClick={() => setShowCreateJobModal(false)}
                      className="flex-1 py-4 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl font-black text-slate-500 dark:text-slate-400 uppercase text-xs tracking-widest hover:bg-slate-50 transition-all"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit"
                      disabled={isActionLoading !== null}
                      className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-indigo-700 shadow-[6px_6px_0px_0px_rgba(49,46,129,1)] transition-all flex items-center justify-center gap-2"
                    >
                      {isActionLoading === 'creating_job' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Post Job'}
                    </button>
                 </div>
              </form>
           </div>
        </div>
      )}

      {/* Schedule Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border-4 border-slate-900 dark:border-slate-800 rounded-[40px] p-8 w-full max-w-md shadow-[16px_16px_0px_0px_rgba(15,23,42,1)] animate-in zoom-in-95 duration-200">
            <h3 className="text-2xl font-black text-slate-900 dark:text-white uppercase mb-2 tracking-tight">Schedule Interview</h3>
            <p className="text-slate-500 font-medium mb-8">Set a date and time for the candidate screening.</p>
            
            <div className="space-y-6">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Select Date & Time</label>
                <input 
                  type="datetime-local" 
                  className="w-full bg-slate-50 dark:bg-slate-950 border-2 border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-4 text-slate-900 dark:text-white font-bold focus:outline-none focus:border-indigo-500"
                  value={interviewDate}
                  onChange={(e) => setInterviewDate(e.target.value)}
                />
              </div>

              <div className="flex gap-4">
                <button 
                  onClick={() => setShowScheduleModal(null)}
                  className="flex-1 py-4 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl font-black text-slate-500 dark:text-slate-400 uppercase text-xs tracking-widest hover:bg-slate-50 transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSchedule}
                  disabled={!interviewDate || isActionLoading !== null}
                  className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-indigo-700 shadow-[4px_4px_0px_0px_rgba(49,46,129,1)] transition-all flex items-center justify-center gap-2"
                >
                  {isActionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function UserIcon({ name }: { name: string }) {
  const initials = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  return <span className="text-lg font-black text-indigo-600 dark:text-indigo-400">{initials}</span>;
}
