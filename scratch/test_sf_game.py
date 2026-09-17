import sys
import os
sys.path.insert(0, os.path.abspath("."))

import time
import api.index
from api.services.db_service import DBService
from src.engine.stockfish_engine import StockfishEngine
from src.engine.evaluator import analyze_game_moves

print("1. Starting test...", flush=True)
player_id = "644aef97-c53f-470e-9701-8344fbf90dd6"
db_games = DBService.get_player_games(player_id, limit=1)
games = DBService.convert_db_games_to_analysis_games(db_games, "Vu, Bui Thi Thanh Van")
g = games[0]
print(f"Game moves count: {len(g.get('moves', []))}, player_color: {g.get('player_color')}", flush=True)

eng = StockfishEngine(depth=6)
print(f"Engine available: {eng.is_available()}, path: {eng.path}", flush=True)
t0 = time.time()
res = analyze_game_moves(g, eng, depth=6)
t1 = time.time()
print(f"Analyzed {len(res)} moves in {t1-t0:.2f}s", flush=True)
if res:
    print(f"First move eval: {res[0]}", flush=True)
eng.close()
