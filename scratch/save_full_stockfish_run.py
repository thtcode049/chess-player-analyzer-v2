import sys
import os
sys.path.insert(0, os.path.abspath("."))

import uuid
import time
import api.index
from api.services.db_service import DBService
from api.services.analysis_service import AnalysisService
from src.opening_tree import build_opening_tree

player_id = "644aef97-c53f-470e-9701-8344fbf90dd6"
player_name = "Vu, Bui Thi Thanh Van"

print(f"Fetching games for {player_name} ({player_id})...", flush=True)
db_games = DBService.get_player_games(player_id, limit=500)
print(f"Fetched {len(db_games)} games from DB", flush=True)

games = DBService.convert_db_games_to_analysis_games(db_games, player_name)
print(f"Converted {len(games)} games with accurate player colors", flush=True)

print("Running 100% Stockfish Parallel analysis across all games...", flush=True)
t0 = time.time()
run_res = AnalysisService.run_complete_analysis(
    games=games,
    player_name=player_name,
    color_filter="all",
    run_label=f"Hồ sơ {player_name} (Stockfish Full Analysis)"
)
t1 = time.time()
print(f"Analysis completed in {t1-t0:.2f}s!", flush=True)

# Build color-specific opening trees
_, fm_all = build_opening_tree(games, color="all")
_, fm_w = build_opening_tree(games, color="white")
_, fm_b = build_opening_tree(games, color="black")
run_res["fen_map_all"] = fm_all
run_res["fen_map_white"] = fm_w
run_res["fen_map_black"] = fm_b
run_res["player_name"] = player_name
run_res["player_id"] = player_id

run_id = str(uuid.uuid4())
run_res["run_id"] = run_id

print(f"Saving run {run_id} to Supabase DB...", flush=True)
saved = DBService.save_analysis_run(player_id, run_res, run_id=run_id)
print("Saved successfully!")
print("  engine_status:", saved.get("engine_status"))
print("  engine_coverage_pct:", saved.get("engine_coverage_pct"))
print("  engine_games_count:", saved.get("engine_games_count"))
print("  overall_acpl:", saved.get("overall_acpl"))
print("  acpl_opening:", saved.get("acpl_opening"))
print("  acpl_middlegame:", saved.get("acpl_middlegame"))
print("  acpl_endgame:", saved.get("acpl_endgame"))
print("  dominant_archetype:", saved.get("dominant_archetype"))
