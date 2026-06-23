#!/usr/bin/env python3
"""
sync_live_scores.py
====================
Stáhne aktuální data ze https://worldcup26.ir/get/games (stejný zdroj, který
v prohlížeči používá klientská "live API" vrstva v index.html) a promítne
nově odehrané zápasy do games.json, aby statický fallback nikdy nezůstal
příliš starý, i kdyby live API zrovna nebylo dostupné.

Pravidla mergování
------------------
- Jednosměrný merge: live API → games.json, párování podle shodného `id`.
- Pokud games.json už má daný zápas finished=True, nic se nemění
  (manuální zásah má vždy přednost).
- Pokud live API hlásí finished a games.json ještě ne, doplní se
  finished/homeScore/awayScore.
"""

import json
import os
import sys
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

try:
    import requests
except ImportError:
    print("ERROR: Modul 'requests' není nainstalovaný. Spusť: pip install requests")
    sys.exit(1)

LIVE_API_URL      = "https://worldcup26.ir/get/games"
GAMES_JSON_PATH   = Path(__file__).parent.parent / "games.json"
PREDICTIONS_PATH  = Path(__file__).parent.parent / "players_predictions.json"
TIMEOUT_SEC       = 15
ONESIGNAL_APP_ID  = os.environ.get("ONESIGNAL_APP_ID", "")
ONESIGNAL_API_KEY = os.environ.get("ONESIGNAL_API_KEY", "")


def count_exact_hits(game_id, home_score, away_score) -> int:
    try:
        with open(PREDICTIONS_PATH, encoding="utf-8") as f:
            players = json.load(f)
        return sum(
            1 for p in players
            if p.get("predictions", {}).get(str(game_id), {}).get("home") == home_score
            and p.get("predictions", {}).get(str(game_id), {}).get("away") == away_score
        )
    except Exception:
        return 0


def send_result_notification(game, home_score, away_score):
    if not ONESIGNAL_APP_ID or not ONESIGNAL_API_KEY:
        return
    exact = count_exact_hits(game.get("id"), home_score, away_score)
    home  = game.get("homeTeam", "?")
    away  = game.get("awayTeam", "?")
    title = f"⚽ Výsledek: {home} vs {away}"
    body  = f"{home} {home_score}:{away_score} {away}"
    if exact:
        body += f" · {exact}× přesný tip 🎯"
    payload = {
        "app_id":            ONESIGNAL_APP_ID,
        "included_segments": ["All"],
        "headings":  {"en": title, "cs": title},
        "contents":  {"en": body,  "cs": body},
    }
    try:
        resp = requests.post(
            "https://onesignal.com/api/v1/notifications",
            json=payload,
            headers={"Authorization": f"Basic {ONESIGNAL_API_KEY}"},
            timeout=10,
        )
        print(f"  [NOTIFY] {title} — HTTP {resp.status_code}")
    except Exception as e:
        print(f"  [NOTIFY] Chyba při odesílání notifikace: {e}")


def is_finished(value) -> bool:
    if value is True:
        return True
    if isinstance(value, str):
        return value.strip().upper() == "TRUE"
    return False


def parse_score(value):
    if value is None:
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, str):
        v = value.strip()
        if not v or v.lower() == "null":
            return None
        try:
            return int(v)
        except ValueError:
            return None
    return None


def main():
    print(f"[{datetime.now(ZoneInfo('Europe/Prague')):%Y-%m-%d %H:%M}] Spouštím sync_live_scores.py")

    if not GAMES_JSON_PATH.exists():
        print(f"ERROR: {GAMES_JSON_PATH} neexistuje")
        sys.exit(1)

    with open(GAMES_JSON_PATH, encoding="utf-8") as f:
        local_data = json.load(f)

    local_games = local_data.get("games", [])
    print(f"  Načteno {len(local_games)} zápasů z games.json")

    print(f"  Stahuji: {LIVE_API_URL}")
    try:
        resp = requests.get(LIVE_API_URL, timeout=TIMEOUT_SEC)
        resp.raise_for_status()
        remote_data = resp.json()
    except requests.RequestException as e:
        print(f"ERROR: Nepodařilo se stáhnout data: {e}")
        sys.exit(1)

    remote_games = remote_data if isinstance(remote_data, list) else remote_data.get("games", [])
    print(f"  Staženo {len(remote_games)} zápasů z live API")

    remote_by_id = {str(g.get("id")): g for g in remote_games if g.get("id") is not None}

    updated_count  = 0
    finished_games = []
    for game in local_games:
        if game.get("finished"):
            continue  # manuální/dříve potvrzený výsledek je nedotknutelný

        remote = remote_by_id.get(str(game.get("id")))
        if not remote or not is_finished(remote.get("finished")):
            continue

        home_score = parse_score(remote.get("home_score"))
        away_score = parse_score(remote.get("away_score"))
        if home_score is None or away_score is None:
            continue

        game["finished"]  = True
        game["homeScore"] = home_score
        game["awayScore"] = away_score
        print(f"  [UPDATE] {game.get('homeTeam')} {home_score}:{away_score} {game.get('awayTeam')} (id {game.get('id')})")
        updated_count += 1
        finished_games.append((game, home_score, away_score))

    if updated_count > 0:
        local_data["lastUpdate"]   = datetime.now(ZoneInfo("Europe/Prague")).strftime("%Y-%m-%d %H:%M")
        local_data["updateSource"] = "auto"
        with open(GAMES_JSON_PATH, "w", encoding="utf-8") as f:
            json.dump(local_data, f, ensure_ascii=False, indent=2)
            f.write("\n")
        print(f"\n✓ Uloženo: {updated_count} nových výsledků")
        for g, hs, as_ in finished_games:
            send_result_notification(g, hs, as_)
    else:
        print("\n– Žádná změna")


if __name__ == "__main__":
    main()
