# SolidStart 2.0 DeVinxi Migration Checklist

**Status**: Preparing for migration  
**Target Version**: SolidStart 2.0-alpha (devinxi-separate-nitro)  
**Current Version**: 1.2.0  
**Last Updated**: 2025-10-05

## 🎯 Overview

This checklist guides the migration from SolidStart 1.x (Vinxi-based) to 2.0 (pure Vite-based). The DeVinxi initiative removes Vinxi and uses Nitro separately with direct Vite integration.

## 📋 Pre-Migration Checklist

### 1. Preparation Phase

- [ ] **Backup current working state**
  - [ ] Create git branch: `git checkout -b backup/pre-devinxi-migration`
  - [ ] Commit all changes: `git commit -am "chore: backup before SolidStart 2.0 migration"`
  - [ ] Tag current version: `git tag v0.15.3-pre-devinxi`
  - [ ] Push backup: `git push origin backup/pre-devinxi-migration --tags`

- [ ] **Document current configuration**
  - [ ] Export current `package.json` dependencies
  - [ ] Backup `app.config.ts` configuration
  - [ ] Backup `vite.config.ts` configuration
  - [ ] Document custom Vinxi patches: `patches/vinxi+0.5.8.patch`
  - [ ] List all build scripts in use

- [ ] **Verify test coverage**
  - [ ] Run full test suite: `npm run e2e`
  - [ ] Document baseline test results
  - [ ] Ensure all critical paths are covered
  - [ ] Run smoke tests: `npm run e2e:smoke`

- [ ] **Check SolidStart 2.0 release status**
  - [ ] Monitor: https://github.com/solidjs/solid-start/tree/devinxi-separate-nitro
  - [ ] Read official migration guide (when available)
  - [ ] Check breaking changes in CHANGELOG
  - [ ] Review community migration experiences

### 2. Environment Setup

- [ ] **Create migration branch**
  ```bash
  git checkout -b feature/solidstart-2.0-migration
  ```

- [ ] **Install SolidStart 2.0-alpha**
  ```bash
  npm install @solidjs/start@next @solidjs/router@next
  ```

- [ ] **Update related dependencies**
  - [ ] `solid-js` to compatible version (likely 2.x)
  - [ ] `@solidjs/meta` to compatible version
  - [ ] `vite` to required version
  - [ ] Remove `vinxi` if no longer needed

## 🔧 Migration Tasks

### 3. Build System Migration

#### 3.1 Package Scripts

**Current (`package.json`):**
```json
"dev": "vinxi dev",
"build": "vinxi build",
```

- [ ] **Update build scripts**
  - [ ] Replace `vinxi dev` with new dev command
  - [ ] Replace `vinxi build` with new build command
  - [ ] Update `dev:e2e` script (line 29)
  - [ ] Update debug scripts that reference vinxi (line 28)
  - [ ] Test: `npm run dev` works
  - [ ] Test: `npm run build` works

#### 3.2 Configuration Files

**File: `app.config.ts`**

- [ ] **Update import statements**
  ```typescript
  // OLD:
  import { defineConfig, SolidStartInlineConfig } from '@solidjs/start/config'
  
  // NEW: (check actual API in 2.0)
  import { defineConfig } from '@solidjs/start/config'
  ```

- [ ] **Migrate Nitro configuration** (lines 36-40)
  - [ ] Review new Nitro integration approach
  - [ ] Update `nitro.timing` option
  - [ ] Update `nitro.minify` option
  - [ ] Update `nitro.sourceMap` option
  - [ ] Verify Nitro options still valid

- [ ] **Update server preset configuration** (lines 64-73)
  - [ ] Verify `preset: 'netlify'` still works
  - [ ] Verify `preset: 'vercel'` still works
  - [ ] Verify `preset: 'node'` still works
  - [ ] Test HTTPS configuration with new system

- [ ] **Review experimental options** (lines 76-84)
  - [ ] Check if `experimental.streaming` is still valid
  - [ ] Check if `experimental.islands` is still valid
  - [ ] Check if `experimental.hydration` is still valid
  - [ ] Update router configuration if needed

- [ ] **Test route rules** (lines 42-57)
  - [ ] Verify `/api/og/**` rules work
  - [ ] Verify `/api/thumb/**` rules work
  - [ ] Test cache headers are applied correctly

**File: `vite.config.ts`**

- [ ] **Review Vite configuration compatibility**
  - [ ] Verify CSS transformer settings (line 40)
  - [ ] Verify Lightning CSS configuration (lines 41-57)
  - [ ] Verify SCSS preprocessor options (lines 63-75)
  - [ ] Test CSS modules generation

- [ ] **Update SSR configuration** (lines 143-149)
  - [ ] Verify `ssr.noExternal` packages
  - [ ] Check if new packages need to be added
  - [ ] Test SSR build works correctly

