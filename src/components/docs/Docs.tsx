import React, { useState, useEffect, useMemo } from 'react';
import { Globe, FileText, CheckCircle, AlertTriangle, Database, Save, X, RefreshCw } from 'lucide-react';
import { marked } from 'marked';
import './docs.css';

interface DocsProps {
  initialSelectedModule?: string | null;
}

const DEFAULT_DOCS: Record<string, string> = {
  'lib.rs': 'QmXoypizjW3WknFixtdKLh4T72Yk9951wX9rEMe3c3b5A5', // Standard IPFS README
  'admin.rs': 'QmYwAPJzv5CZ1aA5xKVrnzg2VWJqk5F37tqbvvqHCsLk3d', // IPFS Quick Start Guide
  'types.rs': 'QmW2WQiZy3cKo14YJqh4teA4JNi34Yq1J2g3S4a5k6y7z8',
  'errors.rs': 'QmTz991tW9bga7t3N3h7f7H3WwXbU2yM5n3K4a5b6c7d8e'
};

const GATEWAYS = [
  { name: 'ipfs.io', url: 'https://ipfs.io/ipfs/' },
  { name: 'cloudflare-ipfs.com', url: 'https://cloudflare-ipfs.com/ipfs/' },
  { name: 'pinata.cloud', url: 'https://gateway.pinata.cloud/ipfs/' }
];

import { validateIpfsHash } from '../../utils/ipfs';
export { validateIpfsHash };

