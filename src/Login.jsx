import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { supabase } from './supabaseClient';

const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    const { data, error: supabaseError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (supabaseError) {
      setError(supabaseError.message === 'Invalid login credentials'
        ? 'Invalid email or password. If you were recently invited, check your email for the invite link to set up your account.'
        : supabaseError.message);
    } else if (data && data.user) {
      login(data.user);
      navigate('/dashboard');
    } else {
      setError('Login failed. Please try again.');
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-500 via-purple-500 to-indigo-500">
      <form
        onSubmit={handleSubmit}
        className="bg-white p-8 rounded-lg shadow-xl w-full max-w-md flex flex-col items-center"
      >
        <div className="w-16 h-16 rounded-lg bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center mb-6">
          <span className="text-white font-bold text-3xl">A</span>
        </div>
        <h1 className="text-2xl font-bold text-apptivia-coral mb-2 text-center">Welcome to Apptivia</h1>
        <p className="text-apptivia-carbon-500 mb-4 text-center text-sm">Sign in to access your sales productivity platform</p>
        {error && <div className="mb-4 text-red-500 text-center w-full">{error}</div>}
        <button
          type="button"
          onClick={async () => {
            const { error: oauthErr } = await supabase.auth.signInWithOAuth({
              provider: 'google',
              options: { redirectTo: window.location.origin + '/dashboard' },
            });
            if (oauthErr) setError(oauthErr.message);
          }}
          className="w-full flex items-center justify-center gap-3 border border-apptivia-carbon-300 rounded-lg py-2.5 font-medium text-apptivia-carbon-700 hover:bg-apptivia-paper transition-all duration-200 text-sm mb-4"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </button>
        <div className="flex items-center w-full mb-4">
          <div className="flex-1 border-t border-apptivia-carbon-200"></div>
          <span className="px-3 text-xs text-apptivia-carbon-400 uppercase">or</span>
          <div className="flex-1 border-t border-apptivia-carbon-200"></div>
        </div>
        <div className="mb-4 w-full">
          <label className="block mb-1 font-medium">Email Address</label>
          <input
            type="email"
            className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all duration-200"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoFocus
            placeholder="you@company.com"
          />
        </div>
        <div className="mb-2 w-full">
          <label className="block mb-1 font-medium">Password</label>
          <input
            type="password"
            className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all duration-200"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            placeholder="Enter your password"
          />
        </div>
        <div className="flex items-center justify-between w-full mb-6 mt-2">
          <label className="flex items-center text-apptivia-carbon-600 text-sm cursor-pointer transition-colors duration-200 hover:text-apptivia-ink">
            <input type="checkbox" className="mr-2" /> Remember me
          </label>
          <a href="/forgot-password" className="text-apptivia-coral hover:underline text-sm transition-all duration-200 hover:text-apptivia-coral">Forgot password?</a>
        </div>
        <button
          type="submit"
          className="w-full bg-gradient-to-r from-blue-500 to-purple-500 text-white py-2.5 rounded-lg font-semibold hover:from-blue-600 hover:to-purple-600 transition-all duration-300 text-sm mb-4 hover:shadow-lg hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          disabled={isLoading}
        >
          {isLoading ? 'Signing in...' : 'Sign In'}
        </button>
        <div className="text-center text-apptivia-carbon-500 text-sm mt-2">
          Don't have an account?{' '}
          <Link to="/signup" className="text-apptivia-coral hover:underline transition-all duration-200 hover:text-apptivia-coral">Sign Up</Link>
        </div>
      </form>
    </div>
  );
};

export default Login;
