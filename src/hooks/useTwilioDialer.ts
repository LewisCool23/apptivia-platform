/**
 * useTwilioDialer — React hook for Twilio WebRTC browser-based calling.
 *
 * Manages the Twilio Device lifecycle, call state, and auto-logging.
 * Mount this hook at the Engage page level so it persists across tab switches.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Device, Call } from '@twilio/voice-sdk';
import { supabase } from '../supabaseClient';
import { backendFetch } from '../utils/backendFetch';

// ── Types ──────────────────────────────────────────────────

export interface DialerContact {
  name: string;
  phone: string;
  prospect_id?: string;   // only if contact is a persisted engage_prospects row
  company_name?: string;
}

export type CallStatus =
  | 'idle'
  | 'connecting'      // Device registering / token fetch in progress
  | 'ringing'         // Call placed, waiting for answer
  | 'in-call'         // Call connected
  | 'disconnecting'   // Hang-up initiated
  | 'error';

export interface TwilioDialerState {
  callStatus: CallStatus;
  activeContact: DialerContact | null;
  callDurationSeconds: number;
  isMuted: boolean;
  error: string | null;
  isDeviceReady: boolean;
}

export interface TwilioDialerActions {
  startCall: (contact: DialerContact) => Promise<void>;
  hangUp: () => void;
  toggleMute: () => void;
}

export type UseTwilioDialerReturn = TwilioDialerState & TwilioDialerActions;

// ── Hook ───────────────────────────────────────────────────

export function useTwilioDialer(
  organizationId: string,
  userId: string,
): UseTwilioDialerReturn {
  const [callStatus, setCallStatus] = useState<CallStatus>('idle');
  const [activeContact, setActiveContact] = useState<DialerContact | null>(null);
  const [callDurationSeconds, setCallDurationSeconds] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDeviceReady, setIsDeviceReady] = useState(false);

  const deviceRef = useRef<Device | null>(null);
  const callRef = useRef<Call | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const callStartRef = useRef<Date | null>(null);
  // Use a ref for duration to avoid closure stale value in disconnect handler
  const durationRef = useRef(0);

  // ── Device initialization ────────────────────────────────

  useEffect(() => {
    if (!organizationId || !userId) return;

    let cancelled = false;

    async function initDevice() {
      try {
        const resp = await backendFetch<{ token: string; identity: string }>(
          '/api/engage/calls/token',
          {},
          'POST',
        );

        if (cancelled) return;

        const device = new Device(resp.token, {
          logLevel: 1,
          codecPreferences: [Call.Codec.Opus, Call.Codec.PCMU],
        });

        device.on('registered', () => {
          if (!cancelled) setIsDeviceReady(true);
        });

        device.on('error', (err: any) => {
          console.error('[TwilioDialer] Device error:', err);
          if (!cancelled) setError(err.message || 'Dialer device error');
        });

        device.on('tokenWillExpire', async () => {
          try {
            const refreshed = await backendFetch<{ token: string }>(
              '/api/engage/calls/token',
              {},
              'POST',
            );
            device.updateToken(refreshed.token);
          } catch (e) {
            console.error('[TwilioDialer] Token refresh failed:', e);
          }
        });

        await device.register();
        deviceRef.current = device;
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message || 'Failed to initialize dialer');
        }
      }
    }

    initDevice();

    return () => {
      cancelled = true;
      deviceRef.current?.destroy();
      deviceRef.current = null;
      setIsDeviceReady(false);
    };
  }, [organizationId, userId]);

  // ── Timer helpers ────────────────────────────────────────

  const startTimer = useCallback(() => {
    callStartRef.current = new Date();
    durationRef.current = 0;
    setCallDurationSeconds(0);
    timerRef.current = setInterval(() => {
      durationRef.current += 1;
      setCallDurationSeconds(durationRef.current);
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // ── Auto-log on disconnect ───────────────────────────────

  const logCall = useCallback(async (
    contact: DialerContact,
    durationSeconds: number,
    callSid?: string,
  ) => {
    const durationMinutes = Math.max(1, Math.round(durationSeconds / 60));
    try {
      const row: Record<string, any> = {
        organization_id: organizationId,
        user_id: userId,
        contact_name: contact.name,
        call_direction: 'outbound',
        duration_minutes: durationMinutes,
        notes: 'Outbound call via Apptivia Engage',
        call_date: callStartRef.current?.toISOString() ?? new Date().toISOString(),
      };
      if (callSid) row.twilio_call_sid = callSid;
      if (contact.prospect_id) row.prospect_id = contact.prospect_id;

      const { error: insertErr } = await supabase
        .from('engage_call_logs')
        .insert(row);

      if (insertErr) {
        console.error('[TwilioDialer] Call log insert error:', insertErr.message);
      }

      // Update last_called_at on the prospect row if we have a prospect_id
      if (contact.prospect_id) {
        await supabase
          .from('engage_prospects')
          .update({ last_called_at: new Date().toISOString() })
          .eq('id', contact.prospect_id);
      }
    } catch (e) {
      console.error('[TwilioDialer] logCall error:', e);
    }
  }, [organizationId, userId]);

  // ── startCall ────────────────────────────────────────────

  const startCall = useCallback(async (contact: DialerContact) => {
    if (!deviceRef.current || !isDeviceReady) {
      setError('Dialer not ready. Please wait a moment and try again.');
      return;
    }
    if (callStatus !== 'idle') return;

    try {
      setError(null);
      setActiveContact(contact);
      setCallStatus('connecting');
      setIsMuted(false);
      durationRef.current = 0;
      setCallDurationSeconds(0);

      const call = await deviceRef.current.connect({
        params: { To: contact.phone },
      });
      callRef.current = call;

      call.on('ringing', () => setCallStatus('ringing'));

      call.on('accept', () => {
        setCallStatus('in-call');
        startTimer();
      });

      call.on('disconnect', () => {
        const sid = (callRef.current as any)?.parameters?.CallSid as string | undefined;
        const duration = durationRef.current;
        const capturedContact = contact;
        const hadStart = callStartRef.current !== null;

        stopTimer();
        setCallStatus('idle');
        setActiveContact(null);
        setIsMuted(false);
        callRef.current = null;

        // Only log if the call actually connected (startTimer was called)
        if (hadStart) {
          logCall(capturedContact, duration, sid);
        }
        callStartRef.current = null;
      });

      call.on('error', (err: any) => {
        console.error('[TwilioDialer] Call error:', err);
        stopTimer();
        setCallStatus('error');
        setError(err.message || 'Call failed');
        callRef.current = null;
        callStartRef.current = null;
      });
    } catch (err: any) {
      setCallStatus('error');
      setError(err.message || 'Failed to start call');
    }
  }, [isDeviceReady, callStatus, startTimer, stopTimer, logCall]);

  // ── hangUp ───────────────────────────────────────────────

  const hangUp = useCallback(() => {
    if (callRef.current) {
      callRef.current.disconnect();
      setCallStatus('disconnecting');
    }
  }, []);

  // ── toggleMute ───────────────────────────────────────────

  const toggleMute = useCallback(() => {
    if (!callRef.current) return;
    const next = !isMuted;
    callRef.current.mute(next);
    setIsMuted(next);
  }, [isMuted]);

  // ── Cleanup timer on unmount ─────────────────────────────

  useEffect(() => {
    return () => { stopTimer(); };
  }, [stopTimer]);

  return {
    callStatus,
    activeContact,
    callDurationSeconds,
    isMuted,
    error,
    isDeviceReady,
    startCall,
    hangUp,
    toggleMute,
  };
}
