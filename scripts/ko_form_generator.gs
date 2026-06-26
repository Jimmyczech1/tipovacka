// ═══════════════════════════════════════════════════════════════
// KO Tipovačka – Google Apps Script
// Použití:
//   1. Nastav PLAYERS a ROUNDS níže dle aktuálního kola
//   2. Spusť createKORoundForm() → vznikne Form + Sheet
//   3. Pošli odkaz na formulář hráčům
//   4. Po uzávěrce spusť exportKOPredictions() → zkopíruj JSON do repozitáře
// ═══════════════════════════════════════════════════════════════

// ── Konfigurace hráčů ────────────────────────────────────────
const PLAYERS = [
  "Pavel Machovsky",
  "David Machovsly",
  "Vitek Slunecko",
  "Olda Cervinka",
  "Karel Klima",
  "Darek Nestak",
  "Vit Vevericik",
  "Jan Cejchan",
  "Jan Satra",
  "Marek Machovsky",
  "Honza Horáček",
  "Stepan Ruzicka",
  "Kuba Kriz",
  "Starky",
  "Matus Lazovsky",
  "Kuba Neužil",
  "David Filgas",
  "Standa Jambor",
  "Jachym Jakimeczko",
  "Filip Podlipny",
  "Standa Silhavy",
  "David Nestak",
  "Honza Novak",
  "Jirka Nyvlt",
  "Hardy Pavlicek",
  "Matej Chalupka",
  "Vašek Stach",
  "Martin Souček",
  "Mike Dallal"
];

// ── Zápasy daného kola ────────────────────────────────────────
// Před každým kolem uprav tuto sekci dle aktuálních párů.
// id = číslo zápasu z games.json (pro export do JSON)
// home/away = skutečné názvy týmů (jakmile jsou známy ze skupin)
const ROUND_NAME = "1. kolo play off"; // změní se pro každé kolo
const GAMES = [
  // Příklady – nahraď skutečnými páry po skončení skupin:
  { id: 73,  home: "TBD", away: "TBD" },
  { id: 74,  home: "TBD", away: "TBD" },
  { id: 75,  home: "TBD", away: "TBD" },
  { id: 76,  home: "TBD", away: "TBD" },
  { id: 77,  home: "TBD", away: "TBD" },
  { id: 78,  home: "TBD", away: "TBD" },
  { id: 79,  home: "TBD", away: "TBD" },
  { id: 80,  home: "TBD", away: "TBD" },
  { id: 81,  home: "TBD", away: "TBD" },
  { id: 82,  home: "TBD", away: "TBD" },
  { id: 83,  home: "TBD", away: "TBD" },
  { id: 84,  home: "TBD", away: "TBD" },
  { id: 85,  home: "TBD", away: "TBD" },
  { id: 86,  home: "TBD", away: "TBD" },
  { id: 87,  home: "TBD", away: "TBD" },
  { id: 88,  home: "TBD", away: "TBD" },
];

// ════════════════════════════════════════════════════════════════
// KROK 1: Vytvoř formulář
// ════════════════════════════════════════════════════════════════
function createKORoundForm() {
  const title = `Tipovačka MS 2026 – ${ROUND_NAME}`;

  // Vytvoř formulář
  const form = FormApp.create(title);
  form.setTitle(title);
  form.setDescription(
    `Zadej svoje tipy na výsledky zápasů ${ROUND_NAME}.\n` +
    `Tipy jsou konečné – po odeslání nelze měnit.\n` +
    `Vyplň každé pole celým číslem (0, 1, 2, …).`
  );
  form.setCollectEmail(false);
  form.setLimitOneResponsePerUser(false);
  form.setAllowResponseEdits(false);

  // Jméno hráče
  const nameItem = form.addListItem();
  nameItem.setTitle("Tvoje jméno");
  nameItem.setRequired(true);
  nameItem.setChoices(PLAYERS.map(p => nameItem.createChoice(p)));

  // Zápasy
  GAMES.forEach((game, i) => {
    form.addSectionHeaderItem()
      .setTitle(`Zápas ${i + 1}  ·  ${game.home} vs ${game.away}`);

    const homeItem = form.addTextItem();
    homeItem.setTitle(`${game.home} – góly`);
    homeItem.setHelpText("Celé číslo, např. 2");
    homeItem.setRequired(true);
    homeItem.setValidation(
      FormApp.createTextValidation()
        .requireNumber()
        .requireNumberGreaterThanOrEqualTo(0)
        .build()
    );

    const awayItem = form.addTextItem();
    awayItem.setTitle(`${game.away} – góly`);
    awayItem.setHelpText("Celé číslo, např. 1");
    awayItem.setRequired(true);
    awayItem.setValidation(
      FormApp.createTextValidation()
        .requireNumber()
        .requireNumberGreaterThanOrEqualTo(0)
        .build()
    );
  });

  // Propoj s Google Sheets (automaticky vytvoří nový Sheet)
  const ss = SpreadsheetApp.create(`Tipovačka KO – ${ROUND_NAME} – Odpovědi`);
  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());

  // Ulož ID sheetu do Properties pro pozdější export
  PropertiesService.getScriptProperties().setProperty('SHEET_ID', ss.getId());
  PropertiesService.getScriptProperties().setProperty('ROUND_NAME', ROUND_NAME);

  Logger.log("✅ Formulář vytvořen: " + form.getPublishedUrl());
  Logger.log("✅ Sheet vytvořen: " + ss.getUrl());
  Logger.log("📋 Zkopíruj odkaz na formulář a pošli hráčům.");

  // Zobraz URL v dialogu (pokud spouštíš v browseru)
  try {
    SpreadsheetApp.getUi().alert(
      "Formulář vytvořen!\n\n" +
      "Odkaz pro hráče:\n" + form.getPublishedUrl() + "\n\n" +
      "Sheet s odpověďmi:\n" + ss.getUrl()
    );
  } catch(e) {
    // Běží z editoru skriptů – viz log výše
  }
}