- [ ] **Review build optimizations** (lines 91-142)
  - [ ] Verify chunk splitting strategy (lines 113-139)
  - [ ] Test bundle sizes are acceptable
  - [ ] Verify terser options still work

#### 3.3 Type Definitions

**File: `src/global.d.ts`**

- [ ] **Remove Vinxi types** (line 2)
  ```typescript
  // REMOVE:
  /// <reference types="vinxi/client" />
  
  // ADD (if needed):
  /// <reference types="vite/client" />
  ```

- [ ] **Add new type references**
  - [ ] Check if new SolidStart types needed
  - [ ] Verify `@solidjs/start/env` still valid (line 1)
  - [ ] Test TypeScript compilation: `npm run typecheck`

#### 3.4 Remove Vinxi Patches

- [ ] **Delete Vinxi patch file**
  ```bash
  rm patches/vinxi+0.5.8.patch
  ```

- [ ] **Update package.json patches section**
  - [ ] Remove vinxi from patches (if specified)
  - [ ] Clean up postinstall scripts if they reference vinxi

### 4. Code Migration

#### 4.1 Entry Points

**File: `src/entry-server.tsx`**

- [ ] **Verify server imports** (line 2)
  ```typescript
  import { createHandler, StartServer } from '@solidjs/start/server'
  ```
  - [ ] Test SSR rendering works
  - [ ] Verify error boundaries work
  - [ ] Test document structure renders correctly

**File: `src/entry-client.tsx`**

- [ ] **Verify client imports** (line 2)
  ```typescript
  import { mount, StartClient } from '@solidjs/start/client'
  ```
  - [ ] Test client-side hydration
  - [ ] Verify mount function works
  - [ ] Test HMR (Hot Module Replacement)

#### 4.2 Router Integration

**File: `src/app.tsx`**

- [ ] **Verify router imports** (line 3)
  ```typescript
  import { FileRoutes } from '@solidjs/start/router'
  ```
  - [ ] Test file-based routing works
  - [ ] Verify dynamic routes work
  - [ ] Test route parameters

**Files: Route definitions**

- [ ] **Test route.load functions** (SSR data loading)
  - [ ] Verify `src/routes/(main).tsx` loads correctly
  - [ ] Test `createCacheableLoader` still works
  - [ ] Verify SSR data is passed to components
  - [ ] Test client-side navigation

#### 4.3 API Routes

- [ ] **Test API routes functionality**
  - [ ] Verify `/api/og/**` routes work
  - [ ] Verify `/api/thumb/**` routes work
  - [ ] Test API error handling
  - [ ] Verify response headers

### 5. Custom Server Script

**File: `scripts/server.mjs`**

- [ ] **Review custom server compatibility**
  - [ ] Check if server script needs updates
  - [ ] Verify HTTPS setup still works (line 7)
  - [ ] Test production server starts correctly
  - [ ] Verify environment variable handling

### 6. Testing Phase

#### 6.1 Development Testing

- [ ] **Test development server**
  ```bash
  npm run dev
  ```
  - [ ] Server starts without errors
  - [ ] HMR works correctly
  - [ ] CSS hot reload works
  - [ ] TypeScript compilation works
  - [ ] No console errors in browser

#### 6.2 Build Testing

- [ ] **Test production build**
  ```bash
  npm run build
  ```
  - [ ] Build completes without errors
  - [ ] No TypeScript errors
  - [ ] Bundle sizes are acceptable
  - [ ] Source maps generated correctly
  - [ ] Assets copied correctly

- [ ] **Test production server**
  ```bash
  npm run start
  ```
  - [ ] Server starts correctly
  - [ ] SSR works properly
  - [ ] Static assets load
  - [ ] API routes work

#### 6.3 E2E Testing

- [ ] **Run full E2E test suite**
  ```bash
  npm run e2e:clean && npm run e2e
  ```
  - [ ] All tests pass
  - [ ] No hydration mismatches
  - [ ] No regression in functionality
  - [ ] Performance is acceptable

- [ ] **Run smoke tests**
  ```bash
  npm run e2e:smoke
  ```
  - [ ] Critical paths work
  - [ ] Authentication works
  - [ ] Navigation works

- [ ] **Run auth tests**
  ```bash
  npm run e2e:auth
  ```
  - [ ] Login/logout works
  - [ ] Protected routes work
  - [ ] Session management works

#### 6.4 Hydration Testing

- [ ] **Test hydration specifically**
  ```bash
  npm run e2e:hydration
  ```
  - [ ] No hydration mismatches
  - [ ] Client state matches server state
  - [ ] No console warnings

### 7. Deployment Testing

#### 7.1 Netlify Deployment

