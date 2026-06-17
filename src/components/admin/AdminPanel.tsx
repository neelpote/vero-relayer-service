import React, { useState, useEffect, useMemo } from 'react';
import { ShieldAlert, CheckCircle, RefreshCw, XCircle, ShieldCheck } from 'lucide-react';
import './admin.css';

export default function AdminPanel() {
  const [adminAddress, setAdminAddress] = useState<string>('');
  const [isKilled, setIsKilled] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Fetch current kill-switch status on mount
  useEffect(() => {
    fetch('/api/admin/status')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch contract status');
        return res.json();
      })
      .then((data) => {
        setIsKilled(data.killed);
      })
      .catch((err) => {
        console.error('Failed to load admin status:', err);
      });
  }, []);

  // Validate address format (Starts with G, base32 characters, length 56)
  const isValidAddress = useMemo(() => {
    const trimmed = adminAddress.trim();
    const stellarAddressRegex = /^G[A-Z2-7]{55}$/;
    return stellarAddressRegex.test(trimmed);
  }, [adminAddress]);

  // Trigger Kill Switch
  const handleTriggerKill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidAddress) {
      setError('Please provide a valid Stellar admin address');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/admin/kill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminAddress: adminAddress.trim() })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to trigger kill switch');

      setIsKilled(true);
      setSuccessMsg('Kill switch triggered! Contract execution has been successfully halted on-chain.');
      setAdminAddress('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Reactivate Contract
  const handleReactivate = async () => {
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/admin/resume', {
        method: 'POST'
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reactivate contract');

      setIsKilled(false);
      setSuccessMsg('Contract successfully reactivated. Operations have resumed.');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-container">
      {/* Background visual indicators */}
      <div className={`status-glow ${isKilled ? 'glow-red' : 'glow-green'}`}></div>

      <div className="admin-grid">
        {/* Status Card */}
        <div className="admin-card glass-panel status-card">
          <div className="card-header">
            <h3>Contract Status Indicator</h3>
          </div>
          <div className="status-display">
            <div className={`status-indicator-ring ${isKilled ? 'killed' : 'active'}`}>
              <div className="status-indicator-dot"></div>
            </div>
            <div className="status-labels">
              <div className={`status-badge-large ${isKilled ? 'terminated' : 'active'}`}>
                {isKilled ? 'TERMINATED' : 'OPERATIONAL'}
              </div>
              <p className="status-description">
                {isKilled 
                  ? 'All contract proposal creation, threshold updates, and vote approval endpoints are strictly disabled.'
                  : 'All contract functions are running normally. Multisig proposals can be cast and executed.'}
              </p>
            </div>
          </div>

          {isKilled && (
            <button
              onClick={handleReactivate}
              disabled={loading}
              className="btn-action btn-resume"
              style={{ alignSelf: 'flex-start', marginTop: '16px' }}
            >
              {loading ? <RefreshCw size={18} className="spin-icon" /> : <ShieldCheck size={18} />}
              <span>Reactivate Contract</span>
            </button>
          )}
        </div>

        {/* Trigger Card */}
        <div className="admin-card glass-panel trigger-card">
          <div className="card-header">
            <ShieldAlert className="warning-icon" />
            <h3>Emergency Kill Switch</h3>
          </div>
          
          <p className="emergency-warning">
            Triggering the kill switch is an administrative emergency action. Any single authorized admin address can invoke this, instantly halting all multisig and transaction pipelines.
          </p>

          <form onSubmit={handleTriggerKill} className="kill-form">
            <div className="form-group">
              <label htmlFor="admin-address">Admin Authorization Address</label>
              <input
                id="admin-address"
                type="text"
                placeholder="Enter admin public key (G...)"
                value={adminAddress}
                onChange={(e) => setAdminAddress(e.target.value)}
                disabled={isKilled || loading}
                className="address-input"
              />
              {adminAddress && (
                <span className={`validation-indicator ${isValidAddress ? 'valid' : 'invalid'}`}>
                  {isValidAddress ? 'Valid Address Syntax' : 'Invalid Address (must start with G, length 56)'}
                </span>
              )}
            </div>

            <button
              type="submit"
              disabled={isKilled || loading || !isValidAddress}
              className="btn-action btn-kill"
            >
              {loading ? <RefreshCw size={18} className="spin-icon" /> : <XCircle size={18} />}
              <span>Execute Kill Switch</span>
            </button>
          </form>

          {successMsg && (
            <div className="alert-message alert-success">
              <CheckCircle size={18} />
              <p>{successMsg}</p>
            </div>
          )}

          {error && (
            <div className="alert-message alert-error">
              <ShieldAlert size={18} />
              <p>{error}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
