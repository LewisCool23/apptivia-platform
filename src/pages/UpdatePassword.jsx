
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

export default function UpdatePassword() {
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [status, setStatus] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, sessionData) => {
      setSession(sessionData ?? null);
    });
    return () => {
      listener?.subscription?.unsubscribe?.();
    };
  }, []);

  const handleUpdate = async (e) => {
    e.preventDefault();
    setStatus('Verifying current password...');
    if (!session) {
      setStatus('No authenticated session found. Click the reset link again or use the forgot-password flow.');
      return;
    }
    if (newPassword.length < 8) {
      setStatus('Password must be at least 8 characters.');
      return;
    }
    // Re-authenticate user with current password
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: session.user.email,
      password: currentPassword,
    });
    if (signInError) {
      setStatus('Current password is incorrect.');
      return;
    }
    setStatus('Updating password...');
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      setStatus(`Error: ${error.message}`);
      return;
    }
    setStatus('Password updated successfully. You are now signed in. Redirecting to login...');
    setNewPassword('');
    setCurrentPassword('');
    setTimeout(() => {
      navigate('/login');
    }, 2000);
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
        <p className="text-gray-500 mb-4 text-center text-sm">Enter your new password below to update your account.</p>
        {!session ? (
          <p className="mb-6 text-red-500 text-center">
            If you clicked the reset link but are not authenticated, you may need to open the link directly in the browser or try the forgot-password flow again. Some email clients may prefetch links; if that happens try copying the link into a private browser window.
          </p>
        ) : (
          <p className="mb-6 text-center text-gray-700">Signed in as {session.user.email}</p>
        )}
        <div className="mb-4 w-full">
          <label className="block mb-1 font-medium">Current Password</label>
          <input
            type="password"
            className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
            required
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Enter current password"
          />
        </div>
        <div className="mb-4 w-full">
          <label className="block mb-1 font-medium">New Password</label>
          <input
            type="password"
            className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
            required
            minLength={8}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Enter new password"
          />
        </div>
        <button
          type="submit"
          className="w-full bg-gradient-to-r from-blue-500 to-purple-500 text-white py-2.5 rounded-lg font-semibold hover:from-blue-600 hover:to-purple-600 transition text-sm mb-4"
        >
          Update password
        </button>
        {status && <p className={`mt-2 text-center w-full ${status.startsWith('Error') ? 'text-red-500' : status.startsWith('Password') ? 'text-red-500' : 'text-green-600'}`}>{status}</p>}
        <div className="text-center text-gray-500 text-sm mt-6">
          <a href="/login" className="text-blue-600 hover:underline">Back to login</a>
        </div>
      </form>
    </div>
  );
}
