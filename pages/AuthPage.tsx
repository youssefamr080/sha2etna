import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, User, Phone, ArrowRight, Loader2 } from 'lucide-react';
import * as AuthService from '../services/authService';
import * as GroupService from '../services/GroupService';
import { getErrorMessage } from '../utils/errorHandler';
import type { User as UserType } from '../types';

interface AuthPageProps {
  onLogin: (user: UserType) => void;
}

const AuthPage: React.FC<AuthPageProps> = ({ onLogin }) => {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Form fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (isLogin) {
        // Login
        const user = await AuthService.signInWithEmail(email, password);
        AuthService.setCachedProfile(user);
        onLogin(user);
        
        // Check if user has groups
        const groups = await GroupService.getUserGroups(user.id);
        if (groups.length > 0) {
          navigate('/');
        } else {
          navigate('/group-setup');
        }
      } else {
        // Register
        if (password !== confirmPassword) {
          setError('كلمة المرور غير متطابقة');
          setIsLoading(false);
          return;
        }

        if (password.length < 4) {
          setError('كلمة المرور يجب أن تكون 4 أحرف على الأقل');
          setIsLoading(false);
          return;
        }

        const user = await AuthService.signUpWithEmail(name, email, password, phone);
        AuthService.setCachedProfile(user);
        onLogin(user);
        navigate('/group-setup');
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-secondary via-slate-900 to-secondary flex flex-col items-center justify-center p-6" dir="rtl">
      {/* Logo */}
      <div className="mb-8 text-center">
        <div className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-4xl">🏠</span>
        </div>
        <h1 className="text-4xl font-bold text-primary">شقتنا</h1>
        <p className="text-gray-400 mt-2">إدارة مصاريف السكن بذكاء</p>
      </div>

      {/* Auth Card */}
      <div className="w-full max-w-md bg-white/10 backdrop-blur-lg rounded-3xl p-8 border border-white/20 shadow-2xl">
        {/* Tabs */}
        <div className="flex mb-8 bg-white/5 rounded-xl p-1">
          <button
            onClick={() => { setIsLogin(true); setError(''); }}
            className={`flex-1 py-3 rounded-lg font-semibold transition-all ${
              isLogin ? 'bg-primary text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            تسجيل الدخول
          </button>
          <button
            onClick={() => { setIsLogin(false); setError(''); }}
            className={`flex-1 py-3 rounded-lg font-semibold transition-all ${
              !isLogin ? 'bg-primary text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            حساب جديد
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {!isLogin && (
            <div className="relative">
              <User className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="الاسم الكامل"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required={!isLogin}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-4 pr-12 pl-4 text-white placeholder-gray-400 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
          )}

          <div className="relative">
            <Mail className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="email"
              placeholder="البريد الإلكتروني"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-white/5 border border-white/10 rounded-xl py-4 pr-12 pl-4 text-white placeholder-gray-400 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
            />
          </div>

          {!isLogin && (
            <div className="relative">
              <Phone className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="tel"
                placeholder="رقم الهاتف (اختياري)"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-4 pr-12 pl-4 text-white placeholder-gray-400 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
          )}

          <div className="relative">
            <Lock className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="كلمة المرور"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full bg-white/5 border border-white/10 rounded-xl py-4 pr-12 pl-12 text-white placeholder-gray-400 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>

          {!isLogin && (
            <div className="relative">
              <Lock className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="تأكيد كلمة المرور"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required={!isLogin}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-4 pr-12 pl-4 text-white placeholder-gray-400 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
          )}

          {error && (
            <div className="bg-red-500/20 border border-red-500/30 rounded-xl p-3 text-red-300 text-sm text-center">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-primary hover:bg-emerald-600 text-white font-bold py-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isLoading ? (
              <Loader2 className="animate-spin" size={24} />
            ) : (
              <>
                {isLogin ? 'دخول' : 'إنشاء حساب'}
                <ArrowRight size={20} />
              </>
            )}
          </button>
        </form>

      </div>
    </div>
  );
};

export default AuthPage;