export default function Docs({ initialSelectedModule }: DocsProps) {
  const [activeModule, setActiveModule] = useState<string>('lib.rs');
  const [moduleHashes, setModuleHashes] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem('vero:module-hashes');
    return saved ? JSON.parse(saved) : DEFAULT_DOCS;
  });

  const [customHash, setCustomHash] = useState<string>('');
  const [selectedGateway, setSelectedGateway] = useState<string>(GATEWAYS[0].url);
  const [docContent, setDocContent] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState<boolean>(false);

  // Editing state for mapping CIDs
  const [editingModule, setEditingModule] = useState<string | null>(null);
  const [editingHashValue, setEditingHashValue] = useState<string>('');

  // Sync with initialSelectedModule prop if set by visualizer selection
  useEffect(() => {
    if (initialSelectedModule) {
      const matchedFile = Object.keys(moduleHashes).find(
        (key) => key.startsWith(initialSelectedModule) || initialSelectedModule.startsWith(key.split('.')[0])
      );
      if (matchedFile) {
        setActiveModule(matchedFile);
        setCustomHash(moduleHashes[matchedFile]);
      }
    }
  }, [initialSelectedModule]);

  // Set hash input when changing modules
  useEffect(() => {
    if (moduleHashes[activeModule]) {
      setCustomHash(moduleHashes[activeModule]);
    }
  }, [activeModule, moduleHashes]);

  // Validate CID hash
  const isValidCid = useMemo(() => {
    return validateIpfsHash(customHash.trim());
  }, [customHash]);

  // Fetch from IPFS or Cache
  const fetchDoc = async (cidToFetch: string) => {
    const cleanCid = cidToFetch.trim();
    if (!validateIpfsHash(cleanCid)) {
      setError('Invalid IPFS Content Identifier (CID)');
      return;
    }

    setLoading(true);
    setError(null);
    setDocContent('');

    // 1. Check local cache (localStorage)
    const cached = localStorage.getItem(`ipfs-cache:${cleanCid}`);
    if (cached) {
      setDocContent(cached);
      setFromCache(true);
      setLoading(false);
      return;
    }

    // 2. Fetch from gateway
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

      const res = await fetch(`${selectedGateway}${cleanCid}`, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!res.ok) throw new Error(`Gateway returned status ${res.status}`);
      
      const text = await res.text();
      
      // Cache the result
      try {
        localStorage.setItem(`ipfs-cache:${cleanCid}`, text);
      } catch (cacheErr) {
        console.warn('LocalStorage caching failed:', cacheErr);
      }

      setDocContent(text);
      setFromCache(false);
    } catch (err: any) {
      setError(err.name === 'AbortError' ? 'Request timed out' : err.message);
    } finally {
      setLoading(false);
    }
  };

  // Trigger initial fetch when target CID changes
  useEffect(() => {
    if (customHash && isValidCid) {
      fetchDoc(customHash);
    }
  }, [activeModule, selectedGateway, customHash, isValidCid]);

  // Custom CID submission handler
  const handleFetchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isValidCid) {
      fetchDoc(customHash);
    }
  };

  // Associate new hash with a contract module
  const handleSaveHash = (moduleName: string) => {
    if (!validateIpfsHash(editingHashValue)) {
      alert('Cannot save: Invalid IPFS CID format');
      return;
    }

    const updated = {
      ...moduleHashes,
      [moduleName]: editingHashValue.trim()
    };
    setModuleHashes(updated);
    localStorage.setItem('vero:module-hashes', JSON.stringify(updated));
    setEditingModule(null);

    // If we updated the active module, trigger a fetch
    if (moduleName === activeModule) {
      setCustomHash(editingHashValue);
      fetchDoc(editingHashValue);
    }
  };

  // HTML detector
  const isHtml = useMemo(() => {
    const trimmed = docContent.trim().toLowerCase();
    return trimmed.startsWith('<html') || trimmed.startsWith('<!doctype html');
  }, [docContent]);

  // Parse Markdown to HTML
  const parsedHtml = useMemo(() => {
    if (!docContent || isHtml) return '';
    try {
      const parsed = marked.parse(docContent);
      return typeof parsed === 'string' ? parsed : docContent;
    } catch (e) {
      return docContent;
    }
  }, [docContent, isHtml]);

  return (
    <div className="docs-container">
      {/* Sidebar: Contracts & IPFS Mapping */}
      <aside className="docs-sidebar glass-panel">
        <div className="sidebar-section">
          <h3>Contract Modules</h3>
          <ul className="docs-menu">
            {Object.keys(moduleHashes).map((fileName) => {
              const isActive = activeModule === fileName;
              const isEditing = editingModule === fileName;
              
              return (
                <li
                  key={fileName}
                  className={`docs-menu-item ${isActive ? 'active' : ''}`}
                  onClick={() => !isEditing && setActiveModule(fileName)}
                >
                  <div className="docs-item-title">{fileName}</div>
                  
                  {isEditing ? (
                    <div className="hash-edit-form" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="text"
                        value={editingHashValue}
                        onChange={(e) => setEditingHashValue(e.target.value)}
                        placeholder="Paste IPFS CID..."
                      />
                      <div className="hash-edit-actions">
                        <button
                          className="btn-small btn-small-primary"
                          onClick={() => handleSaveHash(fileName)}
                        >
                          Save
                        </button>
                        <button
                          className="btn-small"
                          onClick={() => setEditingModule(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="docs-item-hash">{moduleHashes[fileName]}</div>
                      <button
                        className="edit-hash-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingModule(fileName);
                          setEditingHashValue(moduleHashes[fileName]);
                        }}
                      >
                        Change CID
                      </button>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </aside>

      {/* Main doc viewer */}
      <main className="docs-content">
        <div className="docs-content-header">
          <form onSubmit={handleFetchSubmit} className="docs-search-bar">
            <Globe size={18} className="search-icon" />
            <input
              type="text"
              placeholder="Enter IPFS CID (Qm... or b...)"
              value={customHash}
              onChange={(e) => setCustomHash(e.target.value)}
              className="cid-input"
              style={{
                fontFamily: 'Courier New',
                flex: 1,
                padding: '10px 12px',
                backgroundColor: 'rgba(0, 0, 0, 0.2)',
                border: '1px solid var(--panel-border)',
                borderRadius: '8px',
                color: '#fff'
              }}
            />
            <select
              value={selectedGateway}
              onChange={(e) => setSelectedGateway(e.target.value)}
              className="gateway-selector"
            >
              {GATEWAYS.map((g) => (
                <option key={g.name} value={g.url}>
                  {g.name}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={loading || !isValidCid}
              className="btn-fetch"
            >
              {loading ? <RefreshCw size={18} className="spin-icon" /> : <FileText size={18} />}
              <span>Fetch</span>
            </button>
          </form>

          {/* Badges for caching and CID validity */}
          <div className="hash-status-badges">
            {customHash && (
              <span className={`status-badge ${isValidCid ? 'badge-success' : 'badge-warning'}`}>
                {isValidCid ? <CheckCircle size={12} /> : <AlertTriangle size={12} />}
                {isValidCid ? 'Valid CID Format' : 'Invalid CID Format'}
              </span>
            )}
            {fromCache && docContent && (
              <span className="status-badge badge-info">
                <Database size={12} />
                Cached Locally (Instant)
              </span>
            )}
          </div>
        </div>

        {/* Content Renderer */}
        <div className="docs-body">
          {loading && (
            <div className="status-message loading-state" style={{ marginTop: 100 }}>
              <RefreshCw size={36} className="spin-icon" />
              <p>Fetching document from IPFS gateway...</p>
            </div>
          )}

          {error && (
            <div className="status-message error-state" style={{ marginTop: 100 }}>
              <AlertTriangle size={36} />
              <p>Gateway Error: {error}</p>
              <button onClick={() => fetchDoc(customHash)} className="btn-action" style={{ marginTop: 16 }}>
                Retry Request
              </button>
            </div>
          )}

          {!loading && !error && docContent && (
            isHtml ? (
              <iframe
                sandbox="allow-scripts"
                srcDoc={docContent}
                className="iframe-renderer"
                title="IPFS HTML Doc"
              />
            ) : (
              <div
                className="markdown-renderer"
                dangerouslySetInnerHTML={{ __html: parsedHtml }}
              />
            )
          )}

          {!loading && !error && !docContent && (
            <div className="no-selection" style={{ height: '80%' }}>
              <FileText size={48} />
              <p>Provide a valid IPFS CID or choose a contract file on the left to display audit docs.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
