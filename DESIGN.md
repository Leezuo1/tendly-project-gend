---
name: Tendly
description: Shared REM typography, warm paper, charcoal and coral across the landing and product.
colors:
  paper: "#faf8f5"
  white: "#fffefa"
  sand: "#f0ebe3"
  line: "#e3ddd5"
  ink: "#252722"
  muted: "#4a4d45"
  coral: "#bc4532"
  peach: "#f8e4dc"
  green: "#45614c"
  sidebar: "#2c3029"
typography:
  display:
    fontFamily: "REM, sans-serif"
    fontSize: "clamp(44px,6.2vw,104px)"
    fontWeight: 650
    lineHeight: 1.18
    letterSpacing: "-0.015em"
  headline:
    fontFamily: "REM, sans-serif"
    fontWeight: 650
    lineHeight: 1.4
    letterSpacing: "-0.01em"
  body:
    fontFamily: "REM, sans-serif"
    fontSize: "14px"
    lineHeight: 1.6
rounded:
  control: "5px"
  action: "7px"
  card: "8px"
---

# Tendly design system

## Shared foundations

`app/globals.css` is the source of truth for the palette and radius variables. The public landing,
authentication, pricing, onboarding, dashboard, inbox, marketing, livestream, settings, AI configuration,
Smart Sourcing and customer previews inherit these foundations. Screen layouts and data behavior remain
specific to their jobs; product screens keep their compact type scale instead of landing-sized headings.

`app/layout.tsx` loads the existing local variable REM font once through `next/font/local` and exposes
`--font-tendly`. Retain `public/landing/fonts/REM-OFL.txt` with the font. Use the shared family for headings,
body, forms and buttons. Vietnamese body and FAQ questions use normal tracking; large headings use
-0.01em to -0.015em tracking and enough line height for accents. Numbers such as chapter times can keep
tighter tracking. The exact slogan is `Your AI teammate for every customer`.

The canvas is warm paper, content surfaces are off-white, and secondary surfaces use sand. Charcoal
carries primary text; dark green communicates approval and focus; coral identifies primary actions.
Keep platform and warning/error colors where they carry meaning. The supplied `/tendly-logo.png` stays
transparent, with no white badge or padding added around the wordmark.

The landing aliases its `--paper` to the global canvas and its `--white` to the global surface.
Do not restore independent copies of the palette inside each route root. The mini livestream's dark
mode keeps its own legible semantic colors. Its picture-in-picture document copies the root font class
along with styles so that local REM works in that separate document too.

## Public landing

The current direction is a fashion lookbook: bold editorial type, product photography and interface
fragments showing the shop's review step. The persisted direction and subject notes live in
`.taste-skill/direction.json` and `.taste-skill/notes.md`; this refinement keeps that composition.

`LandingPage.tsx` owns the content, `SizeDesk.tsx` the local size example, `DayStory.tsx` the daily work
scenes, and `LandingMotion.tsx` the reveal/progress behavior. Local demonstrations do not prove live
provider delivery. Preserve their validation, labels and review states.

The FAQ uses alternating flat bands with all answers visible. Its coral heading band is content-sized,
with 28-56px vertical padding and a 36-64px heading; it has no viewport-height minimum. Questions use
1.4 line height and normal tracking, answers 1.7 line height. At 760px and below, question and answer
stack. Preserve this compact heading rather than restoring the former 30-40svh banner.

## Shared navigation and controls

Pricing navigation and footer point to the landing's current anchors: `#san-pham`, `#cach-hoat-dong`
and `#hoi-dap`. Account entry goes to `/dang-nhap`; prices and plan selection behavior are unchanged.
On phones the public navigation wraps below the logo and account action, keeping links reachable.

Use shared action and card radius tokens. Pricing cards have flat surfaces with a coral border for
the existing featured plan. Auth primary actions use the same coral and darker hover color. Keep
visible keyboard focus, input labels, error states, disabled states and the supplied logo.

## Validation boundaries

Verify desktop, tablet and phone layouts, navigation after route transitions, Vietnamese wrapping,
auth form validation and reduced-motion visibility. Mocked browser sessions and API responses validate
UI behavior only; they do not validate Meta/Shopee delivery or production deployment.
