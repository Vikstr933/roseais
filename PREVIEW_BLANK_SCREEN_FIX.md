# 🖥️ Preview Blank Screen - FIXED!

## The Problem

You were seeing a **white/blank screen** in the Preview tab even though:
- ✅ Files generated successfully (18-20 files)
- ✅ WebContainer booted correctly
- ✅ Dependencies installed
- ✅ Vite dev server started
- ✅ URL logged: `https://...webcontainer-api.io`

**But the iframe was blank!** 😱

---

## Root Cause

### **Prop Name Mismatch** 🎯

The `AdvancedPreview` component and `PromptPlayground` were using different prop names:

**AdvancedPreview expected:**
```typescript
interface AdvancedPreviewProps {
  previewUrl: string;     // ← Expected this
  files: Array<...>;
  projectName: string;    // ← Expected this
}
```

**But it was receiving:**
```typescript
<AdvancedPreview
  livePreviewUrl={...}    // ❌ Wrong prop name!
  files={...}             // ✅ Correct
  componentName={...}     // ❌ Wrong prop name!
/>
```

**Result:** The iframe's `src` attribute was `undefined`, showing a blank screen!

---

## The Fix

### 1. **Fixed Prop Names** ✅

```typescript
// Before (BROKEN):
<AdvancedPreview
  livePreviewUrl={livePreviewUrl}
  componentName={currentComponentName}
/>

// After (WORKING):
<AdvancedPreview
  previewUrl={livePreviewUrl || ''}
  projectName={currentComponentName}
/>
```

### 2. **Added Loading State** ✅

The iframe now shows a loading spinner while the WebContainer URL is being prepared:

```typescript
{previewUrl ? (
  <iframe src={previewUrl} ... />
) : (
  <div>
    <spinner />
    <p>Preparing Preview...</p>
    <p>Starting development server in WebContainer</p>
  </div>
)}
```

### 3. **Added Debug Logging** ✅

Now logs when the preview URL updates:
```typescript
console.log('🔍 AdvancedPreview URL updated:', previewUrl);
```

---

## What You'll See Now

### **Preview Tab Flow:**

1. **Initial State (No URL):**
   ```
   ⏳ Preparing Preview...
      Starting development server in WebContainer
   ```

2. **WebContainer Starting:**
   ```
   🚀 Deploying to WebContainer...
   📦 Installing npm dependencies...
   🚀 Starting Vite dev server...
   ```

3. **URL Set & Preview Loads:**
   ```
   [IFRAME LOADS WITH YOUR APP] 🎉
   ```

---

## Files Modified

1. **`client/src/pages/PromptPlayground.tsx`**
   - Fixed prop names: `livePreviewUrl` → `previewUrl`
   - Fixed: `componentName` → `projectName`

2. **`client/src/components/AdvancedPreview.tsx`**
   - Added check for empty `previewUrl`
   - Show loading state while URL is being prepared
   - Added debug logging
   - Set initial loading state to `true`

---

## Testing

Try generating again:

```
"Create a simple snake game"
```

**Expected Result:**
1. ✅ Chat shows progress messages
2. ✅ Files appear in Editor tab
3. ✅ Auto-switches to Preview tab
4. ✅ Shows "Preparing Preview..." spinner briefly
5. ✅ **Preview loads with your working app!** 🎮

---

## Why The Blank Screen?

TypeScript prop mismatches like this fail **silently** in runtime:
- Component receives props with wrong names
- Destructuring assigns `undefined` to expected variables
- `<iframe src={undefined}>` shows blank
- No error thrown, just blank screen!

**Lesson:** Always verify prop names match between parent and child components!

---

**Status:** ✅ Preview should now work perfectly - try generating a new app!

