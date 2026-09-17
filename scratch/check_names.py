import sys
import os
sys.path.insert(0, os.path.abspath("."))

import api.index
from api.services.db_service import DBService

player_id = "644aef97-c53f-470e-9701-8344fbf90dd6"
db_games = DBService.get_player_games(player_id, limit=500)
print(f"Total db_games: {len(db_games)}")
for i in range(min(10, len(db_games))):
    g = db_games[i]
    print(f"Game {i}: W=\"{g.get('white_player')}\" | B=\"{g.get('black_player')}\"")
