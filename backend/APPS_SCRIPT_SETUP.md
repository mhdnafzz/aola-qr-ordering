# Google Apps Script Setup & Database Architecture

This guide explains how to deploy the serverless Google Apps Script backend router (`Code.gs`) and configure the Google Sheets database with ₹0 server costs.

---

## 1. Google Sheets Structure

### Sheet 1: `AOLA_Master_DB` (Private to Agency)
Create a new Google Sheet named **AOLA_Master_DB** and name the tab **Shops**.

**Columns (Row 1 Headers):**
| Column A | Column B | Column C | Column D | Column E | Column F |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `Shop_ID` | `Shop_Name` | `Logo_URL` | `Sheet_ID` | `Owner_PIN` | `Status` |

**Example Row 2:**
- `Shop_ID`: `bismillah`
- `Shop_Name`: `Bismillah Biryani House`
- `Logo_URL`: `https://images.unsplash.com/photo-1589302168068-964664d93dc0?w=200`
- `Sheet_ID`: `1A2B3C4D5E...` *(The ID of the client's individual sheet)*
- `Owner_PIN`: `1234`
- `Status`: `Active` *(or `Suspended`)*

---

### Sheet 2: Client-Specific Sheets (Shared with Client as Editor)
Create one Google Sheet per client (e.g., named **Bismillah_Orders_and_Menu**).
Give Editor access to the restaurant owner's Google account.

This sheet **must** have two tabs:

#### Tab 1: `Menu`
| Column A | Column B | Column C | Column D (Optional) |
| :--- | :--- | :--- | :--- |
| `Dish Name` | `Price` | `In Stock` | `Category` |
| Chicken Biryani | 220 | TRUE | Main Course |
| Mutton Kebab | 180 | TRUE | Starters |
| Mango Lassi | 80 | FALSE | Beverages |

*(Note: In Stock can be `TRUE` or `FALSE` checkboxes in Google Sheets)*

#### Tab 2: `Orders`
| Column A | Column B | Column C | Column D | Column E | Column F |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `Order_ID` | `Timestamp` | `Table_Number` | `Items` | `Total_Price` | `Status` |

*(The backend script automatically appends incoming orders here).*

---

## 2. Deploying the Google Apps Script Web App

1. Go to [script.google.com](https://script.google.com) and create a **New Project** (name it `AOLA-Backend-Router`).
2. Paste the contents of [`backend/Code.gs`](./Code.gs) into the editor.
3. Paste the contents of [`backend/appsscript.json`](./appsscript.json) into `appsscript.json` (Enable "Show appsscript.json manifest" under Project Settings if hidden).
4. Go to **Project Settings** (gear icon) -> Scroll down to **Script Properties** -> Click **Add script property**:
   - Property: `MASTER_DB_SHEET_ID` | Value: `<ID of your AOLA_Master_DB Sheet>`
   - Property: `MASTER_ADMIN_PIN` | Value: `998877` *(or your custom master pin)*
5. Click **Deploy** -> **New Deployment**:
   - Select type: **Web App**
   - Description: `AOLA Production Web App`
   - Execute as: **Me** (your Google account)
   - Who has access: **Anyone** *(Essential: allows frontend fetch calls without Google sign-in prompts)*
6. Click **Deploy**, authorize permissions when prompted.
7. Copy the **Web App URL** (e.g., `https://script.google.com/macros/s/AKfycb.../exec`).
   - You will paste this URL into the frontend configuration.

---

## 3. Security Implementation Highlights in `Code.gs`

1. **Anti-Bot Honeypot**:
   The `handlePlaceOrder` controller checks `customer_fax`. If populated, the request is immediately rejected.
2. **Anti-Spam Rate Limiting**:
   Uses `CacheService.getScriptCache()` to lock orders per `Shop_ID + Table_Number` for 60 seconds (`CONFIG.RATE_LIMIT_SECONDS`). Subsequent orders within 60s return an error without kitchen sheet writes.
3. **Authentication & Authorization**:
   - `get_orders` and `complete_order` require a valid `pin` matching `AOLA_Master_DB`.
   - Admin routes (`admin_get_shops`, `admin_save_shop`, `admin_toggle_status`) require the `MASTER_ADMIN_PIN`.
   - Suspended shops are blocked from fetching menus or placing orders.
4. **Input Sanitization & Concurrency**:
   - `sanitizeString()` strips all HTML and script injection patterns.
   - `LockService.getScriptLock()` prevents write collisions when concurrent orders arrive.
