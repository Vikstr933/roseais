# WebContainer Implementation Guide

## 🎯 Goal
Replace server-side deployment with browser-based WebContainer for true instant preview and HMR.

## 📋 Implementation Status

### ✅ Completed
- [x] Installed `@webcontainer/api` package
- [x] Created `WebContainerService.ts` with full API
- [x] Service includes: boot, writeFiles, install, startDevServer, stop

### ⏳ In Progress
- [ ] Update `PromptPlayground.tsx` to use WebContainer
- [ ] Configure cross-origin isolation headers
- [ ] Update preview iframe to use WebContainer URL
- [ ] Add WebContainer status indicators

### 📝 Todo
- [ ] Handle WebContainer errors gracefully
- [ ] Add fallback to server-side for unsupported browsers
- [ ] Implement file watching for live updates
- [ ] Add WebContainer metrics and monitoring

## 🔧 Technical Requirements

### 1. Cross-Origin Isolation Headers

WebContainer requires these headers for SharedArrayBuffer support:

```typescript
// Add to vite.config.ts
export default defineConfig({
  server: {
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
  },
});
```

### 2. Update PromptPlayground.tsx

Replace server-side deployment logic with WebContainer:

```typescript
import { webContainerService } from '../services/WebContainerService';

// In component:
const [webContainerReady, setWebContainerReady] = useState(false);
const [devServerUrl, setDevServerUrl] = useState<string | null>(null);

// Boot WebContainer on mount
useEffect(() => {
  async function bootContainer() {
    try {
      await webContainerService.boot();
      setWebContainerReady(true);
    } catch (error) {
      console.error('Failed to boot WebContainer:', error);
      // Fallback to server-side
    }
  }
  bootContainer();
}, []);

// When AI generates files:
async function deployToWebContainer(files: FileContent[]) {
  try {
    // Write all files
    await webContainerService.writeFiles(files);
    
    // Install dependencies
    await webContainerService.installDependencies((msg) => {
      addChatMessage('system', msg);
    });
    
    // Start dev server
    const url = await webContainerService.startDevServer((msg) => {
      addChatMessage('system', msg);
    });
    
    setDevServerUrl(url);
    setActiveTab('preview');
  } catch (error) {
    console.error('WebContainer deployment failed:', error);
    // Fallback to server-side deployment
  }
}
```

### 3. Update Preview Iframe

```typescript
<iframe
  src={devServerUrl || 'about:blank'}
  sandbox="allow-scripts allow-same-origin"
  className="w-full h-full border-0"
  title="App Preview"
/>
```

## 🚀 Benefits of WebContainer

### Performance
- ✅ **Instant Preview**: No server roundtrip needed
- ✅ **Sub-100ms HMR**: Vite HMR runs locally in browser
- ✅ **No Network Latency**: Everything runs client-side

### User Experience
- ✅ **Offline Capable**: Works without internet after initial load
- ✅ **No Server Costs**: No deployment infrastructure needed
- ✅ **Instant Feedback**: See changes immediately

### Development
- ✅ **Real Dev Server**: Full Vite dev server with all features
- ✅ **True npm**: Install any npm package in browser
- ✅ **Console Access**: Direct access to console.log output

## ⚠️ Limitations & Considerations

### Browser Support
- **Required**: Chrome 89+, Edge 89+, or other Chromium-based
- **Not Supported**: Firefox, Safari (no SharedArrayBuffer)
- **Solution**: Implement fallback to server-side deployment

### Performance Considerations
- **Memory**: Each WebContainer uses ~50-100MB RAM
- **CPU**: npm install can be CPU-intensive
- **Storage**: IndexedDB used for virtual filesystem

### Security
- **Sandboxed**: Runs in secure browser sandbox
- **No File System**: Can't access user's files
- **Network**: Limited network access (can be configured)

## 📊 Comparison: WebContainer vs Server-Side

| Feature | WebContainer | Server-Side | Winner |
|---------|-------------|-------------|--------|
| Preview Speed | <100ms | 2-5s | 🏆 WebContainer |
| npm install | 10-20s | 5-10s | Server |
| HMR Updates | <50ms | 200-500ms | 🏆 WebContainer |
| Browser Support | Chrome only | All browsers | Server |
| Server Costs | $0 | $100+/month | 🏆 WebContainer |
| Offline | ✅ Yes | ❌ No | 🏆 WebContainer |
| Scalability | ♾️ Infinite | Limited | 🏆 WebContainer |

## 🎯 Next Steps

### Immediate (This Week)
1. ✅ Install WebContainer package
2. ✅ Create WebContainerService
3. ⏳ Add cross-origin headers to Vite config
4. ⏳ Update PromptPlayground to use WebContainer
5. ⏳ Test with simple React app generation

### Short Term (Next Week)
6. Implement browser support detection
7. Add graceful fallback to server-side
8. Implement file watching for live edits
9. Add WebContainer status UI
10. Performance optimization

### Medium Term (This Month)
11. Add offline mode support
12. Implement WebContainer caching
13. Add resource usage monitoring
14. Implement WebContainer pooling
15. Add WebContainer metrics to Grafana

## 🐛 Common Issues & Solutions

### Issue 1: SharedArrayBuffer not available
**Error**: `ReferenceError: SharedArrayBuffer is not defined`

**Solution**: Add cross-origin isolation headers:
```typescript
// vite.config.ts
headers: {
  'Cross-Origin-Embedder-Policy': 'require-corp',
  'Cross-Origin-Opener-Policy': 'same-origin',
}
```

### Issue 2: WebContainer boot fails
**Error**: `Failed to boot WebContainer`

**Solution**: Check browser compatibility:
```typescript
if (!WebContainerService.isSupported()) {
  // Fallback to server-side
  console.warn('WebContainer not supported, using server-side deployment');
}
```

### Issue 3: Dev server doesn't start
**Error**: `Dev server failed to start within 30 seconds`

**Solution**: Check package.json has dev script:
```json
{
  "scripts": {
    "dev": "vite"
  }
}
```

### Issue 4: Files not appearing
**Error**: Files written but not visible in dev server

**Solution**: Ensure files are written before starting dev server:
```typescript
await webContainerService.writeFiles(files);
await webContainerService.installDependencies();
await webContainerService.startDevServer(); // Start AFTER files written
```

## 📚 Resources

- **WebContainer Docs**: https://webcontainers.io/
- **API Reference**: https://webcontainers.io/api
- **Browser Support**: https://webcontainers.io/guides/browser-support
- **Examples**: https://github.com/stackblitz/webcontainer-examples
- **Tutorial**: https://webcontainers.io/tutorial/1-build-your-first-webcontainer-app

## 🎉 Expected Outcome

Once implemented, users will experience:

1. **Instant Preview**: App appears in <2 seconds (vs 30-60s server-side)
2. **Live HMR**: Changes appear in <100ms (vs 2-5s roundtrip)
3. **No Server Costs**: Everything runs in browser
4. **Offline Mode**: Works without internet
5. **Bolt.new Experience**: Matches leading AI builders

This is the **#1 priority** according to BuilderDocs Phase 1 requirements.

