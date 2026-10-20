# AOLA - Secure Serverless Multi-Tenant QR Ordering SaaS (₹0/Month)

A high-performance, mobile-first QR code dining and ordering SaaS engineered for restaurant clients with **₹0 monthly server costs**.

- **Database**: Google Sheets (`AOLA_Master_DB` + Client-Specific Google Sheets).
- **Backend API**: Single Google Apps Script (`Code.gs`) deployed as a Web App.
- **Frontend**: Lightweight, blazing fast Vanilla HTML5, CSS3, and ES6 JavaScript.
- **Hosting**: Static site deployed to **Vercel** (`?shop=slug` URL parameter routing).

---

## 3-Tier Security Architecture

1. **Frontend Honeypot (Anti-Bot)**:
   - Contains an invisible input field (`customer_fax`).
   - If any automated web crawler or bot populates this field, the frontend aborts the order immediately.
2. **Backend Rate Limiting (Anti-Spam)**:
   - Uses Apps Script `CacheService` to lock orders per `Table_Number` for **60 seconds**.
   - Prevents table flooding, kitchen printer spam, and DoS attacks.
3. **PIN Authentication & Anti-Breach**:
   - Owner Kitchen Display (`owner.html`) and Agency Master Console (`admin.html`) require PIN verification against `AOLA_Master_DB`.
   - All text inputs (table numbers, dish notes, customer instructions) are sanitized to prevent Stored XSS attacks.
   - Suspended accounts are immediately blocked from customer ordering.

---

## Project Structure

```
aula ord/
├── backend/
│   ├── Code.gs                # Complete Google Apps Script Backend Web App
│   ├── appsscript.json        # Apps Script manifest configuration
│   └── APPS_SCRIPT_SETUP.md   # Detailed step-by-step Apps Script guide
├── css/
│   └── style.css              # Obsidian Dark & Gold Glassmorphic design system
├── js/
│   ├── config.js              # Global configuration & helper functions
│   ├── api.js                 # Centralized fetch client & built-in Mock Provider
│   ├── customer.js            # Customer Menu & dynamic cart logic (index.html)
│   ├── owner.js               # Kitchen Display with 15s auto-polling & audio chime
│   └── admin.js               # Agency Master Admin onboarding & suspension console
├── index.html                 # App 1: Customer QR Menu (?shop=slug&table=N)
├── owner.html                 # App 2: Restaurant Owner Kitchen Dashboard
├── admin.html                 # App 3: Agency Master Control Panel
├── vercel.json                # Vercel deployment & security headers configuration
└── README.md                  # Project documentation
```

---

## Quick Start: Testing Locally (Mock Mode Included)

You can test all 3 frontend applications immediately in any web browser without waiting to configure Google Sheets:

1. Open a local development server or double-click to open in your browser:
   - **Customer Menu**: [`index.html?shop=bismillah&table=4`](./index.html?shop=bismillah&table=4)
   - **Kitchen Display**: [`owner.html?shop=bismillah`](./owner.html?shop=bismillah) *(Default Demo PIN: `1234`)*
   - **Agency Master Admin**: [`admin.html`](./admin.html) *(Default Master PIN: `998877`)*

> [!TIP]
> The built-in **Mock Provider** allows you to test adding items, placing orders, observing 60-second table locks, hearing live audio chimes on the kitchen display, and toggling client suspension right away!

---

## Connecting Your Live Google Sheets & Apps Script

When you are ready to connect live Google Sheets:

1. Follow the step-by-step instructions in [`backend/APPS_SCRIPT_SETUP.md`](./backend/APPS_SCRIPT_SETUP.md) to set up:
   - `AOLA_Master_DB` (Private agency sheet).
   - Client-specific Google Sheets (with `Menu` and `Orders` tabs).
   - Deploy `backend/Code.gs` as a **Web App** with **Execute as: Me** and **Access: Anyone**.
2. Copy your deployed Apps Script Web App URL (e.g. `https://script.google.com/macros/s/AKfycb.../exec`).
3. Set the URL in [`js/config.js`](./js/config.js) under `APPS_SCRIPT_URL`, or click **⚙️ Backend Config** in [`admin.html`](./admin.html) to save it directly via your browser.

---

## Deploying to Vercel (100% Free Static Hosting)

1. Push this folder to a GitHub repository or use the Vercel CLI:
   ```bash
   npm i -g vercel
   vercel
   ```
2. In the Vercel dashboard:
   - **Framework Preset**: Other
   - **Build Command**: None (Static)
   - **Output Directory**: `./` (Root)
3. Your deployment will be live at `https://your-project.vercel.app/`.

### Client QR Code Generation
To give your client their QR code:
- Menu URL: `https://your-project.vercel.app/?shop=bismillah&table=1`
- Kitchen URL: `https://your-project.vercel.app/owner.html?shop=bismillah`
- Use any free QR generator (or the copy button inside [`admin.html`](./admin.html)) to print QR stickers for each table.
