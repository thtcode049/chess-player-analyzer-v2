import {
  Player,
  Game,
  AnalysisRun,
  StrategicBriefing,
  ImportSummary,
  OpeningTreeNode,
  PaginatedResult,
} from "./types";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== "undefined" &&
  (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
    ? "http://127.0.0.1:8000"
    : "");

async function handleResponse<T>(res: Response): Promise<T> {
  let json: any = null;
  const contentType = res.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    try {
      json = await res.json();
    } catch {
      // Ignore parsing error, will fall back to text / statusText
    }
  }

  if (!res.ok) {
    let errorMsg = "";
    if (json) {
      if (typeof json.detail === "string") {
        errorMsg = json.detail;
      } else if (Array.isArray(json.detail)) {
        errorMsg = json.detail.map((d: any) => d.msg || JSON.stringify(d)).join("; ");
      } else if (typeof json.message === "string") {
        errorMsg = json.message;
      }
    }
    if (!errorMsg) {
      try {
        const text = await res.text();
        if (text && text.length < 300) {
          errorMsg = text;
        }
      } catch {
        // ignore
      }
    }
    if (!errorMsg) {
      if (res.status === 504 || res.status === 502) {
        errorMsg = "Máy chủ phản hồi quá thời gian chờ (Gateway Timeout). Vui lòng thử lại với số lượng ván đấu ít hơn.";
      } else {
        errorMsg = `Lỗi máy chủ (HTTP ${res.status}: ${res.statusText || "Internal Server Error"})`;
      }
    }
    throw new Error(errorMsg);
  }

  if (json && typeof json === "object") {
    if ("success" in json && json.success === false) {
      throw new Error(json.message || "Yêu cầu thất bại");
    }
    if ("data" in json) {
      return json.data as T;
    }
    return json as T;
  }

  return json as T;
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {};
  if (typeof window !== "undefined") {
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const sb = createClient();
      const { data } = await sb.auth.getSession();
      if (data?.session?.user?.id) {
        headers["X-User-Id"] = data.session.user.id;
        headers["Authorization"] = `Bearer ${data.session.access_token}`;
      }
    } catch (e) {
      console.warn("Could not get supabase session for API headers:", e);
    }
  }
  return headers;
}

