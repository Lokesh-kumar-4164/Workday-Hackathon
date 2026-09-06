import React, { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, UserPlus, CheckCircle2, AlertCircle, ShieldCheck, ArrowRight, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import GoogleAuthButton from '../components/GoogleAuthButton';

const RegisterationForm = ({ onSwitchToLogin, initialRole = 'user' }) => {
  const { register, startGoogleAuth } = useAuth();
  const [registerAs, setRegisterAs] = useState(initialRole); // 'user' | 'admin'

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const isAdmin = registerAs === 'admin';

  // Switch role — clear form state so nothing carries over
  const handleRoleSwitch = (role) => {
    setRegisterAs(role);
    setFormData({ email: '', password: '', confirmPassword: '' });
    setErrors({});
    setApiError('');
    setIsSuccess(false);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear error for field when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  // Password strength calculation
  const getPasswordStrength = (pass) => {
    if (!pass) return { score: 0, label: '', color: '' };
    let score = 0;
    if (pass.length >= 8) score += 1;
    if (/[A-Z]/.test(pass)) score += 1;
    if (/[0-9]/.test(pass)) score += 1;
    if (/[^A-Za-z0-9]/.test(pass)) score += 1;

    switch (score) {
      case 1:
        return { score: 25, label: 'Weak', color: 'bg-rose-500' };
      case 2:
        return { score: 50, label: 'Fair', color: 'bg-amber-500' };
      case 3:
        return { score: 75, label: 'Good', color: 'bg-blue-500' };
      case 4:
        return { score: 100, label: 'Strong', color: 'bg-emerald-500' };
      default:
        return { score: 15, label: 'Too short', color: 'bg-rose-500' };
    }
  };

  const strength = getPasswordStrength(formData.password);

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
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Confirm password is required';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
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
      await register({
        email: formData.email,
        password: formData.password,
        role: registerAs,
      });
      setIsSuccess(true);
    } catch (err) {
      setApiError(err.response?.data?.message || err.message || 'Registration failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-8 shadow-2xl shadow-indigo-950/40 relative overflow-hidden">
        {/* Glow accent — colour shifts with role */}
        <div className={`absolute -top-24 -right-24 w-48 h-48 rounded-full blur-3xl pointer-events-none transition-colors duration-500 ${isAdmin ? 'bg-rose-500/20' : 'bg-indigo-500/20'}`} />
        <div className={`absolute -bottom-24 -left-24 w-48 h-48 rounded-full blur-3xl pointer-events-none transition-colors duration-500 ${isAdmin ? 'bg-orange-500/15' : 'bg-blue-500/15'}`} />

        {isSuccess ? (
          <div className="relative text-center py-8 space-y-4">
            <div className={`inline-flex p-4 rounded-full border mb-2 ${isAdmin ? 'bg-rose-500/15 text-rose-400 border-rose-500/30' : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'}`}>
              <CheckCircle2 className="w-12 h-12" />
            </div>
            <h3 className="text-2xl font-bold text-white tracking-tight">
              {isAdmin ? 'Admin Account Created!' : 'Account Created!'}
            </h3>
            <p className="text-slate-400 text-sm max-w-xs mx-auto">
              Registered as{' '}
              <span className={`font-semibold ${isAdmin ? 'text-rose-400' : 'text-indigo-300'}`}>
                {isAdmin ? 'Administrator' : 'User'}
              </span>{' '}
              with <span className="text-slate-200">{formData.email}</span>
            </p>
            <button
              onClick={() => {
                setIsSuccess(false);
                if (onSwitchToLogin) onSwitchToLogin(isAdmin ? 'admin' : 'user');
              }}
              className={`mt-6 w-full py-3.5 px-4 text-white font-semibold rounded-xl shadow-lg transition-all duration-200 flex items-center justify-center gap-2 group cursor-pointer ${
                isAdmin
                  ? 'bg-gradient-to-r from-rose-500 to-orange-500 hover:from-rose-600 hover:to-orange-600 shadow-rose-500/25'
                  : 'bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 shadow-indigo-500/25'
              }`}
            >
              <span>Proceed to Login</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        ) : (
          <div className="relative">
            {/* ── Role Toggle ── */}
            <div className="mb-6">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-2 text-center">
                Register As
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
                  Admin account — grants access to the event management panel
                </p>
              )}
            </div>

            {/* ── Header ── */}
            <div className="mb-6 text-center sm:text-left">
              <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium mb-3 border ${
                isAdmin
                  ? 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                  : 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400'
              }`}>
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>{isAdmin ? 'Admin Registration' : 'Create New Account'}</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                {isAdmin ? 'Register as Administrator' : 'Get started with SurgeShield'}
              </h2>
              <p className="text-slate-400 text-sm mt-1.5">
                {isAdmin
                  ? 'Create an administrator account to manage events, attendees, and settings.'
                  : 'Create your account to register for events and manage your sessions.'}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <GoogleAuthButton
                disabled={isSubmitting}
                label={isAdmin ? 'Continue with Google as Admin' : 'Continue with Google'}
                onClick={() => startGoogleAuth({ role: registerAs })}
              />
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-slate-800" />
                <span className="text-[10px] uppercase tracking-widest text-slate-500">or email</span>
                <div className="h-px flex-1 bg-slate-800" />
              </div>
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
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-5 h-5" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="Create a strong password"
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

                {/* Password strength indicator */}
                {formData.password && (
                  <div className="mt-2.5 space-y-1.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400">Security strength</span>
                      <span className="font-semibold text-slate-300">{strength.label}</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${strength.color} transition-all duration-300`}
                        style={{ width: `${strength.score}%` }}
                      />
                    </div>
                  </div>
                )}

                {errors.password && (
                  <p className="flex items-center gap-1.5 text-xs text-rose-400 mt-1.5 font-medium">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {errors.password}
                  </p>
                )}
              </div>

              {/* Confirm Password field */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                  Confirm Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-5 h-5" />
                  </div>
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    placeholder="Repeat your password"
                    className={`w-full pl-11 pr-11 py-3 bg-slate-950/60 border ${
                      errors.confirmPassword
                        ? 'border-rose-500 focus:ring-rose-500/30'
                        : formData.confirmPassword && formData.password === formData.confirmPassword
                        ? 'border-emerald-500 focus:ring-emerald-500/30'
                        : isAdmin
                        ? 'border-slate-800 focus:border-rose-500 focus:ring-rose-500/20'
                        : 'border-slate-800 focus:border-indigo-500 focus:ring-indigo-500/30'
                    } rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-4 transition-all duration-200`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                    aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                  >
                    {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>

                {/* Match confirmation helper */}
                {formData.confirmPassword && (
                  <div className="mt-1.5">
                    {formData.password === formData.confirmPassword ? (
                      <p className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Passwords match
                      </p>
                    ) : (
                      <p className="flex items-center gap-1.5 text-xs text-amber-400 font-medium">
                        <AlertCircle className="w-3.5 h-3.5" /> Passwords do not match yet
                      </p>
                    )}
                  </div>
                )}

                {errors.confirmPassword && (
                  <p className="flex items-center gap-1.5 text-xs text-rose-400 mt-1.5 font-medium">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {errors.confirmPassword}
                  </p>
                )}
              </div>

              {/* API Error Banner */}
              {apiError && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-medium">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{apiError}</span>
                </div>
              )}

              {/* Register Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className={`w-full mt-2 py-3.5 px-4 text-white font-semibold rounded-xl shadow-lg active:scale-[0.99] transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
                  isAdmin
                    ? 'bg-gradient-to-r from-rose-500 to-orange-500 hover:from-rose-600 hover:to-orange-600 shadow-rose-500/25 hover:shadow-rose-500/40'
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
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    <span>{isAdmin ? 'Creating Admin Account...' : 'Creating Account...'}</span>
                  </>
                ) : (
                  <>
                    {isAdmin ? <ShieldCheck className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                    <span>{isAdmin ? 'Register as Admin' : 'Register'}</span>
                  </>
                )}
              </button>

              {/* Switch to Login */}
              <div className="pt-2 text-center text-xs text-slate-400">
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => onSwitchToLogin && onSwitchToLogin(isAdmin ? 'admin' : 'user')}
                  className={`${
                    isAdmin ? 'text-rose-400 hover:text-rose-300' : 'text-indigo-400 hover:text-indigo-300'
                  } font-semibold transition-colors cursor-pointer underline underline-offset-4`}
                >
                  Log In
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default RegisterationForm;