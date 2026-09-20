// ============================================================
// MOI (Gifts) Tracker
// Replace these 3 values before publishing.
// ============================================================
const CONFIG = {
  CLIENT_ID: "223810672461-ktu1aq6302819ng697693s1r4jcge8gu.apps.googleusercontent.com",
  API_KEY: "AIzaSyApV1mu070FOxKKwjatPv1L9uG7TgmXSXQ",
  SPREADSHEET_ID: "1nJVGAOyl-1o9pbYW_-Mji2zMNpyFzUKUupyKBSQc_eU"
};

const DISCOVERY_DOC = "https://sheets.googleapis.com/$discovery/rest?version=v4";
const SCOPES = "https://www.googleapis.com/auth/spreadsheets.readonly";

let gapiInited = false;
let gisInited = false;
let tokenClient;
let givenRows = [];
let receivedRows = [];
let people = [];

const $ = (id) => document.getElementById(id);

function setStatus(message, isError = false) {
  $("status").textContent = message;
  $("status").classList.toggle("error", isError);
}

function gapiLoaded() {
  gapi.load("client", initializeGapiClient);
}

async function initializeGapiClient() {
  try {
    await gapi.client.init({
      apiKey: CONFIG.API_KEY,
      discoveryDocs: [DISCOVERY_DOC],
    });
    gapiInited = true;
    maybeEnableAuth();
  } catch (error) {
    console.error(error);
    setStatus("Could not initialize Google Sheets API. Check your API key.", true);
  }
}

function gisLoaded() {
  if (!window.google?.accounts?.oauth2) {
    setStatus("Google Identity Services did not load. Try refreshing.", true);
    return;
  }

  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CONFIG.CLIENT_ID,
    scope: SCOPES,
    callback: "",
  });

  gisInited = true;
  maybeEnableAuth();
}

function maybeEnableAuth() {
  if (gapiInited && gisInited) {
    $("authorizeBtn").disabled = false;
    setStatus("Ready. Sign in to read your Moi sheet.");
  }
}

$("authorizeBtn").addEventListener("click", () => {
  tokenClient.callback = async (response) => {
    if (response.error) {
      console.error(response);
      setStatus("Google authorization failed.", true);
      return;
    }

    await loadSheetData();
  };

  const hasToken = gapi.client.getToken();
  tokenClient.requestAccessToken({ prompt: hasToken ? "" : "consent" });
});

$("refreshBtn").addEventListener("click", loadSheetData);

$("personSelect").addEventListener("change", (event) => {
  if (event.target.value) {
    showPerson(event.target.value);
  } else {
    $("result").classList.add("hidden");
    $("emptyState").classList.remove("hidden");
  }
});

async function loadSheetData() {
  setStatus("Loading data from Google Sheets…");

  try {
    const response = await gapi.client.sheets.spreadsheets.values.batchGet({
      spreadsheetId: CONFIG.SPREADSHEET_ID,
      ranges: ["given!A:G", "received!A:H"],
      valueRenderOption: "UNFORMATTED_VALUE",
    });

    const ranges = response.result.valueRanges || [];
    givenRows = (ranges[0]?.values || []).slice(1);
    receivedRows = (ranges[1]?.values || []).slice(1);

    // Given: A = name, C = date, D = function, E = amount, F = place, G = phone
    // Received: A = name, D = date, E = function, F = amount, G = place, H = family side

    const names = [
      ...givenRows.map(row => cleanName(row[0])),
      ...receivedRows.map(row => cleanName(row[0])),
    ].filter(Boolean);

    people = [...new Set(names)].sort((a, b) => a.localeCompare(b));

    populatePeople();

    $("authCard").classList.add("hidden");
    $("appCard").classList.remove("hidden");
    $("emptyState").classList.remove("hidden");
    $("result").classList.add("hidden");

    setStatus("");
  } catch (error) {
    console.error(error);
    const message = error?.result?.error?.message || error?.message || "Unknown error";
    setStatus("Could not read the sheet: " + message, true);
  }
}

function cleanName(value) {
  return String(value ?? "").trim();
}

function toAmount(value) {
  if (typeof value === "number") return value;
  if (value === null || value === undefined || value === "") return 0;
  const cleaned = String(value).replace(/[₹,\s]/g, "");
  const number = Number(cleaned);
  return Number.isFinite(number) ? number : 0;
}

function formatCurrency(amount) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Math.abs(amount));
}

function populatePeople() {
  const select = $("personSelect");

  select.innerHTML = '<option value="">Select a person…</option>';

  for (const name of people) {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    select.appendChild(option);
  }

  if ($(select).hasClass("select2-hidden-accessible")) {
    $(select).select2("destroy");
  }

$(select).select2({
  placeholder: "Search person...",
  allowClear: true,
  width: "100%",
  matcher: function (params, data) {
    if (!params.term || params.term.trim() === "") {
      return data;
    }

    const search = params.term
      .toLowerCase()
      .replace(/\s+/g, "");

    const text = String(data.text || "")
      .toLowerCase()
      .replace(/\s+/g, "");

    return text.includes(search) ? data : null;
  }
});

  $(select).off("change.select2");

  $(select).on("change.select2", function () {
    const value = this.value;

    if (value) {
      showPerson(value);
    } else {
      $("result").classList.add("hidden");
      $("emptyState").classList.remove("hidden");
    }
  });
}

function showPerson(name) {
  const given = givenRows
    .filter(row => cleanName(row[0]) === name)
    .map(row => ({
      type: "Given",
      date: row[2] ?? "",
      function: row[3] ?? "",
      amount: toAmount(row[4]),
      place: row[5] ?? "",
      // Phone number exists in the sheet but is intentionally not shown in the web app.
      extra: "",
    }));

  const received = receivedRows
    .filter(row => cleanName(row[0]) === name)
    .map(row => ({
      type: "Received",
      date: row[3] ?? "",
      function: row[4] ?? "",
      amount: toAmount(row[5]),
      place: row[6] ?? "",
      extra: row[7] ? `Family side: ${row[7]}` : "",
    }));

  const totalGiven = given.reduce((sum, row) => sum + row.amount, 0);
  const totalReceived = received.reduce((sum, row) => sum + row.amount, 0);
  const balance = totalGiven - totalReceived;

  $("personName").textContent = name;
  $("givenTotal").textContent = formatCurrency(totalGiven);
  $("receivedTotal").textContent = formatCurrency(totalReceived);
  $("balanceAmount").textContent = formatCurrency(balance);

  const message = $("balanceMessage");
  message.className = "balance-message";

  if (balance > 0) {
    message.textContent = `${name} should give you ${formatCurrency(balance)}`;
  } else if (balance < 0) {
    message.textContent = `You have to pay ${name} ${formatCurrency(balance)}`;
    message.classList.add("owe");
  } else {
    message.textContent = "Settled — no amount pending";
    message.classList.add("settled");
  }

  const transactions = [...given, ...received];
  $("transactionBody").innerHTML = "";

  if (!transactions.length) {
    $("transactionBody").innerHTML =
      '<tr><td colspan="4">No transactions found.</td></tr>';
  } else {
    for (const row of transactions) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(row.date)}</td>
        <td><span class="badge ${row.type.toLowerCase()}">${row.type}</span></td>
        <td>${formatCurrency(row.amount)}</td>
        <td>${escapeHtml([row.function, row.place, row.extra].filter(Boolean).join(" • "))}</td>
      `;
      $("transactionBody").appendChild(tr);
    }
  }

  $("emptyState").classList.add("hidden");
  $("result").classList.remove("hidden");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
