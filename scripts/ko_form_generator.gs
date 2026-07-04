// ═══════════════════════════════════════════════════════════════
// KO Tipovačka – Google Apps Script
//
// Použití pro každé kolo:
//   1. Uprav ROUND_NAME a GAMES níže dle aktuálního kola
//   2. Spusť createKORoundForm() → vznikne Form + Sheet, zkopíruj odkaz hráčům
//   3. Po uzávěrce spusť exportKOPredictions() → zkopíruj JSON výstup
//      do players_predictions_ko.json v repozitáři a commitni
//
// Tipy z předchozích kol se ZACHOVAJÍ – script merguje nové tipy
// do záložky "Předchozí tipy" v Sheetu. Před exportem 2.+ kola
// vlož aktuální obsah players_predictions_ko.json do buňky A1
// záložky "Předchozí tipy" (záložka se vytvoří automaticky).
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
// Uprav před každým kolem. id = číslo zápasu z games.json.
const ROUND_NAME = "Osmifinále"; // "Osmifinále" / "Čtvrtfinále" / atd.
const GAMES = [
  // ID ověřena z games.json + live API (4.7.2026)
  // POZOR: games.json má prohozená ID 80 (Belgium) a 82 (England) oproti API –
  // R16 zápasy jsou ale správně: hra 92 = Mexico vs England, hra 94 = USA vs Belgium
  { id: 90, home: "Canada",         away: "Morocco" },        //  4.7. 19:00 CZ
  { id: 89, home: "Paraguay",       away: "France" },         //  4.7. 23:00 CZ
  { id: 91, home: "Brazil",         away: "Norway" },         //  5.7. 22:00 CZ
  { id: 92, home: "Mexico",         away: "England" },        //  6.7. 02:00 CZ
  { id: 93, home: "Portugal",       away: "Spain" },          //  6.7. 21:00 CZ
  { id: 94, home: "United States",  away: "Belgium" },        //  7.7. 02:00 CZ
  { id: 95, home: "Argentina",      away: "Egypt" },          //  7.7. 18:00 CZ
  { id: 96, home: "Switzerland",    away: "Colombia" },       //  7.7. 22:00 CZ
  // Pro čtvrtfinále použij id: 97–100, atd.
];

// ════════════════════════════════════════════════════════════════
// KROK 1: Vytvoř formulář pro aktuální kolo
// ════════════════════════════════════════════════════════════════
function createKORoundForm() {
  const title = `Tipovačka MS 2026 – ${ROUND_NAME}`;

  const form = FormApp.create(title);
  form.setTitle(title);
  form.setDescription(
    `Zadej svoje tipy na výsledky zápasů – ${ROUND_NAME}.\n` +
    `Tipy jsou konečné – po odeslání nelze měnit.\n` +
    `Vyplň každé pole celým číslem (0, 1, 2, …).`
  );
  form.setCollectEmail(false);
  form.setLimitOneResponsePerUser(false);
  form.setAllowResponseEdits(false);

  // Jméno hráče – dropdown, žádné překlepy
  const nameItem = form.addListItem();
  nameItem.setTitle("Tvoje jméno");
  nameItem.setRequired(true);
  nameItem.setChoices(PLAYERS.map(p => nameItem.createChoice(p)));

  // Otázky pro každý zápas
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

  // Vytvoř Sheet a propoj s formulářem
  const ss = SpreadsheetApp.create(`Tipovačka KO – ${ROUND_NAME} – Odpovědi`);
  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());

  // Vytvoř záložku "Předchozí tipy" pro merge při exportu
  const prevSheet = ss.insertSheet("Předchozí tipy");
  prevSheet.getRange(1, 1).setValue(
    "── Sem vlož obsah players_predictions_ko.json před spuštěním exportKOPredictions() ──\n" +
    "Smaž tento text a vlož JSON. Pro 1. kolo tuto záložku nech prázdnou."
  );
  prevSheet.getRange(1, 1).setFontColor("#999999");

  // Ulož ID sheetu pro pozdější export
  PropertiesService.getScriptProperties().setProperty('SHEET_ID', ss.getId());
  PropertiesService.getScriptProperties().setProperty('ROUND_NAME', ROUND_NAME);

  Logger.log("✅ Formulář: " + form.getPublishedUrl());
  Logger.log("✅ Sheet:    " + ss.getUrl());
  Logger.log("📋 Pošli odkaz hráčům. Před exportem vlož stávající JSON do záložky 'Předchozí tipy'.");
}

