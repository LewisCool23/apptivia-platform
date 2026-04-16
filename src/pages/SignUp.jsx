import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { supabase } from '../supabaseClient';
import { backendFetch } from '../utils/backendFetch';

export default function SignUp() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const { first_name, last_name, email, password, confirm } = form;

    if (!first_name.trim() || !last_name.trim() || !email.trim() || !password) {
      return setError('All fields are required');
    }
    if (password.length < 8) {
      return setError('Password must be at least 8 characters');
    }
    if (password !== confirm) {
      return setError('Passwords do not match');
    }

    setIsLoading(true);
    try {
      await backendFetch('/api/auth/signup', {
        first_name: first_name.trim(),
        last_name: last_name.trim(),
        email: email.trim().toLowerCase(),
        password,
      });

      // Auto sign in
      const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (authErr) {
        setError('Account created but sign in failed. Please go to the login page.');
        setIsLoading(false);
        return;
      }
      login(authData.user);
      navigate('/dashboard');
    } catch (err) {
      // backendFetch throws with the backend's error message on non-2xx responses
      const msg = err.message || '';
      // Try to parse JSON error from backend (e.g. '{"error":"An account with this email already exists"}')
      try {
        const parsed = JSON.parse(msg);
        setError(parsed.error || 'Sign up failed');
      } catch {
        setError(msg || 'Something went wrong. Please try again.');
      }
      setIsLoading(false);
    }
  };

  const inputCls = 'w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all duration-200';

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-500 via-purple-500 to-indigo-500">
      <form
        onSubmit={handleSubmit}
        className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md flex flex-col items-center"
      >
        <div className="w-16 h-16 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center mb-6">
          <span className="text-white font-bold text-3xl">A</span>
        </div>
        <h1 className="text-2xl font-bold text-blue-700 mb-1 text-center">Create Your Account</h1>
        <p className="text-gray-500 mb-4 text-center text-sm">Start your 14-day free Pro trial — no credit card required</p>

        {error && <div className="mb-4 text-red-500 text-center w-full text-sm">{error}</div>}

        <button
          type="button"
          onClick={async () => {
            const { error: oauthErr } = await supabase.auth.signInWithOAuth({
              provider: 'google',
              options: { redirectTo: window.location.origin + '/dashboard' },
            });
            if (oauthErr) setError(oauthErr.message);
          }}
          className="w-full flex items-center justify-center gap-3 border border-gray-300 rounded-lg py-2.5 font-medium text-gray-700 hover:bg-gray-50 transition-all duration-200 text-sm mb-4"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Sign up with Google
        </button>
        <div className="flex items-center w-full mb-4">
          <div className="flex-1 border-t border-gray-200"></div>
          <span className="px-3 text-xs text-gray-400 uppercase">or</span>
          <div className="flex-1 border-t border-gray-200"></div>
        </div>

        <div className="flex gap-3 w-full mb-4">
          <div className="flex-1">
            <label className="block mb-1 font-medium text-sm">First Name</label>
            <input type="text" className={inputCls} value={form.first_name} onChange={set('first_name')} required placeholder="Jane" autoFocus />
          </div>
          <div className="flex-1">
            <label className="block mb-1 font-medium text-sm">Last Name</label>
            <input type="text" className={inputCls} value={form.last_name} onChange={set('last_name')} required placeholder="Smith" />
          </div>
        </div>

        <div className="mb-4 w-full">
          <label className="block mb-1 font-medium text-sm">Work Email</label>
          <input type="email" className={inputCls} value={form.email} onChange={set('email')} required placeholder="jane@company.com" />
        </div>

        <div className="mb-4 w-full">
          <label className="block mb-1 font-medium text-sm">Password</label>
          <div className="relative">
            <input
              type={showPw ? 'text' : 'password'}
              className={inputCls + ' pr-10'}
              value={form.password}
              onChange={set('password')}
              required
              placeholder="Min. 8 characters"
            />
            <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm" onClick={() => setShowPw((v) => !v)} tabIndex={-1}>
              {showPw ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>

        <div className="mb-6 w-full">
          <label className="block mb-1 font-medium text-sm">Confirm Password</label>
          <input type="password" className={inputCls} value={form.confirm} onChange={set('confirm')} required placeholder="Re-enter your password" />
        </div>

        <button
          type="submit"
          className="w-full bg-gradient-to-r from-blue-500 to-purple-500 text-white py-2.5 rounded-lg font-semibold hover:from-blue-600 hover:to-purple-600 transition-all duration-300 text-sm mb-4 hover:shadow-lg hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          disabled={isLoading}
        >
          {isLoading ? 'Creating account...' : 'Start Free Trial'}
        </button>

        <p className="text-xs text-gray-400 text-center mb-3">
          By signing up you agree to our Terms of Service and Privacy Policy.
        </p>

        <div className="text-center text-gray-500 text-sm">
          Already have an account?{' '}
          <Link to="/login" className="text-blue-600 hover:underline transition-all duration-200 hover:text-blue-700">Sign In</Link>
        </div>
      </form>
    </div>
  );
}
