import {
  Player,
  Game,
  AnalysisRun,
  StrategicBriefing,
  ImportSummary,
  OpeningTreeNode,
  PaginatedResult,
  AnalysisRunSyncRequest,
  LichessMastersResponse,
  LichessGameDetail,
  LichessMasterMove,
  LichessMasterTopGame,
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
        return headers;
      }
    } catch (e) {
      console.warn("Could not get supabase session for API headers:", e);
    }

    // Guest Mode Session: lấy hoặc tạo unique guest session ID lưu trong sessionStorage
    try {
      let guestId = sessionStorage.getItem("chess_guest_session_id");
      if (!guestId) {
        guestId = "guest_" + (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2) + Date.now().toString(36));
        sessionStorage.setItem("chess_guest_session_id", guestId);
      }
      headers["X-Guest-Session-Id"] = guestId;
    } catch {
      // In case sessionStorage is blocked by browser privacy settings
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

  async updatePlayer(
    id: string,
    data: { canonical_name?: string; title?: string; fide_id?: number; notes?: string }
  ): Promise<Player> {
    const authHeaders = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/api/players/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify(data),
    });
    return handleResponse<Player>(res);
  },

  async deletePlayer(id: string): Promise<{ deleted: boolean; player_id: string }> {
    const authHeaders = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/api/players/${id}`, {
      method: "DELETE",
      headers: authHeaders,
    });
    return handleResponse<{ deleted: boolean; player_id: string }>(res);
  },

  async getPlayerGames(
    playerId: string,
    params: { page?: number; pageSize?: number; color?: string; eco?: string; search?: string; allGames?: boolean } = {}
  ): Promise<PaginatedResult<Game>> {
    const authHeaders = await getAuthHeaders();
    const query = new URLSearchParams();
    if (params.page) query.set("page", params.page.toString());
    if (params.pageSize) query.set("page_size", params.pageSize.toString());
    if (params.color) query.set("color", params.color);
    if (params.eco) query.set("eco", params.eco);
    if (params.search) query.set("search", params.search);
    if (params.allGames) query.set("all_games", "true");

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

  async importPgnFile(
    file: File,
    playerId?: string,
    maxGames = 1000,
    userIdOverride?: string,
    playerName?: string,
    aliasNames?: string[],
    forceNewPlayer = false
  ): Promise<ImportSummary> {
    const authHeaders = await getAuthHeaders();
    const userId = userIdOverride || (await getUserId());
    const formData = new FormData();
    formData.append("file", file);
    if (playerId) formData.append("player_id", playerId);
    if (playerName) formData.append("player_name", playerName);
    if (aliasNames && aliasNames.length > 0) {
      formData.append("alias_names", JSON.stringify(aliasNames));
    }
    if (userId) formData.append("user_id", userId);
    formData.append("max_games", maxGames.toString());
    if (forceNewPlayer) formData.append("force_new_player", "true");

    const res = await fetch(`${API_BASE}/api/import/pgn-file`, {
      method: "POST",
      headers: authHeaders,
      body: formData,
    });
    return handleResponse<ImportSummary>(res);
  },

  async importPgnText(
    text: string,
    datasetName?: string,
    playerId?: string,
    maxGames = 1000,
    userIdOverride?: string,
    playerName?: string,
    aliasNames?: string[],
    forceNewPlayer = false
  ): Promise<ImportSummary> {
    const blob = new Blob([text], { type: "text/plain" });
    const file = new File([blob], `${datasetName || "import"}.pgn`, { type: "text/plain" });
    return this.importPgnFile(file, playerId, maxGames, userIdOverride, playerName, aliasNames, forceNewPlayer);
  },

  async importLichess(data: {
    player_id?: string;
    user_id?: string;
    username: string;
    max_games?: number;
    rated_only?: boolean;
    perf_types?: string[];
    since?: number;
    until?: number;
    token?: string;
    force_new_player?: boolean;
  }): Promise<ImportSummary> {
    const authHeaders = await getAuthHeaders();
    const userId = data.user_id || (await getUserId());
    const res = await fetch(`${API_BASE}/api/import/lichess`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({ ...data, user_id: userId }),
    });
    return handleResponse<ImportSummary>(res);
  },

  async exchangeLichessCode(data: {
    code: string;
    code_verifier: string;
    redirect_uri: string;
    client_id?: string;
  }): Promise<{ access_token?: string; username?: string; valid: boolean; error?: string }> {
    const res = await fetch(`${API_BASE}/api/import/lichess/oauth-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return handleResponse<{ access_token?: string; username?: string; valid: boolean; error?: string }>(res);
  },

  async verifyLichessToken(token: string): Promise<{ access_token?: string; username?: string; valid: boolean; error?: string }> {
    const res = await fetch(`${API_BASE}/api/import/lichess/verify-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    return handleResponse<{ access_token?: string; username?: string; valid: boolean; error?: string }>(res);
  },

  async importChesscom(data: {
    player_id?: string;
    user_id?: string;
    username: string;
    max_games?: number;
    rated_only?: boolean;
    perf_types?: string[];
    since?: number;
    until?: number;
    force_new_player?: boolean;
  }): Promise<ImportSummary> {
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

  async syncEvaluations(data: AnalysisRunSyncRequest): Promise<AnalysisRun> {
    const authHeaders = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/api/analysis/runs/sync-evaluations`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify(data),
    });
    return handleResponse<AnalysisRun>(res);
  },

  async getOpeningTreeBranch(runId: string, fen: string, color: string = "all", playerId?: string): Promise<OpeningTreeNode> {
    const authHeaders = await getAuthHeaders();
    const query = new URLSearchParams({ fen, color });
    if (playerId) {
      query.set("player_id", playerId);
    }
    const res = await fetch(`${API_BASE}/api/analysis/runs/${runId}/tree?${query.toString()}`, {
      headers: authHeaders,
    });
    return handleResponse<OpeningTreeNode>(res);
  },

  async getLichessMasters(fen: string, token?: string): Promise<LichessMastersResponse> {
    const localToken =
      token ||
      (typeof window !== "undefined"
        ? localStorage.getItem("lichess_token") || ""
        : "");

    if (!localToken || localToken.length < 10) {
      return {
        authenticated: false,
        total_games: 0,
        moves: [],
        top_games: [],
        is_book: false,
        message:
          "Chưa kết nối tài khoản Lichess. Vui lòng bấm 'Ủy quyền Lichess' để xem dữ liệu Kiện tướng quốc tế.",
      };
    }

    try {
      // 1. Direct high-speed call from Browser to Lichess Explorer (Zero backend proxy delay)
      const encodedFen = encodeURIComponent(fen.trim());
      const res = await fetch(
        `https://explorer.lichess.ovh/masters?fen=${encodedFen}&moves=15&topGames=15`,
        {
          headers: {
            Authorization: `Bearer ${localToken}`,
            Accept: "application/json",
          },
        }
      );

      if (res.status === 401) {
        return {
          authenticated: false,
          total_games: 0,
          moves: [],
          top_games: [],
          is_book: false,
          message:
            "Phiên ủy quyền Lichess đã hết hạn hoặc token không hợp lệ. Vui lòng ủy quyền lại.",
        };
      }

      if (res.status === 429) {
        console.warn("[Lichess] Direct call hit 429 rate limit, falling back to backend proxy...");
        // Do not return empty data! Fall through to backend proxy which has its own cache.
      } else if (res.ok) {
        const rawData = await res.json();
        const wTot = rawData.white || 0;
        const dTot = rawData.draws || 0;
        const bTot = rawData.black || 0;
        const totalG = wTot + dTot + bTot;

        const parsedMoves: LichessMasterMove[] = [];
        for (const m of rawData.moves || []) {
          const mw = m.white || 0;
          const md = m.draws || 0;
          const mb = m.black || 0;
          const mg = mw + md + mb;
          if (mg === 0) continue;
          parsedMoves.push({
            san: m.san || "",
            uci: m.uci || "",
            games_count: mg,
            white: mw,
            draws: md,
            black: mb,
            win_pct: Number(((mw / mg) * 100).toFixed(1)),
            draw_pct: Number(((md / mg) * 100).toFixed(1)),
            loss_pct: Number(((mb / mg) * 100).toFixed(1)),
            score_pct: Number((((mw + 0.5 * md) / mg) * 100).toFixed(1)),
            average_rating: m.averageRating,
          });
        }

        const rawTopGames = rawData.topGames || [];
        const parsedTopGames: LichessMasterTopGame[] = [];
        for (const g of rawTopGames) {
          const wObj = g.white || {};
          const bObj = g.black || {};
          const winner = g.winner;
          const resStr =
            winner === "white" ? "1-0" : winner === "black" ? "0-1" : "½-½";
          parsedTopGames.push({
            id: String(g.id || ""),
            white: {
              name: wObj.name || "Unknown White",
              rating: wObj.rating,
            },
            black: {
              name: bObj.name || "Unknown Black",
              rating: bObj.rating,
            },
            year: g.year,
            month: g.month,
            winner,
            result: resStr,
            uci: g.uci,
          });
        }

        const rawOpening = rawData.opening || null;

        return {
          authenticated: true,
          total_games: totalG,
          moves: parsedMoves,
          top_games: parsedTopGames,
          opening: rawOpening ? { eco: rawOpening.eco || "", name: rawOpening.name || "" } : null,
          is_book: false,
          message: undefined,
        };
      }
    } catch (directErr) {
      console.warn("Direct Lichess fetch encountered error, attempting fallback via backend proxy:", directErr);
    }

    // 2. Fallback to backend proxy if direct fetch fails (e.g. adblocker, strict network)
    try {
      const authHeaders = await getAuthHeaders();
      const query = new URLSearchParams({ fen });
      if (localToken) {
        authHeaders["X-Lichess-Token"] = localToken;
      }
      const res = await fetch(`${API_BASE}/api/analysis/lichess-masters?${query.toString()}`, {
        headers: authHeaders,
      });
      return handleResponse<LichessMastersResponse>(res);
    } catch (fallbackErr) {
      console.error("Both direct Lichess and proxy failed:", fallbackErr);
      return {
        authenticated: true,
        total_games: 0,
        moves: [],
        top_games: [],
        is_book: false,
        is_rate_limited: true,
        message: "Lichess giới hạn tần suất truy vấn (1 req/giây). Vui lòng đợi 2-3 giây rồi bấm Thử lại.",
      };
    }
  },

  async getLichessGame(gameId: string): Promise<LichessGameDetail> {
    // 1. Direct high-speed fetch from Lichess public export API
    try {
      const directRes = await fetch(
        `https://lichess.org/game/export/${encodeURIComponent(gameId)}?moves=true&tags=true&clocks=false&evals=false`,
        {
          headers: {
            Accept: "application/json",
            "User-Agent": "ChessPlayerAnalyzer/2.0",
          },
        }
      );
      if (directRes.ok) {
        const data = await directRes.json();
        const players = data.players || {};
        const wPlayer = players.white || {};
        const bPlayer = players.black || {};
        const wName = (wPlayer.user?.name) || wPlayer.name || "Trắng";
        const bName = (bPlayer.user?.name) || bPlayer.name || "Đen";
        const winner = data.winner;
        const result = winner === "white" ? "1-0" : winner === "black" ? "0-1" : "½-½";
        const rawMoves = data.moves || "";
        const movesList = rawMoves.split(" ").filter(Boolean);
        const openingInfo = data.opening || {};

        return {
          id: data.id || gameId,
          white: wName,
          white_elo: wPlayer.rating,
          black: bName,
          black_elo: bPlayer.rating,
          result,
          moves: movesList,
          moves_san: rawMoves,
          event: data.event || openingInfo.name || "Lichess Master Game",
          date: String(data.createdAt || data.lastMoveAt || ""),
          site: `https://lichess.org/${gameId}`,
          eco: openingInfo.eco || "",
          opening: openingInfo.name || "",
        };
      }
    } catch (err) {
      console.warn("Direct Lichess game export failed, falling back to backend proxy:", err);
    }

    // 2. Fallback to backend proxy
    const authHeaders = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/api/analysis/lichess-game/${encodeURIComponent(gameId)}`, {
      headers: authHeaders,
    });
    return handleResponse<LichessGameDetail>(res);
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
