import urllib.request
import json
import time

url = "http://127.0.0.1:8000/api/analysis/runs"
payload = {
    "player_id": "644aef97-c53f-470e-9701-8344fbf90dd6",
    "run_label": "Test Re-run Stockfish Full"
}
data = json.dumps(payload).encode("utf-8")
req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})

print("Sending POST to /api/analysis/runs...", flush=True)
t0 = time.time()
try:
    with urllib.request.urlopen(req, timeout=120) as resp:
        t1 = time.time()
        print(f"Response in {t1-t0:.2f}s, status: {resp.status}", flush=True)
        res_json = json.loads(resp.read().decode("utf-8"))
        print("Success:", res_json.get("success"))
        run_data = res_json.get("data", {})
        print("engine_status:", run_data.get("engine_status"))
        print("engine_coverage_pct:", run_data.get("engine_coverage_pct"))
        print("engine_games_count:", run_data.get("engine_games_count"))
        print("overall_acpl:", run_data.get("overall_acpl"))
        print("acpl_opening:", run_data.get("acpl_opening"))
        print("acpl_middlegame:", run_data.get("acpl_middlegame"))
        print("acpl_endgame:", run_data.get("acpl_endgame"))
except Exception as e:
    print("Error:", e, flush=True)
