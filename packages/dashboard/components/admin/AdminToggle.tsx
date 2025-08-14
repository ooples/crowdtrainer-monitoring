'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, Eye, EyeOff, ChevronUp, ChevronDown } from 'lucide-react';
import { useAdminMode } from './AdminModeProvider';

export function AdminToggle() {
  const { isAdminMode, toggleAdminMode, isPanelVisible, setPanelVisible } = useAdminMode();

  if (!isAdminMode) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      className="fixed bottom-6 right-6 z-50 flex flex-col gap-2"
    >
      {/* Admin Mode Indicator */}
      <motion.div
        className="relative"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <motion.button
          onClick={() => setPanelVisible(!isPanelVisible)}
          className="group relative p-4 bg-gradient-to-br from-amber-500 to-orange-500 rounded-full shadow-2xl shadow-amber-500/25 hover:shadow-amber-500/40 transition-all duration-300"
          whileHover={{ y: -2 }}
        >
          <motion.div
            animate={{ rotate: isPanelVisible ? 180 : 0 }}
            transition={{ duration: 0.3 }}
          >
            {isPanelVisible ? (
              <ChevronDown className="w-6 h-6 text-white" />
            ) : (
              <ChevronUp className="w-6 h-6 text-white" />
            )}
          </motion.div>

          {/* Pulsing ring animation */}
          <motion.div
            className="absolute inset-0 rounded-full border-2 border-amber-400"
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.6, 0, 0.6],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />

          {/* Admin mode badge */}
          <motion.div
            className="absolute -top-2 -right-2 w-5 h-5 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center"
            animate={{
              boxShadow: [
                "0 0 0 0 rgba(34, 197, 94, 0.7)",
                "0 0 20px 4px rgba(34, 197, 94, 0)",
                "0 0 0 0 rgba(34, 197, 94, 0)"
              ]
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
            }}
          >
            <Settings className="w-3 h-3 text-white" />
          </motion.div>
        </motion.button>

        {/* Tooltip */}
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            className="absolute right-full mr-3 top-1/2 -translate-y-1/2 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          >
            <div className="px-3 py-2 bg-gray-900/90 backdrop-blur-sm border border-gray-700 rounded-lg text-sm text-white shadow-xl">
              {isPanelVisible ? 'Hide Admin Panel' : 'Show Admin Panel'}
              <div className="absolute left-full top-1/2 -translate-y-1/2 border-4 border-transparent border-l-gray-900/90" />
            </div>
          </motion.div>
        </AnimatePresence>
      </motion.div>

      {/* Toggle Admin Mode Button */}
      <motion.button
        onClick={toggleAdminMode}
        className="group relative p-3 bg-gradient-to-br from-red-500 to-rose-500 rounded-full shadow-2xl shadow-red-500/25 hover:shadow-red-500/40 transition-all duration-300"
        whileHover={{ scale: 1.05, y: -2 }}
        whileTap={{ scale: 0.95 }}
        title="Exit Admin Mode (Ctrl+Shift+A)"
      >
        <EyeOff className="w-5 h-5 text-white" />

        {/* Tooltip */}
        <motion.div
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 10 }}
          className="absolute right-full mr-3 top-1/2 -translate-y-1/2 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        >
          <div className="px-3 py-2 bg-gray-900/90 backdrop-blur-sm border border-gray-700 rounded-lg text-sm text-white shadow-xl">
            Exit Admin Mode
            <div className="text-xs text-gray-400 mt-1">Ctrl+Shift+A</div>
            <div className="absolute left-full top-1/2 -translate-y-1/2 border-4 border-transparent border-l-gray-900/90" />
          </div>
        </motion.div>
      </motion.button>

      {/* Keyboard shortcut hint */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="text-xs text-gray-400 text-center bg-gray-900/70 backdrop-blur-sm rounded-lg px-2 py-1 border border-gray-700"
      >
        Ctrl+Shift+A
      </motion.div>
    </motion.div>
  );
}