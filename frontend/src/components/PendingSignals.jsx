import React, { useState, useEffect } from 'react';
import { LuCheck, LuX, LuZap } from 'react-icons/lu';
import projectService from '../services/projectService';

export default function PendingSignals({ projectId, onRefreshDashboard }) {
  const [signals, setSignals] = useState([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchSignals();
    
    let inactivityTimer;
    const resetTimer = () => {
      clearTimeout(inactivityTimer);
      inactivityTimer = setTimeout(() => {
        fetchSignals();
      }, 15000); // 15s of inactivity triggers a fetch
    };

    window.addEventListener('mousemove', resetTimer);
    window.addEventListener('keydown', resetTimer);
    window.addEventListener('click', resetTimer);

    // Initial timer start
    resetTimer();

    return () => {
      clearTimeout(inactivityTimer);
      window.removeEventListener('mousemove', resetTimer);
      window.removeEventListener('keydown', resetTimer);
      window.removeEventListener('click', resetTimer);
    };
  }, [projectId]);

  useEffect(() => {
    if (isExpanded) {
      fetchSignals();
    }
  }, [isExpanded]);

  const fetchSignals = async () => {
    try {
      const pending = await projectService.getPendingSignals(projectId);
      setSignals(pending || []);
    } catch (err) {
      console.error('Failed to fetch pending signals', err);
    }
  };

  const handleConfirm = async (e, signalId) => {
    e.stopPropagation();
    try {
      setLoading(true);
      await projectService.confirmSignal(projectId, signalId);
      await fetchSignals();
      onRefreshDashboard();
    } catch (err) {
      console.error('Failed to confirm signal', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = async (e, signalId) => {
    e.stopPropagation();
    try {
      setLoading(true);
      await projectService.dismissSignal(projectId, signalId);
      await fetchSignals();
    } catch (err) {
      console.error('Failed to dismiss signal', err);
    } finally {
      setLoading(false);
    }
  };

  if (!signals || signals.length === 0) return null;

  return (
    <div className="bg-indigo-900/40 border border-indigo-500/30 rounded-xl mb-6 overflow-hidden transition-all duration-300">
      <div 
        className="px-5 py-4 flex items-center justify-between cursor-pointer hover:bg-indigo-800/30"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center space-x-3 text-indigo-200">
          <LuZap className="h-5 w-5 text-indigo-400" />
          <span className="font-medium">
            {signals.length} unreviewed signal{signals.length !== 1 ? 's' : ''} detected in your conversation.
          </span>
        </div>
        <div className="flex items-center space-x-4">
          <span className="text-sm font-medium text-indigo-300 bg-indigo-900/60 px-3 py-1 rounded-full border border-indigo-500/20">
            Review now &rarr;
          </span>
        </div>
      </div>

      {isExpanded && (
        <div className="px-5 pb-5 border-t border-indigo-500/20 pt-4 bg-indigo-900/20">
          <div className="space-y-3">
            {signals.map(signal => (
              <div key={signal._id} className="bg-slate-800/50 rounded-lg p-4 flex items-center justify-between border border-slate-700/50">
                <div className="flex-1 mr-4">
                  <div className="flex items-center space-x-2 text-xs mb-1">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      signal.type === 'decision' ? 'bg-emerald-500/10 text-emerald-400' :
                      signal.type === 'blocker' ? 'bg-red-500/10 text-red-400' :
                      'bg-blue-500/10 text-blue-400'
                    }`}>
                      {signal.type}
                    </span>
                    <span className="text-slate-400 font-medium">via {signal.proposedBy?.username || 'user'}</span>
                  </div>
                  <p className="text-slate-200 text-sm italic truncate max-w-2xl px-1 border-l-2 border-slate-600 ml-1">
                    "{signal.rawText?.length > 100 ? signal.rawText.substring(0, 100) + '...' : signal.rawText}"
                  </p>
                </div>
                
                <div className="flex items-center space-x-2 shrink-0">
                  <button 
                    onClick={(e) => handleDismiss(e, signal._id)}
                    disabled={loading}
                    className="p-2 rounded-lg bg-slate-700/50 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                  >
                    <LuX className="h-4 w-4" />
                  </button>
                  <button 
                    onClick={(e) => handleConfirm(e, signal._id)}
                    disabled={loading}
                    className="flex items-center space-x-1 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors font-medium text-sm"
                  >
                    <LuCheck className="h-4 w-4" />
                    <span>Confirm</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
