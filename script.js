// ---------- CONFIG ----------
const stateCountries = ["United States", "India", "Australia", "Canada"];

const indiaStatesRegex = /\b(Andhra Pradesh|Karnataka|Maharashtra|Tamil Nadu|Delhi|Gujarat|Rajasthan|Punjab|Haryana|Kerala|West Bengal|Telangana|Uttar Pradesh)\b/i;

const stateShortMap = {
  "New York": "NY",
  "California": "CA",
  "Texas": "TX",
  "Illinois": "IL",

  "Western Australia": "WA",
  "New South Wales": "NSW",
  "Victoria": "VIC",
  "Queensland": "QLD",
  "South Australia": "SA",
  "Tasmania": "TAS",
  "Northern Territory": "NT",
  "Australian Capital Territory": "ACT"
};


// ---------- MODAL CONTROL ----------
function openApiModal() {
  document.getElementById("apiModal").style.display = "flex";
}

function closeApiModal() {
  document.getElementById("apiModal").style.display = "none";
}


// ---------- API KEY HANDLER ----------
function saveApiKey() {
  const keyInput = document.getElementById("apiKeyInputModal");
  const key = keyInput.value.trim();

  if (!key) {
    alert("Please enter a valid API key");
    return;
  }

  localStorage.setItem("geoapifyKey", key);
  alert("API key saved successfully!");

  closeApiModal();
}

// ---------- LOAD SAVED KEY ----------
window.addEventListener("DOMContentLoaded", () => {
  const savedKey = localStorage.getItem("geoapifyKey");
  if (savedKey) {
    const input = document.getElementById("apiKeyInputModal");
    if (input) input.value = savedKey;
  }
});


// ---------- UTILS ----------
function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function cleanCommaString(str) {
  return str
    .split(",")
    .map(s => s.trim())
    .filter(s => s.length > 0)
    .join(", ");
}

function normalizeInput(line) {
  return line
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+,/g, ",")
    .replace(/,\s+/g, ", ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function existsInInput(line, value) {
  if (!value) return false;

  const normalize = str =>
    str.toLowerCase().replace(/\s+/g, "");

  return normalize(line).includes(normalize(value));
}


// ---------- FALLBACK CITY (UK SAFE) ----------
function fallbackCityDetection(line, detected) {

  if (detected.city) return detected;

  if (detected.zipcode || detected.state) return detected;

  const parts = line.split(",").map(p => p.trim()).filter(Boolean);

  if (parts.length >= 2) {

    let lastPart = parts[parts.length - 1];

    const blocked = ["england", "uk", "united kingdom", "great britain"];

    if (blocked.includes(lastPart.toLowerCase()) && parts.length >= 2) {
      lastPart = parts[parts.length - 2];
    }

    if (!blocked.includes(lastPart.toLowerCase()) && /^[a-zA-Z\s]+$/.test(lastPart)) {
      detected.city = lastPart;
    }
  }

  return detected;
}


// ---------- COUNTRY VARIANTS ----------
const countryVariants = {
  "United States": ["USA", "US", "United States"],
  "United Kingdom": ["UK", "United Kingdom"],
  "India": ["India"],
  "Australia": ["Australia"],
  "Canada": ["Canada"],
  "Singapore": ["Singapore"],
  "Japan": ["Japan"],
  "China": ["China"],
  "Russia": ["Russia"],
  "Hong Kong": ["Hong Kong"],
  "New Zealand": ["New Zealand"]
};


// ---------- COUNTRY ----------
function extractCountryFromInput(line, apiCountry, detectedState) {

  if (apiCountry) {
    const variants = countryVariants[apiCountry] || [apiCountry];

    for (let v of variants) {
      if (existsInInput(line, v)) {
        return apiCountry;
      }
    }
  }

  if (detectedState) {

    if (["New York","California","Texas","Illinois"].includes(detectedState)) {
      return "United States";
    }

    if ([
      "Western Australia","New South Wales","Victoria","Queensland"
    ].includes(detectedState)) {
      return "Australia";
    }

    if (indiaStatesRegex.test(detectedState)) {
      return "India";
    }
  }

  if (apiCountry) return apiCountry;

  return "";
}


// ---------- ZIP ----------
function extractZipFromInput(line, apiZip) {

  if (apiZip) {
    const cleaned = apiZip.replace(/\s/g, "");
    const lineClean = line.replace(/\s/g, "");

    if (lineClean.includes(cleaned)) {
      return apiZip;
    }
  }

  const match = line.match(/\b\d{4,6}\b/);
  if (match) return match[0];

  return "";
}


// ---------- CITY ----------
function extractCityFromInput(line, p) {
  const possibleCity = p.city || "";

  if (!possibleCity) return "";

  if (p.country && possibleCity.toLowerCase() === p.country.toLowerCase()) {
    return "";
  }

  if (existsInInput(line, possibleCity)) {
    return possibleCity;
  }

  return "";
}


