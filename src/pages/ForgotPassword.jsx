import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { ApptiviaLogo } from '../components/ApptiviaLogo';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('Sending reset email...');
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/update-password`,
    });
    if (error) {
      setStatus(`Error: ${error.message}`);
      return;
    }
    setStatus('If the email exists, a reset link was sent. Check your inbox.');
  };

  return (
    <div className="min-h-screen relative bg-apptivia-ink flex items-center justify-center">
      {/* Decorative gradient overlay - Option B subtle Carbon + Coral glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(ellipse at top right, #27272A 0%, transparent 60%),
            radial-gradient(ellipse at bottom left, rgba(255, 77, 46, 0.08) 0%, transparent 50%)
          `,
        }}
      />
      <div className="relative z-10">
      <form
        onSubmit={handleSubmit}
        className="bg-white p-8 rounded-lg shadow-xl w-full max-w-md flex flex-col items-center"
      >
        <div className="text-center mb-6">
          <ApptiviaLogo className="text-3xl" />
        </div>
        <h1 className="text-2xl font-bold text-apptivia-coral mb-2 text-center">Forgot your password?</h1>
        <p className="text-apptivia-carbon-500 mb-4 text-center text-sm">Enter your email address and we'll send you a link to reset your password.</p>
        <div className="mb-4 w-full">
          <label className="block mb-1 font-medium">Email Address</label>
          <input
            type="email"
            className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-apptivia-coral"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@email.com"
          />
        </div>
        <button
          type="submit"
          className="w-full bg-apptivia-coral hover:bg-apptivia-coral-tone-600 text-apptivia-paper py-2.5 rounded-lg font-semibold transition text-sm mb-4"
        >
          Send reset email
        </button>
        {status && <p className={`mt-2 text-center w-full ${status.startsWith('Error') ? 'text-red-500' : 'text-green-600'}`}>{status}</p>}
        <div className="text-center text-apptivia-carbon-500 text-sm mt-6">
          <a href="/login" className="text-apptivia-coral hover:underline">Back to login</a>
        </div>
      </form>
      </div>
    </div>
  );
}
