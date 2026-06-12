#!/usr/bin/env python3
"""
update_scores.py
================
Stáhne výsledky ze https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json
a aktualizuje games.json v repozitáři.

Pravidla mergování
------------------
- Pouze jednosměrný merge: openfootball → games.json
- Pokud games.json má finished=True a openfootball ho nemá,
  lokální data zůstanou (manuální override je nedotknutelný).
- Pokud openfootball má skóre a games.json ho ještě nemá,
  skóre se doplní a finished se nastaví na True.
- ID zápasů se nikdy nemění.
"""

import json
import sys
import re
from datetime import datetime, timezone
from pathlib import Path

try:
    import requests
except ImportError:
    print("ERROR: Modul 'requests' není nainstalovaný. Spusť: pip install requests")
    sys.exit(1)

# ── Konfigurace ────────────────────────────────────────────────
OPENFOOTBALL_URL = (
    "https://raw.githubusercontent.com/"
    "openfootball/worldcup.json/master/2026/worldcup.json"
)
GAMES_JSON_PATH = Path(__file__).parent.parent / "games.json"
TIMEOUT_SEC     = 15

# ── Normalizace jmen týmů ─────────────────────────────────────
# Openfootball používá jiná pojmenování než náš games.json.
# Klíč = openfootball jméno, hodnota = naše jméno v games.json.
TEAM_NAME_MAP = {
    # Skupina A
    "Mexico":                "Mexico",
    "South Africa":          "South Africa",
    "South Korea":           "South Korea",
    "Czech Republic":        "Czech Republic",
    # Skupina B
    "Canada":                "Canada",
    "Bosnia and Herzegovina":"Bosnia and Herzegovina",
    "Qatar":                 "Qatar",
    "Switzerland":           "Switzerland",
    # Skupina C
    "Brazil":                "Brazil",
    "Morocco":               "Morocco",
    "Haiti":                 "Haiti",
    "Scotland":              "Scotland",
    # Skupina D
    "United States":         "United States",
    "USA":                   "United States",
    "Paraguay":              "Paraguay",
    "Australia":             "Australia",
    "Turkey":                "Turkey",
    # Skupina E
    "Germany":               "Germany",
    "Curaçao":               "Curaçao",
    "Curacao":               "Curaçao",
    "Ivory Coast":           "Ivory Coast",
    "Ecuador":               "Ecuador",
    # Skupina F
    "Netherlands":           "Netherlands",
    "Japan":                 "Japan",
    "Sweden":                "Sweden",
    "Tunisia":               "Tunisia",
    # Skupina G
    "Belgium":               "Belgium",
    "Egypt":                 "Egypt",
    "Iran":                  "Iran",
    "New Zealand":           "New Zealand",
    # Skupina H
    "Spain":                 "Spain",
    "Cape Verde":            "Cape Verde",
    "Saudi Arabia":          "Saudi Arabia",
    "Uruguay":               "Uruguay",
    # Skupina I
    "France":                "France",
    "Senegal":               "Senegal",
    "Iraq":                  "Iraq",
    "Norway":                "Norway",
    # Skupina J
    "Argentina":             "Argentina",
    "Algeria":               "Algeria",
    "Austria":               "Austria",
    "Jordan":                "Jordan",
    # Skupina K
    "Portugal":              "Portugal",
    "DR Congo":              "DR Congo",
    "Uzbekistan":            "Uzbekistan",
    "Colombia":              "Colombia",
    # Skupina L
    "England":               "England",
    "Croatia":               "Croatia",
    "Ghana":                 "Ghana",
    "Panama":                "Panama",
}


def normalize_team(name: str) -> str:
    """Převede jméno týmu z openfootball na naše jméno."""
    return TEAM_NAME_MAP.get(name, name)


def parse_openfootball_date(date_str: str, time_str: str) -> str:
    """
    Sestaví kickoff string ve formátu 'YYYY-MM-DD HH:MM' z openfootball polí.
    Openfootball time může vypadat jako "13:00 UTC-6" – extrahujeme jen čas.
    """
    time_clean = re.split(r'\s', time_str.strip())[0]  # "13:00 UTC-6" → "13:00"
    return f"{date_str} {time_clean}"


def parse_score(score_data) -> tuple[int, int] | None:
    """
    Parsuje score pole z openfootball.
    Formát: {"ft": [2, 0]} nebo {"ht": [1,0], "ft": [2,0]}
    Vrátí (home, away) nebo None pokud skóre není k dispozici.
    """
    if not score_data:
        return None
    ft = score_data.get("ft")
    if ft and isinstance(ft, (list, tuple)) and len(ft) == 2:
        try:
            return int(ft[0]), int(ft[1])
        except (TypeError, ValueError):
            return None
    return None


