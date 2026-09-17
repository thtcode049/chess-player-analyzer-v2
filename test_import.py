import requests
import json

pgn_content = b"""[Event "Test"]
[White "Carlsen"]
[Black "Nakamura"]
[Result "1-0"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 1-0"""

files = {'file': ('test.pgn', pgn_content, 'text/plain')}
r = requests.post('http://127.0.0.1:8000/api/import/pgn-file', files=files)
print(f"Status: {r.status_code}")
print(json.dumps(r.json(), indent=2))
