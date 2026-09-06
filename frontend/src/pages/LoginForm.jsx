import React, { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, LogIn, CheckCircle2, AlertCircle, ArrowRight, ShieldCheck, User } from 'lucide-react';
import { loginApi } from '../api/userApi';

const LoginForm = ({ onSwitchToRegister, onLoginSuccess }) => {
  const [loginAs, setLoginAs] = useState('user'); // 'user' | 'admin'

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    rememberMe: false,
  });

  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const isAdmin = loginAs === 'admin';

  // Switch role — clear form state so nothing carries over
  function handleRoleSwitch(role) {
    setLoginAs(role);
    setFormData({ email: '', password: '', rememberMe: false });
    setErrors({});
    setApiError('');
    setIsSuccess(false);
  }

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const validate = () => {
    const newErrors = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!formData.email) {
      newErrors.email = 'Email address is required';
    } else if (!emailRegex.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    }

    return newErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsSubmitting(true);
    setApiError('');
    try {
      const data = await loginApi({ email: formData.email, password: formData.password, role: loginAs });
      setIsSuccess(true);
      if (onLoginSuccess) {
        // Use role from server response if available, otherwise use the toggle value
        onLoginSuccess({ email: formData.email, role: data?.user?.role ?? loginAs });
      }
    } catch (err) {
      setApiError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-8 shadow-2xl shadow-indigo-950/40 relative overflow-hidden">
        {/* Glow accent — colour shifts with role */}
        <div className={`absolute -top-24 -right-24 w-48 h-48 rounded-full blur-3xl pointer-events-none transition-colors duration-500 ${isAdmin ? 'bg-rose-500/20' : 'bg-blue-500/20'}`} />
        <div className={`absolute -bottom-24 -left-24 w-48 h-48 rounded-full blur-3xl pointer-events-none transition-colors duration-500 ${isAdmin ? 'bg-orange-500/15' : 'bg-indigo-500/15'}`} />

        {isSuccess ? (
          <div className="relative text-center py-8 space-y-4">
            <div className={`inline-flex p-4 rounded-full border mb-2 ${isAdmin ? 'bg-rose-500/15 text-rose-400 border-rose-500/30' : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'}`}>
              <CheckCircle2 className="w-12 h-12" />
            </div>
            <h3 className="text-2xl font-bold text-white tracking-tight">
              {isAdmin ? 'Admin Access Granted!' : 'Welcome Back!'}
            </h3>
            <p className="text-slate-400 text-sm max-w-xs mx-auto">
              Logged in as{' '}
              <span className={`font-semibold ${isAdmin ? 'text-rose-400' : 'text-indigo-300'}`}>
                {isAdmin ? 'Administrator' : 'User'}
              </span>{' '}
              with <span className="text-slate-200">{formData.email}</span>
            </p>
            <button
              onClick={() => setIsSuccess(false)}
              className={`mt-6 w-full py-3.5 px-4 text-white font-semibold rounded-xl shadow-lg transition-all duration-200 flex items-center justify-center gap-2 group cursor-pointer ${
                isAdmin
                  ? 'bg-gradient-to-r from-rose-500 to-orange-500 hover:from-rose-600 hover:to-orange-600 shadow-rose-500/25'
                  : 'bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 shadow-indigo-500/25'
              }`}
            >
              <span>{isAdmin ? 'Go to Admin Panel' : 'Go to Dashboard'}</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        ) : (
          <div className="relative">
            {/* ── Role Toggle ── */}
            <div className="mb-6">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-2 text-center">
                Login As
              </p>
              <div className="bg-slate-950/60 border border-slate-800 p-1 rounded-2xl flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleRoleSwitch('user')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 cursor-pointer ${
                    !isAdmin
                      ? 'bg-gradient-to-r from-indigo-500 via-indigo-600 to-blue-600 text-white shadow-md shadow-indigo-500/20'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <User className="w-4 h-4" />
                  User
                </button>
                <button
                  type="button"
                  onClick={() => handleRoleSwitch('admin')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 cursor-pointer ${
                    isAdmin
                      ? 'bg-gradient-to-r from-rose-500 to-orange-500 text-white shadow-md shadow-rose-500/20'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <ShieldCheck className="w-4 h-4" />
                  Admin
                </button>
              </div>

              {/* Contextual hint */}
              {isAdmin && (
                <p className="mt-2 text-center text-xs text-rose-400/80 font-medium">
                  Admin access — you'll be routed to the management panel
                </p>
              )}
            </div>

            {/* ── Header ── */}
            <div className="mb-6 text-center sm:text-left">
              <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium mb-3 border ${
                isAdmin
                  ? 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                  : 'bg-blue-500/10 border-blue-500/20 text-blue-400'
              }`}>
                {isAdmin ? <ShieldCheck className="w-3.5 h-3.5" /> : <LogIn className="w-3.5 h-3.5" />}
                <span>{isAdmin ? 'Admin Login' : 'Welcome Back'}</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                {isAdmin ? 'Admin Sign In' : 'Log in to your account'}
              </h2>
              <p className="text-slate-400 text-sm mt-1.5">
                {isAdmin
                  ? 'Enter your admin credentials to access the management panel.'
                  : 'Enter your credentials to access your workspace.'}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email field */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-5 h-5" />
                  </div>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder={isAdmin ? 'admin@company.com' : 'you@company.com'}
                    className={`w-full pl-11 pr-4 py-3 bg-slate-950/60 border ${
                      errors.email
                        ? 'border-rose-500 focus:ring-rose-500/30'
                        : isAdmin
                        ? 'border-slate-800 focus:border-rose-500 focus:ring-rose-500/20'
                        : 'border-slate-800 focus:border-indigo-500 focus:ring-indigo-500/30'
                    } rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-4 transition-all duration-200`}
                  />
                </div>
                {errors.email && (
                  <p className="flex items-center gap-1.5 text-xs text-rose-400 mt-1.5 font-medium">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {errors.email}
                  </p>
                )}
              </div>

              {/* Password field */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                    Password
                  </label>
                  <a
                    href="#forgot"
                    onClick={(e) => {
                      e.preventDefault();
                      alert('Password reset instructions will be sent to your email.');
                    }}
                    className="text-xs text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
                  >
                    Forgot password?
                  </a>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-5 h-5" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="Enter your password"
                    className={`w-full pl-11 pr-11 py-3 bg-slate-950/60 border ${
                      errors.password
                        ? 'border-rose-500 focus:ring-rose-500/30'
                        : isAdmin
                        ? 'border-slate-800 focus:border-rose-500 focus:ring-rose-500/20'
                        : 'border-slate-800 focus:border-indigo-500 focus:ring-indigo-500/30'
                    } rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-4 transition-all duration-200`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="flex items-center gap-1.5 text-xs text-rose-400 mt-1.5 font-medium">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {errors.password}
                  </p>
                )}
              </div>

              {/* Remember me — only for user login */}
              {!isAdmin && (
                <div className="flex items-center">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      name="rememberMe"
                      checked={formData.rememberMe}
                      onChange={handleChange}
                      className="w-4 h-4 rounded border-slate-700 bg-slate-950/80 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-slate-900 cursor-pointer"
                    />
                    <span className="text-xs text-slate-400">Remember this device for 30 days</span>
                  </label>
                </div>
              )}

              {/* API Error Banner */}
              {apiError && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-medium">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{apiError}</span>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className={`w-full mt-2 py-3.5 px-4 text-white font-semibold rounded-xl shadow-lg active:scale-[0.99] transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
                  isAdmin
                    ? 'bg-gradient-to-r from-rose-500 via-rose-600 to-orange-500 hover:from-rose-600 hover:to-orange-600 shadow-rose-600/30 hover:shadow-rose-600/50'
                    : 'bg-gradient-to-r from-indigo-500 via-indigo-600 to-blue-600 hover:from-indigo-600 hover:to-blue-700 shadow-indigo-600/30 hover:shadow-indigo-600/50'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <svg
                      className="animate-spin -ml-1 mr-2 h-5 w-5 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    {isAdmin ? <ShieldCheck className="w-4 h-4" /> : <LogIn className="w-4 h-4" />}
                    <span>{isAdmin ? 'Sign in as Admin' : 'Log In'}</span>
                  </>
                )}
              </button>

              {/* Switch to Register — only for regular user */}
              {!isAdmin && (
                <div className="pt-2 text-center text-xs text-slate-400">
                  Don't have an account yet?{' '}
                  <button
                    type="button"
                    onClick={onSwitchToRegister}
                    className="text-indigo-400 hover:text-indigo-300 font-semibold transition-colors cursor-pointer underline underline-offset-4"
                  >
                    Create an account
                  </button>
                </div>
              )}
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default LoginForm;
