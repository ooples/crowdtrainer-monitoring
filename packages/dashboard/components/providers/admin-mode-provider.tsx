'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Lock, Unlock, Settings, X } from 'lucide-react';

interface AdminModeContextType {
  isAdminMode: boolean;
  toggleAdminMode: () => void;
  adminPassword: string | null;
  promptForPassword: () => Promise<boolean>;
  isAuthenticated: boolean;
}

const AdminModeContext = createContext<AdminModeContextType | undefined>(undefined);

export function useAdminMode() {
  const context = useContext(AdminModeContext);
  if (context === undefined) {
    throw new Error('useAdminMode must be used within an AdminModeProvider');
  }
  return context;
}

interface AdminModeProviderProps {
  children: ReactNode;
  adminPassword?: string;
}

export function AdminModeProvider({ children, adminPassword = 'admin123' }: AdminModeProviderProps) {
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');

  const promptForPassword = useCallback((): Promise<boolean> => {
    return new Promise((resolve) => {
      setShowPasswordPrompt(true);
      
      const handleSubmit = (password: string) => {
        if (password === adminPassword) {
          setIsAuthenticated(true);
          setIsAdminMode(true);
          setShowPasswordPrompt(false);
          setPasswordInput('');
          resolve(true);
        } else {
          setPasswordInput('');
          // Show error briefly
          setTimeout(() => {
            setShowPasswordPrompt(false);
            resolve(false);
          }, 1000);
        }
      };

      // Store the resolve function to call from the modal
      (window as any).__adminPasswordResolve = handleSubmit;
    });
  }, [adminPassword]);

  const toggleAdminMode = useCallback(async () => {
    if (isAdminMode) {
      setIsAdminMode(false);
      setIsAuthenticated(false);
    } else {
      const success = await promptForPassword();
      if (success) {
        setIsAdminMode(true);
        setIsAuthenticated(true);
      }
    }
  }, [isAdminMode, promptForPassword]);

  const handlePasswordSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if ((window as any).__adminPasswordResolve) {
      (window as any).__adminPasswordResolve(passwordInput);
    }
  }, [passwordInput]);

  const value: AdminModeContextType = {
    isAdminMode,
    toggleAdminMode,
    adminPassword,
    promptForPassword,
    isAuthenticated,
  };

  return (
    <AdminModeContext.Provider value={value}>
      {children}
      
      {/* Admin Mode Overlay */}
      <AnimatePresence>
        {isAdminMode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 pointer-events-none z-40"
          >
            {/* Border glow effect */}
            <div className="absolute inset-0 border-4 border-red-500/50 shadow-[inset_0_0_50px_rgba(239,68,68,0.3)] pointer-events-none" />
            
            {/* Admin badge */}
            <motion.div
              initial={{ scale: 0, rotate: -45 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0, rotate: 45 }}
              className="absolute top-4 right-4 pointer-events-auto"
            >
              <div className="flex items-center gap-2 px-4 py-2 bg-red-500/90 backdrop-blur-sm border border-red-400 rounded-lg text-white font-medium shadow-lg">
                <Shield className="w-4 h-4" />
                <span>ADMIN MODE</span>
                <button
                  onClick={toggleAdminMode}
                  className="ml-2 p-1 hover:bg-red-400/50 rounded"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Password Prompt Modal */}
      <AnimatePresence>
        {showPasswordPrompt && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-gray-900 border border-gray-700 rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-red-500/20 rounded-lg">
                  <Lock className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Admin Access Required</h3>
                  <p className="text-gray-400 text-sm">Enter the admin password to continue</p>
                </div>
              </div>

              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                <div>
                  <input
                    type="password"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="Enter admin password"
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-red-400"
                    autoFocus
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors"
                  >
                    <div className="flex items-center justify-center gap-2">
                      <Unlock className="w-4 h-4" />
                      Unlock
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowPasswordPrompt(false);
                      setPasswordInput('');
                      if ((window as any).__adminPasswordResolve) {
                        (window as any).__adminPasswordResolve('');
                      }
                    }}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AdminModeContext.Provider>
  );
}