# PLAN.md — UAS Planner v2.2.2 (Landing & UI Polish)

## TL;DR
Enhance the landing experience with epic scroll animations, Evervault cards, image gallery carousel, transparent header/footer on `/launch`, and professional UI improvements. The landing page (`/`) becomes a full marketing page with scroll sections. The `/launch` page gets a shader background with transparent header/footer.

All v2.2.1 tasks (1–15) are completed. This plan covers new tasks 16–19.

---

## Phase 7: Header / Footer with Shader Background (Tasks 16–17)

### Task 16 — Transparent Header & Footer with shader bg on /launch + z-index fix
**Problem**: On `/launch`, the header/footer have solid backgrounds that clash with the shader. The footer is unclickable because the shader overlay covers it (z-index issue).
**Solution**: 
- Make header/footer transparent with `backdrop-blur` on `/launch` (detect via `usePathname()`).
- Fix z-index: header/footer must be above the shader overlay layer (`z-[1]`). Set header/footer to `relative z-[100]`.
- Ensure all links/buttons in header & footer remain clickable.
**Files**:
- `app/components/header.tsx` — Accept `transparent` prop, apply glass style.
- `app/components/footer.tsx` — Accept `transparent` prop, apply glass style.
- `app/layout.tsx` — Pass transparent prop on `/launch`.

### Task 17 — Professional header & footer styling
**Problem**: Current header/footer look basic and don't match the epic landing aesthetic.
**Solution**:
- **Header**: Sleek pill-shaped nav items, subtle glow on active, glassmorphism look. Better hover effects with smooth transitions.
- **Footer**: Clean modern layout with refined typography, hover animations on links, glassmorphism on transparent mode.
**Files**:
- `app/components/header.tsx`
- `app/components/footer.tsx`

---

## Phase 8: Landing Page Epic Scroll Sections (Tasks 18–19)

### Task 18 — Install dependencies & create base UI components
**Dependencies needed**: `embla-carousel-react`, `@radix-ui/react-slot` (framer-motion already installed).
**Components to create**:
- `app/components/ui/container-scroll-animation.tsx` — 3D perspective scroll card (framer-motion).
- `app/components/ui/evervault-card.tsx` — Interactive hover card with random string effect.
- `app/components/ui/carousel.tsx` — Embla-based carousel (shadcn pattern).
- `app/components/ui/gallery4.tsx` — Image gallery carousel with navigation.
**Files**: All new component files in `app/components/ui/`.

### Task 19 — Full landing page rewrite with epic scroll sections
**Problem**: Current landing (`/`) is a single-screen splash. Needs epic scroll sections with professional copywriting.
**Solution**: Transform `app/page.tsx` into a long scrollable marketing page:
1. **Hero** (viewport 1): Keep shader bg + AETHON title + tagline + CTA button.
2. **ContainerScroll**: "How It Works" — 3D perspective card with app screenshot placeholder.
3. **EvervaultCard section**: Three interactive hover cards for Plan/Authorize/Fly services.
4. **Gallery4 Carousel**: Aviation/drone themed showcase using Unsplash stock images.
5. **Final CTA**: Call to action with InteractiveHoverButton.
- All sections dark-themed, professional copywriting (no lorem ipsum).
- Footer visible at bottom of scrollable page.
**Files**:
- `app/page.tsx` — Complete rewrite.
- `app/layout.tsx` — Show footer on `/` again (landing is now scrollable).
- `app/globals.css` — Smooth scroll, any needed animations.

---

## Dependency Graph
```
Task 18 (deps + components) ← must be first
Task 16 (transparent header/footer) ← no deps, can be parallel with 18
Task 17 (professional styling) ← depends on Task 16
Task 19 (landing page rewrite) ← depends on Task 18
```

## Execution Order
1. Task 18 — Install deps, create all UI components
2. Task 16 — Transparent header/footer on /launch
3. Task 17 — Professional header/footer styling  
4. Task 19 — Full landing page rewrite with all sections