// ---------- STATE ----------
function extractStateFromInput(line, p) {
  if (!p.state) return "";

  if (!stateCountries.includes(p.country)) return "";

  if (existsInInput(line, p.state)) return p.state;

  const short = stateShortMap[p.state];
  if (short && existsInInput(line, short)) return p.state;

  for (let full in stateShortMap) {
    if (existsInInput(line, stateShortMap[full])) {
      return full;
    }
  }

  return "";
}


// ---------- STREET ----------
function extractStreetFromInput(line, { city, state, postcode, country }) {

  let parts = line.split(",").map(p => p.trim());

  const isMatch = (part, value) => {
    if (!value) return false;
    return existsInInput(part, value);
  };

  const stateShort = stateShortMap[state];

  let filtered = parts.filter(part => {

    if (country) {
      const variants = countryVariants[country] || [country];
      if (variants.some(v => isMatch(part, v))) return false;
    }

    if (state) {
      if (isMatch(part, state)) return false;
      if (stateShort && isMatch(part, stateShort)) return false;
    }

    if (city && isMatch(part, city)) return false;

    if (postcode && isMatch(part, postcode)) return false;

    if (/^\d{4,6}$/.test(part)) return false;

    return true;
  });

  if (filtered.length === 0 || parts.length === 1) {
    let temp = line;

    if (country) {
      const variants = countryVariants[country] || [country];
      variants.forEach(c => {
        temp = temp.replace(new RegExp(`\\b${escapeRegex(c)}\\b`, "gi"), "");
      });
    }

    if (state) {
      temp = temp.replace(new RegExp(`\\b${escapeRegex(state)}\\b`, "gi"), "");

      const short = stateShortMap[state];
      if (short) {
        temp = temp.replace(new RegExp(`\\b${short}\\b`, "gi"), "");
      }
    }

    if (city) {
      temp = temp.replace(new RegExp(`\\b${escapeRegex(city)}\\b`, "gi"), "");
    }

    if (postcode) {
      temp = temp.replace(new RegExp(`\\b${postcode}\\b`, "g"), "");
    }

    temp = temp.replace(/\b\d{4,6}\b/g, "");
    temp = temp.replace(/\s{2,}/g, " ");

    return cleanCommaString(temp.trim());
  }

  return filtered.join(", ").trim();
}


// ---------- MAIN ----------
async function processAddresses() {
  const API_KEY = localStorage.getItem("geoapifyKey");

  if (!API_KEY || API_KEY.length < 10) {
    alert("Please enter your Geoapify API key");
    openApiModal();
    return;
  }

  const input = document.getElementById("input").value.trim();
  const lines = input.split("\n").filter(l => l.trim() !== "");
  const tbody = document.querySelector("#outputTable tbody");

  tbody.innerHTML = "";

  for (let line of lines) {
    const result = await processSingleAddress(line, API_KEY);
    addRow(result);
  }
}


// ---------- PROCESS ----------
async function processSingleAddress(line, API_KEY) {

  line = normalizeInput(line);

  let street = "", city = "", state = "", zipcode = "", country = "";

  try {
    const url = `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(line)}&apiKey=${API_KEY}`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.features && data.features.length > 0) {
      const p = data.features[0].properties;

      state = extractStateFromInput(line, p);
      country = extractCountryFromInput(line, p.country, state);
      city = extractCityFromInput(line, p);
      zipcode = extractZipFromInput(line, p.postcode);

      const fallback = fallbackCityDetection(line, { city, state, zipcode, country });
      city = fallback.city;

      street = extractStreetFromInput(line, {
        city,
        state,
        postcode: zipcode,
        country
      });
    }

  } catch (e) {}

  return { street, city, state, zipcode, country };
}


// ---------- UI ----------
function addRow({ street, city, state, zipcode, country }) {
  const tbody = document.querySelector("#outputTable tbody");

  const row = document.createElement("tr");
  row.innerHTML = `
    <td>${street || ""}</td>
    <td>${city || ""}</td>
    <td>${state || ""}</td>
    <td>${zipcode || ""}</td>
    <td>${country || ""}</td>
  `;

  tbody.appendChild(row);
}


// ---------- COPY ----------
function copyToClipboard() {
  let text = "";
  document.querySelectorAll("#outputTable tbody tr").forEach(row => {
    const cols = row.querySelectorAll("td");
    text += Array.from(cols).map(td => td.innerText).join("\t") + "\n";
  });

  navigator.clipboard.writeText(text);
  alert("Copied!");
}


// ---------- CSV DOWNLOAD ----------
function downloadCSV() {
  let csv = "Street,City,State,Zipcode,Country\n";

  document.querySelectorAll("#outputTable tbody tr").forEach(row => {
    const cols = row.querySelectorAll("td");
    csv += Array.from(cols).map(td => `"${td.innerText}"`).join(",") + "\n";
  });

  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "splitty.csv";
  a.click();
}