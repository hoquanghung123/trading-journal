# Design System: Trading Journal TMA (Obsidian Ledger)

## 1. Visual Theme & Atmosphere
The design system operates on the **Obsidian Ledger** aesthetic. It is a high-density, dark, and tactical trading workspace. The interfaces are clinical, high-contrast, and hyper-focused, inspired by premium terminal interfaces and hardware ledger designs. 
It uses sharp, geometric edges (0px to 2px border radius) to convey speed and technical precision, avoiding soft/friendly rounded curves. 

## 2. Color Palette & Roles
- **Obsidian Canvas** (#0A0A0C) — Absolute dark background canvas.
- **Coal Surface** (#111115) — Surface containers, cards, and interactive elements.
- **Asphalt Hover** (#1A1A22) — Subtle active/hover state background.
- **Zinc Primary** (#F4F4F5) — High contrast text, titles, and active icons.
- **Zinc Muted** (#71717A) — Secondary text, metadata, labels, and inactive states.
- **Steel Border** (#222226) — Hairline 1px borders, separators, and structural dividers.
- **Bullish Green** (#22C55E) — Accent color for Bullish bias, successful save states, and streak indicators.
- **Bearish Red** (#EF4444) — Accent color for Bearish bias and error indicators.
- **Consolidation Orange** (#F59E0B) — Accent color for Consolidation bias.

## 3. Typography Rules
- **Display & Headlines:** Geist (Sans-Serif) — Set with tight tracking (-0.02em), bold weights, and high-contrast styling. Used for headers and primary controls.
- **Body & Controls:** Geist — Clean, legible, and optimized for small viewports. Font size minimum 14px.
- **Monospace (Data & Metrics):** Geist Mono — Mandatory for all timeframes, streak counts, timestamps, chart links, and values to maintain alignment and terminal feel.
- **Banned Typography:** Inter is strictly banned. Serif fonts are strictly banned.

## 4. Component Stylings
- **Buttons / Bias Selectors:** Flat, sharp rectangles (2px border radius). High contrast on hover, interactive tactile state (-1px Y-axis translate on click). Custom color schemes for bias states (Green/Red/Orange).
- **Cards (Bias Expect):** Flat panels with a `#111115` background and 1px `#222226` border. Border radius is sharp (2px). Shadow is a tiny, hard offset shadow rather than soft diffused glow.
- **Streak Fire Badge:** Dynamic header element. The numerical streak count is wrapped in a high-contrast container with a subtle CSS-animated red/orange gradient pulse to evoke a flame without resorting to flat emojis.
- **Chart Lightbox Modal:** Full-screen overlay in `#0A0A0CCB` backdrop blur (12px). The active image container has sharp borders, zero padding, and responsive sizing.
- **Auto-Save Indicators:** A 12px checkmark icon at the top corner of active cards. It transitions from muted gray to a bright `#22C55E` when a selection is auto-saved.

## 5. Layout Principles
- **Mobile-First Portrait:** Fixed width container max-width 480px centered. Designed exclusively for mobile vertical viewport (`min-h-[100dvh]`).
- **Asymmetric Header:** Left side displays user info and logo; right side houses the high-priority Streak Fire Badge and User Avatar.
- **Stacked Swipe Deck:** Active timeframe cards (Daily, Weekly, Monthly, Yearly) stacked as offset deck layout with interactive touch swipe triggers.
- **No Overlapping Elements:** Spacings are strictly defined (8px increments) for dense, professional alignment.

## 6. Motion & Interaction
- **Spring Physics Swipes:** Card transitions utilize snappy spring physics (`stiffness: 140, damping: 20`) for satisfying tactile swipes.
- **Streak Pulse:** The Fire badge has a loop animation using subtle keyframe pulse (`scale: 1.02`, `opacity: 0.95` to `scale: 1`, `opacity: 1`) to feel alive.
- **Hardware-Accelerated:** All active transitions use GPU properties (`transform`, `opacity`) for 60fps performance inside Telegram's browser webview.

## 7. Anti-Patterns (Banned)
- No rounded corners greater than 2px.
- No soft, friendly circular avatars or cards.
- No Fintech Blue or Aurora gradients.
- No emojis (except the user-requested 🔥 for the streak badge, which should be stylized or accompanied by clean SVGs).
- No fake mockup numbers or placeholder text.
