# Mode Toggle System

A comprehensive mode toggle system for the monitoring dashboard with three distinct modes: Simple, Advanced, and Expert. Each mode provides different levels of functionality and complexity.

## Features

- 🎛️ **Three Mode Levels**: Simple (default), Advanced, Expert
- 👑 **Admin Overlay**: Separate admin mode as overlay (not a primary mode)
- ⌨️ **Keyboard Shortcuts**: Full keyboard navigation (Ctrl+M to cycle modes)
- 🎨 **Smooth Animations**: Beautiful transitions using Framer Motion
- 💾 **Persistent Storage**: Remembers user preference in localStorage
- 🌍 **Cross-tab Sync**: Mode changes sync across browser tabs
- ♿ **Accessibility**: Full screen reader support and keyboard navigation
- 📊 **Usage Analytics**: Track mode usage patterns and statistics

## Mode Descriptions

### Simple Mode 🟢
- **Purpose**: Clean, essential monitoring with key metrics only
- **Target Users**: Business users, managers, casual viewers
- **Features**: Key performance indicators, basic alerts, essential charts, simplified navigation
- **UI**: Clean, mobile-friendly interface with reduced complexity

### Advanced Mode 🔵
- **Purpose**: Comprehensive monitoring with detailed insights
- **Target Users**: Operations teams, analysts, power users
- **Features**: All simple features + advanced analytics, custom dashboards, detailed alerts, performance profiling, data export
- **UI**: Full-featured interface with customization options

### Expert Mode 🟣
- **Purpose**: Full-featured monitoring with debugging tools
- **Target Users**: Developers, DevOps engineers, system administrators
- **Features**: All advanced features + raw data access, debugging panel, technical metrics, system internals, experimental features
- **UI**: Complete access to all tools and technical details

## Quick Start

### 1. Wrap Your App with ModeProvider

```tsx
import { ModeProvider } from '@/components/mode';

function App() {
  return (
    <ModeProvider 
      showNotifications={true}
      enableKeyboardShortcuts={true}
    >
      <YourDashboard />
    </ModeProvider>
  );
}
```

### 2. Add Mode Toggle Component

```tsx
import { ModeToggle } from '@/components/mode';

function Header() {
  return (
    <header>
      <h1>Dashboard</h1>
      <ModeToggle 
        variant="compact" 
        position="top-right"
        showDescription={true}
        showKeyboardHints={true}
      />
    </header>
  );
}
```

### 3. Use Mode in Components

```tsx
import { useModeContext, ModeGuard } from '@/components/mode';

function MetricsPanel() {
  const { currentMode, canAccess, config } = useModeContext();
  
  return (
    <div>
      <h2>Metrics - {config.name} Mode</h2>
      
      {/* Always shown */}
      <BasicMetrics />
      
      {/* Only in Advanced/Expert modes */}
      <ModeGuard modes={['advanced', 'expert']}>
        <DetailedMetrics />
      </ModeGuard>
      
      {/* Only when raw data access is enabled */}
      <ModeGuard requiredFeatures={['showRawData']}>
        <RawDataPanel />
      </ModeGuard>
    </div>
  );
}
```

### 4. Connect with Keyboard Shortcuts

```tsx
import { ModeKeyboardIntegration } from '@/components/mode';

function Dashboard() {
  const handleModeChange = (mode: string) => {
    console.log('Mode changed to:', mode);
  };

  return (
    <div>
      <YourDashboardContent />
      <ModeKeyboardIntegration 
        onModeChange={handleModeChange}
        enableNotifications={true}
      />
    </div>
  );
}
```

## Components

### ModeProvider
The main context provider that manages mode state and provides functionality to child components.

**Props:**
- `showNotifications?: boolean` - Show mode change notifications (default: true)
- `enableKeyboardShortcuts?: boolean` - Enable keyboard shortcuts (default: true)
- `enableCrossTtabSync?: boolean` - Sync mode across tabs (default: true)

### ModeToggle
A beautiful, animated toggle component for switching between modes.

**Props:**
- `variant?: 'compact' | 'full' | 'minimal'` - Display style (default: 'full')
- `position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'inline'` - Position (default: 'inline')
- `showStats?: boolean` - Show usage statistics (default: true)
- `showDescription?: boolean` - Show mode descriptions (default: true)
- `showKeyboardHints?: boolean` - Show keyboard shortcuts (default: true)
- `enableHoverEffects?: boolean` - Enable hover animations (default: true)

### ModeGuard
Conditionally render content based on current mode or available features.

**Props:**
- `modes?: DashboardMode[]` - Allowed modes (empty = all modes)
- `requiredFeatures?: string[]` - Required mode features
- `fallback?: React.ReactNode` - Fallback content when conditions not met

### ModeKeyboardIntegration
Connects mode system with keyboard shortcuts system.

