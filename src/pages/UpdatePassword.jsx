import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

export default function UpdatePassword() {
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [isRecovery, setIsRecovery] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event, sessionData) => {
      setSession(sessionData ?? null);
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecovery(true);
      }
    });
    return () => {
      listener?.subscription?.unsubscribe?.();
    };
  }, []);

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!session) {
      setStatus({ type: 'error', text: 'No authenticated session. Please click the reset link from your email again, or use the forgot password flow.' });
      return;
    }
    if (newPassword.length < 8) {
      setStatus({ type: 'error', text: 'Password must be at least 8 characters.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setStatus({ type: 'error', text: 'Passwords do not match.' });
      return;
    }

    setIsSubmitting(true);
    setStatus({ type: 'info', text: 'Updating password...' });

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      setStatus({ type: 'error', text: error.message });
      setIsSubmitting(false);
      return;
    }

    setStatus({ type: 'success', text: 'Password updated successfully! Redirecting to login...' });
    setNewPassword('');
    setConfirmPassword('');
    setTimeout(() => navigate('/login'), 2000);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-500 via-purple-500 to-indigo-500">
      <form
        onSubmit={handleUpdate}
        className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md flex flex-col items-center"
      >
        <div className="w-16 h-16 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center mb-6">
          <span className="text-white font-bold text-3xl">A</span>
        </div>
        <h1 className="text-2xl font-bold text-blue-700 mb-2 text-center">Set a new password</h1>
        <p className="text-gray-500 mb-4 text-center text-sm">
          {isRecovery
            ? 'Enter your new password below to reset your account.'
            : 'Enter your new password below to update your account.'}
        </p>
        {!session ? (
          <div className="mb-4 w-full p-3 bg-amber-50 border border-amber-200 rounded-md text-amber-700 text-sm text-center">
            Waiting for session... If you clicked the reset link from your email, please wait a moment. If this persists, try copying the full link directly into your browser.
          </div>
        ) : (
          <p className="mb-4 text-center text-gray-600 text-sm">Signed in as <span className="font-medium">{session.user.email}</span></p>
        )}
        <div className="mb-4 w-full">
          <label className="block mb-1 font-medium text-sm text-gray-700">New Password</label>
          <input
            type="password"
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200"
            required
            minLength={8}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Min. 8 characters"
          />
        </div>
        <div className="mb-6 w-full">
          <label className="block mb-1 font-medium text-sm text-gray-700">Confirm Password</label>
          <input
            type="password"
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200"
            required
            minLength={8}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Re-enter password"
          />
        </div>
        <button
          type="submit"
          disabled={isSubmitting || !session}
          className="w-full bg-gradient-to-r from-blue-500 to-purple-500 text-white py-2.5 rounded-lg font-semibold hover:from-blue-600 hover:to-purple-600 transition-all duration-300 text-sm mb-4 hover:shadow-lg hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
        >
          {isSubmitting ? 'Updating...' : 'Update Password'}
        </button>
        {status && (
          <p className={`mt-2 text-center w-full text-sm ${
            status.type === 'error' ? 'text-red-500' :
            status.type === 'success' ? 'text-green-600' :
            'text-blue-600'
          }`}>{status.text}</p>
        )}
        <div className="text-center text-gray-500 text-sm mt-6">
          <a href="/login" className="text-blue-600 hover:underline transition-all duration-200 hover:text-blue-700">Back to login</a>
        </div>
      </form>
    </div>
  );
}
