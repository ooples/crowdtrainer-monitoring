'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Key, 
  Eye, 
  EyeOff, 
  Copy, 
  Check, 
  Plus, 
  Trash2, 
  Settings, 
  AlertTriangle,
  Shield
} from 'lucide-react';
import { GlassCard } from '@/components/ui/glass-card';
import { cn } from '@/lib/utils';

interface ApiKey {
  id: string;
  name: string;
  key: string;
  permissions: string[];
  createdAt: string;
  lastUsed?: string;
  expiresAt?: string;
  isActive: boolean;
}

interface ApiKeyManagerProps {
  apiKeys: ApiKey[];
  onCreateKey: (name: string, permissions: string[]) => Promise<ApiKey>;
  onUpdateKey: (id: string, updates: Partial<ApiKey>) => Promise<void>;
  onDeleteKey: (id: string) => Promise<void>;
  onTestConnection: (key: string) => Promise<boolean>;
  className?: string;
}

const permissions = [
  { id: 'read:metrics', label: 'Read Metrics', description: 'Access system metrics and performance data' },
  { id: 'read:events', label: 'Read Events', description: 'Access event logs and activity data' },
  { id: 'read:alerts', label: 'Read Alerts', description: 'Access alert information' },
  { id: 'write:alerts', label: 'Manage Alerts', description: 'Create, update, and acknowledge alerts' },
  { id: 'admin', label: 'Full Admin Access', description: 'Complete access to all dashboard features' }
];

