/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/AuthContext';
import DashboardLayout from './components/DashboardLayout';
import { ThemeProvider } from './lib/ThemeProvider';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import Analyzer from './pages/Analyzer';
import Result from './pages/Result';
import History from './pages/History';
import Builder from './pages/Builder';
import GeneratedResume from './pages/GeneratedResume';

import RecruiterLayout from './components/RecruiterLayout';
import RecruiterDashboard from './pages/RecruiterDashboard';
import Jobs from './pages/Jobs';
import Applications from './pages/Applications';
import RecruiterCandidates from './pages/RecruiterCandidates';
import RecruiterJobs from './pages/RecruiterJobs';

function ProtectedRoute({ children, allowedRole }: { children: React.ReactNode, allowedRole?: 'candidate' | 'recruiter' }) {
  const { token, user, isLoading } = useAuth();
  if (isLoading) return <div className="min-h-screen flex items-center justify-center dark:bg-slate-900 dark:text-slate-100">Loading...</div>;
  if (!token) return <Navigate to="/login" replace />;
  if (allowedRole && user?.role !== allowedRole) {
    return <Navigate to={user?.role === 'recruiter' ? '/recruiter-dashboard' : '/dashboard'} replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="app-theme">
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          
          {/* Candidate Routes */}
          <Route element={<ProtectedRoute allowedRole="candidate"><DashboardLayout /></ProtectedRoute>}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/upload" element={<Analyzer />} />
            <Route path="/history" element={<History />} />
            <Route path="/result/:id" element={<Result />} />
            <Route path="/builder" element={<Builder />} />
            <Route path="/resume/:id" element={<GeneratedResume />} />
            <Route path="/jobs" element={<Jobs />} />
            <Route path="/applications" element={<Applications />} />
          </Route>

          {/* Recruiter Routes */}
          <Route element={<ProtectedRoute allowedRole="recruiter"><RecruiterLayout /></ProtectedRoute>}>
            <Route path="/recruiter-dashboard" element={<RecruiterDashboard />} />
            <Route path="/recruiter-candidates" element={<RecruiterCandidates />} />
            <Route path="/recruiter-jobs" element={<RecruiterJobs />} />
          </Route>
        </Routes>
      </AuthProvider>
    </ThemeProvider>
  );
}
