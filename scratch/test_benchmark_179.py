import sys
import os
sys.path.insert(0, os.path.abspath("."))

import time
import api.index
from api.services.db_service import DBService
from api.services.analysis_service import AnalysisService

player_id = "644aef97-c53f-470e-9701-8344fbf90dd6"
player_name = "Vu, Bui Thi Thanh Van"
db_games = DBService.get_player_games(player_id, limit=500)
print(f"Total db_games: {len(db_games)}")
games = DBService.convert_db_games_to_analysis_games(db_games, player_name)

t0 = time.time()
print("Starting analysis on all 179 games...", flush=True)
res = AnalysisService.run_complete_analysis(games, player_name=player_name)
t1 = time.time()
print(f"Completed in {t1-t0:.2f}s!", flush=True)
print("  engine_status:", res.get("engine_status"))
print("  engine_coverage_pct:", res.get("engine_coverage_pct"))
print("  engine_games_count:", res.get("engine_games_count"))
print("  overall_acpl:", res.get("overall_acpl"))
print("  acpl_opening:", res.get("acpl_opening"))
print("  acpl_middlegame:", res.get("acpl_middlegame"))
print("  acpl_endgame:", res.get("acpl_endgame"))
