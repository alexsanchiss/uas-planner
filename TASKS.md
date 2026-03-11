# TASKS.md — UAS Planner v2.2.2

> v2.2.1 tasks (1–15) all completed. Below are the new tasks for v2.2.2.

---

## Task 16: Transparent Header & Footer on /launch + z-index fix
- **Priority**: High
- **Files**: `app/components/header.tsx`, `app/components/footer.tsx`, `app/layout.tsx`
- **Description**: On `/launch`, the shader background is behind the header/footer but they have solid `bg-[var(--surface-primary)]` backgrounds. Additionally, the shader overlay div (`z-[1]`) covers the footer making it unclickable. Fix:
  1. Header: Accept an optional `transparent` boolean prop. When true, replace solid bg with `bg-transparent backdrop-blur-md` and keep `relative z-[100]` to stay above shader overlay.
  2. Footer: Same transparent treatment. The footer must have `relative z-[100]` so it sits above the fixed shader and overlay layers.
  3. Layout: Detect `/launch` route via `usePathname()` and pass `transparent` to Header/Footer.
  4. Ensure all interactive elements (links, buttons, dropdowns) remain fully clickable.
- **Acceptance**: On `/launch`, header and footer show the animated shader behind them with blur. All links and buttons are clickable.

## Task 17: Professional header & footer styling
- **Priority**: Medium
- **Files**: `app/components/header.tsx`, `app/components/footer.tsx`
- **Description**: Modernize the visual style to match the epic landing aesthetic:
  - **Header**: Replace the current bordered box nav buttons with sleek pill-shaped items using `rounded-full` and subtle gradient/glow on active state. Use `text-white` in transparent mode. Smooth hover transitions. Remove visible borders, use subtle `border-white/10` in transparent mode.
  - **Footer**: Cleaner grid with more spacing. Subtle hover underline animations on links. Use `text-white/70` for secondary text in transparent mode. More elegant typography for section titles.
  - Both: In non-transparent mode (regular app pages), keep current theme-variable colors but with refined spacing and hover effects.
- **Acceptance**: Header and footer look modern and elegant on both `/launch` (transparent) and regular pages. 

## Task 18: Install deps & create UI components (ContainerScroll, EvervaultCard, Carousel, Gallery4)
- **Priority**: High (do first)
- **Files**: Multiple new files in `app/components/ui/`
- **Description**:
  1. Install npm deps: `embla-carousel-react @radix-ui/react-slot` (framer-motion, clsx, class-variance-authority, tailwind-merge, lucide-react already present).
  2. Create `app/components/ui/container-scroll-animation.tsx` with the ContainerScroll component (framer-motion based perspective scroll card). Adapt imports to use `@/lib/utils`.
  3. Create `app/components/ui/evervault-card.tsx` with the EvervaultCard + CardPattern + generateRandomString + Icon components. Adapt imports.
  4. Create `app/components/ui/carousel.tsx` with the full Carousel system (Carousel, CarouselContent, CarouselItem, CarouselPrevious, CarouselNext) using embla-carousel-react. Use existing `app/components/ui/button.tsx` Button (add `variant` support if needed) or adapt the Button import.
  5. Create `app/components/ui/gallery4.tsx` with the Gallery4 carousel component. Adapt to use local Button and Carousel components. Use existing Unsplash image URLs for default data.
  6. NOTE: The existing Button component at `app/components/ui/button.tsx` only has `default` and `outline` variants. The Gallery4 + Carousel components need `ghost` and `icon` size. Either extend the existing Button or create a shadcn-style Button alongside. Prefer extending the existing one to avoid breaking other usages.
- **Acceptance**: All 4 new UI components created. `npm run build` passes.

## Task 19: Full landing page rewrite with epic scroll sections
- **Priority**: High
- **Files**: `app/page.tsx`, `app/layout.tsx`, `app/globals.css`
- **Description**: Transform the landing page from a single-viewport splash into a scrollable marketing page:
  1. **Hero section** (first viewport): Keep existing shader backdrop + AETHON title + tagline + brief description + InteractiveHoverButton CTA. The shader should only cover this first section (or the full page as a subtle fixed bg).
  2. **"How It Works" section** using ContainerScroll: Title "Experience the Future of Drone Operations" or similar. The 3D card shows a placeholder screenshot (use a stock image from Unsplash with drone/dashboard theme). Professional copy about the 3-step workflow.
  3. **Features section** using EvervaultCard: Three interactive cards for "Plan Definition", "Plan Authorization", "Plan Activation" with lucide-react icons (Map, Shield, Rocket or similar). Short professional descriptions. Dark bg section.
  4. **Gallery/Showcase section** using Gallery4: Title "Platform Capabilities" or "See It In Action". 4-5 items with drone/aviation Unsplash stock images and professional copy about features.
  5. **Final CTA section**: "Ready to Take Flight?" with InteractiveHoverButton linking to `/launch`.
  6. **Footer**: Show footer at the bottom of the landing page (update layout.tsx to not hide footer on `/`).
  7. Layout change: `app/layout.tsx` — Change `isSplash` logic: still hide header on `/` but show footer. Or better: show neither header nor footer on `/` since the landing has its own structure, and a final CTA replaces the need for footer nav.
  8. Smooth scroll: Add `scroll-behavior: smooth` to html in globals.css.
  9. All text: professional, punchy, aviation/drone-industry tone. No lorem ipsum.
- **Acceptance**: Scrollable landing page with 5 distinct sections. All animations working. Build passes. Dark theme consistent.