- [ ] **Test Netlify build**
  ```bash
  npm run build:netlify
  ```
  - [ ] Build succeeds
  - [ ] GraphQL codegen runs
  - [ ] Deploy to staging
  - [ ] Test staging site

#### 7.2 Vercel Deployment

- [ ] **Test Vercel preset**
  - [ ] Update `app.config.ts` preset to 'vercel'
  - [ ] Build locally
  - [ ] Deploy to Vercel preview
  - [ ] Test preview deployment

#### 7.3 Node Server Deployment

- [ ] **Test Node preset**
  - [ ] Update `app.config.ts` preset to 'node'
  - [ ] Build locally
  - [ ] Test custom server script
  - [ ] Verify HTTPS works

### 8. Performance Validation

- [ ] **Measure performance metrics**
  - [ ] Compare bundle sizes (before/after)
  - [ ] Measure build time
  - [ ] Test page load times
  - [ ] Check Lighthouse scores
  - [ ] Verify LCP < 2.5s
  - [ ] Verify FID < 100ms

- [ ] **Optimize if needed**
  - [ ] Review chunk splitting
  - [ ] Optimize imports
  - [ ] Check for duplicate dependencies

### 9. Documentation Updates

- [ ] **Update project documentation**
  - [ ] Update `README.md` with new commands
  - [ ] Update `docs/getting-started/quick-start.md`
  - [ ] Document breaking changes
  - [ ] Update developer setup guide

- [ ] **Update CHANGELOG.md**
  ```markdown
  ## [0.16.0] - 2025-XX-XX
  
  ### Changed
  - Migrated to SolidStart 2.0 (DeVinxi)
  - Replaced Vinxi with pure Vite build system
  - Updated build scripts and configuration
  
  ### Breaking Changes
  - Build commands changed from `vinxi` to new system
  - Configuration API updated in `app.config.ts`
  - Removed Vinxi patches
  ```

### 10. Cleanup

- [ ] **Remove old dependencies**
  ```bash
  npm uninstall vinxi
  npm prune
  ```

- [ ] **Clean build artifacts**
  ```bash
  npm run clean
  rm -rf node_modules/.cache
  ```

- [ ] **Update lock file**
  ```bash
  npm install
  ```

### 11. Final Validation

- [ ] **Complete system test**
  - [ ] Fresh install: `rm -rf node_modules && npm install`
  - [ ] Clean build: `npm run clean && npm run build`
  - [ ] Run all tests: `npm run e2e`
  - [ ] Test in multiple browsers
  - [ ] Test on different devices

- [ ] **Code quality checks**
  ```bash
  npm run fix
  npm run format
  npm run typecheck
  npm run lint
  ```

- [ ] **Security audit**
  ```bash
  npm audit
  ```

### 12. Deployment

- [ ] **Deploy to staging**
  - [ ] Deploy to staging environment
  - [ ] Smoke test staging
  - [ ] Monitor for errors

- [ ] **Deploy to production**
  - [ ] Create release branch
  - [ ] Tag release: `git tag v0.16.0-solidstart-2.0`
  - [ ] Deploy to production
  - [ ] Monitor production metrics
  - [ ] Watch error logs

- [ ] **Post-deployment monitoring**
  - [ ] Monitor error rates
  - [ ] Check performance metrics
  - [ ] Verify all features work
  - [ ] Monitor user feedback

## 🚨 Rollback Plan

If migration fails:

1. **Immediate rollback**
   ```bash
   git checkout backup/pre-devinxi-migration
   npm install
   npm run build
   ```

2. **Redeploy previous version**
   - Deploy from backup branch
   - Verify production is stable
   - Document issues encountered

3. **Post-mortem**
   - Document what went wrong
   - Create issues for blockers
   - Plan retry strategy

## 📊 Success Criteria

Migration is successful when:

- ✅ All E2E tests pass
- ✅ No hydration errors
- ✅ Build time is acceptable (< 2x slower)
- ✅ Bundle size is acceptable (< 10% increase)
- ✅ All deployment targets work (Netlify, Vercel, Node)
- ✅ No regressions in functionality
- ✅ Performance metrics maintained
- ✅ Production deployment stable for 48 hours

## 🔗 Resources

- **SolidStart DeVinxi Branch**: https://github.com/solidjs/solid-start/tree/devinxi-separate-nitro
- **SolidStart Docs**: https://start.solidjs.com
- **Migration Guide**: (TBD - check when 2.0-alpha releases)
- **Community Discord**: https://discord.com/invite/solidjs

## 📝 Notes

- Keep this checklist updated as you progress
- Document any unexpected issues
- Share learnings with the team
- Consider writing a blog post about the migration experience

---

**Migration Status**: ⏳ Waiting for SolidStart 2.0-alpha release  
**Estimated Effort**: 4-8 hours  
**Risk Level**: Medium (feature parity expected in alpha)