**Props:**
- `onModeChange?: (mode: string) => void` - Mode change callback
- `onAdminToggle?: (enabled: boolean) => void` - Admin toggle callback
- `enableNotifications?: boolean` - Enable change notifications

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+M` | Cycle through modes (Simple → Advanced → Expert → Simple) |
| `Ctrl+Shift+M` | Reverse cycle through modes |
| `Ctrl+Shift+A` | Toggle admin overlay |
| `Ctrl+Alt+1` | Switch directly to Simple mode |
| `Ctrl+Alt+2` | Switch directly to Advanced mode |
| `Ctrl+Alt+3` | Switch directly to Expert mode |

## Hooks

### useModeContext()
Access mode functionality within components wrapped by ModeProvider.

```tsx
const { 
  currentMode,
  adminOverlay,
  config,
  setMode,
  cycleMode,
  toggleAdmin,
  canAccess,
  isSimpleMode,
  isAdvancedMode,
  isExpertMode
} = useModeContext();
```

### useMode()
Standalone hook for mode management (used internally by ModeProvider).

### useModeKeyboardHandlers()
Get keyboard handlers for custom integrations.

## Storage & Persistence

Mode preferences are automatically saved to localStorage and persist across sessions. The system also supports:

- Cross-tab synchronization
- Mode change history tracking
- Usage statistics
- Import/export of preferences

## Accessibility

The mode system is fully accessible with:

- ARIA labels and live regions
- Screen reader announcements for mode changes
- Keyboard navigation support
- High contrast mode compatibility
- Focus management

## Advanced Usage

### Custom Mode Logic

```tsx
import { useModeContext } from '@/components/mode';

function CustomComponent() {
  const { currentMode, canAccess, config } = useModeContext();
  
  // Check if specific features are available
  if (canAccess('showAdvancedMetrics')) {
    return <AdvancedMetricsView />;
  }
  
  // Mode-specific styling
  const className = `component mode-${currentMode}`;
  
  // Access mode configuration
  const isComplexMode = config.complexity === 'high';
  
  return (
    <div className={className} data-complexity={config.complexity}>
      {/* Your content */}
    </div>
  );
}
```

### Listen to Mode Changes

```tsx
import { useModeContext } from '@/components/mode';
import { useEffect } from 'react';

function Component() {
  const { onModeChange, currentMode } = useModeContext();
  
  useEffect(() => {
    const cleanup = onModeChange((event) => {
      console.log('Mode changed:', {
        from: event.previousMode,
        to: event.newMode,
        source: event.source, // 'user' | 'keyboard' | 'system'
        timestamp: event.timestamp
      });
    });
    
    return cleanup;
  }, [onModeChange]);
  
  return <div>Current mode: {currentMode}</div>;
}
```

### Export/Import Preferences

```tsx
import { useModeContext } from '@/components/mode';

function PreferencesManager() {
  const { exportPreferences, importPreferences } = useModeContext();
  
  const handleExport = () => {
    const data = exportPreferences();
    navigator.clipboard.writeText(data);
  };
  
  const handleImport = (data: string) => {
    const success = importPreferences(data);
    if (success) {
      console.log('Preferences imported successfully');
    }
  };
  
  return (
    <div>
      <button onClick={handleExport}>Export Preferences</button>
      <button onClick={() => handleImport(/* data */)}>Import Preferences</button>
    </div>
  );
}
```

## Styling & Theming

The mode system uses Tailwind CSS classes and respects the existing theme system. Each mode provides:

- `data-mode="simple|advanced|expert"` attribute on the root element
- CSS custom properties for mode colors
- Conditional styling based on mode features

```css
/* Mode-specific styles */
[data-mode="simple"] .complex-feature {
  display: none;
}

[data-mode="expert"] .debug-panel {
  display: block;
}

/* Mode colors available as CSS variables */
.mode-indicator {
  background-color: var(--mode-color);
}
```

## Best Practices

1. **Progressive Enhancement**: Start with Simple mode and add features for Advanced/Expert
2. **Consistent UX**: Use ModeGuard to conditionally show features rather than breaking layouts
3. **User Guidance**: Provide clear descriptions of what each mode offers
4. **Performance**: Use mode conditions to avoid rendering heavy components in Simple mode
5. **Testing**: Test all modes to ensure functionality works across all levels
6. **Analytics**: Monitor which modes users prefer to inform future feature decisions

## Error Handling

The mode system includes comprehensive error handling:

- Graceful fallback to Simple mode if stored preferences are corrupted
- Console warnings for invalid mode transitions
- Automatic recovery from localStorage issues
- TypeScript types prevent invalid mode usage

## Browser Support

- All modern browsers (Chrome, Firefox, Safari, Edge)
- Internet Explorer 11+ (with polyfills)
- Mobile browsers (iOS Safari, Chrome Mobile)
- Requires JavaScript enabled for full functionality

## Performance

- Lightweight: < 10KB gzipped
- Efficient re-renders using React context optimization
- localStorage operations are debounced
- Smooth animations using Framer Motion
- Tree-shakable exports