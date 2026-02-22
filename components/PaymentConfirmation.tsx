import React, { useState } from 'react';
import { CheckCircle, AlertCircle } from 'lucide-react';
import { buildAuthHeaders } from '../services/sessionService';

interface PaymentConfirmationProps {
  tier: string;
  userId: string;
  onSuccess: (membership: any) => void;
  onCancel: () => void;
}

const PaymentConfirmation: React.FC<PaymentConfirmationProps> = ({
  tier,
  userId,
  onSuccess,
  onCancel
}) => {
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [error, setError] = useState('');
  const backendBaseUrl = (import.meta.env.VITE_BACKEND_URL || '').replace(/\/+$/, '');

  React.useEffect(() => {
    const processPayment = async () => {
      try {
        // Call membership confirmation endpoint
        const response = await fetch(`${backendBaseUrl}/api/membership/confirm-payment`, {
          method: 'POST',
          headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ userId, tier })
        });

        if (!response.ok) {
          throw new Error('Payment confirmation failed');
        }

        // Fetch updated membership status
        const statusResponse = await fetch(
          `${backendBaseUrl}/api/membership/status/${userId}`,
          { headers: buildAuthHeaders() }
        );
        const membershipData = await statusResponse.json();

        setStatus('success');
        onSuccess(membershipData);
      } catch (err) {
        setStatus('error');
        setError(err instanceof Error ? err.message : 'Payment processing failed');
      }
    };

    // Small delay for UX
    const timer = setTimeout(processPayment, 2000);
    return () => clearTimeout(timer);
  }, [tier, userId, onSuccess]);

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
      <div className="glass-panel rounded-[2rem] p-8 sm:p-12 max-w-md w-full border border-blue-400/30 shadow-2xl">
        {status === 'processing' && (
          <div className="space-y-6 text-center">
            <div className="flex justify-center">
              <div className="relative">
                <div className="w-20 h-20 rounded-full border-4 border-blue-400/20 border-t-cyan-400 animate-spin" />
                <div className="absolute inset-2 rounded-full border-4 border-transparent border-r-blue-400/40 animate-spin" style={{ animationDirection: 'reverse' }} />
              </div>
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-cyan-200">Processing Payment</h3>
              <p className="text-sm text-blue-300/70">Confirming your <span className="font-bold text-cyan-300">{tier}</span> membership...</p>
            </div>
            <div className="flex gap-1 justify-center">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"
                  style={{ animationDelay: `${i * 0.2}s` }}
                />
              ))}
            </div>
          </div>
        )}

        {status === 'success' && (
          <div className="space-y-6 text-center">
            <div className="flex justify-center">
              <CheckCircle className="w-20 h-20 text-green-400 animate-bounce" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-green-300">Welcome!</h3>
              <p className="text-sm text-blue-300/70">Your <span className="font-bold text-cyan-300">{tier}</span> membership is now active</p>
            </div>
            <div className="bg-green-500/10 border border-green-400/30 rounded-lg p-4">
              <p className="text-xs text-green-300 font-semibold">✨ MVP Payment Confirmed</p>
              <p className="text-[11px] text-green-200/70 mt-2">This is a simulated payment for MVP testing. Real payments will be integrated later.</p>
            </div>
            <button
              onClick={() => onSuccess({})}
              className="w-full py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white rounded-xl font-bold text-sm uppercase tracking-widest transition-all"
            >
              Continue to Dashboard
            </button>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-6 text-center">
            <div className="flex justify-center">
              <AlertCircle className="w-20 h-20 text-red-400" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-red-300">Payment Error</h3>
              <p className="text-sm text-blue-300/70">{error}</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={onCancel}
                className="flex-1 py-3 bg-blue-900/50 hover:bg-blue-800/70 text-blue-200 rounded-xl font-bold text-sm uppercase tracking-widest transition-all border border-blue-400/30"
              >
                Back
              </button>
              <button
                onClick={() => {
                  setStatus('processing');
                  setError('');
                  // Retry payment
                  const processPayment = async () => {
                    try {
                      const response = await fetch(`${backendBaseUrl}/api/membership/confirm-payment`, {
                        method: 'POST',
                        headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
                        body: JSON.stringify({ userId, tier })
                      });

                      if (!response.ok) throw new Error('Payment confirmation failed');

                      const statusResponse = await fetch(
                        `${backendBaseUrl}/api/membership/status/${userId}`,
                        { headers: buildAuthHeaders() }
                      );
                      const membershipData = await statusResponse.json();

                      setStatus('success');
                      onSuccess(membershipData);
                    } catch (err) {
                      setStatus('error');
                      setError(err instanceof Error ? err.message : 'Payment processing failed');
                    }
                  };

                  setTimeout(processPayment, 2000);
                }}
                className="flex-1 py-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-bold text-sm uppercase tracking-widest transition-all"
              >
                Retry
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PaymentConfirmation;
