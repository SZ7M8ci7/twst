# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Setup and Installation
```bash
npm install --force  # Force install dependencies (required due to package conflicts)
```

### Development and Build
```bash
npm run dev          # Start development server on port 3000
npm run build        # TypeScript check + production build
npm run preview      # Preview production build locally
npm run lint         # ESLint with auto-fix
```

### Deployment
```bash
npm run deploy       # Deploy to GitHub Pages (Unix)
npm run deploy-github # Deploy to GitHub Pages (Windows)
```

## Architecture Overview

### Technology Stack
- **Vue 3** with TypeScript and Composition API
- **Vuetify 3** for Material Design components
- **Pinia** for state management across components
- **Vue Router** for client-side routing
- **Chart.js + vue-chartjs** for data visualization
- **Vue i18n** for Japanese/English internationalization
- **Vite** for build tooling

### Key Application Structure

#### State Management (Pinia Stores)
- `simulatorStore.ts` - Main deck simulator state with character management and statistics calculation
- `characters.ts` - Character data and filtering logic
- `searchResult.ts` / `searchSetting.ts` - Search functionality state
- `deckStore.ts` - Deck building functionality

#### Core Views Architecture
- `sim.vue` - Main simulator page with responsive carousel for calculation tools
- `calcBASIC.vue`, `calcDEF.vue`, `calcATK.vue` - Exam score calculators with mobile-optimized layouts
- `search.vue`, `search1.vue`, `search2.vue` - Multi-variant search interfaces
- `data.vue` - Character data browser
- `hand.vue` - Hand gacha simulator

#### Component Organization
- `SimChara.vue` - Individual character configuration component
- `SimChart.vue` - Statistics visualization with Chart.js
- `SimStats.vue` - Real-time statistics display
- `DoughnutGraph.vue` - Reusable chart component for score calculators
- Modal components (`*Modal.vue`) for overlay interfaces

### Data Flow Patterns

#### Character Management
Characters are managed through the `simulatorStore` with:
- Reactive character arrays with computed statistics
- Debounced calculations for performance optimization
- State persistence to localStorage
- Cache management for expensive calculations

#### Responsive Design Strategy
The application uses Vuetify's breakpoint system:
- Mobile-first approach with `cols="12"` default
- Breakpoint-specific layouts: `sm`, `md` variants
- Carousel navigation for tools on mobile vs. sidebar on desktop
- Custom CSS with `:deep()` selectors to override Vuetify defaults

#### Internationalization Pattern
All messages must be translated.
Translation keys are organized by feature domain:
```javascript
// Access pattern
{{ $t('basic.difficulty') }}    // Exam calculator translations
{{ $t('tool.deckSimulator') }}  // Tool name translations
```

### Mobile Optimization Approach

#### Layout Adjustments
- Responsive column breakpoints: `cols="4" sm="3"` for labels, `cols="8" sm="9"` for inputs
- Compact field styling with minimal padding
- Horizontal scroll tables with wrapper divs
- Custom CSS overrides for Vuetify 3 field spacing

#### Input Optimizations
- Dropdowns replace radio button groups on mobile
- Reduced font sizes and padding on small screens
- Touch-friendly button sizing and spacing

### Data Integration
- Character data sourced from external repositories via GitHub Actions
- Static JSON assets in `/src/assets/` for character information
- Image assets organized by character and costume variant
- Periodic data synchronization from simulator and room repositories

### Performance Considerations
- Debounced calculations in simulator store (300ms delay)
- Memoized computed properties for expensive operations
- Cache management with manual clearing utilities
- Lazy loading of character images
- Component-level state isolation to prevent unnecessary re-renders

### Deployment Architecture
- GitHub Actions builds on master branch pushes
- Static site deployment to GitHub Pages
- Production build optimization through Vite
- Asset path configuration for GitHub Pages subdirectory hosting