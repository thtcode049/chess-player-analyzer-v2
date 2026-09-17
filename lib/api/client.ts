import {
  Player,
  Game,
  AnalysisRun,
  StrategicBriefing,
  ImportSummary,
  OpeningTreeNode,
  PaginatedResult,
} from "./types";

const API_BASE = ""; // Relative calls proxy through /api/* in Next.js

export const apiClient = {
  async healthCheck() {
    const res = await fetch(`${API_BASE}/api/health`);
    return res.json();
  },

  async getPlayers(): Promise<Player[]> {
    const res = await fetch(`${API_BASE}/api/players`);
    const json = await res.json();
    return json.data || [];
  },

  async createPlayer(data: { canonical_name: string; title?: string; notes?: string }): Promise<Player> {
    const res = await fetch(`${API_BASE}/api/players`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    return json.data;
  },

  async getPlayer(id: string): Promise<Player> {
    const res = await fetch(`${API_BASE}/api/players/${id}`);
    const json = await res.json();
    return json.data;
  },

  async getPlayerGames(
    playerId: string,
    params: { page?: number; pageSize?: number; color?: string; eco?: string } = {}
  ): Promise<PaginatedResult<Game>> {
    const query = new URLSearchParams();
    if (params.page) query.set("page", params.page.toString());
    if (params.pageSize) query.set("page_size", params.pageSize.toString());
    if (params.color) query.set("color", params.color);
    if (params.eco) query.set("eco", params.eco);

    const res = await fetch(`${API_BASE}/api/players/${playerId}/games?${query.toString()}`);
    const json = await res.json();
    return json.data;
  },

  async getGame(gameId: string): Promise<Game> {
    const res = await fetch(`${API_BASE}/api/games/${gameId}`);
    const json = await res.json();
    return json.data;
  },

  async importPgnFile(file: File, playerId?: string, maxGames = 200): Promise<ImportSummary> {
    const formData = new FormData();
    formData.append("file", file);
    if (playerId) formData.append("player_id", playerId);
    formData.append("max_games", maxGames.toString());

    const res = await fetch(`${API_BASE}/api/import/pgn-file`, {
      method: "POST",
      body: formData,
    });
    const json = await res.json();
    return json.data;
  },

  async importPgnText(text: string, datasetName?: string, playerId?: string, maxGames = 200): Promise<ImportSummary> {
    const blob = new Blob([text], { type: "text/plain" });
    const file = new File([blob], `${datasetName || "import"}.pgn`, { type: "text/plain" });
    return this.importPgnFile(file, playerId, maxGames);
  },

  async importLichess(data: { player_id?: string; username: string; max_games?: number; rated_only?: boolean; perf_types?: string[] }): Promise<ImportSummary> {
    const res = await fetch(`${API_BASE}/api/import/lichess`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    return json.data;
  },

  async importChesscom(data: { player_id?: string; username: string; max_games?: number; rated_only?: boolean; perf_types?: string[] }): Promise<ImportSummary> {
    const res = await fetch(`${API_BASE}/api/import/chesscom`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    return json.data;
  },

  async createAnalysisRun(data: {
    player_id: string;
    run_label?: string;
    scope_filter?: Record<string, any>;
    raw_pgn_text?: string;
  }): Promise<AnalysisRun> {
    const res = await fetch(`${API_BASE}/api/analysis/runs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    return json.data;
  },

  async getAnalysisRun(runId: string): Promise<AnalysisRun> {
    const res = await fetch(`${API_BASE}/api/analysis/runs/${runId}`);
    const json = await res.json();
    return json.data;
  },

  async getOpeningTreeBranch(runId: string, fen: string, color: string = "all"): Promise<OpeningTreeNode> {
    const query = new URLSearchParams({ fen, color });
    const res = await fetch(`${API_BASE}/api/analysis/runs/${runId}/tree?${query.toString()}`);
    const json = await res.json();
    return json.data;
  },


  async getAiBriefing(runId: string, perspectiveMode: "self" | "opponent" = "self"): Promise<StrategicBriefing> {
    const res = await fetch(`${API_BASE}/api/ai/briefing`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ run_id: runId, perspective_mode: perspectiveMode }),
    });
    const json = await res.json();
    return json.data;
  },

  async chatAiStream(
    data: {
      run_id: string;
      message: string;
      perspective_mode?: "self" | "opponent";
      history?: Array<{ role: string; content: string }>;
      current_fen?: string;
    },
    callbacks: {
      onChunk: (chunk: string) => void;
      onDone: () => void;
      onError: (err: Error) => void;
    }
  ) {
    try {
      const res = await fetch(`${API_BASE}/api/ai/chat-stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok || !res.body) {
        throw new Error(`Chat stream error: ${res.statusText}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;

          const dataStr = trimmed.slice(5).trim();
          if (dataStr === "[DONE]") {
            callbacks.onDone();
            return;
          }

          try {
            const parsed = JSON.parse(dataStr);
            if (parsed.chunk) {
              callbacks.onChunk(parsed.chunk);
            } else if (parsed.error) {
              callbacks.onError(new Error(parsed.error));
              return;
            }
          } catch {
            // Ignore parse errors on partial chunks
          }
        }
      }
      callbacks.onDone();
    } catch (err) {
      callbacks.onError(err instanceof Error ? err : new Error(String(err)));
    }
  },
};
