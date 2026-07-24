import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Shield,
    Lock,
    Eye,
    EyeOff,
    ArrowRight,
    CheckCircle,
    KeyRound,
    AlertTriangle,
    ArrowLeft,
    Zap,
    Brain,
    TrendingUp,
    Activity,
    Check,
    X,
} from 'lucide-react';
import { appConfig as config } from '../config/runtime-config';
import { useNotifications } from '../components/notifications';
import apiClient from '../utils/apiClient';

// ─── Types ───────────────────────────────────────────────────────────────────

interface PasswordRule {
    label: string;
    test: (pw: string) => boolean;
}

interface LocationState {
    /** When true the user was redirected here by the system (forced change) */
    forced?: boolean;
    username?: string;
}

// ─── Password rules ───────────────────────────────────────────────────────────

const PASSWORD_RULES: PasswordRule[] = [
    { label: 'At least 8 characters', test: (pw) => pw.length >= 8 },
    { label: 'One uppercase letter', test: (pw) => /[A-Z]/.test(pw) },
    { label: 'One lowercase letter', test: (pw) => /[a-z]/.test(pw) },
    { label: 'One number', test: (pw) => /\d/.test(pw) },
    { label: 'One special character (!@#$%^&*)', test: (pw) => /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(pw) },
];

// ─── Strength helpers ─────────────────────────────────────────────────────────

function getStrength(password: string): number {
    return PASSWORD_RULES.filter((r) => r.test(password)).length;
}

function strengthLabel(score: number): { text: string; color: string } {
    if (score <= 1) return { text: 'Very Weak', color: 'from-red-500 to-red-600' };
    if (score === 2) return { text: 'Weak', color: 'from-orange-500 to-orange-600' };
    if (score === 3) return { text: 'Fair', color: 'from-yellow-500 to-yellow-600' };
    if (score === 4) return { text: 'Strong', color: 'from-blue-500 to-blue-600' };
    return { text: 'Very Strong', color: 'from-green-500 to-emerald-500' };
}

// ─── Component ────────────────────────────────────────────────────────────────

