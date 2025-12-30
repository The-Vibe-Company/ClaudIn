import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Eye, EyeOff, Key, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { useAppStore } from '../store/app';
import { fetchSettingsStatus, updateSettings } from '../lib/api';

export function SettingsModal() {
  const { isSettingsOpen, setSettingsOpen } = useAppStore();
  const [apiKey, setApiKey] = useState('');
  const [isVisible, setIsVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [isConfigured, setIsConfigured] = useState(false);

  // Reset state when opening
  useEffect(() => {
    if (isSettingsOpen) {
      setApiKey('');
      setStatus('idle');
      setMessage('');
      checkStatus();
    }
  }, [isSettingsOpen]);

  const checkStatus = async () => {
    try {
      const { hasApiKey } = await fetchSettingsStatus();
      setIsConfigured(hasApiKey);
    } catch (error) {
      console.error('Failed to check settings status:', error);
    }
  };

  const handleClose = () => {
    setSettingsOpen(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim()) return;

    setIsLoading(true);
    setStatus('idle');
    setMessage('');

    try {
      await updateSettings({ openrouter_api_key: apiKey });
      setStatus('success');
      setMessage('Settings saved successfully');
      setIsConfigured(true);
      setApiKey(''); // Clear sensitive data
      
      // Auto close after success
      setTimeout(() => {
        handleClose();
      }, 1500);
    } catch (error) {
      setStatus('error');
      setMessage('Failed to save settings');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isSettingsOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={handleClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", duration: 0.5, bounce: 0.3 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md z-50"
          >
            <div className="bg-bg-secondary border border-border-subtle rounded-xl shadow-2xl overflow-hidden">
              
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle bg-bg-tertiary/30">
                <h2 className="text-lg font-semibold text-text-primary">Settings</h2>
                <button
                  onClick={handleClose}
                  className="p-1 rounded-md text-text-muted hover:text-text-primary hover:bg-bg-tertiary transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <form onSubmit={handleSave} className="p-6 space-y-6">
                
                {/* Status Indicator */}
                <div className={`flex items-center gap-3 p-3 rounded-lg border ${
                  isConfigured 
                    ? 'bg-green-500/10 border-green-500/20 text-green-500' 
                    : 'bg-yellow-500/10 border-yellow-500/20 text-yellow-500'
                }`}>
                  {isConfigured ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : (
                    <AlertCircle className="w-5 h-5" />
                  )}
                  <span className="text-sm font-medium">
                    {isConfigured ? 'OpenRouter API is configured' : 'OpenRouter API key missing'}
                  </span>
                </div>

                {/* API Key Input */}
                <div className="space-y-2">
                  <label htmlFor="apiKey" className="block text-sm font-medium text-text-secondary">
                    OpenRouter API Key
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Key className="h-4 w-4 text-text-muted group-focus-within:text-accent-primary transition-colors" />
                    </div>
                    <input
                      id="apiKey"
                      type={isVisible ? 'text' : 'password'}
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder={isConfigured ? '••••••••••••••••••••••••' : 'sk-or-...'}
                      className="block w-full pl-10 pr-10 py-2.5 bg-bg-primary border border-border-default rounded-lg 
                               text-text-primary placeholder:text-text-muted/50 focus:ring-2 focus:ring-accent-primary/50 
                               focus:border-accent-primary transition-all text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setIsVisible(!isVisible)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-text-muted hover:text-text-primary transition-colors"
                    >
                      {isVisible ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-text-muted">
                    Your key is stored locally and never shared with anyone else.
                  </p>
                </div>

                {/* Feedback Message */}
                <AnimatePresence mode='wait'>
                  {status !== 'idle' && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className={`text-sm flex items-center gap-2 ${
                        status === 'success' ? 'text-green-500' : 'text-red-500'
                      }`}
                    >
                      {status === 'success' ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : (
                        <AlertCircle className="w-4 h-4" />
                      )}
                      {message}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Footer Actions */}
                <div className="pt-2 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary 
                             bg-transparent hover:bg-bg-tertiary rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading || !apiKey.trim()}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white 
                             bg-accent-primary hover:bg-accent-secondary rounded-lg shadow-lg 
                             shadow-accent-primary/20 disabled:opacity-50 disabled:cursor-not-allowed 
                             transform active:scale-95 transition-all"
                  >
                    {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                    {isLoading ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
