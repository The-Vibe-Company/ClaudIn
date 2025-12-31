import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface SetupWizardProps {
  onComplete: () => void;
}

export function SetupWizard({ onComplete }: SetupWizardProps) {
  const [step, setStep] = useState(1);
  const [extensionPath, setExtensionPath] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    extractExtension();
  }, []);

  async function extractExtension() {
    setIsExtracting(true);
    setError(null);
    try {
      const path = await invoke<string>('extract_extension');
      setExtensionPath(path);
    } catch (e) {
      setError(String(e));
    } finally {
      setIsExtracting(false);
    }
  }

  async function openChromeExtensions() {
    try {
      await invoke('open_chrome_extensions');
    } catch (e) {
      console.error('Failed to open Chrome:', e);
    }
  }

  async function openExtensionFolder() {
    try {
      await invoke('open_extension_folder');
    } catch (e) {
      console.error('Failed to open folder:', e);
    }
  }

  async function completeSetup() {
    try {
      await invoke('mark_setup_complete');
      onComplete();
    } catch (e) {
      console.error('Failed to mark setup complete:', e);
      onComplete();
    }
  }

  return (
    <div className="fixed inset-0 bg-bg-primary flex items-center justify-center p-8">
      <div className="max-w-2xl w-full">
        <div className="text-center mb-12">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl font-bold text-white">C</span>
          </div>
          <h1 className="text-3xl font-bold text-text-primary mb-2">Welcome to ClaudIn</h1>
          <p className="text-text-secondary">Let's set up the Chrome extension to sync your LinkedIn data</p>
        </div>

        <div className="bg-bg-secondary rounded-xl p-8 border border-border-subtle">
          {step === 1 && (
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-blue-400 font-semibold">1</span>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-text-primary mb-1">Extension Ready</h3>
                  {isExtracting ? (
                    <p className="text-text-secondary">Extracting extension files...</p>
                  ) : error ? (
                    <p className="text-red-400">{error}</p>
                  ) : (
                    <p className="text-text-secondary">
                      Extension files are ready at:<br />
                      <code className="text-xs bg-bg-tertiary px-2 py-1 rounded mt-1 inline-block">
                        {extensionPath}
                      </code>
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-4 opacity-50">
                <div className="w-10 h-10 rounded-full bg-bg-tertiary flex items-center justify-center flex-shrink-0">
                  <span className="text-text-secondary font-semibold">2</span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-text-primary mb-1">Load in Chrome</h3>
                  <p className="text-text-secondary">Open Chrome extensions and load the extension</p>
                </div>
              </div>

              <div className="flex items-start gap-4 opacity-50">
                <div className="w-10 h-10 rounded-full bg-bg-tertiary flex items-center justify-center flex-shrink-0">
                  <span className="text-text-secondary font-semibold">3</span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-text-primary mb-1">Browse LinkedIn</h3>
                  <p className="text-text-secondary">Your network data will sync automatically</p>
                </div>
              </div>

              <button
                onClick={() => setStep(2)}
                disabled={isExtracting || !!error}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
              >
                Continue
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-text-primary mb-1">Extension Ready</h3>
                  <p className="text-text-secondary text-sm">Files extracted successfully</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-blue-400 font-semibold">2</span>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-text-primary mb-2">Load in Chrome</h3>
                  <ol className="text-text-secondary text-sm space-y-2 list-decimal list-inside mb-4">
                    <li>Click the buttons below to open Chrome and the extension folder</li>
                    <li>In Chrome, enable <strong className="text-text-primary">Developer mode</strong> (top right)</li>
                    <li>Click <strong className="text-text-primary">Load unpacked</strong></li>
                    <li>Select the extension folder that just opened</li>
                  </ol>
                  <div className="flex gap-3">
                    <button
                      onClick={openChromeExtensions}
                      className="flex-1 py-2 px-4 bg-bg-tertiary hover:bg-border-subtle text-text-primary font-medium rounded-lg transition-colors"
                    >
                      Open Chrome Extensions
                    </button>
                    <button
                      onClick={openExtensionFolder}
                      className="flex-1 py-2 px-4 bg-bg-tertiary hover:bg-border-subtle text-text-primary font-medium rounded-lg transition-colors"
                    >
                      Open Extension Folder
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-4 opacity-50">
                <div className="w-10 h-10 rounded-full bg-bg-tertiary flex items-center justify-center flex-shrink-0">
                  <span className="text-text-secondary font-semibold">3</span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-text-primary mb-1">Browse LinkedIn</h3>
                  <p className="text-text-secondary">Your network data will sync automatically</p>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(1)}
                  className="py-3 px-6 bg-bg-tertiary hover:bg-border-subtle text-text-primary font-medium rounded-lg transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={() => setStep(3)}
                  className="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
                >
                  I've loaded the extension
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-text-primary">Extension Ready</h3>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-text-primary">Loaded in Chrome</h3>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-blue-400 font-semibold">3</span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-text-primary mb-2">You're all set!</h3>
                  <p className="text-text-secondary text-sm">
                    Now just browse LinkedIn as usual. The extension will automatically sync:
                  </p>
                  <ul className="text-text-secondary text-sm mt-2 space-y-1">
                    <li>• Profile pages you visit</li>
                    <li>• Search results</li>
                    <li>• Feed posts (links, videos, documents)</li>
                    <li>• Messages</li>
                  </ul>
                </div>
              </div>

              <button
                onClick={completeSetup}
                className="w-full py-3 px-4 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors"
              >
                Start Using ClaudIn
              </button>
            </div>
          )}
        </div>

        <p className="text-center text-text-tertiary text-sm mt-6">
          You can reinstall the extension anytime from Settings
        </p>
      </div>
    </div>
  );
}
