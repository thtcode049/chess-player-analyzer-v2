"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { 
  UploadCloud, 
  Globe, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Database, 
  User, 
  BarChart3, 
  ArrowRight,
  UserCheck,
  ChevronDown,
  Calendar,
  Zap,
  Clock,
  ShieldCheck,
  LogOut,
  Download,
  Search,
  Users,
  Sparkles,
  X
} from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { ImportSummary, Player } from "@/lib/api/types";

export interface ImportProgressState {
  stage: number;
  totalStages: number;
  percent: number;
  stageName: string;
  detail: string;
  elapsedSeconds: number;
}

export interface DetectedPlayerInfo {
  name: string;
  rawNames: string[];
  rawStats: { name: string; count: number; white: number; black: number }[];
  gameCount: number;
  whiteCount: number;
  blackCount: number;
  hasMergedVariants: boolean;
}

function cleanPlayerName(name: string): string {
  // Normalize unicode NFD to strip diacritics
  let s = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  // Replace Vietnamese đ/Đ
  s = s.replace(/[đĐ]/g, "d");
  // Remove special characters, accents often corrupted in VIQR/VNI: ~ ` ' ? ^
  s = s.replace(/[~`'?^]/g, "");
  // Replace punctuation and commas with spaces
  s = s.replace(/[,._\-\/\\|+*]/g, " ");
  // Collapse whitespace and lowercase
  return s.toLowerCase().trim().replace(/\s+/g, " ");
}

function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

function stringSimilarity(a: string, b: string): number {
  if (a === b) return 1.0;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1.0;
  return 1 - levenshteinDistance(a, b) / maxLen;
}

function arePlayerNamesSimilar(nameA: string, nameB: string): boolean {
  if (nameA === nameB) return true;
  const cleanA = cleanPlayerName(nameA);
  const cleanB = cleanPlayerName(nameB);
  if (cleanA === cleanB) return true;

  const wordsA = cleanA.split(" ").filter((w) => w.length > 0);
  const wordsB = cleanB.split(" ").filter((w) => w.length > 0);

  // If both have multiple words:
  if (wordsA.length >= 2 && wordsB.length >= 2) {
    // Check first word (often family name e.g. "vu" vs "vu")
    if (wordsA[0] !== wordsB[0]) {
      return false;
    }
    // Check word count difference
    if (Math.abs(wordsA.length - wordsB.length) > 1) {
      return false;
    }
  }

  // Token set check or overall Levenshtein similarity on cleaned strings
  const sim = stringSimilarity(cleanA, cleanB);
  if (sim >= 0.80) return true;

  // Also check if words match closely with prefix (e.g. "th" vs "thi")
  if (wordsA.length === wordsB.length && wordsA.length >= 3) {
    let matchedWords = 0;
    for (let i = 0; i < wordsA.length; i++) {
      const wa = wordsA[i];
      const wb = wordsB[i];
      if (wa === wb || wa.startsWith(wb) || wb.startsWith(wa) || stringSimilarity(wa, wb) >= 0.7) {
        matchedWords++;
      }
    }
    if (matchedWords >= wordsA.length - 0.5) return true;
  }

  return false;
}

function nameQualityScore(name: string): number {
  let score = 0;
  for (const ch of name) {
    if ("?~`^".includes(ch)) score += 10;
  }
  return score;
}

function extractPlayersFromPgn(pgnText: string): DetectedPlayerInfo[] {
  const playerCounts: Record<string, { count: number; white: number; black: number }> = {};
  const whiteRegex = /\[White\s+["']([^"']+)["']\]/gi;
  const blackRegex = /\[Black\s+["']([^"']+)["']\]/gi;

  let match;
  while ((match = whiteRegex.exec(pgnText)) !== null) {
    const name = match[1].trim();
    if (name && name !== "?" && name.toLowerCase() !== "unknown") {
      if (!playerCounts[name]) playerCounts[name] = { count: 0, white: 0, black: 0 };
      playerCounts[name].count += 1;
      playerCounts[name].white += 1;
    }
  }

  while ((match = blackRegex.exec(pgnText)) !== null) {
    const name = match[1].trim();
    if (name && name !== "?" && name.toLowerCase() !== "unknown") {
      if (!playerCounts[name]) playerCounts[name] = { count: 0, white: 0, black: 0 };
      playerCounts[name].count += 1;
      playerCounts[name].black += 1;
    }
  }

  const rawList = Object.entries(playerCounts)
    .map(([name, stats]) => ({
      name,
      count: stats.count,
      white: stats.white,
      black: stats.black,
    }))
    .sort((a, b) => b.count - a.count);

  const clusters: DetectedPlayerInfo[] = [];

  for (const item of rawList) {
    const matchedCluster = clusters.find((c) =>
      c.rawNames.some((rn) => arePlayerNamesSimilar(rn, item.name))
    );

    if (matchedCluster) {
      matchedCluster.rawNames.push(item.name);
      matchedCluster.rawStats.push(item);
      matchedCluster.gameCount += item.count;
      matchedCluster.whiteCount += item.white;
      matchedCluster.blackCount += item.black;
      matchedCluster.hasMergedVariants = true;

      // Select cleanest name: lowest corruption score, tie-break with largest game count
      if (nameQualityScore(item.name) < nameQualityScore(matchedCluster.name)) {
        matchedCluster.name = item.name;
      }
    } else {
      clusters.push({
        name: item.name,
        rawNames: [item.name],
        rawStats: [item],
        gameCount: item.count,
        whiteCount: item.white,
        blackCount: item.black,
        hasMergedVariants: false,
      });
    }
  }

  return clusters.sort((a, b) => b.gameCount - a.gameCount);
}

// PKCE Helper Functions for Lichess OAuth
function generateRandomString(length = 64): string {
  const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  let text = "";
  const values = new Uint8Array(length);
  crypto.getRandomValues(values);
  for (let i = 0; i < length; i++) {
    text += possible[values[i] % possible.length];
  }
  return text;
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(digest);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

type TimeRangePreset = "all" | "30d" | "3m" | "6m" | "1y" | "custom";

const TIME_PRESETS: { id: TimeRangePreset; label: string }[] = [
  { id: "all", label: "Tất cả" },
  { id: "30d", label: "30 ngày gần nhất" },
  { id: "3m", label: "3 tháng" },
  { id: "6m", label: "6 tháng" },
  { id: "1y", label: "1 năm" },
  { id: "custom", label: "Tùy chỉnh" },
];

const LICHESS_PERF_OPTIONS = [
  { id: "blitz", label: "Blitz (Chớp)" },
  { id: "rapid", label: "Rapid (Nhanh)" },
  { id: "classical", label: "Classical (Tiêu chuẩn)" },
  { id: "bullet", label: "Bullet (Siêu chớp)" },
];

const CHESSCOM_PERF_OPTIONS = [
  { id: "blitz", label: "Blitz (Chớp)" },
  { id: "rapid", label: "Rapid (Nhanh)" },
  { id: "bullet", label: "Bullet (Siêu chớp)" },
  { id: "daily", label: "Daily (Hàng ngày)" },
];

function computeTimeBounds(
  preset: TimeRangePreset,
  customStart: string,
  customEnd: string
): { since?: number; until?: number } {
  const now = Date.now();
  if (preset === "30d") return { since: now - 30 * 24 * 60 * 60 * 1000 };
  if (preset === "3m") return { since: now - 90 * 24 * 60 * 60 * 1000 };
  if (preset === "6m") return { since: now - 180 * 24 * 60 * 60 * 1000 };
  if (preset === "1y") return { since: now - 365 * 24 * 60 * 60 * 1000 };
  if (preset === "custom") {
    const s = customStart ? new Date(customStart).getTime() : undefined;
    const u = customEnd ? new Date(customEnd).getTime() + 86399999 : undefined;
    return { since: s, until: u };
  }
  return {};
}

function ImportContent() {
  const searchParams = useSearchParams();
  const paramPlayerId = searchParams.get("playerId") || "";
  const paramPlayerName = searchParams.get("playerName") || "";

  const [activeTab, setActiveTab] = useState<"pgn" | "lichess" | "chesscom">("lichess");
  const [userId, setUserId] = useState<string | null>(null);

  // Existing players list and target player selection
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>(paramPlayerId);
  const [, setLoadingPlayers] = useState(true);

  // Lichess OAuth & Token state
  const [lichessToken, setLichessToken] = useState<string>("");
  const [lichessAuthUser, setLichessAuthUser] = useState<string>("");
  const [isVerifyingLichess, setIsVerifyingLichess] = useState(false);

  // PGN Upload states
  const [pgnFile, setPgnFile] = useState<File | null>(null);
  const [pgnText, setPgnText] = useState("");
  const [detectedPlayers, setDetectedPlayers] = useState<DetectedPlayerInfo[]>([]);
  const [selectedFocusPlayer, setSelectedFocusPlayer] = useState<string>("");
  const [playerSearchFilter, setPlayerSearchFilter] = useState<string>("");

  // Lichess states
  const [lichessUsername, setLichessUsername] = useState("");
  const [lichessMaxGames, setLichessMaxGames] = useState<number | "">("");
  const [lichessRatedOnly, setLichessRatedOnly] = useState(true);
  const [lichessSelectedPerfs, setLichessSelectedPerfs] = useState<string[]>(["blitz", "rapid"]);
  const [lichessTimePreset, setLichessTimePreset] = useState<TimeRangePreset>("all");
  const [lichessCustomStart, setLichessCustomStart] = useState("");
  const [lichessCustomEnd, setLichessCustomEnd] = useState("");

  // Chess.com states
  const [chesscomUsername, setChesscomUsername] = useState("");
  const [chesscomMaxGames, setChesscomMaxGames] = useState<number | "">("");
  const [chesscomRatedOnly, setChesscomRatedOnly] = useState(true);
  const [chesscomSelectedPerfs, setChesscomSelectedPerfs] = useState<string[]>(["blitz", "rapid"]);
  const [chesscomTimePreset, setChesscomTimePreset] = useState<TimeRangePreset>("all");
  const [chesscomCustomStart, setChesscomCustomStart] = useState("");
  const [chesscomCustomEnd, setChesscomCustomEnd] = useState("");

  // Loading & Result states
  const [isLoading, setIsLoading] = useState(false);
  const [importProgress, setImportProgress] = useState<ImportProgressState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportSummary | null>(null);

  // Load user session
  useEffect(() => {
    import("@/lib/supabase/client").then(({ createClient }) => {
      const sb = createClient();
      sb.auth.getUser().then(({ data }) => {
        if (data.user) setUserId(data.user.id);
      });
    });
  }, []);

  // Fetch players for selector
  useEffect(() => {
    const fetchPlayers = async () => {
      try {
        setLoadingPlayers(true);
        const data = await apiClient.getPlayers();
        setPlayers(data || []);
      } catch (err) {
        console.warn("Không thể tải danh sách kỳ thủ:", err);
      } finally {
        setLoadingPlayers(false);
      }
    };
    fetchPlayers();
  }, []);

  // Update selectedPlayerId if param changes
  useEffect(() => {
    if (paramPlayerId) {
      setSelectedPlayerId(paramPlayerId);
    }
  }, [paramPlayerId]);

  // Load persisted Lichess token & account on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedToken = localStorage.getItem("lichess_token");
      const savedUser = localStorage.getItem("lichess_username");
      if (savedToken) {
        setLichessToken(savedToken);
        if (savedUser) {
          setLichessAuthUser(savedUser);
          setLichessUsername(savedUser);
        }
      }
    }
  }, []);

  // Handle Lichess OAuth redirect callback
  useEffect(() => {
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    if (code && typeof window !== "undefined") {
      const savedVerifier = localStorage.getItem("lichess_oauth_verifier");
      const savedState = localStorage.getItem("lichess_oauth_state");

      // Clean query parameters from URL
      window.history.replaceState({}, document.title, window.location.pathname);

      if (savedState && state && savedState !== state) {
        setError("OAuth state không khớp hoặc phiên đã hết hạn. Vui lòng thử lại.");
        return;
      }

      if (savedVerifier) {
        setIsVerifyingLichess(true);
        const redirectUri = `${window.location.origin}/import`;
        apiClient
          .exchangeLichessCode({
            code,
            code_verifier: savedVerifier,
            redirect_uri: redirectUri,
            client_id: window.location.origin,
          })
          .then((res) => {
            if (res.access_token) {
              setLichessToken(res.access_token);
              localStorage.setItem("lichess_token", res.access_token);
              if (res.username) {
                setLichessAuthUser(res.username);
                setLichessUsername(res.username);
                localStorage.setItem("lichess_username", res.username);
              }
              setActiveTab("lichess");
            } else {
              setError(res.error || "Không thể xác thực OAuth với Lichess.");
            }
          })
          .catch((err) => {
            setError(err.message || "Lỗi khi trao đổi mã xác thực với Lichess.");
          })
          .finally(() => {
            setIsVerifyingLichess(false);
            localStorage.removeItem("lichess_oauth_verifier");
            localStorage.removeItem("lichess_oauth_state");
          });
      }
    }
  }, [searchParams]);

  const selectedPlayer = players.find((p) => p.id === selectedPlayerId);

  // Authorize Lichess via OAuth PKCE
  const handleAuthorizeLichess = async () => {
    try {
      setError(null);
      const verifier = generateRandomString(64);
      const challenge = await generateCodeChallenge(verifier);
      const state = generateRandomString(16);

      localStorage.setItem("lichess_oauth_verifier", verifier);
      localStorage.setItem("lichess_oauth_state", state);

      const redirectUri = `${window.location.origin}/import`;
      const clientId = window.location.origin;

      const authUrl = new URL("https://lichess.org/oauth");
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("client_id", clientId);
      authUrl.searchParams.set("redirect_uri", redirectUri);
      authUrl.searchParams.set("code_challenge", challenge);
      authUrl.searchParams.set("code_challenge_method", "S256");
      authUrl.searchParams.set("scope", "");
      authUrl.searchParams.set("state", state);

      window.location.href = authUrl.toString();
    } catch (err: any) {
      setError("Không thể khởi tạo phiên xác thực Lichess: " + err.message);
    }
  };


  // Disconnect / Revoke Lichess Authorization
  const handleDisconnectLichess = () => {
    setLichessToken("");
    setLichessAuthUser("");
    localStorage.removeItem("lichess_token");
    localStorage.removeItem("lichess_username");
  };

  // Toggle perf types
  const toggleLichessPerf = (id: string) => {
    setLichessSelectedPerfs((prev) =>
      prev.includes(id) ? (prev.length > 1 ? prev.filter((p) => p !== id) : prev) : [...prev, id]
    );
  };

  const toggleChesscomPerf = (id: string) => {
    setChesscomSelectedPerfs((prev) =>
      prev.includes(id) ? (prev.length > 1 ? prev.filter((p) => p !== id) : prev) : [...prev, id]
    );
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setPgnFile(file);

      // Auto-extract all players from PGN file
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        if (content) {
          const detected = extractPlayersFromPgn(content);
          setDetectedPlayers(detected);
          if (detected.length > 0) {
            setSelectedFocusPlayer(detected[0].name);
          }
        }
      };
      reader.readAsText(file);
    }
  };

  const handlePgnTextChange = (text: string) => {
    setPgnText(text);
    if (text.trim().length > 15) {
      const detected = extractPlayersFromPgn(text);
      setDetectedPlayers(detected);
      if (detected.length > 0 && (!selectedFocusPlayer || !detected.some((p) => p.name === selectedFocusPlayer))) {
        setSelectedFocusPlayer(detected[0].name);
      }
    } else if (!pgnFile) {
      setDetectedPlayers([]);
      setSelectedFocusPlayer("");
    }
  };

  const handleTabChange = (tab: "lichess" | "chesscom" | "pgn") => {
    if (isLoading || activeTab === tab) return;
    setActiveTab(tab);
    setError(null);
    setResult(null);
    setImportProgress(null);
  };

  const startProgress = (source: "lichess" | "chesscom" | "pgn") => {
    const startTime = Date.now();
    setImportProgress({
      stage: 1,
      totalStages: 4,
      percent: 10,
      stageName: "Kết nối & Tải dữ liệu",
      detail:
        source === "lichess"
          ? "Đang kết nối tới Lichess.org & nạp danh sách ván đấu..."
          : source === "chesscom"
          ? "Đang kết nối tới Chess.com Archives & nạp dữ liệu..."
          : "Đang đọc và phân tích cấu trúc tệp PGN...",
      elapsedSeconds: 0,
    });

    const timer = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;
      const roundedSec = Math.floor(elapsed);

      setImportProgress((prev) => {
        if (!prev) return null;
        let stage = 1;
        let percent = 10;
        let stageName = "Kết nối & Tải dữ liệu";
        let detail = prev.detail;

        if (elapsed < 1.6) {
          stage = 1;
          percent = Math.min(32, Math.floor(10 + (elapsed / 1.6) * 22));
          stageName = "Kết nối & Tải dữ liệu";
          detail =
            source === "lichess"
              ? "Đang tải dữ liệu ván đấu từ máy chủ Lichess.org..."
              : source === "chesscom"
              ? "Đang nạp kho lưu trữ ván đấu Chess.com..."
              : "Đang đọc các bản ghi từ tệp PGN...";
        } else if (elapsed < 3.8) {
          stage = 2;
          percent = Math.min(62, Math.floor(32 + ((elapsed - 1.6) / 2.2) * 30));
          stageName = "Chuẩn hóa nước đi & Thế cờ";
          detail = "Đang phân tích cú pháp SAN, thời gian đồng hồ & chuỗi FEN...";
        } else if (elapsed < 6.0) {
          stage = 3;
          percent = Math.min(84, Math.floor(62 + ((elapsed - 3.8) / 2.2) * 22));
          stageName = "Đối chiếu & Khử trùng lặp";
          detail = "Đang kiểm tra trùng lặp với lịch sử dữ liệu kỳ thủ...";
        } else {
          stage = 4;
          percent = Math.min(96, Math.floor(84 + Math.min(12, (elapsed - 6.0) * 1.5)));
          stageName = "Dựng cây khai cuộc & Hồ sơ";
          detail = "Đang tự động xây dựng cây khai cuộc và tổng hợp chỉ số...";
        }

        return {
          stage,
          totalStages: 4,
          percent,
          stageName,
          detail,
          elapsedSeconds: roundedSec,
        };
      });
    }, 200);

    return timer;
  };

  const finishProgress = async (timer: NodeJS.Timeout) => {
    clearInterval(timer);
    setImportProgress((prev) =>
      prev
        ? {
            ...prev,
            stage: 4,
            percent: 100,
            stageName: "Hoàn tất xử lý!",
            detail: "Đã nạp và đồng bộ hóa toàn bộ ván đấu thành công!",
          }
        : null
    );
    await new Promise((resolve) => setTimeout(resolve, 400));
  };

  const handlePgnImport = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);
    setIsLoading(true);
    const timer = startProgress("pgn");

    try {
      let res: ImportSummary;
      const targetId = selectedPlayerId ? selectedPlayerId : undefined;
      const focusPlayer = selectedFocusPlayer ? selectedFocusPlayer.trim() : undefined;

      // Find the cluster matching selectedFocusPlayer to get all raw corrupted/variant names
      const selectedCluster = detectedPlayers.find(
        (p) => p.name === selectedFocusPlayer || p.rawNames.includes(selectedFocusPlayer)
      );

      let aliasNames: string[] | undefined = undefined;
      if (selectedCluster) {
        const set = new Set<string>(selectedCluster.rawNames);
        if (focusPlayer) set.add(focusPlayer);
        aliasNames = Array.from(set);
      } else if (focusPlayer) {
        aliasNames = [focusPlayer];
      }

      const autoDataset = pgnFile
        ? pgnFile.name.replace(/\.[^/.]+$/, "")
        : focusPlayer
        ? `${focusPlayer} PGN Import`
        : "PGN Import";

      if (pgnFile) {
        res = await apiClient.importPgnFile(pgnFile, targetId, 1000, userId || undefined, focusPlayer, aliasNames);
      } else if (pgnText.trim()) {
        res = await apiClient.importPgnText(pgnText, autoDataset, targetId, 1000, userId || undefined, focusPlayer, aliasNames);
      } else {
        throw new Error("Vui lòng tải lên tệp .pgn hoặc dán văn bản PGN.");
      }
      await finishProgress(timer);
      setResult(res);
    } catch (err: any) {
      clearInterval(timer);
      setImportProgress(null);
      console.error("[Import] Error:", err);
      setError(err.message || "Lỗi khi nạp dữ liệu PGN");
    } finally {
      clearInterval(timer);
      setIsLoading(false);
    }
  };

  const handleLichessSync = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lichessUsername.trim()) {
      setError("Vui lòng nhập Lichess username.");
      return;
    }
    setError(null);
    setResult(null);
    setIsLoading(true);
    const timer = startProgress("lichess");

    try {
      const { since, until } = computeTimeBounds(lichessTimePreset, lichessCustomStart, lichessCustomEnd);
      const targetId = selectedPlayerId ? selectedPlayerId : undefined;
      const res = await apiClient.importLichess({
        player_id: targetId,
        user_id: userId || undefined,
        username: lichessUsername.trim(),
        max_games: Math.min(1000, Math.max(1, Number(lichessMaxGames) || 100)),
        rated_only: lichessRatedOnly,
        perf_types: lichessSelectedPerfs.length > 0 ? lichessSelectedPerfs : undefined,
        since,
        until,
        token: lichessToken || undefined,
      });
      await finishProgress(timer);
      setResult(res);
    } catch (err: any) {
      clearInterval(timer);
      setImportProgress(null);
      setError(err.message || "Lỗi khi nạp ván đấu từ Lichess.org");
    } finally {
      clearInterval(timer);
      setIsLoading(false);
    }
  };

  const handleChesscomSync = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chesscomUsername.trim()) {
      setError("Vui lòng nhập Chess.com username.");
      return;
    }
    setError(null);
    setResult(null);
    setIsLoading(true);
    const timer = startProgress("chesscom");

    try {
      const { since, until } = computeTimeBounds(chesscomTimePreset, chesscomCustomStart, chesscomCustomEnd);
      const targetId = selectedPlayerId ? selectedPlayerId : undefined;
      const res = await apiClient.importChesscom({
        player_id: targetId,
        user_id: userId || undefined,
        username: chesscomUsername.trim(),
        max_games: Math.min(1000, Math.max(1, Number(chesscomMaxGames) || 100)),
        rated_only: chesscomRatedOnly,
        perf_types: chesscomSelectedPerfs.length > 0 ? chesscomSelectedPerfs : undefined,
        since,
        until,
      });
      await finishProgress(timer);
      setResult(res);
    } catch (err: any) {
      clearInterval(timer);
      setImportProgress(null);
      setError(err.message || "Lỗi khi nạp ván đấu từ Chess.com");
    } finally {
      clearInterval(timer);
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-3">
            <Database className="w-8 h-8 text-primary" />
            Nạp & Đồng bộ Dữ liệu Ván Đấu
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Hỗ trợ nạp ván đấu tốc độ cao từ Lichess.org (với OAuth Authorization), Chess.com Public Archives và tệp PGN tiêu chuẩn (tối đa 1000 ván).
          </p>
        </div>
      </div>

      {/* Target Player Profile Selection Banner */}
      <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                Hồ sơ kỳ thủ nhận ván đấu
              </div>
              <div className="text-sm font-bold text-foreground flex items-center gap-2">
                {selectedPlayer ? (
                  <>
                    <span className="text-primary">{selectedPlayer.canonical_name}</span>
                    {selectedPlayer.title && (
                      <span className="px-1.5 py-0.5 text-[10px] font-extrabold uppercase rounded bg-amber-500/10 text-amber-500 border border-amber-500/30">
                        {selectedPlayer.title}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground font-normal">
                      ({selectedPlayer.total_games || 0} ván hiện có)
                    </span>
                  </>
                ) : paramPlayerName ? (
                  <span className="text-primary">{paramPlayerName}</span>
                ) : (
                  <span className="text-muted-foreground">Tự động nhận diện & tạo hồ sơ mới</span>
                )}
              </div>
            </div>
          </div>

          {/* Player Switcher Dropdown */}
          <div className="flex items-center gap-2">
            <label htmlFor="targetPlayerSelect" className="text-xs text-muted-foreground whitespace-nowrap hidden sm:inline">
              Gán vào:
            </label>
            <div className="relative min-w-[220px]">
              <select
                id="targetPlayerSelect"
                value={selectedPlayerId}
                onChange={(e) => setSelectedPlayerId(e.target.value)}
                className="w-full bg-background border border-border/70 rounded-xl px-3 py-2 text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 appearance-none pr-8 cursor-pointer"
              >
                <option value="">-- Tự động tạo hồ sơ mới --</option>
                {players.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.canonical_name} {p.title ? `[${p.title}]` : ""} ({p.total_games || 0} ván)
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>

        {selectedPlayer && (
          <div className="text-[11px] text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-1.5 flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            <span>
              Các ván đấu mới sẽ được thêm trực tiếp vào hồ sơ <b>{selectedPlayer.canonical_name}</b>, không tạo hồ sơ trùng lặp.
            </span>
          </div>
        )}
      </div>

      {/* Source Selector Tabs */}
      <div className="grid grid-cols-3 p-1.5 rounded-xl bg-card border border-border/60 max-w-lg">
        <button
          type="button"
          onClick={() => handleTabChange("lichess")}
          disabled={isLoading}
          className={`flex items-center justify-center gap-2 py-2 px-3 text-sm font-semibold rounded-lg transition-all ${
            activeTab === "lichess"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          } ${isLoading ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          <Globe className="w-4 h-4" />
          Lichess.org
        </button>
        <button
          type="button"
          onClick={() => handleTabChange("chesscom")}
          disabled={isLoading}
          className={`flex items-center justify-center gap-2 py-2 px-3 text-sm font-semibold rounded-lg transition-all ${
            activeTab === "chesscom"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          } ${isLoading ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          <User className="w-4 h-4" />
          Chess.com
        </button>
        <button
          type="button"
          onClick={() => handleTabChange("pgn")}
          disabled={isLoading}
          className={`flex items-center justify-center gap-2 py-2 px-3 text-sm font-semibold rounded-lg transition-all ${
            activeTab === "pgn"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          } ${isLoading ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          <FileText className="w-4 h-4" />
          PGN File / Text
        </button>
      </div>

      {/* Main Content Box */}
      <div className={`grid grid-cols-1 ${result || error || (isLoading && importProgress) ? "lg:grid-cols-3" : ""} gap-8`}>
        {/* Left Form Area */}
        <div className={result || error || (isLoading && importProgress) ? "lg:col-span-2" : ""}>
          <div className="bg-card border border-border/60 rounded-2xl p-6 sm:p-8 shadow-sm">
            {/* TAB LICHESS.ORG */}
            {activeTab === "lichess" && (
              <div className="space-y-6">
                {/* Lichess Authorization Card */}
                <div className="rounded-2xl border border-amber-500/25 bg-gradient-to-br from-amber-500/5 via-transparent to-primary/5 p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start sm:items-center gap-3.5">
                      {/* Lichess Horse Logo Icon */}
                      <div className="w-11 h-11 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 font-bold shrink-0 shadow-inner">
                        <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
                          <path d="M19.5 21a3 3 0 0 0 3-3v-4.5a3 3 0 0 0-3-3h-1.5V9a6 6 0 0 0-6-6H9a3 3 0 0 0-3 3v1.5H4.5a3 3 0 0 0-3 3V15a3 3 0 0 0 3 3H6v3h13.5zm-7.5-16.5a4.5 4.5 0 0 1 4.5 4.5v1.5H12a1.5 1.5 0 0 1-1.5-1.5V4.5zM7.5 6a1.5 1.5 0 0 1 1.5-1.5v4.5A3 3 0 0 0 12 12h4.5v1.5H4.5a1.5 1.5 0 0 1-1.5-1.5v-1.5a1.5 1.5 0 0 1 1.5-1.5H6V7.5A1.5 1.5 0 0 1 7.5 6zM6 16.5h12a1.5 1.5 0 0 1 1.5 1.5v1.5H6v-3z" />
                        </svg>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-sm text-foreground">
                            {lichessToken ? "Đã liên kết Lichess.org" : "Ủy quyền Lichess (Authorize)"}
                          </h3>
                          {lichessToken && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 flex items-center gap-1">
                              <ShieldCheck className="w-3 h-3" />
                              Tốc độ tối đa
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                          {lichessToken ? (
                            <span>
                              Tài khoản: <b className="text-primary font-mono">{lichessAuthUser || lichessUsername}</b> — Nạp ván đấu không giới hạn tốc độ (Unthrottled rate-limit).
                            </span>
                          ) : (
                            <span>
                              Ủy quyền giúp nạp ván đấu với tốc độ cao, không bị giới hạn Rate Limit từ Lichess API (chỉ truy cập dữ liệu công khai).
                            </span>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      {lichessToken ? (
                        <button
                          type="button"
                          onClick={handleDisconnectLichess}
                          className="px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/10 border border-destructive/30 rounded-xl transition-all flex items-center gap-1.5"
                          title="Hủy ủy quyền tài khoản Lichess"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          Hủy ủy quyền
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={isVerifyingLichess}
                          onClick={handleAuthorizeLichess}
                          className="px-4 py-2 text-xs font-bold text-white bg-[#629924] hover:bg-[#52821d] active:scale-95 rounded-xl transition-all shadow-md flex items-center gap-2"
                        >
                          {isVerifyingLichess ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <ShieldCheck className="w-4 h-4" />
                          )}
                          Authorize Lichess.org
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <form onSubmit={handleLichessSync} className="space-y-6">
                  {/* Lichess Username */}
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      Lichess Username
                    </label>
                    <input
                      type="text"
                      required
                      value={lichessUsername}
                      onChange={(e) => setLichessUsername(e.target.value)}
                      placeholder="VD: magnuscarlsen, penguingm1, nganbanghe..."
                      className="w-full bg-background border border-border/60 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 font-medium"
                    />
                  </div>

                  {/* Max Games & Rated Filter */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                        Số lượng ván đấu
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={1000}
                        value={lichessMaxGames}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === "") {
                            setLichessMaxGames("");
                          } else {
                            const parsed = parseInt(val, 10);
                            setLichessMaxGames(isNaN(parsed) ? "" : Math.min(1000, Math.max(1, parsed)));
                          }
                        }}
                        placeholder="Tối đa 1000 ván"
                        className="w-full bg-background border border-border/60 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 font-medium"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                        Chế độ xếp hạng
                      </label>
                      <div className="flex items-center gap-3 p-2.5 bg-card/60 border border-border/40 rounded-xl h-[42px]">
                        <input
                          type="checkbox"
                          id="ratedOnlyLichess"
                          checked={lichessRatedOnly}
                          onChange={(e) => setLichessRatedOnly(e.target.checked)}
                          className="w-4 h-4 rounded text-primary focus:ring-primary border-border cursor-pointer"
                        />
                        <label htmlFor="ratedOnlyLichess" className="text-xs text-foreground cursor-pointer select-none font-medium">
                          Chỉ lấy ván đấu có tính điểm (Rated)
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Selectable Game Types (Thể loại) */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Thể loại ván đấu (Game Types)
                      </label>
                      <span className="text-[11px] text-muted-foreground">
                        Bấm để chọn / bỏ chọn thể loại
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {LICHESS_PERF_OPTIONS.map((perf) => {
                        const isSelected = lichessSelectedPerfs.includes(perf.id);
                        return (
                          <button
                            key={perf.id}
                            type="button"
                            onClick={() => toggleLichessPerf(perf.id)}
                            className={`flex items-center justify-center py-2 px-3 rounded-xl border text-xs font-semibold transition-all ${
                              isSelected
                                ? "bg-primary text-primary-foreground border-primary shadow-xs"
                                : "bg-card hover:bg-accent/40 text-muted-foreground border-border/60 hover:text-foreground"
                            }`}
                          >
                            <span>{perf.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Time Range Filter (Khoảng thời gian) */}
                  <div className="space-y-3">
                    <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Khoảng thời gian của dữ liệu
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {TIME_PRESETS.map((preset) => {
                        const isSelected = lichessTimePreset === preset.id;
                        return (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => setLichessTimePreset(preset.id)}
                            className={`py-1.5 px-3 rounded-lg border text-xs font-medium transition-all ${
                              isSelected
                                ? "bg-primary/10 text-primary border-primary font-bold shadow-xs"
                                : "bg-card text-muted-foreground border-border/60 hover:text-foreground hover:bg-accent/30"
                            }`}
                          >
                            {preset.label}
                          </button>
                        );
                      })}
                    </div>

                    {lichessTimePreset === "custom" && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 p-3 bg-accent/20 rounded-xl border border-border/40 animate-fade-in">
                        <div>
                          <label className="block text-[11px] font-semibold text-muted-foreground mb-1 flex items-center gap-1">
                            <Calendar className="w-3 h-3" /> Từ ngày:
                          </label>
                          <input
                            type="date"
                            value={lichessCustomStart}
                            onChange={(e) => setLichessCustomStart(e.target.value)}
                            className="w-full bg-background border border-border/60 rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-muted-foreground mb-1 flex items-center gap-1">
                            <Calendar className="w-3 h-3" /> Đến ngày:
                          </label>
                          <input
                            type="date"
                            value={lichessCustomEnd}
                            onChange={(e) => setLichessCustomEnd(e.target.value)}
                            className="w-full bg-background border border-border/60 rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Inline Progress Bar */}
                  {isLoading && importProgress && (
                    <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 space-y-2.5 animate-fade-in shadow-inner">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-foreground flex items-center gap-2">
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-primary shrink-0" />
                          <span>{importProgress.stageName} ({importProgress.stage}/4)</span>
                        </span>
                        <span className="font-bold text-primary tabular-nums">
                          {importProgress.percent}%
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-secondary/80 overflow-hidden relative">
                        <div
                          className="h-full bg-gradient-to-r from-primary via-blue-500 to-emerald-500 transition-all duration-300 rounded-full"
                          style={{ width: `${importProgress.percent}%` }}
                        />
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {importProgress.detail}
                      </p>
                    </div>
                  )}

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={isLoading || !lichessUsername.trim()}
                    className="w-full py-3.5 px-6 bg-primary text-primary-foreground font-bold rounded-xl hover:bg-primary/90 transition-all flex items-center justify-center gap-2.5 disabled:opacity-50 shadow-md shadow-primary/20 text-sm"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Đang nạp ván đấu từ Lichess.org...
                      </>
                    ) : (
                      <>
                        <Download className="w-5 h-5" />
                        Nạp ván đấu từ Lichess.org
                      </>
                    )}
                  </button>
                </form>
              </div>
            )}

            {/* TAB CHESS.COM */}
            {activeTab === "chesscom" && (
              <form onSubmit={handleChesscomSync} className="space-y-6">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Chess.com Username
                  </label>
                  <input
                    type="text"
                    required
                    value={chesscomUsername}
                    onChange={(e) => setChesscomUsername(e.target.value)}
                    placeholder="VD: hikaru, magnuscarlsen, gothamchess..."
                    className="w-full bg-background border border-border/60 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 font-medium"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      Số lượng ván đấu
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={1000}
                      value={chesscomMaxGames}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "") {
                          setChesscomMaxGames("");
                        } else {
                          const parsed = parseInt(val, 10);
                          setChesscomMaxGames(isNaN(parsed) ? "" : Math.min(1000, Math.max(1, parsed)));
                        }
                      }}
                      placeholder="Tối đa 1000 ván"
                      className="w-full bg-background border border-border/60 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      Chế độ xếp hạng
                    </label>
                    <div className="flex items-center gap-3 p-2.5 bg-card/60 border border-border/40 rounded-xl h-[42px]">
                      <input
                        type="checkbox"
                        id="ratedOnlyChesscom"
                        checked={chesscomRatedOnly}
                        onChange={(e) => setChesscomRatedOnly(e.target.checked)}
                        className="w-4 h-4 rounded text-primary focus:ring-primary border-border cursor-pointer"
                      />
                      <label htmlFor="ratedOnlyChesscom" className="text-xs text-foreground cursor-pointer select-none font-medium">
                        Chỉ lấy ván đấu có tính điểm (Rated)
                      </label>
                    </div>
                  </div>
                </div>

                {/* Selectable Game Types (Thể loại) */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Thể loại ván đấu (Game Types)
                    </label>
                    <span className="text-[11px] text-muted-foreground">
                      Bấm để chọn / bỏ chọn thể loại
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {CHESSCOM_PERF_OPTIONS.map((perf) => {
                      const isSelected = chesscomSelectedPerfs.includes(perf.id);
                      return (
                        <button
                          key={perf.id}
                          type="button"
                          onClick={() => toggleChesscomPerf(perf.id)}
                          className={`flex items-center justify-center py-2 px-3 rounded-xl border text-xs font-semibold transition-all ${
                            isSelected
                              ? "bg-primary text-primary-foreground border-primary shadow-xs"
                              : "bg-card hover:bg-accent/40 text-muted-foreground border-border/60 hover:text-foreground"
                          }`}
                        >
                          <span>{perf.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Time Range Filter (Khoảng thời gian) */}
                <div className="space-y-3">
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Khoảng thời gian của dữ liệu
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {TIME_PRESETS.map((preset) => {
                      const isSelected = chesscomTimePreset === preset.id;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => setChesscomTimePreset(preset.id)}
                          className={`py-1.5 px-3 rounded-lg border text-xs font-medium transition-all ${
                            isSelected
                              ? "bg-primary/10 text-primary border-primary font-bold shadow-xs"
                              : "bg-card text-muted-foreground border-border/60 hover:text-foreground hover:bg-accent/30"
                          }`}
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                  </div>

                  {chesscomTimePreset === "custom" && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 p-3 bg-accent/20 rounded-xl border border-border/40 animate-fade-in">
                      <div>
                        <label className="block text-[11px] font-semibold text-muted-foreground mb-1 flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> Từ ngày:
                        </label>
                        <input
                          type="date"
                          value={chesscomCustomStart}
                          onChange={(e) => setChesscomCustomStart(e.target.value)}
                          className="w-full bg-background border border-border/60 rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-muted-foreground mb-1 flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> Đến ngày:
                        </label>
                        <input
                          type="date"
                          value={chesscomCustomEnd}
                          onChange={(e) => setChesscomCustomEnd(e.target.value)}
                          className="w-full bg-background border border-border/60 rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Inline Progress Bar */}
                {isLoading && importProgress && (
                  <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 space-y-2.5 animate-fade-in shadow-inner">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-foreground flex items-center gap-2">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-primary shrink-0" />
                        <span>{importProgress.stageName} ({importProgress.stage}/4)</span>
                      </span>
                      <span className="font-bold text-primary tabular-nums">
                        {importProgress.percent}%
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-secondary/80 overflow-hidden relative">
                      <div
                        className="h-full bg-gradient-to-r from-primary via-blue-500 to-emerald-500 transition-all duration-300 rounded-full"
                        style={{ width: `${importProgress.percent}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {importProgress.detail}
                    </p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading || !chesscomUsername.trim()}
                  className="w-full py-3.5 px-6 bg-primary text-primary-foreground font-bold rounded-xl hover:bg-primary/90 transition-all flex items-center justify-center gap-2.5 disabled:opacity-50 shadow-md shadow-primary/20 text-sm"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Đang nạp ván đấu từ Chess.com...
                    </>
                  ) : (
                    <>
                      <Download className="w-5 h-5" />
                      Nạp ván đấu từ Chess.com
                    </>
                  )}
                </button>
              </form>
            )}

            {/* TAB PGN */}
            {activeTab === "pgn" && (
              <form onSubmit={handlePgnImport} className="space-y-6">
                <div className="border-2 border-dashed border-border/80 hover:border-primary/50 transition-colors rounded-xl p-6 text-center cursor-pointer relative bg-card/40">
                  <input
                    type="file"
                    accept=".pgn,.txt"
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <UploadCloud className="w-10 h-10 text-primary mx-auto mb-3" />
                  <p className="text-sm font-medium text-foreground">
                    {pgnFile ? pgnFile.name : "Kéo thả tệp .pgn hoặc bấm để chọn"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {pgnFile
                      ? `${(pgnFile.size / 1024).toFixed(1)} KB`
                      : "Hỗ trợ tệp PGN đơn hoặc đa ván (Multi-game PGN lên tới 1000 ván)"}
                  </p>
                </div>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border/40" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">Hoặc dán trực tiếp PGN</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    PGN Text Nội dung
                  </label>
                  <textarea
                    rows={4}
                    value={pgnText}
                    onChange={(e) => handlePgnTextChange(e.target.value)}
                    placeholder="[Event &quot;FIDE Candidates 2024&quot;]&#10;1. e4 e5 2. Nf3 Nc6..."
                    className="w-full bg-background border border-border/60 rounded-xl px-4 py-3 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>

                {/* Detected Players in PGN */}
                {detectedPlayers.length > 0 && (
                  <div className="space-y-3 p-4 bg-accent/20 border border-border/60 rounded-2xl animate-fade-in">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <UserCheck className="w-4 h-4 text-primary" />
                        <label className="text-xs font-bold text-foreground uppercase tracking-wider">
                          Chọn kỳ thủ tạo hồ sơ & phân tích
                        </label>
                      </div>
                      <span className="text-[11px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full self-start sm:self-auto">
                        Phát hiện {detectedPlayers.length} kỳ thủ trong tệp
                      </span>
                    </div>

                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Hệ thống tự động quét danh sách các kỳ thủ trong tệp PGN. Hãy chọn kỳ thủ bạn muốn thiết lập hồ sơ khai cuộc:
                    </p>

                    {detectedPlayers.length > 6 && (
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="text"
                          value={playerSearchFilter}
                          onChange={(e) => setPlayerSearchFilter(e.target.value)}
                          placeholder="Tìm nhanh tên kỳ thủ..."
                          className="w-full bg-background border border-border/60 rounded-xl pl-8 pr-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-64 overflow-y-auto pr-1">
                      {detectedPlayers
                        .filter((p) => !playerSearchFilter || p.name.toLowerCase().includes(playerSearchFilter.toLowerCase()))
                        .map((player) => {
                          const isSelected = selectedFocusPlayer === player.name;
                          return (
                            <button
                              key={player.name}
                              type="button"
                              onClick={() => setSelectedFocusPlayer(player.name)}
                              className={`flex items-center justify-between p-2.5 rounded-xl border text-left transition-all ${
                                isSelected
                                  ? "bg-primary text-primary-foreground border-primary shadow-xs ring-2 ring-primary/20"
                                  : "bg-card hover:bg-accent/40 text-foreground border-border/70 hover:border-primary/40"
                              }`}
                            >
                              <div className="min-w-0 pr-2">
                                <div className="text-xs font-bold truncate">
                                  {player.name}
                                </div>
                                <div className={`text-[10px] ${isSelected ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                                  {player.gameCount} ván ({player.whiteCount} Trắng / {player.blackCount} Đen)
                                </div>
                              </div>
                              {isSelected ? (
                                <CheckCircle2 className="w-4 h-4 shrink-0 text-primary-foreground" />
                              ) : (
                                <div className="w-3.5 h-3.5 rounded-full border border-muted-foreground/30 shrink-0" />
                              )}
                            </button>
                          );
                        })}
                    </div>

                    {selectedFocusPlayer && (
                      <div className="text-[11px] text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-2.5 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        <span>
                          Đã chọn: <b>{selectedFocusPlayer}</b> — Ván đấu sẽ được gán và phân tích theo góc nhìn kỳ thủ này.
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Inline Progress Bar */}
                {isLoading && importProgress && (
                  <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 space-y-2.5 animate-fade-in shadow-inner">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-foreground flex items-center gap-2">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-primary shrink-0" />
                        <span>{importProgress.stageName} ({importProgress.stage}/4)</span>
                      </span>
                      <span className="font-bold text-primary tabular-nums">
                        {importProgress.percent}%
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-secondary/80 overflow-hidden relative">
                      <div
                        className="h-full bg-gradient-to-r from-primary via-blue-500 to-emerald-500 transition-all duration-300 rounded-full"
                        style={{ width: `${importProgress.percent}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {importProgress.detail}
                    </p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading || (!pgnFile && !pgnText.trim())}
                  className="w-full py-3.5 px-6 bg-primary text-primary-foreground font-bold rounded-xl hover:bg-primary/90 transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-md shadow-primary/20 text-sm"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Đang nạp ván đấu từ PGN...
                    </>
                  ) : (
                    <>
                      <UploadCloud className="w-5 h-5" />
                      Nạp ván đấu từ PGN
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Right Info / Result Panel */}
        {(result || error || (isLoading && importProgress)) && (
          <div className="space-y-6">
            {/* Live Progress Card when importing */}
            {isLoading && importProgress && (
              <div className="bg-card border border-primary/30 rounded-2xl p-6 shadow-lg shadow-primary/5 space-y-5 animate-fade-in bg-gradient-to-br from-primary/5 via-card to-background">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary relative">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                      <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-foreground">Tiến trình nạp ván đấu</h3>
                      <p className="text-[11px] text-muted-foreground">
                        {activeTab === "lichess" && "Nguồn: Lichess.org"}
                        {activeTab === "chesscom" && "Nguồn: Chess.com"}
                        {activeTab === "pgn" && "Nguồn: Tệp PGN / Bản ghi"}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-black text-primary tabular-nums tracking-tight">
                      {importProgress.percent}%
                    </div>
                    <div className="text-[10px] text-muted-foreground font-mono">
                      Thời gian: {String(Math.floor(importProgress.elapsedSeconds / 60)).padStart(2, "0")}:{String(importProgress.elapsedSeconds % 60).padStart(2, "0")}s
                    </div>
                  </div>
                </div>

                {/* Progress Bar Track */}
                <div className="space-y-1.5">
                  <div className="w-full h-2.5 rounded-full bg-secondary/80 overflow-hidden relative border border-border/40 p-0.5">
                    <div
                      className="h-full bg-gradient-to-r from-primary via-blue-500 to-emerald-500 transition-all duration-300 rounded-full relative"
                      style={{ width: `${importProgress.percent}%` }}
                    >
                      <div className="absolute inset-0 bg-white/20 animate-pulse" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span className="font-medium text-foreground">{importProgress.stageName}</span>
                    <span>Bước {importProgress.stage}/{importProgress.totalStages}</span>
                  </div>
                </div>

                {/* Detailed status note */}
                <p className="text-xs text-muted-foreground bg-accent/20 border border-border/40 rounded-xl p-3 leading-relaxed">
                  {importProgress.detail}
                </p>

                {/* 4 Process Stages Checklist */}
                <div className="space-y-2 pt-1 border-t border-border/40">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Các giai đoạn xử lý
                  </div>
                  <div className="space-y-2">
                    {[
                      { id: 1, label: activeTab === "lichess" ? "Tải ván đấu từ Lichess" : activeTab === "chesscom" ? "Tải ván đấu từ Chess.com" : "Trích xuất ván đấu PGN" },
                      { id: 2, label: "Chuẩn hóa nước đi & Thế cờ FEN" },
                      { id: 3, label: "Kiểm tra & Khử trùng lặp" },
                      { id: 4, label: "Tạo hồ sơ & Cây khai cuộc" }
                    ].map((s) => {
                      const isDone = importProgress.percent === 100 || importProgress.stage > s.id;
                      const isCurrent = importProgress.stage === s.id && importProgress.percent < 100;
                      return (
                        <div
                          key={s.id}
                          className={`flex items-center justify-between p-2.5 rounded-xl border text-xs transition-all ${
                            isDone
                              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-medium"
                              : isCurrent
                              ? "bg-primary/10 border-primary/40 text-foreground font-semibold shadow-xs"
                              : "bg-card/40 border-border/40 text-muted-foreground opacity-60"
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            {isDone ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                            ) : isCurrent ? (
                              <Loader2 className="w-4 h-4 text-primary animate-spin shrink-0" />
                            ) : (
                              <Clock className="w-4 h-4 text-muted-foreground/40 shrink-0" />
                            )}
                            <span>{s.label}</span>
                          </div>
                          {isDone && <span className="text-[10px] font-bold text-emerald-500">Đạt</span>}
                          {isCurrent && <span className="text-[10px] font-bold text-primary animate-pulse">Đang chạy...</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Footer hint */}
                <div className="text-[11px] text-muted-foreground/80 flex items-start gap-1.5 leading-tight pt-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                  <span>Hệ thống tự động trích xuất cấu trúc nước đi và xây dựng cây khai cuộc tự động.</span>
                </div>
              </div>
            )}

            {/* Status / Result Card */}
            {result && !isLoading && (
              <div className="bg-card border border-emerald-500/40 rounded-2xl p-6 shadow-sm animate-fade-in bg-gradient-to-br from-emerald-500/5 to-transparent">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3 text-emerald-500">
                    <CheckCircle2 className="w-6 h-6 shrink-0" />
                    <h3 className="font-bold text-base text-foreground">Nạp dữ liệu thành công!</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setResult(null)}
                    title="Đóng bảng kết quả"
                    className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-emerald-500/10 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between py-1.5 border-b border-border/40">
                    <span className="text-muted-foreground">Nguồn dữ liệu:</span>
                    <span className="font-medium text-foreground uppercase">{result.source_type}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-border/40">
                    <span className="text-muted-foreground">Tổng ván quét được:</span>
                    <span className="font-bold text-foreground">{result.total_found}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-border/40">
                    <span className="text-muted-foreground">Ván mới nạp thêm:</span>
                    <span className="font-bold text-emerald-500">+{result.imported_count}</span>
                  </div>
                  {Boolean(result.skipped_count && result.skipped_count > 0) && (
                    <div className="flex justify-between py-1.5 border-b border-border/40">
                      <span className="text-muted-foreground">Ván trùng lặp (bỏ qua):</span>
                      <span className="font-bold text-amber-500">{result.skipped_count} ván trùng</span>
                    </div>
                  )}
                  <div className="flex justify-between py-1.5 border-b border-border/40">
                    <span className="text-muted-foreground">Hồ sơ kỳ thủ:</span>
                    <span className="font-bold text-primary">{result.primary_player || "Kỳ thủ"}</span>
                  </div>
                </div>

                {Boolean(result.skipped_count && result.skipped_count > 0) && (
                  <div className="mt-3 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-xs">
                    💡 <b>Khử trùng lặp tự động:</b> Hệ thống đã phát hiện {result.skipped_count} ván đã có trong hồ sơ trước đó và chỉ nạp thêm {result.imported_count} ván mới.
                  </div>
                )}

                <div className="mt-6 pt-4 border-t border-border/60 space-y-2">
                  <Link
                    href={result.player_id ? `/analyze?playerId=${result.player_id}&runId=${result.run_id || ""}` : "/analyze"}
                    className="w-full py-2.5 px-4 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 transition-all flex items-center justify-center gap-2 text-sm shadow-md"
                  >
                    <BarChart3 className="w-4 h-4" />
                    Mở Bàn Cờ & Cây Khai Cuộc
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </Link>

                  {result.player_id && (
                    <Link
                      href={`/players/${result.player_id}`}
                      className="w-full py-2 px-4 bg-secondary text-secondary-foreground font-semibold rounded-xl hover:bg-secondary/80 transition-all flex items-center justify-center gap-2 text-xs"
                    >
                      <User className="w-3.5 h-3.5" />
                      Xem Hồ Sơ & Thống Kê Kỳ Thủ
                    </Link>
                  )}

                  <button
                    type="button"
                    onClick={() => setResult(null)}
                    className="w-full py-2 px-4 bg-card border border-border/70 hover:bg-accent/40 text-muted-foreground hover:text-foreground font-semibold rounded-xl transition-all flex items-center justify-center gap-2 text-xs"
                  >
                    Nạp thêm ván đấu khác
                  </button>

                  <Link
                    href="/players"
                    className="w-full py-1.5 px-4 text-center text-xs text-muted-foreground hover:text-foreground transition-colors block"
                  >
                    Quay lại Thư viện Kỳ thủ
                  </Link>
                </div>
              </div>
            )}

            {error && !isLoading && (
              <div className="bg-destructive/10 border border-destructive/40 rounded-2xl p-6 text-destructive animate-fade-in">
                <div className="flex items-center gap-3 mb-2">
                  <AlertCircle className="w-6 h-6" />
                  <h3 className="font-bold text-base">Đã xảy ra lỗi</h3>
                </div>
                <p className="text-xs leading-relaxed opacity-90">{error}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ImportPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-24 gap-3 text-muted-foreground">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="text-sm">Đang tải trang nạp dữ liệu...</span>
        </div>
      }
    >
      <ImportContent />
    </Suspense>
  );
}
