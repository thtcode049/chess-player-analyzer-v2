import sys
import os
sys.path.insert(0, os.path.abspath("."))

import api.index
from api.services.db_service import DBService
from api.services.analysis_service import AnalysisService

player_id = "644aef97-c53f-470e-9701-8344fbf90dd6"
player_name = "Vu, Bui Thi Thanh Van"
db_games = DBService.get_player_games(player_id, limit=500)
print(f"Total db_games: {len(db_games)}")
games = DBService.convert_db_games_to_analysis_games(db_games, player_name)
print(f"Total converted games: {len(games)}")

# Let's test with 5 games first
res_5 = AnalysisService.run_complete_analysis(games[:5], player_name=player_name)
print("5 games result:")
print("  engine_status:", res_5.get("engine_status"))
print("  engine_coverage_pct:", res_5.get("engine_coverage_pct"))
print("  engine_games_count:", res_5.get("engine_games_count"))
print("  overall_acpl:", res_5.get("overall_acpl"))
print("  acpl_opening:", res_5.get("acpl_opening"))
print("  acpl_middlegame:", res_5.get("acpl_middlegame"))
print("  acpl_endgame:", res_5.get("acpl_endgame"))
