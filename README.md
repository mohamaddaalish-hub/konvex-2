# Konvex — Coming Soon

Premium, minimalist coming-soon landing page for the Konvex brand.
Static HTML/CSS/JS — **no frameworks, no build step, no external dependencies**.

## Structure

```
index.html                    ← default homepage (root)
assets/css/style.css          ← all styling
assets/js/particles.js        ← interactive particle field (canvas)
assets/img/konvex-logo.jpg    ← official Konvex logo (unmodified copy)
photo_2026-09-08_23-21-38.jpg ← original supplied logo (kept as-is)
```

Open `index.html` directly in a browser, or serve the folder with any static
server (e.g. `npx serve .`). It is already the root homepage.

## Placeholders to replace

In `index.html`, the contact section:

| Placeholder | Where |
|---|---|
| `[PHONE_NUMBER]` | link text **and** the `href="tel:..."` attribute |
| `[BUSINESS_ADDRESS]` | `<address>` element |

## Design notes

- **Logo:** the supplied logo is a JPG on a solid black background. It is used
  exactly as provided — never cropped, redrawn or recoloured. It is displayed
  with `mix-blend-mode: screen`, which makes the black background disappear
  seamlessly into the page while the white wordmark and green checkmark stay
  untouched. Its natural padding is compensated for with negative margins so the
  wordmark sits tightly centred (see `--logo-*` variables in the CSS, derived
  from the measured 959 × 934 asset).
- **Palette:** deep charcoal `#0e1113`, off-white `#f2f5f4`, and Konvex green
  `#67a542` sampled directly from the logo.
- **Particles:** layered depth (size / opacity / speed / parallax), inertial
  easing, pointer repulsion on desktop, touch + scroll response on mobile,
  single `requestAnimationFrame` loop, pauses when the tab is hidden, and fully
  disabled under `prefers-reduced-motion`.
- **SEO:** page title, description, Open Graph / Twitter cards, favicon and
  `lang` attributes are set up in `index.html`.
