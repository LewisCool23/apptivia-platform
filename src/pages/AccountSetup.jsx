import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { supabase } from '../supabaseClient';
import { Eye, EyeOff, Loader } from 'lucide-react';

export default function AccountSetup() {
  const navigate = useNavigate();
  const { user, profile, profileLoaded, isAuthenticated, isLoading, refreshProfile } = useAuth();

  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    password: '',
    confirmPassword: '',
    title: '',
    department: '',
  });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [titles, setTitles] = useState([]);

  // Fetch available departments (from teams) and titles (from profiles) for dropdowns
  useEffect(() => {
    (async () => {
      const [teamsRes, profilesRes] = await Promise.all([
        supabase.from('teams').select('department').not('department', 'is', null),
        supabase.from('profiles').select('title').not('title', 'is', null),
      ]);
      if (teamsRes.data) {
        setDepartments([...new Set(teamsRes.data.map(t => t.department).filter(Boolean))].sort());
      }
      if (profilesRes.data) {
        setTitles([...new Set(profilesRes.data.map(p => p.title).filter(Boolean))].sort());
      }
    })();
  }, []);

  // Auth guard: redirect if not authenticated or if setup already complete
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate('/login', { replace: true });
      return;
    }
    if (profile && profile.first_name) {
      navigate('/dashboard', { replace: true });
    }
  }, [isLoading, isAuthenticated, profile, navigate]);

  const handleChange = (field) => (e) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const trimmedFirst = formData.first_name.trim();
    const trimmedLast = formData.last_name.trim();
    if (!trimmedFirst || !trimmedLast) {
      setError('First name and last name are required.');
      return;
    }
    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Set password
      const { error: pwError } = await supabase.auth.updateUser({
        password: formData.password,
      });
      if (pwError) throw pwError;

      // 2. Update profile (row should exist from invite endpoint)
      const profileFields = {
        first_name: trimmedFirst,
        last_name: trimmedLast,
        ...(formData.title.trim() ? { title: formData.title.trim() } : {}),
        ...(formData.department.trim() ? { department: formData.department.trim() } : {}),
      };
      const { data: updated, error: profileError } = await supabase
        .from('profiles')
        .update(profileFields)
        .eq('id', user.id)
        .select('id');
      if (profileError) throw profileError;

      // If no row was updated, profile is missing — insert with full metadata
      if (!updated || updated.length === 0) {
        const meta = user.user_metadata || {};
        const { error: insertError } = await supabase
          .from('profiles')
          .insert({
            id: user.id,
            email: user.email,
            ...profileFields,
            ...(meta.organization_id ? { organization_id: meta.organization_id } : {}),
            ...(meta.role ? { role: meta.role } : {}),
          });
        if (insertError) throw insertError;
      }

      // 3. Mark invitation as accepted (non-fatal — RLS may block)
      await supabase
        .from('invitations')
        .update({ status: 'accepted', accepted_at: new Date().toISOString() })
        .eq('email', user.email)
        .eq('status', 'pending')
        .then(() => {})
        .catch(() => {});

      // 4. Refresh profile so ProtectedRoute sees first_name
      await refreshProfile();

      // 5. Navigate to dashboard
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Show loader while auth state or profile is loading
  if (isLoading || !profileLoaded) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-500 via-purple-500 to-indigo-500 flex items-center justify-center">
        <div className="text-center">
          <Loader className="animate-spin text-white mx-auto mb-4" size={48} />
          <p className="text-white/80">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-500 via-purple-500 to-indigo-500">
      <form
        onSubmit={handleSubmit}
        className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md flex flex-col items-center"
      >
        {/* Brand logo */}
        <div className="w-16 h-16 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center mb-6">
          <span className="text-white font-bold text-3xl">A</span>
        </div>

        <h1 className="text-2xl font-bold text-blue-700 mb-2 text-center">
          Complete Your Account
        </h1>
        <p className="text-gray-500 mb-6 text-center text-sm">
          Welcome to Apptivia! Set up your profile and password to get started.
        </p>

        {error && (
          <div className="mb-4 w-full p-3 bg-red-50 border border-red-200 rounded-md text-red-600 text-sm">
            {error}
          </div>
        )}

        {/* First Name + Last Name */}
        <div className="grid grid-cols-2 gap-4 w-full mb-4">
          <div>
            <label className="block mb-1 font-medium text-sm text-gray-700">
              First Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.first_name}
              onChange={handleChange('first_name')}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200"
              required
              autoFocus
              placeholder="Jane"
            />
          </div>
          <div>
            <label className="block mb-1 font-medium text-sm text-gray-700">
              Last Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.last_name}
              onChange={handleChange('last_name')}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200"
              required
              placeholder="Doe"
            />
          </div>
        </div>

        {/* Password */}
        <div className="mb-4 w-full">
          <label className="block mb-1 font-medium text-sm text-gray-700">
            Password <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={formData.password}
              onChange={handleChange('password')}
              className="w-full border border-gray-300 rounded-md px-3 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200"
              required
              minLength={8}
              placeholder="Min. 8 characters"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        {/* Confirm Password */}
        <div className="mb-4 w-full">
          <label className="block mb-1 font-medium text-sm text-gray-700">
            Confirm Password <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              type={showConfirmPassword ? 'text' : 'password'}
              value={formData.confirmPassword}
              onChange={handleChange('confirmPassword')}
              className="w-full border border-gray-300 rounded-md px-3 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200"
              required
              minLength={8}
              placeholder="Re-enter password"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              tabIndex={-1}
            >
              {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        {/* Title (optional) */}
        <div className="mb-4 w-full">
          <label className="block mb-1 font-medium text-sm text-gray-700">
            Title <span className="text-gray-400 text-xs">(optional)</span>
          </label>
          <select
            value={formData.title}
            onChange={handleChange('title')}
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200 text-sm"
          >
            <option value="">Select a title</option>
            {titles.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        {/* Department (optional) */}
        <div className="mb-6 w-full">
          <label className="block mb-1 font-medium text-sm text-gray-700">
            Department <span className="text-gray-400 text-xs">(optional)</span>
          </label>
          <select
            value={formData.department}
            onChange={handleChange('department')}
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200 text-sm"
          >
            <option value="">Select a department</option>
            {departments.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-gradient-to-r from-blue-500 to-purple-500 text-white py-2.5 rounded-lg font-semibold hover:from-blue-600 hover:to-purple-600 transition-all duration-300 text-sm hover:shadow-lg hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
        >
          {isSubmitting ? 'Setting up your account...' : 'Complete Setup'}
        </button>
      </form>
    </div>
  );
}
