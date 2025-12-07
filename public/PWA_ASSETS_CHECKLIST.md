# 📱 PWA Assets Checklist

## Required Icons (must be placed in `/public` folder)

### Core Icons
| File | Size | Purpose | Priority |
|------|------|---------|----------|
| `favicon.ico` | 32×32 | Browser tab icon | ⭐ Required |
| `pwa-192x192.png` | 192×192 | Android home screen | ⭐ Required |
| `pwa-512x512.png` | 512×512 | Android splash + store | ⭐ Required |
| `pwa-maskable-512x512.png` | 512×512 | Android adaptive icon | ⭐ Required |
| `apple-touch-icon.png` | 180×180 | iOS home screen | ⭐ Required |

### iOS Splash Screens (Optional but Recommended)
| File | Size | Devices |
|------|------|---------|
| `splash-1290x2796.png` | 1290×2796 | iPhone 15/14 Pro Max |
| `splash-1284x2778.png` | 1284×2778 | iPhone 14 Plus, 13 Pro Max |
| `splash-1170x2532.png` | 1170×2532 | iPhone 14/13/12 |
| `splash-828x1792.png` | 828×1792 | iPhone 11/XR |
| `splash-750x1334.png` | 750×1334 | iPhone SE |
| `splash-2048x2732.png` | 2048×2732 | iPad Pro 12.9" |

### Social Media (Optional)
| File | Size | Purpose |
|------|------|---------|
| `og-image.png` | 1200×630 | Open Graph / Facebook |
| `screenshot-wide.png` | 1280×720 | App store listing (desktop) |
| `screenshot-narrow.png` | 720×1280 | App store listing (mobile) |

---

## 🎨 Icon Guidelines

### Maskable Icon (pwa-maskable-512x512.png)
The maskable icon needs a **safe zone** - keep important content in the center 80%.

```
┌─────────────────────────┐
│ ░░░░░░░░░░░░░░░░░░░░░░ │  ← May be cropped
│ ░░░┌───────────────┐░░░ │
│ ░░░│               │░░░ │
│ ░░░│   SAFE ZONE   │░░░ │  ← Your logo here
│ ░░░│    (80%)      │░░░ │
│ ░░░│               │░░░ │
│ ░░░└───────────────┘░░░ │
│ ░░░░░░░░░░░░░░░░░░░░░░ │  ← May be cropped
└─────────────────────────┘
```

### Color Recommendations
- Background: `#0f172a` (Slate 900 - matches app)
- Primary: `#059669` (Emerald 600)
- Icon: White on emerald, or emerald on dark

---

## 🔧 Quick Icon Generator

Use these tools to generate all sizes automatically:

1. **PWA Asset Generator** (CLI)
   ```bash
   npx pwa-asset-generator logo.png ./public --background "#0f172a" --padding "15%"
   ```

2. **Online Tools**
   - [Favicon.io](https://favicon.io/) - For favicon.ico
   - [RealFaviconGenerator](https://realfavicongenerator.net/) - All platforms
   - [PWA Builder](https://www.pwabuilder.com/imageGenerator) - Full PWA icon set

---

## ✅ Verification

After adding icons, run:
```bash
npm run build
npm run preview
```

Then check Lighthouse in Chrome DevTools:
1. Open DevTools (F12)
2. Go to "Lighthouse" tab
3. Select "Progressive Web App"
4. Click "Analyze page load"

Target: **100% PWA Score** 🎯
