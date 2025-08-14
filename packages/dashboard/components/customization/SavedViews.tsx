'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Bookmark,
  BookmarkPlus,
  Edit3,
  Trash2,
  Download,
  Upload,
  Star,
  Users,
  Eye,
  Clock,
  Tag,
  Search,
  Filter,
  MoreVertical,
  Check,
  X,
  AlertTriangle,
  Share2,
  Copy
} from 'lucide-react';
import { GlassCard } from '@/components/ui/glass-card';
import { DashboardLayout } from '@/components/builder/DashboardBuilder';
import { configStorage } from '@/lib/config';

export interface DashboardView {
  id: string;
  name: string;
  description: string;
  layout: DashboardLayout;
  thumbnail?: string;
  metadata: {
    createdAt: string;
    updatedAt: string;
    createdBy: string;
    tags: string[];
    category: 'personal' | 'team' | 'public';
    starred: boolean;
    shared: boolean;
    version: string;
  };
  filters?: {
    timeRange?: string;
    categories?: string[];
    severity?: string;
    searchQuery?: string;
  };
  customization?: {
    theme?: string;
    alertThresholds?: Record<string, number>;
    refreshInterval?: number;
    autoRefresh?: boolean;
  };
}

export interface SavedViewsProps {
  className?: string;
  currentLayout?: DashboardLayout;
  onLoadView?: (view: DashboardView) => void;
  onSaveView?: (view: DashboardView) => Promise<void>;
  onDeleteView?: (viewId: string) => Promise<void>;
  currentUser?: string;
  showTeamViews?: boolean;
  showPublicViews?: boolean;
}

// Predefined views
const DEFAULT_VIEWS: DashboardView[] = [
  {
    id: 'my-dashboard',
    name: 'My Dashboard',
    description: 'Personal monitoring setup',
    layout: {
      id: 'my-dashboard',
      name: 'My Dashboard',
      description: 'Personal monitoring setup',
      widgets: [],
      grid: { columns: 24, rows: 16, gap: 10 },
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: '1.0.0',
        tags: [],
      },
    },
    metadata: {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: 'current-user',
      tags: ['personal', 'monitoring'],
      category: 'personal',
      starred: true,
      shared: false,
      version: '1.0.0',
    },
  },
  {
    id: 'team-view',
    name: 'Team View',
    description: 'Shared team monitoring dashboard',
    layout: {
      id: 'team-view',
      name: 'Team View',
      description: 'Shared team monitoring dashboard',
      widgets: [],
      grid: { columns: 24, rows: 16, gap: 10 },
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: '1.0.0',
        tags: [],
      },
    },
    metadata: {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: 'team-lead',
      tags: ['team', 'collaborative'],
      category: 'team',
      starred: false,
      shared: true,
      version: '1.0.0',
    },
  },
  {
    id: 'executive-summary',
    name: 'Executive Summary',
    description: 'High-level overview for executives',
    layout: {
      id: 'executive-summary',
      name: 'Executive Summary',
      description: 'High-level overview for executives',
      widgets: [],
      grid: { columns: 24, rows: 16, gap: 10 },
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: '1.0.0',
        tags: [],
      },
    },
    metadata: {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: 'admin',
      tags: ['executive', 'summary', 'high-level'],
      category: 'public',
      starred: false,
      shared: true,
      version: '1.0.0',
    },
  },
];