export function ApiKeyManager({
  apiKeys,
  onCreateKey,
  onUpdateKey,
  onDeleteKey,
  onTestConnection,
  className = ""
}: ApiKeyManagerProps) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [testingKeys, setTestingKeys] = useState<Set<string>>(new Set());

  const toggleKeyVisibility = (keyId: string) => {
    setVisibleKeys(prev => {
      const newSet = new Set(prev);
      if (newSet.has(keyId)) {
        newSet.delete(keyId);
      } else {
        newSet.add(keyId);
      }
      return newSet;
    });
  };

  const copyToClipboard = async (text: string, keyId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(keyId);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  const testApiKey = async (keyId: string, key: string) => {
    setTestingKeys(prev => new Set(prev).add(keyId));
    try {
      const isValid = await onTestConnection(key);
      // Show test result visually
      console.log(`API key ${keyId} test result:`, isValid);
    } catch (error) {
      console.error('API key test failed:', error);
    } finally {
      setTestingKeys(prev => {
        const newSet = new Set(prev);
        newSet.delete(keyId);
        return newSet;
      });
    }
  };

  const maskKey = (key: string) => {
    if (key.length <= 8) return key;
    return key.slice(0, 4) + '•'.repeat(Math.max(0, key.length - 8)) + key.slice(-4);
  };

  return (
    <div className={className}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Key className="w-6 h-6 text-blue-400" />
            <h2 className="text-2xl font-semibold text-white">API Keys</h2>
            <div className="px-3 py-1 bg-blue-500/20 border border-blue-500/40 rounded-full text-blue-300 text-sm font-medium">
              {apiKeys.length}
            </div>
          </div>
          
          <motion.button
            onClick={() => setShowCreateForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg font-medium shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all duration-300"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Plus className="w-4 h-4" />
            Create New Key
          </motion.button>
        </div>

        {/* API Keys List */}
        <div className="space-y-4">
          {apiKeys.length === 0 ? (
            <GlassCard className="p-8 text-center">
              <Shield className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">No API Keys</h3>
              <p className="text-gray-400 mb-4">Create your first API key to start accessing the monitoring dashboard</p>
              <button
                onClick={() => setShowCreateForm(true)}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                Create API Key
              </button>
            </GlassCard>
          ) : (
            apiKeys.map((apiKey, index) => (
              <ApiKeyCard
                key={apiKey.id}
                apiKey={apiKey}
                index={index}
                isVisible={visibleKeys.has(apiKey.id)}
                isCopied={copiedKey === apiKey.id}
                isTesting={testingKeys.has(apiKey.id)}
                onToggleVisibility={() => toggleKeyVisibility(apiKey.id)}
                onCopy={() => copyToClipboard(apiKey.key, apiKey.id)}
                onTest={() => testApiKey(apiKey.id, apiKey.key)}
                onUpdate={(updates) => onUpdateKey(apiKey.id, updates)}
                onDelete={() => onDeleteKey(apiKey.id)}
                maskKey={maskKey}
              />
            ))
          )}
        </div>

        {/* Create Form Modal */}
        <AnimatePresence>
          {showCreateForm && (
            <CreateApiKeyModal
              onClose={() => setShowCreateForm(false)}
              onCreate={onCreateKey}
              permissions={permissions}
            />
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

interface ApiKeyCardProps {
  apiKey: ApiKey;
  index: number;
  isVisible: boolean;
  isCopied: boolean;
  isTesting: boolean;
  onToggleVisibility: () => void;
  onCopy: () => void;
  onTest: () => void;
  onUpdate: (updates: Partial<ApiKey>) => void;
  onDelete: () => void;
  maskKey: (key: string) => string;
}

function ApiKeyCard({
  apiKey,
  index,
  isVisible,
  isCopied,
  isTesting,
  onToggleVisibility,
  onCopy,
  onTest,
  onUpdate,
  onDelete,
  maskKey
}: ApiKeyCardProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const isExpired = apiKey.expiresAt && new Date(apiKey.expiresAt) < new Date();
  const isExpiringSoon = apiKey.expiresAt && 
    new Date(apiKey.expiresAt).getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000; // 7 days

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
    >
      <GlassCard className="p-6">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn(
                "p-2 rounded-lg",
                apiKey.isActive ? "bg-green-500/20 border border-green-500/40" : "bg-gray-500/20 border border-gray-500/40"
              )}>
                <Key className={cn("w-4 h-4", apiKey.isActive ? "text-green-400" : "text-gray-400")} />
              </div>
              <div>
                <h3 className="font-medium text-white">{apiKey.name}</h3>
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <span>Created {new Date(apiKey.createdAt).toLocaleDateString()}</span>
                  {apiKey.lastUsed && (
                    <span>• Last used {new Date(apiKey.lastUsed).toLocaleDateString()}</span>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {(isExpired || isExpiringSoon) && (
                <motion.div
                  className={cn(
                    "px-2 py-1 rounded-full text-xs font-medium",
                    isExpired 
                      ? "bg-red-500/20 border border-red-500/40 text-red-300" 
                      : "bg-amber-500/20 border border-amber-500/40 text-amber-300"
                  )}
                  animate={isExpired ? { pulse: [1, 1.1, 1] } : undefined}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  <AlertTriangle className="w-3 h-3 inline mr-1" />
                  {isExpired ? 'Expired' : 'Expiring Soon'}
                </motion.div>
              )}
              
              <button
                onClick={() => onUpdate({ isActive: !apiKey.isActive })}
                className={cn(
                  "px-3 py-1 rounded-full text-xs font-medium transition-colors",
                  apiKey.isActive
                    ? "bg-green-500/20 border border-green-500/40 text-green-300 hover:bg-green-500/30"
                    : "bg-gray-500/20 border border-gray-500/40 text-gray-300 hover:bg-gray-500/30"
                )}
              >
                {apiKey.isActive ? 'Active' : 'Inactive'}
              </button>
            </div>
          </div>

          {/* API Key Display */}
          <div className="flex items-center gap-2 p-3 bg-black/20 rounded-lg border border-white/10">
            <code className="flex-1 text-sm text-gray-300 font-mono">
              {isVisible ? apiKey.key : maskKey(apiKey.key)}
            </code>
            
            <div className="flex items-center gap-2">
              <motion.button
                onClick={onToggleVisibility}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                title={isVisible ? 'Hide key' : 'Show key'}
              >
                {isVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </motion.button>
              
              <motion.button
                onClick={onCopy}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                title="Copy to clipboard"
              >
                <AnimatePresence mode="wait">
                  {isCopied ? (
                    <motion.div
                      key="check"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                    >
                      <Check className="w-4 h-4 text-green-400" />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="copy"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                    >
                      <Copy className="w-4 h-4" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.button>
              
              <motion.button
                onClick={onTest}
                disabled={isTesting || !apiKey.isActive}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                title="Test connection"
              >
                {isTesting ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  >
                    <Settings className="w-4 h-4" />
                  </motion.div>
                ) : (
                  <Shield className="w-4 h-4" />
                )}
              </motion.button>
            </div>
          </div>

          {/* Permissions */}
          <div>
            <h4 className="text-sm font-medium text-white mb-2">Permissions</h4>
            <div className="flex flex-wrap gap-2">
              {apiKey.permissions.map(permission => (
                <span
                  key={permission}
                  className="px-2 py-1 bg-blue-500/20 border border-blue-500/40 text-blue-300 text-xs rounded-full"
                >
                  {permissions.find(p => p.id === permission)?.label || permission}
                </span>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-2 border-t border-white/10">
            <div className="text-xs text-gray-400">
              ID: {apiKey.id}
            </div>
            
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-1 px-3 py-1 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors text-sm"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          </div>

          {/* Delete Confirmation */}
          <AnimatePresence>
            {showDeleteConfirm && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                  <div className="flex-1">
                    <p className="text-sm text-white font-medium">Delete API Key</p>
                    <p className="text-xs text-gray-400">This action cannot be undone.</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className="px-3 py-1 bg-gray-500/20 hover:bg-gray-500/30 text-gray-300 rounded text-sm transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        onDelete();
                        setShowDeleteConfirm(false);
                      }}
                      className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded text-sm transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </GlassCard>
    </motion.div>
  );
}

interface CreateApiKeyModalProps {
  onClose: () => void;
  onCreate: (name: string, permissions: string[]) => Promise<ApiKey>;
  permissions: Array<{ id: string; label: string; description: string }>;
}

function CreateApiKeyModal({ onClose, onCreate, permissions }: CreateApiKeyModalProps) {
  const [name, setName] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>(['read:metrics']);
  const [isCreating, setIsCreating] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsCreating(true);
    try {
      await onCreate(name.trim(), selectedPermissions);
      onClose();
    } catch (error) {
      console.error('Failed to create API key:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const togglePermission = (permissionId: string) => {
    setSelectedPermissions(prev => {
      if (prev.includes(permissionId)) {
        return prev.filter(id => id !== permissionId);
      } else {
        return [...prev, permissionId];
      }
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-gray-900 border border-white/10 rounded-xl shadow-2xl max-w-md w-full p-6"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-xl font-semibold text-white mb-6">Create New API Key</h3>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Key Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Production Dashboard"
              className="w-full px-3 py-2 bg-white/5 border border-white/10 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-3">
              Permissions
            </label>
            <div className="space-y-3 max-h-60 overflow-y-auto">
              {permissions.map(permission => (
                <div key={permission.id} className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id={permission.id}
                    checked={selectedPermissions.includes(permission.id)}
                    onChange={() => togglePermission(permission.id)}
                    className="mt-1 w-4 h-4 text-blue-600 bg-transparent border-gray-300 rounded focus:ring-blue-500"
                  />
                  <div className="flex-1">
                    <label htmlFor={permission.id} className="text-sm font-medium text-white cursor-pointer">
                      {permission.label}
                    </label>
                    <p className="text-xs text-gray-400 mt-1">{permission.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-500/20 hover:bg-gray-500/30 text-gray-300 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || selectedPermissions.length === 0 || isCreating}
              className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
            >
              {isCreating ? 'Creating...' : 'Create Key'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}