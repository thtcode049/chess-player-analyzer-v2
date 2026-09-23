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
  Sparkles, 
  Database, 
  User, 
  RefreshCw, 
  BarChart3, 
  ArrowRight,
  UserCheck,
  ChevronDown
} from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { ImportSummary, Player } from "@/lib/api/types";

function ImportContent() {
  const searchParams = useSearchParams();
  const paramPlayerId = searchParams.get("playerId") || "";
  const paramPlayerName = searchParams.get("playerName") || "";

  const [activeTab, setActiveTab] = useState<"pgn" | "lichess" | "chesscom">("pgn");
  const [userId, setUserId] = useState<string | null>(null);

  // Existing players list and target player selection
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>(paramPlayerId);
  const [loadingPlayers, setLoadingPlayers] = useState(true);

  // Get current user session
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

  // Selected player object
  const selectedPlayer = players.find(p => p.id === selectedPlayerId);

  // PGN Upload states
  const [pgnFile, setPgnFile] = useState<File | null>(null);
  const [pgnText, setPgnText] = useState("");
  const [datasetName, setDatasetName] = useState("");
  const [detectedPlayer, setDetectedPlayer] = useState("");

  // Lichess states
  const [lichessUsername, setLichessUsername] = useState("");
  const [lichessMaxGames, setLichessMaxGames] = useState(50);
  const [lichessRatedOnly, setLichessRatedOnly] = useState(true);
  const [lichessPerfTypes, setLichessPerfTypes] = useState("blitz,rapid");

  // Chess.com states
  const [chesscomUsername, setChesscomUsername] = useState("");
  const [chesscomMaxGames, setChesscomMaxGames] = useState(50);
  const [chesscomRatedOnly, setChesscomRatedOnly] = useState(true);
  const [chesscomPerfTypes, setChesscomPerfTypes] = useState("blitz,rapid");

  // Loading & Result states
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportSummary | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setPgnFile(file);
      if (!datasetName) {
        setDatasetName(file.name.replace(/\.[^/.]+$/, ""));
      }
    }
  };

  const handlePgnImport = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);
    setIsLoading(true);

    try {
      let res: ImportSummary;
      const targetId = selectedPlayerId ? selectedPlayerId : undefined;
      if (pgnFile) {
        res = await apiClient.importPgnFile(pgnFile, targetId, 200, userId || undefined);
      } else if (pgnText.trim()) {
        res = await apiClient.importPgnText(pgnText, datasetName || "PGN Text Import", targetId, 200, userId || undefined);
      } else {
        throw new Error("Vui lòng tải lên tệp .pgn hoặc dán văn bản PGN.");
      }
      setResult(res);
    } catch (err: any) {
      console.error("[Import] Error:", err);
      setError(err.message || "Lỗi khi nhập dữ liệu PGN");
    } finally {
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

    try {
      const perfs = lichessPerfTypes.split(",").map(p => p.trim()).filter(Boolean);
      const targetId = selectedPlayerId ? selectedPlayerId : undefined;
      const res = await apiClient.importLichess({
        player_id: targetId,
        user_id: userId || undefined,
        username: lichessUsername.trim(),
        max_games: lichessMaxGames,
        rated_only: lichessRatedOnly,
        perf_types: perfs.length > 0 ? perfs : undefined
      });
      setResult(res);
    } catch (err: any) {
      setError(err.message || "Lỗi khi đồng bộ ván đấu từ Lichess");
    } finally {
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

    try {
      const perfs = chesscomPerfTypes.split(",").map(p => p.trim()).filter(Boolean);
      const targetId = selectedPlayerId ? selectedPlayerId : undefined;
      const res = await apiClient.importChesscom({
        player_id: targetId,
        user_id: userId || undefined,
        username: chesscomUsername.trim(),
        max_games: chesscomMaxGames,
        rated_only: chesscomRatedOnly,
        perf_types: perfs.length > 0 ? perfs : undefined
      });
      setResult(res);
    } catch (err: any) {
      setError(err.message || "Lỗi khi đồng bộ ván đấu từ Chess.com");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-3">
            <Database className="w-8 h-8 text-primary" />
            Nhập & Đồng bộ Dữ liệu Ván Đấu
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Hỗ trợ tệp PGN tiêu chuẩn, Lichess API trực tiếp và Chess.com Public Archives.
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
          onClick={() => { setActiveTab("pgn"); setError(null); }}
          className={`flex items-center justify-center gap-2 py-2 px-3 text-sm font-medium rounded-lg transition-all ${
            activeTab === "pgn"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <FileText className="w-4 h-4" />
          PGN File / Text
        </button>
        <button
          onClick={() => { setActiveTab("lichess"); setError(null); }}
          className={`flex items-center justify-center gap-2 py-2 px-3 text-sm font-medium rounded-lg transition-all ${
            activeTab === "lichess"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Globe className="w-4 h-4" />
          Lichess Sync
        </button>
        <button
          onClick={() => { setActiveTab("chesscom"); setError(null); }}
          className={`flex items-center justify-center gap-2 py-2 px-3 text-sm font-medium rounded-lg transition-all ${
            activeTab === "chesscom"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <User className="w-4 h-4" />
          Chess.com
        </button>
      </div>

      {/* Main Content Box */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Form Area */}
        <div className="lg:col-span-2">
          <div className="bg-card border border-border/60 rounded-2xl p-6 sm:p-8 shadow-sm">
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
                      : "Hỗ trợ tệp PGN đơn hoặc đa ván (Multi-game PGN)"}
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
                    onChange={(e) => setPgnText(e.target.value)}
                    placeholder="[Event &quot;FIDE Candidates 2024&quot;]&#10;1. e4 e5 2. Nf3 Nc6..."
                    className="w-full bg-background border border-border/60 rounded-xl px-4 py-3 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      Tên Tập Dữ Liệu (Dataset)
                    </label>
                    <input
                      type="text"
                      value={datasetName}
                      onChange={(e) => setDatasetName(e.target.value)}
                      placeholder="VD: Candidates 2024"
                      className="w-full bg-background border border-border/60 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      Tên Kỳ Thủ Tâm Điểm (Tùy chọn)
                    </label>
                    <input
                      type="text"
                      value={detectedPlayer}
                      onChange={(e) => setDetectedPlayer(e.target.value)}
                      placeholder="VD: Carlsen, Magnus"
                      className="w-full bg-background border border-border/60 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading || (!pgnFile && !pgnText.trim())}
                  className="w-full py-3 px-6 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-md shadow-primary/20"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Đang xử lý & phân tách ván đấu...
                    </>
                  ) : (
                    <>
                      <UploadCloud className="w-5 h-5" />
                      Tiến hành Nhập PGN
                    </>
                  )}
                </button>
              </form>
            )}

            {activeTab === "lichess" && (
              <form onSubmit={handleLichessSync} className="space-y-6">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Lichess Username
                  </label>
                  <input
                    type="text"
                    required
                    value={lichessUsername}
                    onChange={(e) => setLichessUsername(e.target.value)}
                    placeholder="VD: nganbanghe, magnuscarlsen, penguingm1"
                    className="w-full bg-background border border-border/60 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      Số lượng ván đấu tối đa
                    </label>
                    <input
                      type="number"
                      min={5}
                      max={200}
                      value={lichessMaxGames}
                      onChange={(e) => setLichessMaxGames(parseInt(e.target.value, 10) || 50)}
                      className="w-full bg-background border border-border/60 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      Thể loại (Perf Types)
                    </label>
                    <input
                      type="text"
                      value={lichessPerfTypes}
                      onChange={(e) => setLichessPerfTypes(e.target.value)}
                      placeholder="blitz, rapid, classical"
                      className="w-full bg-background border border-border/60 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-card/60 border border-border/40 rounded-xl">
                  <input
                    type="checkbox"
                    id="ratedOnlyLichess"
                    checked={lichessRatedOnly}
                    onChange={(e) => setLichessRatedOnly(e.target.checked)}
                    className="w-4 h-4 rounded text-primary focus:ring-primary border-border"
                  />
                  <label htmlFor="ratedOnlyLichess" className="text-xs text-foreground cursor-pointer select-none">
                    Chỉ lấy ván đấu có tính điểm (Rated Matches)
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={isLoading || !lichessUsername.trim()}
                  className="w-full py-3 px-6 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-md shadow-primary/20"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Đang đồng bộ trực tiếp từ Lichess...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-5 h-5" />
                      Bắt đầu Đồng bộ Lichess
                    </>
                  )}
                </button>
              </form>
            )}

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
                    placeholder="VD: hikaru, magnuscarlsen, gothamchess"
                    className="w-full bg-background border border-border/60 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      Số lượng ván đấu tối đa
                    </label>
                    <input
                      type="number"
                      min={5}
                      max={200}
                      value={chesscomMaxGames}
                      onChange={(e) => setChesscomMaxGames(parseInt(e.target.value, 10) || 50)}
                      className="w-full bg-background border border-border/60 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      Thể loại (Perf Types)
                    </label>
                    <input
                      type="text"
                      value={chesscomPerfTypes}
                      onChange={(e) => setChesscomPerfTypes(e.target.value)}
                      placeholder="blitz, rapid, bullet"
                      className="w-full bg-background border border-border/60 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-card/60 border border-border/40 rounded-xl">
                  <input
                    type="checkbox"
                    id="ratedOnlyChesscom"
                    checked={chesscomRatedOnly}
                    onChange={(e) => setChesscomRatedOnly(e.target.checked)}
                    className="w-4 h-4 rounded text-primary focus:ring-primary border-border"
                  />
                  <label htmlFor="ratedOnlyChesscom" className="text-xs text-foreground cursor-pointer select-none">
                    Chỉ lấy ván đấu có tính điểm (Rated Matches)
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={isLoading || !chesscomUsername.trim()}
                  className="w-full py-3 px-6 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-md shadow-primary/20"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Đang đồng bộ trực tiếp từ Chess.com...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-5 h-5" />
                      Bắt đầu Đồng bộ Chess.com
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Right Info / Result Panel */}
        <div className="space-y-6">
          {/* Status / Result Card */}
          {result && (
            <div className="bg-card border border-emerald-500/40 rounded-2xl p-6 shadow-sm animate-fade-in bg-gradient-to-br from-emerald-500/5 to-transparent">
              <div className="flex items-center gap-3 text-emerald-500 mb-4">
                <CheckCircle2 className="w-6 h-6" />
                <h3 className="font-bold text-base text-foreground">Nhập dữ liệu thành công!</h3>
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between py-1.5 border-b border-border/40">
                  <span className="text-muted-foreground">Nguồn dữ liệu:</span>
                  <span className="font-medium text-foreground uppercase">{result.source_type}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-border/40">
                  <span className="text-muted-foreground">Tổng ván nhận:</span>
                  <span className="font-bold text-foreground">{result.total_found}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-border/40">
                  <span className="text-muted-foreground">Ván nhập thành công:</span>
                  <span className="font-bold text-emerald-500">{result.imported_count}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-border/40">
                  <span className="text-muted-foreground">Hồ sơ kỳ thủ:</span>
                  <span className="font-bold text-primary">{result.primary_player || "Kỳ thủ"}</span>
                </div>
              </div>

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

                <Link
                  href="/players"
                  className="w-full py-1.5 px-4 text-center text-xs text-muted-foreground hover:text-foreground transition-colors block"
                >
                  Quay lại Thư viện Kỳ thủ
                </Link>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-destructive/10 border border-destructive/40 rounded-2xl p-6 text-destructive animate-fade-in">
              <div className="flex items-center gap-3 mb-2">
                <AlertCircle className="w-6 h-6" />
                <h3 className="font-bold text-base">Đã xảy ra lỗi</h3>
              </div>
              <p className="text-xs leading-relaxed opacity-90">{error}</p>
            </div>
          )}

          {/* Quick Guide Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-3xl p-6 space-y-4 shadow-xs">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
              <Sparkles className="w-4 h-4" />
              <h4 className="font-bold text-xs uppercase tracking-wider text-slate-900 dark:text-white">
                Quy Trình Phân Tích Dữ Liệu
              </h4>
            </div>
            <ul className="space-y-3 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              <li className="flex items-start gap-2.5">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 font-bold text-[10px] shrink-0 mt-0.5">
                  1
                </span>
                <span><b>Chọn hồ sơ & nạp ván:</b> Chọn đúng hồ sơ kỳ thủ cần phân tích để tránh tạo hồ sơ trùng lặp.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 font-bold text-[10px] shrink-0 mt-0.5">
                  2
                </span>
                <span><b>Chuẩn hóa & Bóc tách:</b> Hệ thống tự động trích xuất các biến khai cuộc, cấu trúc Tốt và phát hiện các nước sai lầm then chốt.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 font-bold text-[10px] shrink-0 mt-0.5">
                  3
                </span>
                <span><b>Khám phá & Cố vấn:</b> Xem cây khai cuộc trên Bàn cờ phân tích hoặc nhận lộ trình cải thiện từ Trợ lí AI.</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ImportPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-24 gap-3 text-muted-foreground">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="text-sm">Đang tải trang nhập dữ liệu...</span>
      </div>
    }>
      <ImportContent />
    </Suspense>
  );
}