export const SavedViews: React.FC<SavedViewsProps> = ({
  className = '',
  currentLayout,
  onLoadView,
  onSaveView,
  onDeleteView,
  currentUser = 'current-user',
  showTeamViews = true,
  showPublicViews = true,
}) => {
  const [views, setViews] = useState<DashboardView[]>(DEFAULT_VIEWS);
  const [filteredViews, setFilteredViews] = useState<DashboardView[]>(DEFAULT_VIEWS);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'personal' | 'team' | 'public'>('all');
  const [showStarredOnly, setShowStarredOnly] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [editingView, setEditingView] = useState<DashboardView | null>(null);
  const [selectedViews, setSelectedViews] = useState<string[]>([]);
  const [showBatchActions, setShowBatchActions] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Load views from storage on mount
  useEffect(() => {
    const savedViews = configStorage.load<DashboardView[]>('saved-views');
    if (savedViews && savedViews.length > 0) {
      setViews([...DEFAULT_VIEWS, ...savedViews]);
    }
  }, []);

  // Filter views based on search and category
  useEffect(() => {
    let filtered = views;

    // Category filter
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(view => view.metadata.category === selectedCategory);
    }

    // Hide team/public views if disabled
    if (!showTeamViews) {
      filtered = filtered.filter(view => view.metadata.category !== 'team');
    }
    if (!showPublicViews) {
      filtered = filtered.filter(view => view.metadata.category !== 'public');
    }

    // Starred filter
    if (showStarredOnly) {
      filtered = filtered.filter(view => view.metadata.starred);
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(view => 
        view.name.toLowerCase().includes(query) ||
        view.description.toLowerCase().includes(query) ||
        view.metadata.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }

    setFilteredViews(filtered);
  }, [views, searchQuery, selectedCategory, showStarredOnly, showTeamViews, showPublicViews]);

  // Save views to storage
  const saveViewsToStorage = useCallback((viewsToSave: DashboardView[]) => {
    const customViews = viewsToSave.filter(view => !DEFAULT_VIEWS.some(dv => dv.id === view.id));
    configStorage.save('saved-views', customViews);
  }, []);

  // Create new view
  const createView = useCallback(async (name: string, description: string) => {
    if (!currentLayout) return;

    const newView: DashboardView = {
      id: `view-${Date.now()}`,
      name,
      description,
      layout: { ...currentLayout, name, description },
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: currentUser,
        tags: [],
        category: 'personal',
        starred: false,
        shared: false,
        version: '1.0.0',
      },
    };

    try {
      if (onSaveView) {
        await onSaveView(newView);
      }
      
      const newViews = [...views, newView];
      setViews(newViews);
      saveViewsToStorage(newViews);
      
      setNotification({ type: 'success', message: 'View saved successfully!' });
      setTimeout(() => setNotification(null), 3000);
    } catch (error) {
      setNotification({ type: 'error', message: 'Failed to save view' });
      setTimeout(() => setNotification(null), 3000);
    }
  }, [currentLayout, currentUser, views, onSaveView, saveViewsToStorage]);

  // Update view
  const updateView = useCallback(async (viewId: string, updates: Partial<DashboardView>) => {
    const updatedViews = views.map(view => 
      view.id === viewId 
        ? { 
            ...view, 
            ...updates,
            metadata: { ...view.metadata, ...updates.metadata, updatedAt: new Date().toISOString() }
          }
        : view
    );
    
    setViews(updatedViews);
    saveViewsToStorage(updatedViews);
    
    setNotification({ type: 'success', message: 'View updated successfully!' });
    setTimeout(() => setNotification(null), 3000);
  }, [views, saveViewsToStorage]);

  // Delete view
  const deleteView = useCallback(async (viewId: string) => {
    try {
      if (onDeleteView) {
        await onDeleteView(viewId);
      }
      
      const newViews = views.filter(view => view.id !== viewId);
      setViews(newViews);
      saveViewsToStorage(newViews);
      
      setNotification({ type: 'success', message: 'View deleted successfully!' });
      setTimeout(() => setNotification(null), 3000);
    } catch (error) {
      setNotification({ type: 'error', message: 'Failed to delete view' });
      setTimeout(() => setNotification(null), 3000);
    }
  }, [views, onDeleteView, saveViewsToStorage]);

  // Toggle star
  const toggleStar = useCallback((viewId: string) => {
    updateView(viewId, {
      metadata: {
        ...views.find(v => v.id === viewId)?.metadata!,
        starred: !views.find(v => v.id === viewId)?.metadata.starred
      }
    });
  }, [views, updateView]);

  // Share view
  const shareView = useCallback(async (viewId: string) => {
    try {
      const view = views.find(v => v.id === viewId);
      if (!view) return;

      const shareUrl = `${window.location.origin}/monitoring/shared/${viewId}`;
      await navigator.clipboard.writeText(shareUrl);
      
      setNotification({ type: 'success', message: 'Share link copied to clipboard!' });
      setTimeout(() => setNotification(null), 3000);
    } catch (error) {
      setNotification({ type: 'error', message: 'Failed to copy share link' });
      setTimeout(() => setNotification(null), 3000);
    }
  }, [views]);

  // Export views
  const exportViews = useCallback(() => {
    const exportData = {
      views: selectedViews.length > 0 
        ? views.filter(view => selectedViews.includes(view.id))
        : views,
      exportedAt: new Date().toISOString(),
      version: '1.0.0',
    };

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const fileName = `dashboard-views-${Date.now()}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', fileName);
    linkElement.click();
  }, [views, selectedViews]);

  // Import views
  const importViews = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importData = JSON.parse(e.target?.result as string);
        
        if (!importData.views || !Array.isArray(importData.views)) {
          throw new Error('Invalid export format');
        }

        const importedViews: DashboardView[] = importData.views.map((view: any) => ({
          ...view,
          id: `imported-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          metadata: {
            ...view.metadata,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            createdBy: currentUser,
          },
        }));

        const newViews = [...views, ...importedViews];
        setViews(newViews);
        saveViewsToStorage(newViews);
        
        setImportError(null);
        setNotification({ 
          type: 'success', 
          message: `Successfully imported ${importedViews.length} views!` 
        });
        setTimeout(() => setNotification(null), 3000);
      } catch (error) {
        setImportError('Failed to import views: Invalid format');
      }
    };
    reader.readAsText(file);
    
    event.target.value = '';
  }, [views, currentUser, saveViewsToStorage]);

  return (
    <GlassCard className={`p-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-green-500 to-blue-600 rounded-lg">
            <Bookmark className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Saved Views</h3>
            <p className="text-sm text-gray-400">Manage your dashboard configurations</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <motion.button
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-2 px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <BookmarkPlus className="w-4 h-4" />
            Save Current
          </motion.button>
          
          <input
            type="file"
            accept=".json"
            onChange={importViews}
            className="hidden"
            id="views-import"
          />
          <label
            htmlFor="views-import"
            className="p-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg cursor-pointer transition-colors"
            title="Import Views"
          >
            <Upload className="w-4 h-4 text-gray-300" />
          </label>

          <motion.button
            onClick={exportViews}
            className="p-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg transition-colors"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            title="Export Views"
          >
            <Download className="w-4 h-4 text-gray-300" />
          </motion.button>
        </div>
      </div>

      {/* Notifications */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`mb-4 p-3 rounded-lg border flex items-center gap-2 ${
              notification.type === 'success'
                ? 'bg-green-500/20 border-green-500/40 text-green-300'
                : 'bg-red-500/20 border-red-500/40 text-red-300'
            }`}
          >
            {notification.type === 'success' ? (
              <Check className="w-4 h-4" />
            ) : (
              <AlertTriangle className="w-4 h-4" />
            )}
            <span className="text-sm">{notification.message}</span>
            <button 
              onClick={() => setNotification(null)}
              className="ml-auto hover:opacity-70"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}

        {importError && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-4 p-3 bg-red-500/20 border border-red-500/40 rounded-lg flex items-center gap-2"
          >
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <span className="text-sm text-red-300">{importError}</span>
            <button 
              onClick={() => setImportError(null)}
              className="ml-auto text-red-400 hover:text-red-300"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filters and Search */}
      <div className="space-y-4 mb-6">
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search views..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
          </div>
          
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value as any)}
            className="px-3 py-2 bg-white/5 border border-white/10 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          >
            <option value="all">All Categories</option>
            <option value="personal">Personal</option>
            {showTeamViews && <option value="team">Team</option>}
            {showPublicViews && <option value="public">Public</option>}
          </select>

          <motion.button
            onClick={() => setShowStarredOnly(!showStarredOnly)}
            className={`p-2 rounded-lg transition-colors ${
              showStarredOnly 
                ? 'bg-yellow-500 text-white' 
                : 'bg-white/10 text-gray-300 hover:bg-white/20'
            }`}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            title="Show starred only"
          >
            <Star className="w-4 h-4" />
          </motion.button>
        </div>

        <div className="flex items-center justify-between text-sm text-gray-400">
          <span>{filteredViews.length} views found</span>
          {selectedViews.length > 0 && (
            <div className="flex items-center gap-2">
              <span>{selectedViews.length} selected</span>
              <button
                onClick={() => setSelectedViews([])}
                className="text-blue-400 hover:text-blue-300"
              >
                Clear
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Views Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredViews.map((view) => (
          <ViewCard
            key={view.id}
            view={view}
            selected={selectedViews.includes(view.id)}
            onSelect={(selected) => {
              if (selected) {
                setSelectedViews([...selectedViews, view.id]);
              } else {
                setSelectedViews(selectedViews.filter(id => id !== view.id));
              }
            }}
            onLoad={() => onLoadView?.(view)}
            onEdit={() => setEditingView(view)}
            onDelete={() => deleteView(view.id)}
            onToggleStar={() => toggleStar(view.id)}
            onShare={() => shareView(view.id)}
            canEdit={view.metadata.createdBy === currentUser}
            canDelete={view.metadata.createdBy === currentUser && !DEFAULT_VIEWS.some(dv => dv.id === view.id)}
          />
        ))}
      </div>

      {filteredViews.length === 0 && (
        <div className="text-center py-12">
          <Bookmark className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h4 className="text-lg font-medium text-white mb-2">No views found</h4>
          <p className="text-gray-400 mb-4">
            {searchQuery || selectedCategory !== 'all' || showStarredOnly
              ? 'Try adjusting your filters'
              : 'Create your first saved view'}
          </p>
          {!searchQuery && selectedCategory === 'all' && !showStarredOnly && (
            <motion.button
              onClick={() => setIsCreating(true)}
              className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              Create View
            </motion.button>
          )}
        </div>
      )}

      {/* Create View Modal */}
      <CreateViewModal
        isOpen={isCreating}
        onClose={() => setIsCreating(false)}
        onSave={createView}
      />

      {/* Edit View Modal */}
      <EditViewModal
        view={editingView}
        onClose={() => setEditingView(null)}
        onSave={(updates) => {
          if (editingView) {
            updateView(editingView.id, updates);
            setEditingView(null);
          }
        }}
      />
    </GlassCard>
  );
};

// View Card Component
interface ViewCardProps {
  view: DashboardView;
  selected: boolean;
  onSelect: (selected: boolean) => void;
  onLoad: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleStar: () => void;
  onShare: () => void;
  canEdit: boolean;
  canDelete: boolean;
}

const ViewCard: React.FC<ViewCardProps> = ({
  view,
  selected,
  onSelect,
  onLoad,
  onEdit,
  onDelete,
  onToggleStar,
  onShare,
  canEdit,
  canDelete,
}) => {
  const [showActions, setShowActions] = useState(false);

  return (
    <motion.div
      className={`relative p-4 rounded-lg border-2 transition-all group ${
        selected
          ? 'border-blue-500 bg-blue-500/10'
          : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10'
      }`}
      whileHover={{ scale: 1.02 }}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <input
            type="checkbox"
            checked={selected}
            onChange={(e) => onSelect(e.target.checked)}
            className="w-4 h-4"
            onClick={(e) => e.stopPropagation()}
          />
          <div className="min-w-0 flex-1">
            <h4 className="font-medium text-white truncate">{view.name}</h4>
            <p className="text-sm text-gray-400 truncate">{view.description}</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <motion.button
            onClick={onToggleStar}
            className={`p-1 rounded transition-colors ${
              view.metadata.starred ? 'text-yellow-400' : 'text-gray-400 hover:text-yellow-400'
            }`}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <Star className="w-4 h-4" fill={view.metadata.starred ? 'currentColor' : 'none'} />
          </motion.button>

          <div className="relative">
            <motion.button
              onClick={() => setShowActions(!showActions)}
              className="p-1 rounded text-gray-400 hover:text-white transition-colors"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              <MoreVertical className="w-4 h-4" />
            </motion.button>

            <AnimatePresence>
              {showActions && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowActions(false)}
                  />
                  <motion.div
                    initial={{ opacity: 0, y: 5, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 5, scale: 0.95 }}
                    className="absolute top-full right-0 mt-1 z-50 bg-white/10 backdrop-blur-md border border-white/20 rounded-lg py-2 min-w-[120px]"
                  >
                    {canEdit && (
                      <button
                        onClick={() => {
                          onEdit();
                          setShowActions(false);
                        }}
                        className="w-full px-3 py-2 text-left text-sm text-white hover:bg-white/10 transition-colors flex items-center gap-2"
                      >
                        <Edit3 className="w-3 h-3" />
                        Edit
                      </button>
                    )}
                    
                    <button
                      onClick={() => {
                        onShare();
                        setShowActions(false);
                      }}
                      className="w-full px-3 py-2 text-left text-sm text-white hover:bg-white/10 transition-colors flex items-center gap-2"
                    >
                      <Share2 className="w-3 h-3" />
                      Share
                    </button>

                    {canDelete && (
                      <button
                        onClick={() => {
                          onDelete();
                          setShowActions(false);
                        }}
                        className="w-full px-3 py-2 text-left text-sm text-red-300 hover:bg-red-500/20 transition-colors flex items-center gap-2"
                      >
                        <Trash2 className="w-3 h-3" />
                        Delete
                      </button>
                    )}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs text-gray-400">
          <div className="flex items-center gap-4">
            <span className={`px-2 py-1 rounded ${
              view.metadata.category === 'personal' 
                ? 'bg-blue-500/20 text-blue-300' 
                : view.metadata.category === 'team'
                ? 'bg-purple-500/20 text-purple-300'
                : 'bg-green-500/20 text-green-300'
            }`}>
              {view.metadata.category}
            </span>
            <span>{view.layout.widgets.length} widgets</span>
          </div>
          <span>{new Date(view.metadata.updatedAt).toLocaleDateString()}</span>
        </div>

        {view.metadata.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {view.metadata.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="px-2 py-1 text-xs bg-white/10 text-gray-300 rounded"
              >
                #{tag}
              </span>
            ))}
            {view.metadata.tags.length > 3 && (
              <span className="px-2 py-1 text-xs bg-white/10 text-gray-300 rounded">
                +{view.metadata.tags.length - 3}
              </span>
            )}
          </div>
        )}

        <motion.button
          onClick={onLoad}
          className="w-full py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center gap-2"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <Eye className="w-4 h-4" />
          Load View
        </motion.button>
      </div>
    </motion.div>
  );
};

// Create View Modal
interface CreateViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, description: string) => Promise<void>;
}

const CreateViewModal: React.FC<CreateViewModalProps> = ({ isOpen, onClose, onSave }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return;
    
    setSaving(true);
    try {
      await onSave(name.trim(), description.trim());
      setName('');
      setDescription('');
      onClose();
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-6 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-white mb-4">Save Current View</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-white mb-2">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter view name..."
              className="w-full px-3 py-2 bg-white/5 border border-white/10 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              autoFocus
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-white mb-2">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter description..."
              rows={3}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
            disabled={saving}
          >
            Cancel
          </button>
          <motion.button
            onClick={handleSave}
            disabled={!name.trim() || saving}
            className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            whileHover={{ scale: saving ? 1 : 1.02 }}
            whileTap={{ scale: saving ? 1 : 0.98 }}
          >
            {saving ? 'Saving...' : 'Save View'}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
};

// Edit View Modal
interface EditViewModalProps {
  view: DashboardView | null;
  onClose: () => void;
  onSave: (updates: Partial<DashboardView>) => void;
}

const EditViewModal: React.FC<EditViewModalProps> = ({ view, onClose, onSave }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');

  useEffect(() => {
    if (view) {
      setName(view.name);
      setDescription(view.description);
      setTags(view.metadata.tags.join(', '));
    }
  }, [view]);

  const handleSave = () => {
    if (!name.trim() || !view) return;
    
    const updates: Partial<DashboardView> = {
      name: name.trim(),
      description: description.trim(),
      metadata: {
        ...view.metadata,
        tags: tags.split(',').map(t => t.trim()).filter(Boolean),
      },
    };
    
    onSave(updates);
  };

  if (!view) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-6 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-white mb-4">Edit View</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-white mb-2">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-white mb-2">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-white mb-2">Tags</label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="comma, separated, tags"
              className="w-full px-3 py-2 bg-white/5 border border-white/10 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <motion.button
            onClick={handleSave}
            disabled={!name.trim()}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            Save Changes
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default SavedViews;