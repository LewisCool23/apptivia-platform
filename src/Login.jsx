import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
      setError(supabaseError.message);
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
        className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md flex flex-col items-center"
      >
        <div className="w-16 h-16 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center mb-6">
          <span className="text-white font-bold text-3xl">A</span>
        </div>
        <h1 className="text-2xl font-bold text-blue-700 mb-2 text-center">Welcome to Apptivia</h1>
        <p className="text-gray-500 mb-4 text-center text-sm">Sign in to access your sales productivity platform</p>
        {error && <div className="mb-4 text-red-500 text-center w-full">{error}</div>}
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
          <label className="flex items-center text-gray-600 text-sm cursor-pointer transition-colors duration-200 hover:text-gray-900">
            <input type="checkbox" className="mr-2" /> Remember me
          </label>
          <div className="flex gap-4">
            <a href="/forgot-password" className="text-blue-600 hover:underline text-sm transition-all duration-200 hover:text-blue-700">Forgot password?</a>
            <a href="/update-password" className="text-blue-600 hover:underline text-sm transition-all duration-200 hover:text-blue-700">Update password</a>
          </div>
        </div>
        <button
          type="submit"
          className="w-full bg-gradient-to-r from-blue-500 to-purple-500 text-white py-2.5 rounded-lg font-semibold hover:from-blue-600 hover:to-purple-600 transition-all duration-300 text-sm mb-4 hover:shadow-lg hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          disabled={isLoading}
        >
          {isLoading ? 'Signing in...' : 'Sign In'}
        </button>
        <div className="text-center text-gray-500 text-sm mt-2">
          Don't have an account?{' '}
          <a href="#" className="text-blue-600 hover:underline transition-all duration-200 hover:text-blue-700">Contact your administrator</a>
        </div>
      </form>
    </div>
  );
};

export default Login;