// ════════════════════════════════════════════════════════════════
// KROK 2: Exportuj tipy jako JSON (spusť po uzávěrce)
// ════════════════════════════════════════════════════════════════
function exportKOPredictions() {
  const sheetId = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  if (!sheetId) {
    Logger.log("❌ Sheet ID nenalezeno – nejdřív spusť createKORoundForm()");
    return;
  }

  const ss = SpreadsheetApp.openById(sheetId);
  const sheet = ss.getSheets()[0]; // první sheet = odpovědi formuláře
  const data  = sheet.getDataRange().getValues();

  if (data.length < 2) {
    Logger.log("⚠️ Žádné odpovědi zatím.");
    return;
  }

  const headers = data[0]; // řádek s nadpisy (generovaný automaticky z formuláře)

  // Zjisti indexy sloupců
  const nameCol = headers.findIndex(h => String(h).toLowerCase().includes("jméno") || String(h).toLowerCase().includes("jmeno"));

  // Sestav mapping: gameId → [homeColIndex, awayColIndex]
  // Sloupce formuláře vypadají jako: "Zápas 1  ·  Team A vs Team B [Section]", "Team A – góly", "Team B – góly"
  const gameColMap = {}; // gameId → { homeIdx, awayIdx }
  GAMES.forEach((game, i) => {
    const homeTitle = `${game.home} – góly`;
    const awayTitle = `${game.away} – góly`;
    const homeIdx = headers.findIndex(h => String(h) === homeTitle);
    const awayIdx = headers.findIndex(h => String(h) === awayTitle);
    if (homeIdx >= 0 && awayIdx >= 0) {
      gameColMap[game.id] = { homeIdx, awayIdx };
    }
  });

  // Načti stávající players_predictions_ko.json strukturu (pouze jména)
  // Pokud nemáme přístup k souboru, vytvoříme základ z PLAYERS
  const playerMap = {};
  PLAYERS.forEach(name => { playerMap[name] = { name, predictions: {} }; });

  // Zpracuj odpovědi (přeskočí duplicity – bere poslední odpověď hráče)
  for (let r = 1; r < data.length; r++) {
    const row  = data[r];
    const name = String(row[nameCol] || '').trim();
    if (!name || !playerMap[name]) continue;

    Object.entries(gameColMap).forEach(([gameId, { homeIdx, awayIdx }]) => {
      const home = parseInt(row[homeIdx], 10);
      const away = parseInt(row[awayIdx], 10);
      if (!isNaN(home) && !isNaN(away)) {
        playerMap[name].predictions[gameId] = { home, away };
      }
    });
  }

  // Výstupní JSON
  const result = Object.values(playerMap);
  const json = JSON.stringify(result, null, 2);

  Logger.log("════ players_predictions_ko.json ════");
  Logger.log(json);
  Logger.log("═════════════════════════════════════");
  Logger.log("Zkopíruj výše uvedený JSON do souboru players_predictions_ko.json v repozitáři a commitni.");

  // Ulož výstup do nového sheetu pro snazší kopírování
  try {
    let outSheet = ss.getSheetByName("JSON Export");
    if (!outSheet) outSheet = ss.insertSheet("JSON Export");
    outSheet.clearContents();
    outSheet.getRange(1, 1).setValue(json);
    Logger.log("✅ JSON uložen do záložky 'JSON Export' ve Sheetu.");
  } catch(e) {
    Logger.log("Poznámka: " + e.message);
  }
}
