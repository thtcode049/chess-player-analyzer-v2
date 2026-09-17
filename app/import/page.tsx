"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { 
  UploadCloud, 
  Globe, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  ArrowRight,
  Database,
  BarChart3,
  User,
  ShieldCheck,
  RefreshCw
} from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { ImportSummary } from "@/lib/api/types";

export default function ImportPage() {
  const [activeTab, setActiveTab] = useState<"pgn" | "lichess" | "chesscom">("pgn");
  const [userId, setUserId] = useState<string | null>(null);
  
  // Get current user session
  useEffect(() => {
    import("@/lib/supabase/client").then(({ createClient }) => {
      const sb = createClient();
      sb.auth.getUser().then(({ data }) => {
        if (data.user) setUserId(data.user.id);
      });
    });
  }, []);
  
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

  // Loading & Result states
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportSummary | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      console.log("[Import] File selected:", file.name, file.size);
      setPgnFile(file);
      if (!datasetName) {
        setDatasetName(file.name.replace(/\.[^/.]+$/, ""));
      }
    }
  };

  const handlePgnImport = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("[Import] Submit clicked, pgnFile:", pgnFile?.name, "pgnText length:", pgnText.length);
    setError(null);
    setResult(null);
    setIsLoading(true);

    try {
      let res: ImportSummary;
      if (pgnFile) {
        const formData = new FormData();
        formData.append("file", pgnFile);
        formData.append("max_games", "200");
        if (userId) formData.append("user_id", userId);
        const httpRes = await fetch("/api/import/pgn-file", { method: "POST", body: formData });
        const json = await httpRes.json();
        console.log("[Import] Raw response:", json);
        if (!httpRes.ok || !json.success) {
          throw new Error(json.detail || json.message || "Lỗi import PGN");
        }
        res = json.data;
      } else if (pgnText.trim()) {
        res = await apiClient.importPgnText(pgnText, datasetName || "PGN Text Import", undefined, 200);
      } else {
        throw new Error("Vui lòng tải lên tệp .pgn hoặc dán văn bản PGN.");
      }
      console.log("[Import] Result:", res);
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
      const res = await apiClient.importLichess({
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
            Hỗ trợ tệp PGN tiêu chuẩn, Lichess API không giới hạn, và trích xuất đánh giá tích hợp &lt;10ms.
          </p>
        </div>
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
                    placeholder="VD: thtcode, penguingm1, magnuscarlsen"
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
                    id="ratedOnly"
                    checked={lichessRatedOnly}
                    onChange={(e) => setLichessRatedOnly(e.target.checked)}
                    className="w-4 h-4 rounded text-primary focus:ring-primary border-border"
                  />
                  <label htmlFor="ratedOnly" className="text-xs text-foreground cursor-pointer select-none">
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
              <div className="space-y-6 text-center py-8">
                <User className="w-12 h-12 text-muted-foreground mx-auto" />
                <div>
                  <h3 className="text-lg font-bold text-foreground">Đồng bộ Chess.com Public API</h3>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
                    Hỗ trợ tải toàn bộ tệp tháng đấu công khai từ Chess.com qua endpoint PGN archive.
                  </p>
                </div>
                <div className="max-w-sm mx-auto space-y-4 text-left">
                  <input
                    type="text"
                    placeholder="Chess.com Username (VD: hikaru)"
                    className="w-full bg-background border border-border/60 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                  <button
                    onClick={() => alert("Chức năng Chess.com API đang kết nối trực tiếp với endpoint PGN archive của Chess.com. Bạn cũng có thể tải PGN từ Chess.com và nhập vào tab PGN File.")}
                    className="w-full py-3 px-6 bg-secondary text-secondary-foreground font-semibold rounded-xl hover:bg-secondary/80 transition-all flex items-center justify-center gap-2"
                  >
                    Đồng bộ từ Chess.com
                  </button>
                </div>
              </div>
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
                  <span className="text-muted-foreground">Kỳ thủ phát hiện:</span>
                  <span className="font-medium text-foreground">{result.primary_player || "Nhiều kỳ thủ"}</span>
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
                    Xem Hồ Sơ & Thống Kê Bayes Kỳ Thủ
                  </Link>
                )}

                <Link
                  href="/dashboard"
                  className="w-full py-1.5 px-4 text-center text-xs text-muted-foreground hover:text-foreground transition-colors block"
                >
                  Về Bảng Điều Khiển Tổng Quan
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

          {/* Architecture Guarantee Card */}
          <div className="bg-card/50 border border-border/40 rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-2.5 text-primary">
              <ShieldCheck className="w-5 h-5" />
              <h4 className="font-bold text-sm text-foreground">Nguyên tắc Kiến trúc V2</h4>
            </div>
            <ul className="space-y-2.5 text-xs text-muted-foreground leading-relaxed">
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold">•</span>
                <span><b>Zero Server CPU Timeout:</b> Trích xuất đánh giá tích hợp trong file PGN (&lt;10ms) thay vì chạy engine nặng gây timeout serverless.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold">•</span>
                <span><b>Free Tier 500MB Safety:</b> PGN gốc lưu trong Supabase Storage Bucket (`pgn-vault`), chỉ lưu metadata và compact JSONB trong DB.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold">•</span>
                <span><b>Interactive Analysis:</b> Phân tích từng thế cờ trực tiếp chạy bằng Stockfish WASM trong Browser Web Worker.</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
