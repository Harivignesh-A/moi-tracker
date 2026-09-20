# MOI (Gifts) Tracker

A GitHub Pages web app that reads the `given` and `received` sheets from a Google Spreadsheet named `Moi`.

## Sheet structure

### given
- Column A: Name
- Column C: Date
- Column D: Function
- Column E: Amount
- Column F: Place
- Column G: Phone number

### received
- Column A: Name
- Column D: Date
- Column E: Function
- Column F: Amount
- Column G: Place
- Column H: Family side

The app calculates:

`Net balance = Total Given - Total Received`

Positive = the person should give you the balance.

Negative = you have to pay the person the absolute value.

Zero = settled.

## Setup

1. Convert your Excel `Moi` workbook into a Google Sheet.
2. In Google Cloud Console create a project.
3. Enable **Google Sheets API**.
4. Create an **API key**.
5. Create an **OAuth 2.0 Client ID** with application type **Web application**.
6. Add your GitHub Pages URL under **Authorized JavaScript origins**.
7. Edit `app.js` and replace:
   - `CLIENT_ID`
   - `API_KEY`
   - `SPREADSHEET_ID`
8. Create a GitHub repository and upload:
   - `index.html`
   - `style.css`
   - `app.js`
9. Enable GitHub Pages from the repository's Settings.
10. Open the published site and click **Sign in & load data**.

## Important security note

Do NOT put a Google OAuth client secret, service-account JSON, or private key in this repository.

The app requests read-only Sheets access (`spreadsheets.readonly`) in the browser. The signed-in Google account must have access to the spreadsheet.

For a personal app, restrict the API key by HTTP referrer and restrict it to the Google Sheets API.

GitHub Pages sites are publicly reachable, so do not commit the Excel workbook or any private sheet data into the repository.
