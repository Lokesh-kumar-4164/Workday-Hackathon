import React, { useState } from 'react';
import RegisterationForm from './RegisterationForm';
import LoginForm from './LoginForm';
import { Sparkles, Shield, Zap, Users, CheckCircle, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const AuthPage = () => {
  const [activeTab, setActiveTab] = useState('register'); // 'register' | 'login'
  const [authRole, setAuthRole] = useState('user'); // 'user' | 'admin'
  const { authError, setAuthError } = useAuth();

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex flex-col justify-between relative selection:bg-indigo-500 selection:text-white overflow-hidden">
      {/* Dynamic Background Glows */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-indigo-600/15 rounded-full blur-[120px] pointer-events-none animate-pulse-glow" />
      <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-purple-600/5 rounded-full blur-[160px] pointer-events-none" />

      {/* Subtle grid pattern background */}
      <div 
        className="absolute inset-0 opacity-[0.03] pointer-events-none" 
        style={{
          backgroundImage: `radial-gradient(#ffffff 1px, transparent 1px)`,
          backgroundSize: '24px 24px'
        }}
      />

      {/* Top Navbar */}
      <header className="relative z-10 w-full max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-sky-400 p-0.5 shadow-lg shadow-indigo-500/25 flex items-center justify-center">
            <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-indigo-400" />
            </div>
          </div>
          <div>
            <span className="font-extrabold text-xl tracking-tight text-white">SurgeShield</span>
            <span className="ml-1.5 text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              Auth
            </span>
          </div>
        </div>

        {/* Quick Switch Buttons in Header */}
        <div className="bg-slate-900/90 border border-slate-800/90 p-1 rounded-2xl flex items-center backdrop-blur-md shadow-inner">
          <button
            onClick={() => setActiveTab('login')}
            className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer ${
              activeTab === 'login'
                ? 'bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-md shadow-indigo-500/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Log In
          </button>
          <button
            onClick={() => setActiveTab('register')}
            className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer ${
              activeTab === 'register'
                ? 'bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-md shadow-indigo-500/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Register
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 w-full max-w-7xl mx-auto px-6 py-8 my-auto flex flex-col lg:flex-row items-center justify-center gap-12 lg:gap-16">
        {/* Left Side: Brand Showcase & Value Proposition */}
        <div className="hidden lg:flex flex-col flex-1 max-w-lg space-y-8">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-medium w-fit">
            <Shield className="w-3.5 h-3.5" />
            <span>Intelligent Event & Access Management</span>
          </div>

          <div className="space-y-4">
            <h1 className="text-4xl xl:text-5xl font-extrabold text-white tracking-tight leading-[1.15]">
              Protect your events. Empower your audience.
            </h1>
            <p className="text-slate-400 text-base leading-relaxed">
              EventGuard provides a hardened infrastructure to manage guest access, verify identity, and orchestrate large-scale events with enterprise-grade security.
            </p>
          </div>

          {/* Feature Highlights */}
          <div className="space-y-4 pt-2">
            <div className="flex items-start gap-3.5">
              <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 shrink-0 mt-0.5">
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-slate-200">Real-Time Access Control</h4>
                <p className="text-xs text-slate-400 mt-0.5">Dynamic entry validation with instant status syncing across all touchpoints.</p>
              </div>
            </div>

            <div className="flex items-start gap-3.5">
              <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 shrink-0 mt-0.5">
                <Shield className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-slate-200">Identity Verification</h4>
                <p className="text-xs text-slate-400 mt-0.5">Secure sign-up workflows with multi-factor authentication and fraud prevention.</p>
              </div>
            </div>

            <div className="flex items-start gap-3.5">
              <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shrink-0 mt-0.5">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-slate-200">Centralized Dashboard</h4>
                <p className="text-xs text-slate-400 mt-0.5">Manage attendees, permissions, and session access from a single secure portal.</p>
              </div>
            </div>
          </div>

          {/* Mini Trust Badge */}
          <div className="pt-4 border-t border-slate-800/80 flex items-center gap-4 text-xs text-slate-400">
            <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
              <CheckCircle className="w-4 h-4" />
              <span>99.9% Uptime SLA</span>
            </div>
            <span className="text-slate-700">•</span>
            <span>SOC2 Compliant</span>
            <span className="text-slate-700">•</span>
            <span>Zero-Trust Architecture</span>
          </div>
        </div>

        {/* Right Side: Authentication Card */}
        <div className="w-full max-w-md flex-1">
          {authError && (
            <div className="mb-4 flex items-start gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-medium">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{authError}</span>
              <button
                type="button"
                onClick={() => setAuthError('')}
                className="ml-auto text-rose-300 hover:text-white cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          )}
          {activeTab === 'register' ? (
            <RegisterationForm
              key={`register-${authRole}`}
              initialRole={authRole}
              onSwitchToLogin={(role) => {
                if (role) setAuthRole(role);
                setActiveTab('login');
              }}
            />
          ) : (
            <LoginForm
              key={`login-${authRole}`}
              initialRole={authRole}
              onSwitchToRegister={(role) => {
                if (role) setAuthRole(role);
                setActiveTab('register');
              }}
            />
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full max-w-7xl mx-auto px-6 py-6 text-center text-xs text-slate-500">
        <p>&copy; {new Date().getFullYear()} SurgeShield. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default AuthPage;
