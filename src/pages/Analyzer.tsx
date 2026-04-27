import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { UploadCloud, File, X, Loader2, Sparkles, ArrowRight, ShieldCheck, Zap, Target } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

export default function Analyzer() {
  const [file, setFile] = useState<File | null>(null);
  const [jobDescription, setJobDescription] = useState('');
  const [isDragActive, setIsDragActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');
  const [showSaved, setShowSaved] = useState(false);
  const { token } = useAuth();
  const navigate = useNavigate();

  // Load Draft
  useEffect(() => {
    const saved = localStorage.getItem('analyzer_jd_draft');
    if (saved) setJobDescription(saved);
  }, []);

  // Save Draft
  useEffect(() => {
    if (jobDescription) {
      localStorage.setItem('analyzer_jd_draft', jobDescription);
      setShowSaved(true);
      const timer = setTimeout(() => setShowSaved(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [jobDescription]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragActive(true);
    } else if (e.type === 'dragleave') {
      setIsDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelection(e.dataTransfer.files[0]);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFileSelection(e.target.files[0]);
    }
  };

  const handleFileSelection = (selectedFile: File) => {
    setError('');
    const validTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!validTypes.includes(selectedFile.type)) {
      setError('Please upload a PDF or DOCX file.');
      return;
    }
    if (selectedFile.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB.');
      return;
    }
    setFile(selectedFile);
  };

  const removeFile = () => {
    setFile(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a resume file.');
      return;
    }

    setIsUploading(true);
    setError('');

    const formData = new FormData();
    formData.append('resume', file);
    formData.append('jobDescription', jobDescription);

    try {
      const apiUrl = import.meta.env.VITE_APP_URL || '';
      const res = await fetch(`${apiUrl}/api/analyze`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        const errorMsg = data.details ? `${data.error}: ${data.details}` : (data.error || 'Analysis failed');
        throw new Error(errorMsg);
      }

      localStorage.removeItem('analyzer_jd_draft'); // Clear draft
      navigate(`/result/${data.id}`);
    } catch (err: any) {
      setError(err.message);
      setIsUploading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 pb-24">
      {/* Hero Header */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-16 pt-8"
      >
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-800/50 text-indigo-600 dark:text-indigo-400 text-xs font-bold uppercase tracking-widest mb-6">
          <Sparkles className="w-4 h-4" />
          AI-Powered Insights
        </div>
        <h1 className="text-5xl sm:text-7xl font-black tracking-tight text-slate-900 dark:text-white mb-6 leading-[1.1]">
          Master Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600 dark:from-indigo-400 dark:to-violet-400">Career Story.</span>
        </h1>
        <p className="text-lg text-slate-500 dark:text-slate-400 font-medium max-w-2xl mx-auto leading-relaxed">
          Upload your resume and get a comprehensive AI analysis of your skills, match score, and professional impact in seconds.
        </p>
      </motion.div>

      <div className="grid lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Upload */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-7 space-y-8"
        >
          <div 
            className={cn(
              "relative group border-2 border-dashed rounded-[40px] p-12 text-center transition-all duration-500 cursor-pointer flex flex-col items-center justify-center min-h-[450px] overflow-hidden",
              isDragActive 
                ? "border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20 scale-[1.02] shadow-2xl shadow-indigo-500/10" 
                : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 hover:border-indigo-400 dark:hover:border-indigo-600 shadow-xl shadow-slate-200/50 dark:shadow-none"
            )}
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            onClick={() => document.getElementById('file-upload')?.click()}
          >
            {/* Animated Background Gradients */}
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-transparent to-violet-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
            
            <input 
              id="file-upload" 
              type="file" 
              className="hidden" 
              accept=".pdf,.docx" 
              onChange={handleChange} 
            />
            
            <AnimatePresence mode="wait">
              {!file ? (
                <motion.div 
                  key="empty"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.1 }}
                  className="relative z-10"
                >
                  <div className="w-24 h-24 bg-gradient-to-tr from-indigo-600 to-violet-600 rounded-3xl flex items-center justify-center mb-8 shadow-xl shadow-indigo-500/30 group-hover:scale-110 transition-transform duration-500">
                    <UploadCloud className="w-10 h-10 text-white" />
                  </div>
                  <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-3 tracking-tight">Drop your resume</h3>
                  <p className="text-slate-500 dark:text-slate-400 font-medium mb-8 max-w-xs mx-auto">
                    We support PDF and DOCX formats up to 10MB.
                  </p>
                  
                  <div className="flex flex-wrap justify-center gap-4">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-800/50 rounded-lg text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                      <ShieldCheck className="w-3.5 h-3.5" /> Secure
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-800/50 rounded-lg text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                      <Zap className="w-3.5 h-3.5" /> Instant
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div 
                  key="selected"
                  initial={{ opacity: 0, scale: 1.1 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="w-full relative z-10"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="w-24 h-24 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-3xl flex items-center justify-center mb-8 mx-auto border-2 border-emerald-200 dark:border-emerald-800/30 shadow-lg shadow-emerald-500/10">
                    <File className="w-10 h-10" />
                  </div>
                  <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2 truncate max-w-md mx-auto px-4">{file.name}</h3>
                  <p className="text-slate-500 dark:text-slate-400 font-bold mb-8">{(file.size / 1024 / 1024).toFixed(2)} MB • Ready for Analysis</p>
                  
                  <button 
                    onClick={(e) => { e.stopPropagation(); removeFile(); }}
                    className="group/btn px-6 py-3 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-black rounded-2xl hover:border-rose-500 dark:hover:border-rose-500/50 hover:text-rose-600 dark:hover:text-rose-400 transition-all uppercase tracking-widest"
                  >
                    Change Resume
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {error && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-6 bg-rose-50/80 dark:bg-rose-950/20 backdrop-blur-sm border-2 border-rose-100 dark:border-rose-900/30 rounded-3xl flex items-start text-rose-700 dark:text-rose-400"
            >
              <div className="w-10 h-10 bg-rose-100 dark:bg-rose-900/30 rounded-xl flex items-center justify-center mr-4 flex-shrink-0">
                <X className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-black text-sm uppercase tracking-wider mb-1">Upload Error</h4>
                <p className="text-sm font-medium opacity-90">{error}</p>
              </div>
            </motion.div>
          )}
        </motion.div>

        {/* Right Column: Job Description & Action */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="lg:col-span-5 h-full"
        >
          <div className="bg-white dark:bg-slate-900/50 backdrop-blur-xl border-2 border-slate-100 dark:border-slate-800 rounded-[40px] p-8 shadow-2xl shadow-slate-200/50 dark:shadow-none h-full flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center">
                  <Target className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Job Context</h3>
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Optional but Recommended</p>
                </div>
              </div>
              <AnimatePresence>
                {showSaved && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="flex items-center gap-2 px-3 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase tracking-widest rounded-full"
                  >
                    Saved
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            
            <textarea
              className="flex-1 w-full bg-slate-50/50 dark:bg-slate-950/50 border-2 border-slate-100 dark:border-slate-800 rounded-3xl p-6 text-sm font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-500 focus:ring-0 resize-none min-h-[300px] transition-all"
              placeholder="Paste the job description here to see how well you match their specific requirements..."
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              disabled={isUploading}
            ></textarea>

            <button
              onClick={handleSubmit}
              disabled={!file || isUploading}
              className={cn(
                "mt-8 group relative w-full flex justify-center items-center py-5 px-8 rounded-2xl text-sm font-black uppercase tracking-[0.2em] transition-all duration-300 overflow-hidden",
                !file || isUploading 
                  ? "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed border-2 border-slate-200 dark:border-slate-700" 
                  : "bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:scale-[1.02] hover:shadow-2xl active:scale-[0.98]"
              )}
            >
              {isUploading ? (
                <>
                  <Loader2 className="animate-spin -ml-1 mr-3 h-5 w-5" />
                  Analyzing Impact...
                </>
              ) : (
                <>
                  Start Analysis <ArrowRight className="ml-3 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </>
              )}
              {/* Button Shine Effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-[shimmer_2s_infinite] pointer-events-none" />
            </button>
          </div>
        </motion.div>
      </div>

      {/* Feature Footnotes */}
      <div className="grid sm:grid-cols-3 gap-8 mt-16 max-w-4xl mx-auto">
        <div className="text-center group">
          <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:rotate-12 transition-transform">
            <Zap className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-black text-slate-900 dark:text-white mb-2 uppercase tracking-wide">Real-time Scoring</h4>
          <p className="text-xs text-slate-500 font-medium">Instant ATS compatibility feedback using Gemini 1.5 Pro.</p>
        </div>
        <div className="text-center group">
          <div className="w-12 h-12 bg-violet-50 dark:bg-violet-950/30 text-violet-600 dark:text-violet-400 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:-rotate-12 transition-transform">
            <Sparkles className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-black text-slate-900 dark:text-white mb-2 uppercase tracking-wide">AI Keywords</h4>
          <p className="text-xs text-slate-500 font-medium">Extract and highlight missing skills for your target role.</p>
        </div>
        <div className="text-center group">
          <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-black text-slate-900 dark:text-white mb-2 uppercase tracking-wide">Data Privacy</h4>
          <p className="text-xs text-slate-500 font-medium">Your resume is encrypted and only used for your analysis.</p>
        </div>
      </div>
    </div>
  );
}
