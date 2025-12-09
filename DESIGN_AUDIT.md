# 🎨 Design Audit - Hela Appen

## Översikt
Granskning av appens visuella design, konsistens och användning av design system.

## Identifierade Problem

### 1. **Inkonsistent färganvändning** ⚠️ KRITISKT
- **NewHome**: Använder hårdkodade färger (`bg-slate-950`, `text-white`, `bg-blue-500/10`)
- **Navigation**: Använder hårdkodade färger (`bg-slate-950`, `text-white`, `bg-blue-600`)
- **PromptPlayground**: Använder hårdkodade färger (`bg-slate-950`, `text-white`, `border-white/5`)
- **ProjectCard**: Använder hårdkodade färger (`bg-blue-100`, `text-blue-800`)

**Lösning**: Alla komponenter bör använda design tokens från `design-system.css` och Tailwind config.

### 2. **Design System används inte konsekvent** ⚠️
- Design system finns (`design-system.css`) men används inte överallt
- Många komponenter använder direkt Tailwind-klasser istället för semantiska tokens
- Inkonsistent spacing (vissa använder `panel-padding`, andra `p-4`)

### 3. **Dark mode support** ✅/⚠️
- Dark mode finns i Tailwind config
- Men många komponenter använder hårdkodade färger som inte fungerar i dark mode
- Navigation och NewHome använder mörka färger som inte anpassar sig

### 4. **Typography** ✅
- Design system har bra typography scale
- Men används inte konsekvent överallt

### 5. **Spacing** ⚠️
- Design system har spacing utilities (`panel-padding`, `item-gap`, etc.)
- Men många komponenter använder direkt Tailwind spacing (`p-4`, `gap-4`)

### 6. **Brand Identity** ⚠️
- Brand gradient finns i design system
- Men används inte konsekvent
- Navigation använder `bg-blue-600` istället för brand colors

## Rekommendationer

### Prioritet 1: Färgsystem
1. Ersätt alla hårdkodade färger med design tokens
2. Använd `bg-background`, `text-foreground`, `bg-card`, etc.
3. För brand colors, använd `brand-gradient` och `brand-accent`

### Prioritet 2: Konsistens
1. Använd design system utilities konsekvent
2. Standardisera spacing med `panel-padding`, `item-gap`, etc.
3. Använd typography scale (`text-h1`, `text-body`, etc.)

### Prioritet 3: Dark Mode
1. Se till att alla komponenter fungerar i dark mode
2. Testa alla sidor i dark mode
3. Fixa kontrast-problem

## Nästa Steg
1. Uppdatera Navigation att använda design tokens
2. Uppdatera NewHome att använda design tokens
3. Uppdatera PromptPlayground att använda design tokens
4. Uppdatera ProjectCard att använda design tokens
5. Testa dark mode på alla sidor

