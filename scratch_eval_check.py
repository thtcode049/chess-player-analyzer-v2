from src.game_fetcher import fetch_lichess_games
from src.pgn_parser import parse_pgn

data, err = fetch_lichess_games('trang66', max_games=24)
if data:
    games = parse_pgn(data.decode('utf-8'))
    print(f'Parsed {len(games)} games')
    has_eval_count = sum(1 for g in games if g.get('has_evals'))
    print(f'Games with has_evals: {has_eval_count}')
    for i, g in enumerate(games):
        evals_present = len([e for e in g.get('evals', []) if e])
        if evals_present > 0:
            print(f'Game {i}: has_evals={g.get("has_evals")}, moves={len(g.get("moves", []))}, evals_count={evals_present}')
else:
    print('Err:', err)
