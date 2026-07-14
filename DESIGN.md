# Design System — Previso

## Product Context
- **What this is:** Un pilota automatico di approvvigionamento (system of action) che automatizza il calcolo dei riordini SKU ed esegue gli invii degli ordini ai fornitori via email, eliminando i passaggi manuali.
- **Who it's for:** Il Titolare della PMI italiana (buyer economico sensibile al cash flow) e il Responsabile Acquisti/Magazziniere (utente operativo quotidiano).
- **Space/industry:** Logistica di magazzino, pianificazione degli approvvigionamenti, automazione B2B.
- **Project type:** Dashboard desktop ad alta densità di dati.

## Aesthetic Direction
- **Direction:** Refined Utilitarian (Slate & Steel)
- **Decoration level:** Intentional (bordi netti sottili, lievissimi sfondi grigi a contrasto per raggruppare i dati, ombreggiature minimali, nessuna sfumatura superflua o gradiente violaceo slop AI).
- **Mood:** Serietà istituzionale, precisione meccanica, estrema facilità e rapidità di lettura delle informazioni operative.

## Typography
- **Display/Hero:** Cabinet Grotesk (geometrico ed elegante, per titoli e metriche principali).
- **Body:** Instrument Sans (neutro ed altamente leggibile, per testi descrittivi e UI).
- **UI/Labels:** Instrument Sans (peso Medium/SemiBold 500/600).
- **Data/Tables:** Geist Mono (monospazio ad alta precisione con tabular-nums, per codici SKU, scorte, quantità e date).
- **Code:** Geist Mono
- **Loading:** Fontshare CDN & Google Fonts CDN.
- **Scale:**
  - Hero: 32px / 2rem (Cabinet Grotesk Bold, tracking -0.04em)
  - Section Title: 20px / 1.25rem (Cabinet Grotesk SemiBold, tracking -0.02em)
  - Body Large: 16px / 1rem (Instrument Sans Regular)
  - Body Default: 14px / 0.875rem (Instrument Sans Regular)
  - UI Labels / Tables: 13px / 0.8125rem (Instrument Sans Medium / Geist Mono Medium)
  - Monospace Data: 13px / 0.8125rem (Geist Mono Regular)

## Color
- **Approach:** Restrained & Balanced (Slate Light Mode come default, con supporto ad Industrial Dark Mode).
- **Primary Background:** `#f8fafc` (Slate 50)
- **Surface / Card Background:** `#ffffff` (White)
- **Borders:** `#e2e8f0` (Slate 200)
- **Primary Text:** `#0f172a` (Slate 900)
- **Secondary Text:** `#475569` (Slate 600)
- **Accent Color:** `#0d9488` (Teal 600 - rappresenta flusso, equilibrio e precisione operativa)
- **Accent Hover:** `#0f766e` (Teal 700)
- **Accent Light:** `#f0fdfa` (Teal 50)
- **Semantic Statuses:**
  - Success (In regola): `#16a34a` (Green 600) / Background `#f0fdf4`
  - Warning (Sotto scorta): `#ea580c` (Orange 600) / Background `#fff7ed`
  - Error (Critico / Urgente): `#dc2626` (Red 600) / Background `#fef2f2`

## Spacing
- **Base unit:** 8px
- **Density:** Compact / Technical
- **Scale:**
  - 2xs: 2px
  - xs: 4px
  - sm: 8px
  - md: 16px
  - lg: 24px
  - xl: 32px
  - 2xl: 48px
  - 3xl: 64px

## Layout
- **Approach:** Grid-disciplined (griglia fissa a 12 colonne per strutture tabellari e cruscotti).
- **Max Content Width:** 1200px
- **Border Radius:**
  - Elementi di UI piccoli (Bottoni, input, badge): `6px` (sm)
  - Elementi medi (Card, gruppi di tabelle, toolbar): `10px` (md)
  - Elementi grandi (Mockup frame, dashboard container): `14px` (lg)

## Motion
- **Approach:** Minimal-functional (le animazioni devono solo supportare la comprensione degli stati, non decorare).
- **Easing:**
  - Enter: `cubic-bezier(0.16, 1, 0.3, 1)` (ease-out-expo)
  - Exit: `cubic-bezier(0.7, 0, 0.84, 0)` (ease-in-expo)
  - Move: `cubic-bezier(0.87, 0, 0.13, 1)` (ease-in-out)
- **Duration:**
  - Micro (Flicker, hover trigger): `80ms`
  - Short (Transizioni di stato, apparizione badge): `150ms`
  - Medium (Apertura pannelli, caricamenti): `250ms`

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-07-14 | Initial design system created | Creato da /design-consultation per garantire affidabilità, precisione e semplicità d'uso per magazzinieri e titolari PMI. |
