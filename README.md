# Borrower Profiles

A view-only, iPhone-style app for browsing borrower profiles built from branch sanction notes: loans held, income and net worth, suggested loan, investment and insurance products, and what suits the customer's spouse, children and parents.

**No customer data is stored in this repository.** The app is a set of static files on GitHub Pages; customer data is fetched from a Google Apps Script API only after sign-in.

## How it fits together

| Piece | Where |
|---|---|
| App (this repo) | GitHub Pages: https://anmolbage.github.io/borrower-profiles/ |
| API + Excel sync | Apps Script project "Borrower Profiles Sync" (`apps-script/Code.gs`) |
| Data | Google Sheet "Borrower Profiles (Live)", refreshed from `Borrower Profiles - Marketing.xlsx` in Google Drive |
| Sign-in | Your Loan CRM username and PIN (checked by the Loan CRM API) |

## Features

- Search and filter customers by loan type and lead priority
- Full profile: loans with us, finances, suggested products with reasons, family products, existing cover
- Segments by life stage and by employment
- Shows matching leads from Loan CRM and CVE CRM (by mobile number)
- **Update** button pulls the newest Excel file into the Google Sheet
- Light and dark mode, installs to the home screen

## Try it without data

Open `?demo=1` to run on made-up sample customers.

## Settings

- `js/config.js`: API address and links to the other apps.
- `apps-script/Code.gs` → `ALLOWED_ROLES`: who may sign in (Admin only by default).