def build_lookup_from_openfootball(matches: list) -> dict:
    """
    Vytvoří slovník pro rychlé vyhledání: (home_norm, away_norm) → match_data
    Zahrnuje pouze skupinová utkání (round obsahuje "Matchday" nebo "Group").
    """
    lookup = {}
    for match in matches:
        round_name = match.get("round", "")
        # Zahrneme skupinovou fázi; knockout fáze má TBD týmy
        if "Matchday" not in round_name and "Group" not in round_name:
            continue
        home = normalize_team(match.get("team1", ""))
        away = normalize_team(match.get("team2", ""))
        if home and away:
            lookup[(home, away)] = match
    return lookup


def main():
    print(f"[{datetime.now(timezone.utc):%Y-%m-%d %H:%M UTC}] Spouštím update_scores.py")

    # ── 1. Načti aktuální games.json ──────────────────────────
    if not GAMES_JSON_PATH.exists():
        print(f"ERROR: {GAMES_JSON_PATH} neexistuje")
        sys.exit(1)

    with open(GAMES_JSON_PATH, encoding="utf-8") as f:
        local_data = json.load(f)

    local_games = local_data.get("games", [])
    print(f"  Načteno {len(local_games)} zápasů z games.json")

    # ── 2. Stáhni openfootball JSON ───────────────────────────
    print(f"  Stahuji: {OPENFOOTBALL_URL}")
    try:
        resp = requests.get(OPENFOOTBALL_URL, timeout=TIMEOUT_SEC)
        resp.raise_for_status()
        remote_data = resp.json()
    except requests.RequestException as e:
        print(f"ERROR: Nepodařilo se stáhnout data: {e}")
        sys.exit(1)

    remote_matches = remote_data.get("matches", [])
    print(f"  Staženo {len(remote_matches)} zápasů z openfootball")

    # ── 3. Sestav lookup tabulku ──────────────────────────────
    lookup = build_lookup_from_openfootball(remote_matches)
    print(f"  Skupinových zápasů v lookup: {len(lookup)}")

    # ── 4. Merguj výsledky ────────────────────────────────────
    updated_count  = 0
    skipped_manual = 0
    not_found      = 0

    for game in local_games:
        # Přeskočíme ne-skupinové zápasy (knockout – týmy zatím nejsou known)
        if game.get("type") != "group":
            continue

        home = game["homeTeam"]
        away = game["awayTeam"]
        key  = (home, away)

        remote_match = lookup.get(key)
        if not remote_match:
            not_found += 1
            continue

        score = parse_score(remote_match.get("score"))

        if score is None:
            # Openfootball zápas ještě nemá výsledek
            if game.get("finished"):
                # Náš games.json má výsledek (manuální) → necháme být
                skipped_manual += 1
            continue

        home_score, away_score = score

        if game.get("finished"):
            # Lokální data jsou již odehraná
            if game.get("homeScore") != home_score or game.get("awayScore") != away_score:
                # Nesoulad – openfootball má jiné skóre než náš manuální zápis
                # Preferujeme lokální manuální data
                print(
                    f"  [SKIP] {home} vs {away}: "
                    f"lokálně {game['homeScore']}:{game['awayScore']}, "
                    f"openfootball {home_score}:{away_score} – ponecháváme lokální"
                )
                skipped_manual += 1
            continue

        # Zápas ještě není v games.json označen jako odehraný → aktualizujeme
        game["finished"]  = True
        game["homeScore"] = home_score
        game["awayScore"] = away_score
        print(f"  [UPDATE] {home} {home_score}:{away_score} {away}")
        updated_count += 1

    # ── 5. Aktualizuj metadata ────────────────────────────────
    if updated_count > 0:
        local_data["lastUpdate"]       = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M")
        local_data["updateSource"]     = "auto"
        # Zachováme i lastManualUpdate pro případ, že bylo nastaveno ručně
        # (nepřepisujeme ho – jen přidáváme/aktualizujeme lastUpdate)

    # ── 6. Uložení ────────────────────────────────────────────
    if updated_count > 0:
        with open(GAMES_JSON_PATH, "w", encoding="utf-8") as f:
            json.dump(local_data, f, ensure_ascii=False, indent=2)
        print(f"\n✓ Uloženo: {updated_count} nových výsledků")
    else:
        print(f"\n– Žádná změna ({skipped_manual} manuálních, {not_found} nenalezeno)")

    print(f"  Hotovo.")


if __name__ == "__main__":
    main()