async function getUserId(): Promise<string | undefined> {
  if (typeof window !== "undefined") {
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const sb = createClient();
      const { data } = await sb.auth.getSession();
      return data?.session?.user?.id;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

export const apiClient = {
  async healthCheck() {
    const res = await fetch(`${API_BASE}/api/health`);
    return handleResponse<any>(res);
  },

  async getPlayers(): Promise<Player[]> {
    const authHeaders = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/api/players`, {
      headers: authHeaders,
    });
    const data = await handleResponse<Player[]>(res);
    return data || [];
  },

  async createPlayer(data: { canonical_name: string; title?: string; fide_id?: number; notes?: string }): Promise<Player> {
    const authHeaders = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/api/players`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify(data),
    });
    return handleResponse<Player>(res);
  },

  async getPlayer(id: string): Promise<Player> {
    const authHeaders = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/api/players/${id}`, {
      headers: authHeaders,
    });
    return handleResponse<Player>(res);
  },

  async getPlayerGames(
    playerId: string,
    params: { page?: number; pageSize?: number; color?: string; eco?: string } = {}
  ): Promise<PaginatedResult<Game>> {
    const authHeaders = await getAuthHeaders();
    const query = new URLSearchParams();
    if (params.page) query.set("page", params.page.toString());
    if (params.pageSize) query.set("page_size", params.pageSize.toString());
    if (params.color) query.set("color", params.color);
    if (params.eco) query.set("eco", params.eco);

    const res = await fetch(`${API_BASE}/api/players/${playerId}/games?${query.toString()}`, {
      headers: authHeaders,
    });
    return handleResponse<PaginatedResult<Game>>(res);
  },

  async getGame(gameId: string): Promise<Game> {
    const authHeaders = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/api/games/${gameId}`, {
      headers: authHeaders,
    });
    return handleResponse<Game>(res);
  },

  async importPgnFile(file: File, playerId?: string, maxGames = 200, userIdOverride?: string): Promise<ImportSummary> {
    const authHeaders = await getAuthHeaders();
    const userId = userIdOverride || (await getUserId());
    const formData = new FormData();
    formData.append("file", file);
    if (playerId) formData.append("player_id", playerId);
    if (userId) formData.append("user_id", userId);
    formData.append("max_games", maxGames.toString());

    const res = await fetch(`${API_BASE}/api/import/pgn-file`, {
      method: "POST",
      headers: authHeaders,
      body: formData,
    });
    return handleResponse<ImportSummary>(res);
  },

  async importPgnText(text: string, datasetName?: string, playerId?: string, maxGames = 200, userIdOverride?: string): Promise<ImportSummary> {
    const blob = new Blob([text], { type: "text/plain" });
    const file = new File([blob], `${datasetName || "import"}.pgn`, { type: "text/plain" });
    return this.importPgnFile(file, playerId, maxGames, userIdOverride);
  },

  async importLichess(data: { player_id?: string; user_id?: string; username: string; max_games?: number; rated_only?: boolean; perf_types?: string[] }): Promise<ImportSummary> {
    const authHeaders = await getAuthHeaders();
    const userId = data.user_id || (await getUserId());
    const res = await fetch(`${API_BASE}/api/import/lichess`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({ ...data, user_id: userId }),
    });
    return handleResponse<ImportSummary>(res);
  },

  async importChesscom(data: { player_id?: string; user_id?: string; username: string; max_games?: number; rated_only?: boolean; perf_types?: string[] }): Promise<ImportSummary> {
    const authHeaders = await getAuthHeaders();
    const userId = data.user_id || (await getUserId());
    const res = await fetch(`${API_BASE}/api/import/chesscom`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({ ...data, user_id: userId }),
    });
    return handleResponse<ImportSummary>(res);
  },

  async createAnalysisRun(data: {
    player_id: string;
    run_label?: string;
    scope_filter?: Record<string, any>;
    raw_pgn_text?: string;
  }): Promise<AnalysisRun> {
    const authHeaders = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/api/analysis/runs`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify(data),
    });
    return handleResponse<AnalysisRun>(res);
  },

  async getAnalysisRun(runId: string): Promise<AnalysisRun> {
    const authHeaders = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/api/analysis/runs/${runId}`, {
      headers: authHeaders,
    });
    return handleResponse<AnalysisRun>(res);
  },

  async getOpeningTreeBranch(runId: string, fen: string, color: string = "all"): Promise<OpeningTreeNode> {
    const authHeaders = await getAuthHeaders();
    const query = new URLSearchParams({ fen, color });
    const res = await fetch(`${API_BASE}/api/analysis/runs/${runId}/tree?${query.toString()}`, {
      headers: authHeaders,
    });
    return handleResponse<OpeningTreeNode>(res);
  },

  async getAiBriefing(runId: string, perspectiveMode: "self" | "opponent" = "self"): Promise<StrategicBriefing> {
    const res = await fetch(`${API_BASE}/api/ai/briefing`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ run_id: runId, perspective_mode: perspectiveMode }),
    });
    return handleResponse<StrategicBriefing>(res);
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

      if (!res.ok) {
        let errorMsg = res.statusText;
        try {
          const errData = await res.json();
          if (errData?.message) errorMsg = errData.message;
          else if (errData?.detail) errorMsg = typeof errData.detail === "string" ? errData.detail : JSON.stringify(errData.detail);
        } catch {
          // Ignore json parse error
        }
        throw new Error(`Chat stream error (${res.status}): ${errorMsg || "Lỗi máy chủ nội bộ"}`);
      }

      if (!res.body) {
        throw new Error("Chat stream error: Không nhận được luồng dữ liệu từ máy chủ");
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
