# Monitoring Dashboard

A beautiful, embeddable monitoring dashboard built with Next.js 14, TypeScript, and Tailwind CSS. Features real-time metrics, customizable branding, and iframe embedding support.

## ✨ Features

- **Real-time Monitoring**: Live metrics, events, and alerts
- **Beautiful UI**: Modern design with glassmorphism effects and Framer Motion animations
- **Embeddable**: iframe-ready with customizable dimensions and branding
- **White-label Ready**: Complete theming and branding customization
- **Multi-source Support**: Connect to multiple data sources and APIs
- **API Key Management**: Secure access control with granular permissions
- **Responsive Design**: Works perfectly on desktop, tablet, and mobile
- **Performance Optimized**: Built for speed with Next.js 14 and optimizations

## 🚀 Quick Start

### Installation

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local

# Start development server
npm run dev
```

### Environment Variables

```env
# API Configuration
NEXT_PUBLIC_MONITORING_API_URL=http://localhost:3000/api
NEXT_PUBLIC_MONITORING_API_KEY=your-api-key-here

# Brand Configuration
NEXT_PUBLIC_BRAND_NAME=Monitoring Dashboard
NEXT_PUBLIC_BRAND_LOGO_URL=/logo.png
NEXT_PUBLIC_PRIMARY_COLOR=#3b82f6
NEXT_PUBLIC_SECONDARY_COLOR=#06b6d4
NEXT_PUBLIC_ACCENT_COLOR=#8b5cf6

# Features
NEXT_PUBLIC_ENABLE_REALTIME=true
NEXT_PUBLIC_ENABLE_EXPORT=true
NEXT_PUBLIC_ENABLE_ALERTS=true
```

## 📖 Usage

### Basic Dashboard

Visit `http://localhost:3000` to see the full dashboard with:
- System health metrics
- Real-time event stream
- Active alerts panel
- Filtering and search capabilities
- Export functionality

### Embedded Dashboard

Use the embed endpoint at `http://localhost:3000/embed` with customization parameters:

```html
<iframe 
  src="http://localhost:3000/embed?compact=true&showHeader=false&primaryColor=#ff6b6b"
  width="800" 
  height="600"
  frameborder="0">
</iframe>
```

#### Embed Parameters

| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| `compact` | boolean | Compact layout with fewer metrics | `false` |
| `showHeader` | boolean | Show header with logo and title | `true` |
| `showFilters` | boolean | Show event filters | `true` |
| `showExport` | boolean | Show export button | `false` |
| `autoRefresh` | boolean | Enable auto-refresh | `true` |
| `maxEvents` | number | Maximum events to display | `10` |
| `apiUrl` | string | Override API endpoint | - |
| `apiKey` | string | API key for authentication | - |
| `brandName` | string | Custom brand name | - |
| `logoUrl` | string | Custom logo URL | - |
| `primaryColor` | string | Primary theme color | `#3b82f6` |
| `secondaryColor` | string | Secondary theme color | `#06b6d4` |
| `accentColor` | string | Accent theme color | `#8b5cf6` |

### API Integration

The dashboard connects to monitoring APIs using the following endpoints:

- `GET /api/monitor/realtime` - System metrics and health
- `GET /api/monitor/alerts` - Active alerts
- `GET /api/monitor/events` - Event logs with filtering
- `GET /api/monitor/oauth/status` - OAuth provider status

#### Data Format

**Metrics Response:**
```json
{
  "systemHealth": "healthy",
  "activeUsers": 150,
  "apiLatency": 85,
  "errorRate": 0.2,
  "lastUpdated": "2024-01-01T12:00:00Z",
  "system": {
    "cpuUsage": "45%",
    "memoryUsage": "62%"
  },
  "recentEvents": [...],
  "oauth": {
    "google": "operational",
    "github": "operational"
  }
}
```

**Event Format:**
```json
{
  "id": "evt_123",
  "timestamp": "2024-01-01T12:00:00Z",
  "category": "api",
  "type": "request",
  "title": "API Request Completed",
  "description": "GET /api/users completed successfully",
  "severity": "info",
  "metadata": {
    "userId": "user_456",
    "duration": 120
  }
}
```

## 🎨 Customization

### White-label Branding

The dashboard supports complete white-labeling:

1. **Logo**: Upload custom logo or provide URL
2. **Colors**: Customize primary, secondary, and accent colors
3. **Typography**: Choose from Google Fonts
4. **Custom CSS**: Add your own styles

### Theme Configuration

```typescript
const brandConfig: BrandConfig = {
  name: "Your Company",
  logo: {
    url: "/your-logo.png",
    width: 120,
    height: 40
  },
  colors: {
    primary: "#your-color",
    secondary: "#your-color",
    accent: "#your-color"
  },
  fonts: {
    heading: "Your Font, sans-serif",
    body: "Your Font, sans-serif"
  }
};
```

### Multi-source Configuration

Connect to multiple monitoring sources:

```typescript
const dataSources: DataSourceConfig[] = [
  {
    id: "primary",
    name: "Main API",
    type: "crowdtrainer",
    endpoint: "https://api.yourapp.com",
    apiKey: "your-key",
    priority: 1,
    enabled: true
  },
  {
    id: "secondary",
    name: "External Service",
    type: "external",
    endpoint: "https://external-api.com",
    apiKey: "external-key",
    priority: 2,
    enabled: true
  }
];
```

## 🛡️ Security

### API Key Management

The dashboard includes a complete API key management system:

- Create keys with granular permissions
- Set expiration dates
- Track usage and last access
- Revoke keys instantly
- Test connection functionality

### Permissions

Available permission scopes:
- `read:metrics` - View system metrics
- `read:events` - View event logs  
- `read:alerts` - View alerts
- `write:alerts` - Manage alerts
- `admin` - Full access

### CORS Configuration

For embedded usage, configure CORS headers:

```javascript
// next.config.js
async headers() {
  return [
    {
      source: '/embed/:path*',
      headers: [
        {
          key: 'X-Frame-Options',
          value: 'SAMEORIGIN'
        },
        {
          key: 'Content-Security-Policy',
          value: "frame-ancestors 'self' https://*.yourdomain.com"
        }
      ]
    }
  ];
}
```

## 📦 Deployment

### Production Build

```bash
# Build for production
npm run build

# Start production server
npm start
```

### Docker Deployment

```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
```

### Environment-specific Configuration

Create environment-specific `.env` files:
- `.env.local` - Development
- `.env.staging` - Staging
- `.env.production` - Production

## 🔧 Development

### Project Structure

```
/
├── app/                 # Next.js app directory
│   ├── page.tsx        # Main dashboard
│   ├── embed/          # Embeddable version
│   └── layout.tsx      # Root layout
├── components/         # Reusable components
│   ├── ui/            # Base UI components
│   ├── monitoring/    # Monitoring-specific components
│   ├── auth/          # Authentication components
│   └── theme/         # Theming components
├── lib/               # Utilities and clients
│   ├── api-client.ts  # API client
│   ├── config.ts      # Configuration management
│   └── utils.ts       # Helper utilities
├── types/             # TypeScript definitions
└── public/            # Static assets
```

### Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production  
npm run start        # Start production server
npm run lint         # Run ESLint
npm run type-check   # Run TypeScript checking
```

### Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🆘 Support

For questions and support:
- Create an issue in the repository
- Check the documentation
- Review the example configurations

---

Built with ❤️ using Next.js, TypeScript, and Tailwind CSS.