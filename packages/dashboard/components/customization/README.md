# Dashboard Customization Features

This directory contains advanced customization components for the monitoring dashboard. These features are only available in **Advanced** and **Expert** modes to maintain simplicity for basic users.

## Components Overview

### 1. ThemeSelector
**Available in**: Advanced, Expert modes  
**Features**: 
- Dark/Light/Auto theme switching
- 12+ predefined themes (Ocean Depths, Sunset Vibes, Forest Guardian, etc.)
- Custom theme import/export
- Live preview
- Theme customization

```tsx
import { ThemeSelector } from '@/components/customization';

<ThemeSelector 
  compact={false}
  showPreview={true} 
/>
```

### 2. LayoutManager
**Available in**: Advanced, Expert modes  
**Features**:
- Drag and drop widget arrangement
- Layout presets (Minimal, Comprehensive, Security-focused)
- Widget resizing and positioning
- Layout import/export
- Undo/Redo functionality
- Grid snapping

```tsx
import { LayoutManager } from '@/components/customization';

<LayoutManager 
  initialLayout={layout}
  onLayoutChange={setLayout}
  readOnly={false}
/>
```

### 3. SavedViews
**Available in**: Advanced, Expert modes  
**Features**:
- Save current dashboard configurations
- Personal, Team, and Public view categories
- View sharing with copy link
- Tagging and search
- Starred favorites
- Bulk operations (export multiple views)

```tsx
import { SavedViews } from '@/components/customization';

<SavedViews 
  currentLayout={layout}
  onLoadView={handleLoadView}
  showTeamViews={true}
  showPublicViews={true}
/>
```

### 4. CustomizationPanel
**Available in**: Advanced, Expert modes  
**Main Features**:
- Unified customization interface
- Mode switching (Basic/Advanced/Expert)
- Tabbed interface for different customization areas
- Settings persistence
- Import/export configurations

```tsx
import { CustomizationPanel } from '@/components/customization';

<CustomizationPanel 
  isOpen={showPanel}
  onClose={() => setShowPanel(false)}
  currentLayout={layout}
  onLayoutChange={setLayout}
/>
```

### 5. ModeAwareWrapper
**Utility Component**  
**Purpose**: Conditionally render components based on dashboard mode

```tsx
import { ModeAwareWrapper } from '@/components/customization';

<ModeAwareWrapper 
  requiredMode="advanced"
  requiredFeature="themeCustomization"
  fallback={<div>Feature not available</div>}
>
  <ThemeSelector />
</ModeAwareWrapper>
```

## Mode System

The dashboard operates in three modes:

### Basic Mode
- Simple monitoring interface
- No customization options
- Essential widgets only
- Perfect for end users

### Advanced Mode ⭐
- Theme customization
- Layout editing
- Saved views
- Export/import capabilities
- Widget arrangement

### Expert Mode 🛡️
- All Advanced features
- API configuration
- Webhook management
- Scripting capabilities
- Advanced collaboration tools

## Configuration Management

### Dashboard Settings
```tsx
import { useDashboardConfig } from '@/components/customization';

const { 
  mode, 
  setMode, 
  isFeatureAvailable,
  updateSettings,
  exportConfig,
  importConfig 
} = useDashboardConfig();

// Check if feature is available
if (isFeatureAvailable('themeCustomization')) {
  // Show theme selector
}

// Update settings
updateSettings({
  autoSave: true,
  refreshInterval: 30000,
  enableAnimations: true
});
```

### Alert Thresholds
```tsx
const { 
  setAlertThreshold, 
  getAlertThreshold,
  getAlertThresholds 
} = useDashboardConfig();

// Set custom thresholds
setAlertThreshold('cpu', 85);
setAlertThreshold('memory', 90);
setAlertThreshold('errorRate', 5);
```

## Example Usage

See `ExampleUsage.tsx` for a complete implementation example showing:
- Mode-aware component rendering
- Customization panel integration  
- Feature availability checks
- Settings persistence

## Features by Mode

| Feature | Basic | Advanced | Expert |
|---------|-------|----------|--------|
| Theme Customization | ❌ | ✅ | ✅ |
| Layout Editor | ❌ | ✅ | ✅ |
| Saved Views | ❌ | ✅ | ✅ |
| Export/Import | ❌ | ✅ | ✅ |
| Custom Alert Thresholds | ❌ | ✅ | ✅ |
| API Configuration | ❌ | ❌ | ✅ |
| Webhooks | ❌ | ❌ | ✅ |
| Scripting | ❌ | ❌ | ✅ |

## Storage

All customizations are persisted in localStorage:
- `monitoring-theme`: Theme settings
- `monitoring-dashboard-config`: Dashboard configuration
- `monitoring-dashboard-saved-views`: Saved views

## Integration

To integrate these features into your existing dashboard:

1. **Wrap your app** with the configuration provider
2. **Add mode selector** in your dashboard header
3. **Use ModeAwareWrapper** to conditionally show features
4. **Add customization button** for Advanced/Expert users

```tsx
// In your main dashboard component
import { 
  CustomizationPanel, 
  ModeAwareWrapper, 
  useDashboardConfig 
} from '@/components/customization';

export function Dashboard() {
  const [showCustomization, setShowCustomization] = useState(false);
  const { mode } = useDashboardConfig();

  return (
    <div>
      {/* Your dashboard content */}
      
      {/* Customization button - only in Advanced/Expert */}
      <ModeAwareWrapper requiredMode="advanced">
        <button onClick={() => setShowCustomization(true)}>
          Customize
        </button>
      </ModeAwareWrapper>

      {/* Customization panel */}
      {showCustomization && (
        <CustomizationPanel 
          onClose={() => setShowCustomization(false)}
        />
      )}
    </div>
  );
}
```

## Performance

- All components use React.memo for optimization
- Settings are debounced to prevent excessive saves
- Theme transitions are GPU accelerated
- Large lists use virtualization where applicable

## Accessibility

- Full keyboard navigation support
- Screen reader compatible
- High contrast mode support
- Focus management in modals
- ARIA labels and descriptions