const ChangePasswordPage: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const state = (location.state as LocationState) ?? {};
    const isForced = state.forced ?? false;

    const logoPath = config.dashboard.logo;
    const appName = config.app.name;
    const appShortName = config.app.shortName;

    // ── Form state ────────────────────────────────────────────────────────────
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    const [showCurrent, setShowCurrent] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [step, setStep] = useState<'form' | 'success'>('form');
    const [isValidating, setIsValidating] = useState(true);

    // Strength
    const strength = getStrength(newPassword);
    const strengthInfo = strengthLabel(strength);
    const strengthPct = (strength / PASSWORD_RULES.length) * 100;

    // Passwords match?
    const passwordsMatch = newPassword !== '' && newPassword === confirmPassword;
    const confirmTouched = confirmPassword !== '';

    // All rules met?
    const allRulesMet = strength === PASSWORD_RULES.length;

    const { addNotification } = useNotifications();

    const isShown = useRef(false);

    // ── VALIDATION: Check if username exists ──────────────────────────────────
    useEffect(() => {

        if (isShown.current) return;


        // Check if username is missing, null, undefined, or empty string
        if (!state.username || state.username.trim() === '' && isShown.current === false) {
            isShown.current = true;
            setIsValidating(false);
            addNotification(
                'User ID is required. Please enter your User ID on the login page before changing your password.',
                'error',
                5000
            );

            // Redirect back to login page after 2 seconds
            const timer = setTimeout(() => {
                navigate('/login', {
                    state: {
                        showUserIdAlert: true,
                        errorMessage: 'Please enter your User ID to change password'
                    }
                });
            }, 2000);

            return () => {
                clearTimeout(timer);
                isShown.current = false;
            };
        }

        setIsValidating(false);

    }, [state.username, navigate, addNotification]);

    // Show loading state while validating
    if (isValidating) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-4 border-white/30 border-t-white mx-auto mb-4"></div>
                    <p className="text-white/70">Validating user session...</p>
                </div>
            </div>
        );
    }

    // ── Handlers ──────────────────────────────────────────────────────────────
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        // Double-check username before submission
        if (!state.username || state.username.trim() === '') {
            addNotification('User ID is missing. Please login again.', 'error');
            navigate('/login');
            return;
        }

        if (!allRulesMet) {
            setError('Please ensure your password meets all requirements.');
            return;
        }
        if (!passwordsMatch) {
            setError('New passwords do not match.');
            return;
        }

        setIsLoading(true);
        try {
            // ── Replace this with your real API call ──────────────────────────────
            const request = { username: state.username, currentPassword, newPassword };
            const response = await apiClient.post('/user/reset', request);
            console.log(response);
            // await changePassword({ username: state.username, currentPassword, newPassword });
            await new Promise((res) => setTimeout(res, 1800)); // simulate network
            // ─────────────────────────────────────────────────────────────────────

            addNotification('Password changed successfully! Redirecting to login...', 'success', 3000);
            setStep('success');
            setTimeout(() => navigate('/login'), 3000);
        } catch {
            setError('Failed to change password. Please verify your current password and try again.');
            addNotification('Password change failed. Please try again.', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    // ── Layout constants shared with LoginPage ────────────────────────────────
    const securityFeatures = [
        { icon: Zap, text: 'Real-time Detection', description: 'Instant threat response' },
        { icon: Brain, text: 'AI-Powered Analytics', description: 'Machine learning insights' },
    ];

    const stats = [
        { value: '99.9%', label: 'Uptime', icon: TrendingUp },
        { value: '24/7', label: 'Monitoring', icon: Activity },
        { value: 'Ai', label: 'Powered', icon: Brain },
    ];

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4 relative overflow-hidden">

            {/* ── Background glows ──────────────────────────────────────────────── */}
            <div className="absolute inset-0">
                <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-blue-500/10 to-transparent rounded-full blur-3xl animate-pulse" />
                <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-to-tl from-purple-500/10 to-transparent rounded-full blur-3xl animate-pulse delay-1000" />
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gradient-to-r from-cyan-500/5 to-blue-500/5 rounded-full blur-2xl animate-pulse delay-500" />
            </div>

            {/* ── Floating particles ────────────────────────────────────────────── */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                {[...Array(20)].map((_, i) => (
                    <motion.div
                        key={i}
                        className="absolute w-1 h-1 bg-white/20 rounded-full"
                        initial={{ x: Math.random() * window.innerWidth, y: Math.random() * window.innerHeight }}
                        animate={{ y: [null, -100], opacity: [0, 1, 0] }}
                        transition={{ duration: Math.random() * 3 + 2, repeat: Infinity, delay: Math.random() * 2 }}
                    />
                ))}
            </div>

            {/* ── Main layout ───────────────────────────────────────────────────── */}
            <div className="relative w-full max-w-7xl mx-auto flex lg:flex-row flex-col gap-8 items-start z-0">

                {/* ── Left branding panel (desktop only) ──────────────────────────── */}
                <motion.div
                    initial={{ opacity: 0, x: -50 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.8 }}
                    className="hidden lg:block space-y-12 lg:w-[60%] float-start flex-shrink-0"
                >
                    {/* Logo + title */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-4">
                            <motion.div
                                className="p-4 bg-gradient-to-br from-c-dark-blue-500 to-c-black-600 rounded-2xl shadow-2xl"
                                whileHover={{ scale: 1.05, rotate: 5 }}
                                transition={{ type: 'spring', stiffness: 300 }}
                            >
                                <Shield className="w-12 h-12 text-white" />
                            </motion.div>
                            <div>
                                <motion.h1
                                    className="text-6xl font-bold bg-gradient-to-r from-white via-blue-200 to-purple-200 bg-clip-text text-transparent"
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.2 }}
                                >
                                    {appShortName}
                                </motion.h1>
                                <motion.p
                                    className="text-blue-200/80 text-lg mt-1 font-medium"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: 0.4 }}
                                >
                                    {appName}
                                </motion.p>
                            </div>
                        </div>

                        <motion.div
                            className="space-y-4"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.6 }}
                        >
                            <h2 className="text-4xl font-bold text-white leading-tight">
                                Advanced fraud monitoring
                                <br />
                                <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                                    & analytics platform
                                </span>
                            </h2>
                            <p className="text-white/70 text-lg leading-relaxed max-w-lg">
                               A comprehensive platform leveraging rule-based logic and artificial intelligence models to detect and prevent fraudulent activities in real time.
                                The solution enables customization of detection rules, continuous monitoring of suspicious behavior, 
                                and delivery of actionable insights through intuitive and informative dashboards.
                            </p>
                        </motion.div>
                    </div>

                    {/* Security feature cards */}
                    <motion.div
                        className="space-y-4"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.8 }}
                    >
                        <div className="space-y-4">
                            {securityFeatures.map((feature, index) => (
                                <motion.div
                                    key={index}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 1 + index * 0.1 }}
                                    whileHover={{ x: 10, scale: 1.02 }}
                                    className="flex items-center gap-4 p-4 bg-white/5 rounded-xl backdrop-blur-sm border border-white/10 hover:bg-white/10 transition-all duration-300 group cursor-pointer"
                                >
                                    <div className="p-2 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-lg group-hover:from-blue-500/30 group-hover:to-purple-500/30 transition-all duration-300">
                                        <feature.icon className="w-5 h-5 text-blue-400 group-hover:text-blue-300 transition-colors" />
                                    </div>
                                    <div>
                                        <span className="text-white/90 font-medium block">{feature.text}</span>
                                        <span className="text-white/60 text-sm">{feature.description}</span>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>

                    {/* Stats */}
                    <motion.div
                        className="grid grid-cols-3 gap-4"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 1.2 }}
                    >
                        {stats.map((stat, index) => (
                            <motion.div
                                key={index}
                                whileHover={{ y: -5, scale: 1.05 }}
                                className="text-center p-4 bg-white/5 rounded-xl backdrop-blur-sm border border-white/10 hover:bg-white/10 transition-all duration-300 group"
                            >
                                <div className="flex justify-center mb-2">
                                    <stat.icon className="w-6 h-6 text-blue-400 group-hover:text-blue-300 transition-colors" />
                                </div>
                                <div className="text-2xl font-bold text-white group-hover:text-blue-200 transition-colors">{stat.value}</div>
                                <div className="text-white/60 text-sm group-hover:text-white/80 transition-colors">{stat.label}</div>
                            </motion.div>
                        ))}
                    </motion.div>
                </motion.div>

                {/* ── Right — form panel ───────────────────────────────────────────── */}
                <motion.div
                    initial={{ opacity: 0, x: 50 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.8, delay: 0.2 }}
                    className="w-full lg:w-[40%] max-w-md mx-auto lg:mx-0 lg:ml-auto flex-shrink-0"
                >
                    <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-8 shadow-2xl hover:shadow-3xl transition-all duration-300">

                        {/* Mobile header */}
                        <div className="lg:hidden text-center mb-8">
                            <div className="flex justify-center mb-4">
                                <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl">
                                    <Shield className="w-8 h-8 text-white" />
                                </div>
                            </div>
                            <h1 className="text-3xl font-bold text-white mb-2">{appShortName}</h1>
                            <p className="text-white/70">Secure Access Portal</p>
                        </div>

                        <AnimatePresence mode="wait">

                            {/* ── FORM STEP ─────────────────────────────────────────────── */}
                            {step === 'form' && (
                                <motion.div
                                    key="form"
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -20 }}
                                    transition={{ duration: 0.3 }}
                                >
                                    {/* Logo */}
                                    <div className="flex justify-center mt-8">
                                        <img src={logoPath} alt="Logo" className="login-logo mb-4" />
                                    </div>

                                    {/* Header */}
                                    <div className="text-center mb-8">
                                        <div className="flex justify-center mb-3">
                                            <div className="p-3 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-2xl border border-white/10">
                                                <KeyRound className="w-7 h-7 text-blue-400" />
                                            </div>
                                        </div>
                                        <h2 className="text-2xl font-bold text-white mb-1">
                                            {isForced ? 'Password Update Required' : 'Change Password'}
                                        </h2>
                                        <p className="text-white/60 text-sm">
                                            {isForced
                                                ? 'Your password must be changed before continuing.'
                                                : 'Update your credentials to keep your account secure.'}
                                        </p>
                                        {state.username && (
                                            <p className="text-blue-400 text-sm mt-2">
                                                User: {state.username}
                                            </p>
                                        )}
                                    </div>

                                    {/* Forced-change banner */}
                                    {isForced && (
                                        <motion.div
                                            initial={{ opacity: 0, y: -10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="flex items-start gap-3 p-4 mb-6 bg-amber-500/10 border border-amber-500/30 rounded-xl"
                                        >
                                            <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                                            <p className="text-amber-300 text-sm leading-relaxed">
                                                Your administrator has required you to set a new password. You will not be
                                                able to access the system until this is completed.
                                            </p>
                                        </motion.div>
                                    )}

                                    {/* Error */}
                                    <AnimatePresence>
                                        {error && (
                                            <motion.div
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: 'auto' }}
                                                exit={{ opacity: 0, height: 0 }}
                                                className="flex items-center gap-3 p-4 mb-6 bg-red-500/10 border border-red-500/30 rounded-xl"
                                            >
                                                <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
                                                <p className="text-red-300 text-sm">{error}</p>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>

                                    {/* ── Form ────────────────────────────────────────────────── */}
                                    <form onSubmit={handleSubmit} className="space-y-5">

                                        {/* Current password */}
                                        <div className="space-y-2">
                                            <label className="text-white/80 text-sm font-medium">Current Password</label>
                                            <div className="relative group">
                                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                    <Lock className="h-5 w-5 text-blue-400 group-focus-within:text-blue-300 transition-colors" />
                                                </div>
                                                <input
                                                    type={showCurrent ? 'text' : 'password'}
                                                    value={currentPassword}
                                                    onChange={(e) => { setCurrentPassword(e.target.value); setError(''); }}
                                                    className="login-input w-full pl-10 pr-12 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 backdrop-blur-sm"
                                                    placeholder="Enter current password"
                                                    required
                                                    autoComplete="current-password"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowCurrent(!showCurrent)}
                                                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-blue-400 hover:text-blue-300 transition-colors"
                                                >
                                                    {showCurrent ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                                </button>
                                            </div>
                                        </div>

                                        {/* New password */}
                                        <div className="space-y-2">
                                            <label className="text-white/80 text-sm font-medium">New Password</label>
                                            <div className="relative group">
                                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                    <KeyRound className="h-5 w-5 text-blue-400 group-focus-within:text-blue-300 transition-colors" />
                                                </div>
                                                <input
                                                    type={showNew ? 'text' : 'password'}
                                                    value={newPassword}
                                                    onChange={(e) => { setNewPassword(e.target.value); setError(''); }}
                                                    className="login-input w-full pl-10 pr-12 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 backdrop-blur-sm"
                                                    placeholder="Enter new password"
                                                    required
                                                    autoComplete="new-password"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowNew(!showNew)}
                                                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-blue-400 hover:text-blue-300 transition-colors"
                                                >
                                                    {showNew ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                                </button>
                                            </div>

                                            {/* Strength bar */}
                                            {newPassword && (
                                                <motion.div
                                                    initial={{ opacity: 0, height: 0 }}
                                                    animate={{ opacity: 1, height: 'auto' }}
                                                    className="space-y-2 pt-1"
                                                >
                                                    <div className="flex items-center justify-between text-xs">
                                                        <span className="text-white/50">Password strength</span>
                                                        <span className={`font-semibold bg-gradient-to-r ${strengthInfo.color} bg-clip-text text-transparent`}>
                                                            {strengthInfo.text}
                                                        </span>
                                                    </div>
                                                    <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                                                        <motion.div
                                                            initial={{ width: 0 }}
                                                            animate={{ width: `${strengthPct}%` }}
                                                            transition={{ duration: 0.4 }}
                                                            className={`h-full rounded-full bg-gradient-to-r ${strengthInfo.color}`}
                                                        />
                                                    </div>
                                                </motion.div>
                                            )}
                                        </div>

                                        {/* Confirm password */}
                                        <div className="space-y-2">
                                            <label className="text-white/80 text-sm font-medium">Confirm New Password</label>
                                            <div className="relative group">
                                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                    <Lock className="h-5 w-5 text-blue-400 group-focus-within:text-blue-300 transition-colors" />
                                                </div>
                                                <input
                                                    type={showConfirm ? 'text' : 'password'}
                                                    value={confirmPassword}
                                                    onChange={(e) => { setConfirmPassword(e.target.value); setError(''); }}
                                                    className={`login-input w-full pl-10 pr-12 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 transition-all duration-200 backdrop-blur-sm ${confirmTouched
                                                        ? passwordsMatch
                                                            ? 'focus:ring-green-500 border-green-500/50'
                                                            : 'focus:ring-red-500 border-red-500/50'
                                                        : 'focus:ring-blue-500 focus:border-blue-500'
                                                        }`}
                                                    placeholder="Re-enter new password"
                                                    required
                                                    autoComplete="new-password"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowConfirm(!showConfirm)}
                                                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-blue-400 hover:text-blue-300 transition-colors"
                                                >
                                                    {showConfirm ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                                </button>
                                            </div>
                                            {confirmTouched && !passwordsMatch && (
                                                <motion.p
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    className="text-red-400 text-xs flex items-center gap-1"
                                                >
                                                    <X className="w-3 h-3" /> Passwords do not match
                                                </motion.p>
                                            )}
                                            {confirmTouched && passwordsMatch && (
                                                <motion.p
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    className="text-green-400 text-xs flex items-center gap-1"
                                                >
                                                    <Check className="w-3 h-3" /> Passwords match
                                                </motion.p>
                                            )}
                                        </div>

                                        {/* Password rules checklist */}
                                        {newPassword && (
                                            <motion.div
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: 'auto' }}
                                                className="p-4 bg-white/5 rounded-xl border border-white/10 space-y-2"
                                            >
                                                <p className="text-white/60 text-xs font-medium mb-3">Password requirements</p>
                                                {PASSWORD_RULES.map((rule, i) => {
                                                    const passed = rule.test(newPassword);
                                                    return (
                                                        <motion.div
                                                            key={i}
                                                            initial={{ opacity: 0, x: -10 }}
                                                            animate={{ opacity: 1, x: 0 }}
                                                            transition={{ delay: i * 0.05 }}
                                                            className="flex items-center gap-2"
                                                        >
                                                            <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300 ${passed ? 'bg-green-500' : 'bg-white/10'}`}>
                                                                {passed
                                                                    ? <Check className="w-2.5 h-2.5 text-white" />
                                                                    : <X className="w-2.5 h-2.5 text-white/30" />}
                                                            </div>
                                                            <span className={`text-xs transition-colors duration-300 ${passed ? 'text-green-400' : 'text-white/50'}`}>
                                                                {rule.label}
                                                            </span>
                                                        </motion.div>
                                                    );
                                                })}
                                            </motion.div>
                                        )}

                                        {/* Submit */}
                                        <motion.button
                                            type="submit"
                                            disabled={isLoading || !allRulesMet || !passwordsMatch}
                                            whileHover={{ scale: 1.02 }}
                                            whileTap={{ scale: 0.98 }}
                                            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden group"
                                        >
                                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -skew-x-12 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                                            {isLoading ? (
                                                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/30 border-t-white" />
                                            ) : (
                                                <>
                                                    Update Password
                                                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                                </>
                                            )}
                                        </motion.button>
                                    </form>
                                </motion.div>
                            )}

                            {/* ── SUCCESS STEP ─────────────────────────────────────────────── */}
                            {step === 'success' && (
                                <motion.div
                                    key="success"
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ duration: 0.5 }}
                                    className="h-80 flex flex-col items-center justify-evenly"
                                >
                                    <div className="mb-8 text-center">
                                        <motion.div
                                            initial={{ scale: 0, rotate: -180 }}
                                            animate={{ scale: 1, rotate: 0 }}
                                            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                                            className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full flex items-center justify-center shadow-2xl"
                                        >
                                            <CheckCircle className="w-10 h-10 text-white" />
                                        </motion.div>
                                        <motion.h2
                                            className="text-2xl font-bold text-white mb-2"
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: 0.4 }}
                                        >
                                            Password Updated!
                                        </motion.h2>
                                        <motion.p
                                            className="text-white/70"
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: 0.6 }}
                                        >
                                            Your password has been changed successfully.
                                            <br />Redirecting to login…
                                        </motion.p>
                                    </div>
                                    <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: '100%' }}
                                            transition={{ duration: 3, ease: 'easeInOut' }}
                                            className="h-full bg-gradient-to-r from-green-400 to-blue-400 rounded-full"
                                        />
                                    </div>
                                </motion.div>
                            )}

                        </AnimatePresence>

                        {/* Footer links */}
                        {step === 'form' && (
                            <div className="mt-6 pt-6 border-t border-white/10">
                                <div className="flex items-center justify-between">
                                    {!isForced && (
                                        <button
                                            type="button"
                                            onClick={() => navigate('/login')}
                                            className="flex items-center gap-1.5 text-white/60 hover:text-white text-sm font-medium transition-colors group"
                                        >
                                            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                                            Back to Login
                                        </button>
                                    )}
                                    <p className="text-white/60 text-sm ml-auto">
                                        Need help?{' '}
                                        <button className="text-blue-400 hover:text-blue-300 font-medium transition-colors hover:underline">
                                            Contact Support
                                        </button>
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="mt-6 text-center">
                        <p className="text-white/40 text-xs">
                            © {new Date().getFullYear()} {appShortName} - {appName}. All rights reserved.
                        </p>
                    </div>
                </motion.div>
            </div>
        </div>
    );
};

export default ChangePasswordPage;
