'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Keyboard, Command } from 'lucide-react';
import { useMode } from '../providers/mode-provider';
import { KeyboardShortcut } from '../../hooks/use-keyboard-shortcuts';

interface ShortcutHelperProps {
  shortcuts: KeyboardShortcut[];
}

export function ShortcutHelper({ shortcuts }: ShortcutHelperProps) {
  const [isVisible, setIsVisible] = useState(false);
  const { mode } = useMode();

  useEffect(() => {
    const handleShowShortcuts = () => setIsVisible(true);
    document.addEventListener('show-shortcuts', handleShowShortcuts);
    return () => document.removeEventListener('show-shortcuts', handleShowShortcuts);
  }, []);

  // Filter shortcuts based on current mode
  const availableShortcuts = shortcuts.filter(shortcut => 
    !shortcut.mode || shortcut.mode === mode
  );

  const formatShortcut = (shortcut: KeyboardShortcut) => {
    const keys = [];
    
    if (shortcut.ctrlKey) keys.push('Ctrl');
    if (shortcut.metaKey) keys.push('Cmd');
    if (shortcut.shiftKey) keys.push('Shift');
    if (shortcut.altKey) keys.push('Alt');
    
    keys.push(shortcut.key.toUpperCase());
    
    return keys;
  };

  const groupedShortcuts = availableShortcuts.reduce((groups, shortcut) => {
    // Determine category based on action
    let category = 'Other';
    
    if (shortcut.description.includes('mode') || shortcut.description.includes('Mode')) {
      category = 'Mode Control';
    } else if (shortcut.description.includes('Admin')) {
      category = 'Admin';
    } else if (shortcut.description.includes('Refresh') || shortcut.description.includes('Export')) {
      category = 'Actions';
    } else if (shortcut.description.includes('search') || shortcut.description.includes('Focus')) {
      category = 'Navigation';
    } else if (shortcut.description.includes('Help') || shortcut.description.includes('shortcuts')) {
      category = 'Help';
    }
    
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(shortcut);
    
    return groups;
  }, {} as Record<string, KeyboardShortcut[]>);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={() => setIsVisible(false)}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-gray-900 border border-gray-700 rounded-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-700">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/20 rounded-lg">
                  <Keyboard className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-white">Keyboard Shortcuts</h2>
                  <p className="text-gray-400 text-sm">Available in {mode} mode</p>
                </div>
              </div>
              
              <button
                onClick={() => setIsVisible(false)}
                className="p-2 hover:bg-gray-700 rounded-lg text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {Object.entries(groupedShortcuts).map(([category, categoryShortcuts]) => (
                <div key={category} className="mb-6 last:mb-0">
                  <h3 className="text-lg font-medium text-white mb-3 flex items-center gap-2">
                    {category === 'Mode Control' && <Command className="w-4 h-4 text-blue-400" />}
                    {category}
                  </h3>
                  
                  <div className="space-y-2">
                    {categoryShortcuts.map((shortcut, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg hover:bg-gray-800 transition-colors"
                      >
                        <span className="text-gray-300">{shortcut.description}</span>
                        
                        <div className="flex items-center gap-1">
                          {formatShortcut(shortcut).map((key, keyIndex) => (
                            <React.Fragment key={keyIndex}>
                              {keyIndex > 0 && (
                                <span className="text-gray-500 mx-1">+</span>
                              )}
                              <kbd className="px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs font-mono text-gray-300 shadow-sm">
                                {key}
                              </kbd>
                            </React.Fragment>
                          ))}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              ))}

              {availableShortcuts.length === 0 && (
                <div className="text-center py-8">
                  <Keyboard className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-400">No shortcuts available in {mode} mode</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-700 bg-gray-800/30">
              <div className="flex items-center justify-center text-sm text-gray-400">
                <span>Press</span>
                <kbd className="mx-2 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs font-mono">
                  ?
                </kbd>
                <span>anytime to show this dialog</span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}