// ════════════════════════════════════════════════════════════════
// KROK 2: Exportuj tipy – merguje nové kolo se stávajícími tipy
//
// Před spuštěním pro 2.+ kolo:
//   1. Otevři Sheet (odkaz v logu z createKORoundForm)
//   2. Klikni na záložku "Předchozí tipy"
//   3. Smaž instrukční text v A1
//   4. Vlož (Ctrl+V) aktuální obsah players_predictions_ko.json do A1
//   5. Spusť exportKOPredictions()
// ════════════════════════════════════════════════════════════════
function exportKOPredictions() {
  const sheetId = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  if (!sheetId) {
    Logger.log("❌ Sheet ID nenalezeno – nejdřív spusť createKORoundForm()");
    return;
  }

  const ss = SpreadsheetApp.openById(sheetId);

  // ── Načti stávající tipy z "Předchozí tipy" záložky (pokud existují) ──
  const playerMap = {};
  PLAYERS.forEach(name => { playerMap[name] = { name, predictions: {} }; });

  const prevSheet = ss.getSheetByName("Předchozí tipy");
  if (prevSheet) {
    const prevVal = prevSheet.getRange(1, 1).getValue();
    if (prevVal && String(prevVal).trim().startsWith('[')) {
      try {
        const existing = JSON.parse(String(prevVal).trim());
        existing.forEach(p => {
          if (playerMap[p.name]) {
            playerMap[p.name].predictions = Object.assign({}, p.predictions || {});
          }
        });
        Logger.log("✅ Načteny stávající tipy z předchozích kol.");
      } catch(e) {
        Logger.log("⚠️ Nepodařilo se načíst předchozí tipy: " + e.message);
        Logger.log("   Zkontroluj, zda je v záložce 'Předchozí tipy' platný JSON.");
      }
    } else {
      Logger.log("ℹ️  Záložka 'Předchozí tipy' je prázdná – exportuji pouze toto kolo.");
    }
  }

  // ── Načti odpovědi formuláře ──
  const formSheet = ss.getSheets()[0];
  const data = formSheet.getDataRange().getValues();

  if (data.length < 2) {
    Logger.log("⚠️ Žádné odpovědi formuláře zatím.");
    return;
  }

  const headers = data[0];
  const nameCol = headers.findIndex(
    h => String(h).toLowerCase().includes("jméno") || String(h).toLowerCase().includes("jmeno")
  );

  // Mapuj sloupce formuláře na ID zápasů
  const gameColMap = {};
  GAMES.forEach(game => {
    const homeIdx = headers.findIndex(h => String(h) === `${game.home} – góly`);
    const awayIdx = headers.findIndex(h => String(h) === `${game.away} – góly`);
    if (homeIdx >= 0 && awayIdx >= 0) {
      gameColMap[game.id] = { homeIdx, awayIdx };
    }
  });

  if (Object.keys(gameColMap).length === 0) {
    Logger.log("❌ Nepodařilo se namapovat sloupce – zkontroluj, zda GAMES odpovídají formuláři.");
    return;
  }

  // Zpracuj odpovědi – bere POSLEDNÍ odpověď každého hráče (přepíše předchozí)
  for (let r = 1; r < data.length; r++) {
    const row  = data[r];
    const name = String(row[nameCol] || '').trim();
    if (!name || !playerMap[name]) continue;

    Object.entries(gameColMap).forEach(([gameId, { homeIdx, awayIdx }]) => {
      const home = parseInt(row[homeIdx], 10);
      const away = parseInt(row[awayIdx], 10);
      if (!isNaN(home) && !isNaN(away)) {
        playerMap[name].predictions[String(gameId)] = { home, away };
      }
    });
  }

  // ── Výstup ──
  const result = Object.values(playerMap);
  const json = JSON.stringify(result, null, 2);

  // Ulož do záložky "JSON Export" pro snadné kopírování
  let outSheet = ss.getSheetByName("JSON Export");
  if (!outSheet) outSheet = ss.insertSheet("JSON Export");
  outSheet.clearContents();
  outSheet.getRange(1, 1).setValue(json);

  Logger.log("════════════════════════════════════════");
  Logger.log("✅ Hotovo! JSON je uložen v záložce 'JSON Export' Sheetu.");
  Logger.log("   Otevři Sheet → záložka 'JSON Export' → zkopíruj obsah A1");
  Logger.log("   → vlož do players_predictions_ko.json → commitni do gitu.");
  Logger.log("════════════════════════════════════════");
}
