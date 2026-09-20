// ============================================================
// MOI (Gifts) Tracker
// ============================================================

const CONFIG = {
  CLIENT_ID: "223810672461-ktu1aq6302819ng697693s1r4jcge8gu.apps.googleusercontent.com",
  API_KEY: "AIzaSyApV1mu070FOxKKwjatPv1L9uG7TgmXSXQ",
  SPREADSHEET_ID: "1nJVGAOyl-1o9pbYW_-Mji2zMNpyFzUKUupyKBSQc_eU"
};

const DISCOVERY_DOC =
  "https://sheets.googleapis.com/$discovery/rest?version=v4";

const SCOPES =
  "https://www.googleapis.com/auth/spreadsheets.readonly";

let gapiInited = false;
let gisInited = false;
let tokenClient;

let givenRows = [];
let receivedRows = [];
let people = [];
let personRelationMap = {};

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
    setStatus(
      "Could not initialize Google Sheets API. Check your API key.",
      true
    );
  }
}

function gisLoaded() {
  if (!window.google?.accounts?.oauth2) {
    setStatus(
      "Google Identity Services did not load. Try refreshing.",
      true
    );
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

  tokenClient.requestAccessToken({
    prompt: hasToken ? "" : "consent"
  });
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

$("personSearch").addEventListener("input", function () {
  const search = this.value.trim().toLowerCase();
  const select = $("personSelect");

  select.innerHTML = '<option value="">Select a person…</option>';

  const filteredPeople = people.filter(name =>
    getDisplayName(name).toLowerCase().includes(search)
  );

  for (const name of filteredPeople) {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = getDisplayName(name);
    select.appendChild(option);
  }

  if (filteredPeople.length === 1 && search !== "") {
    select.value = filteredPeople[0];
    showPerson(filteredPeople[0]);
  } else {
    $("result").classList.add("hidden");
    $("emptyState").classList.remove("hidden");
  }
});

async function loadSheetData() {
  setStatus("Loading data from Google Sheets…");

  try {
    const response =
      await gapi.client.sheets.spreadsheets.values.batchGet({
        spreadsheetId: CONFIG.SPREADSHEET_ID,
        ranges: ["given!A:G", "received!A:H"],
        valueRenderOption: "FORMATTED_VALUE",
      });

    const ranges = response.result.valueRanges || [];

    givenRows = (ranges[0]?.values || []).slice(1);
    receivedRows = (ranges[1]?.values || []).slice(1);

    personRelationMap = {};

    // Collect name to relation mapping from given sheet (Column A: Name, Column B: Relation)
    givenRows.forEach(row => {
      const name = cleanName(row[0]);
      const relation = String(row[1] ?? "").trim();
      if (name && relation) {
        personRelationMap[name] = relation;
      }
    });

    // Collect name to relation mapping from received sheet (Column A: Name, Column B: Relation)
    receivedRows.forEach(row => {
      const name = cleanName(row[0]);
      const relation = String(row[1] ?? "").trim();
      if (name && relation && !personRelationMap[name]) {
        personRelationMap[name] = relation;
      }
    });

    const names = [
      ...givenRows.map(row => cleanName(row[0])),
      ...receivedRows.map(row => cleanName(row[0])),
    ].filter(Boolean);

    people = [...new Set(names)].sort((a, b) =>
      getDisplayName(a).localeCompare(getDisplayName(b))
    );

    populatePeople();

    $("authCard").classList.add("hidden");
    $("appCard").classList.remove("hidden");
    $("emptyState").classList.remove("hidden");
    $("result").classList.add("hidden");

    setStatus("");
  } catch (error) {
    console.error(error);

    const message =
      error?.result?.error?.message ||
      error?.message ||
      "Unknown error";

    setStatus(
      "Could not read the sheet: " + message,
      true
    );
  }
}

function cleanName(value) {
  return String(value ?? "").trim();
}

function getDisplayName(name) {
  const relation = personRelationMap[name];
  return relation ? `${name} (${relation})` : name;
}

function parseAmount(value) {
  if (value === null || value === undefined || value === "") {
    return 0;
  }

  const strVal = String(value).trim();
  const cleanedNumStr = strVal.replace(/[₹,\s]/g, "");

  if (cleanedNumStr !== "" && !isNaN(Number(cleanedNumStr))) {
    return Number(cleanedNumStr);
  }

  return null;
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

  select.innerHTML =
    '<option value="">Select a person…</option>';

  for (const name of people) {
    const option = document.createElement("option");

    option.value = name;
    option.textContent = getDisplayName(name);

    select.appendChild(option);
  }

  $("personSearch").value = "";
}

function showPerson(name) {
  const displayName = getDisplayName(name);

  const given = givenRows
    .filter(row => cleanName(row[0]) === name)
    .map(row => {
      const rawVal = row[4] ?? "";
      const parsed = parseAmount(rawVal);
      return {
        type: "Given",
        date: row[2] ?? "",
        function: row[3] ?? "",
        amount: parsed !== null ? parsed : 0,
        rawAmount: String(rawVal).trim(),
        isTextGift: parsed === null && String(rawVal).trim() !== "",
        place: row[5] ?? "",
        extra: "",
      };
    });

  const received = receivedRows
    .filter(row => cleanName(row[0]) === name)
    .map(row => {
      const rawVal = row[5] ?? "";
      const parsed = parseAmount(rawVal);
      return {
        type: "Received",
        date: row[3] ?? "",
        function: row[4] ?? "",
        amount: parsed !== null ? parsed : 0,
        rawAmount: String(rawVal).trim(),
        isTextGift: parsed === null && String(rawVal).trim() !== "",
        place: row[6] ?? "",
        extra: row[7] ? `Family side: ${row[7]}` : "",
      };
    });

  const totalGiven = given.reduce((sum, row) => sum + row.amount, 0);
  const totalReceived = received.reduce((sum, row) => sum + row.amount, 0);
  const balance = totalGiven - totalReceived;

  // Collect text gifts
  const textGiftsGiven = given.filter(r => r.isTextGift).map(r => r.rawAmount);
  const textGiftsReceived = received.filter(r => r.isTextGift).map(r => r.rawAmount);

  $("personName").textContent = displayName;
  $("givenTotal").textContent = formatCurrency(totalGiven);
  $("receivedTotal").textContent = formatCurrency(totalReceived);
  $("balanceAmount").textContent = formatCurrency(balance);

  const message = $("balanceMessage");
  message.className = "balance-message";

  let statusMessages = [];

  // Construct status messages using formatted display name
  if (textGiftsReceived.length > 0) {
    statusMessages.push(`${displayName} has gifted ${textGiftsReceived.join(", ")}`);
  }
  if (textGiftsGiven.length > 0) {
    statusMessages.push(`You have gifted ${textGiftsGiven.join(", ")}`);
  }

  if (balance > 0) {
    statusMessages.push(`${displayName} should give you ${formatCurrency(balance)}`);
  } else if (balance < 0) {
    statusMessages.push(`You have to pay ${displayName} ${formatCurrency(balance)}`);
    message.classList.add("owe");
  } else if (statusMessages.length === 0) {
    statusMessages.push("Settled — no amount pending");
    message.classList.add("settled");
  }

  message.textContent = statusMessages.join(" | ");

  const transactions = [...given, ...received];
  $("transactionBody").innerHTML = "";

  if (!transactions.length) {
    $("transactionBody").innerHTML = '<tr><td colspan="4">No transactions found.</td></tr>';
  } else {
    for (const row of transactions) {
      const tr = document.createElement("tr");

      const displayAmount = row.isTextGift
        ? escapeHtml(row.rawAmount)
        : formatCurrency(row.amount);

      tr.innerHTML = `
        <td>${escapeHtml(row.date)}</td>
        <td>
          <span class="badge ${row.type.toLowerCase()}">
            ${row.type}
          </span>
        </td>
        <td>${displayAmount}</td>
        <td>
          ${escapeHtml(
            [row.function, row.place, row.extra]
              .filter(Boolean)
              .join(" • ")
          )}
        </td>
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