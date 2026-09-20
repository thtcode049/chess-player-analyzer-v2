"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { 
  Users, 
  UserPlus, 
  Search, 
  Sparkles, 
  Trophy, 
  ChevronRight, 
  BookOpen, 
  Calendar,
  X,
  Loader2,
  AlertCircle
} from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { Player } from "@/lib/api/types";

export default function PlayersPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isGuest, setIsGuest] = useState(false);

  // Form state
  const [canonicalName, setCanonicalName] = useState("");
  const [title, setTitle] = useState("");
  const [fideId, setFideId] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    import("@/lib/supabase/client").then(({ createClient }) => {
      const sb = createClient();
      sb.auth.getUser().then(({ data }) => {
        setIsGuest(!data.user);
      });
    });
  }, []);

  const loadPlayers = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiClient.getPlayers();
      setPlayers(data);
    } catch (err: any) {
      console.error("Failed to load players from API:", err);
      setError(`Không thể kết nối đến máy chủ API (${err.message || "Lỗi mạng"}). Vui lòng thử lại.`);
      setPlayers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlayers();
  }, []);

  const handleCreatePlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canonicalName.trim()) return;

    setCreating(true);
    try {
      const newPlayer = await apiClient.createPlayer({
        canonical_name: canonicalName.trim(),
        title: title.trim() || undefined,
        notes: notes.trim() || undefined
      });
      setPlayers(prev => [newPlayer, ...prev]);
      setShowModal(false);
      setCanonicalName("");
      setTitle("");
      setFideId("");
      setNotes("");
    } catch (err: any) {
      alert(err.message || "Lỗi khi tạo kỳ thủ");
    } finally {
      setCreating(false);
    }
  };

  const filteredPlayers = players.filter(p => 
    p.canonical_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.title && p.title.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/40 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-3">
            <Users className="w-8 h-8 text-primary" />
            Hồ Sơ & Thư Viện Kỳ Thủ
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Quản lý kho dữ liệu ván đấu, chân dung phong cách 8 trục và kho lưu trữ phân tích theo từng kỳ thủ.
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-all shadow-md shadow-primary/20"
        >
          <UserPlus className="w-4 h-4" />
          Tạo Kỳ Thủ Mới
        </button>
      </div>

      {/* Guest Mode Notice */}
      {isGuest && (
        <div className="flex items-center justify-between p-3.5 bg-card/70 border border-primary/20 rounded-xl text-xs text-muted-foreground shadow-sm animate-fade-in">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-4 h-4 text-primary shrink-0" />
            <span>Bạn đang sử dụng ở <b>chế độ Khách</b>. Dữ liệu chỉ lưu tạm thời trong bộ nhớ phiên làm việc.</span>
          </div>
          <Link href="/login" className="font-semibold text-primary hover:underline shrink-0 ml-3">
            Đăng nhập để lưu vĩnh viễn &rarr;
          </Link>
        </div>
      )}

      {/* API Connection / Error Notice */}
      {error && (
        <div className="flex items-center justify-between p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-600 dark:text-amber-400 shadow-sm animate-fade-in">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-500" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => loadPlayers()}
            className="font-semibold underline shrink-0 ml-3 hover:opacity-80"
          >
            Thử lại
          </button>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm kiếm theo tên kỳ thủ hoặc danh hiệu (GM, IM)..."
            className="w-full bg-card border border-border/60 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
        <div className="text-xs text-muted-foreground font-medium whitespace-nowrap">
          Hiển thị <b>{filteredPlayers.length}</b> kỳ thủ
        </div>
      </div>

      {/* Grid of Players */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm">Đang tải thư viện kỳ thủ...</p>
        </div>
      ) : filteredPlayers.length === 0 ? (
        <div className="text-center py-16 bg-card border border-border/40 rounded-2xl p-8">
          <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <h3 className="text-lg font-bold text-foreground">Không tìm thấy kỳ thủ phù hợp</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            Chưa có hồ sơ kỳ thủ nào khớp với từ khóa hoặc thư viện đang trống.
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="mt-5 inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-lg hover:bg-primary/90 transition-all"
          >
            <UserPlus className="w-4 h-4" />
            Tạo kỳ thủ đầu tiên
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPlayers.map((player) => {
            const initials = player.canonical_name
              .split(" ")
              .map(n => n[0])
              .join("")
              .slice(0, 2)
              .toUpperCase();

            return (
              <div
                key={player.id}
                className="bg-card border border-border/60 hover:border-primary/40 rounded-2xl p-6 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-lg group-hover:scale-105 transition-transform">
                        {initials}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-base text-foreground group-hover:text-primary transition-colors">
                            {player.canonical_name}
                          </h3>
                          {player.title && (
                            <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase rounded bg-amber-500/10 text-amber-500 border border-amber-500/30">
                              {player.title}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                          <Calendar className="w-3 h-3" />
                          Hồ sơ tạo lúc {new Date(player.created_at).toLocaleDateString("vi-VN")}
                        </p>
                      </div>
                    </div>
                  </div>

                  {player.notes && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-4 leading-relaxed bg-background/50 p-2.5 rounded-lg border border-border/30">
                      {player.notes}
                    </p>
                  )}

                  <div className="grid grid-cols-2 gap-2 py-3 border-y border-border/40 text-xs mb-4">
                    <div>
                      <span className="text-muted-foreground block text-[11px]">Tổng ván đấu:</span>
                      <span className="font-bold text-foreground text-sm">
                        {player.total_games ? player.total_games.toLocaleString() : "Chưa nhập"}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[11px]">Tập dữ liệu:</span>
                      <span className="font-bold text-foreground text-sm">
                        {player.datasets ? player.datasets.length : 1} Nguồn
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex items-center gap-2">
                  <Link
                    href={`/players/${player.id}`}
                    className="flex-1 py-2 px-3 text-xs font-semibold rounded-xl bg-secondary text-secondary-foreground hover:bg-primary hover:text-primary-foreground transition-all flex items-center justify-center gap-1.5"
                  >
                    Xem Hồ Sơ Chi Tiết
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                  <Link
                    href={`/import`}
                    className="py-2 px-3 text-xs font-medium rounded-xl border border-border/60 hover:bg-card text-muted-foreground hover:text-foreground transition-all"
                    title="Nhập thêm ván cho kỳ thủ này"
                  >
                    + Ván
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Player Modal Dialog */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-card border border-border/80 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-scale-in">
            <div className="flex items-center justify-between border-b border-border/40 pb-4">
              <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-primary" />
                Thêm Hồ Sơ Kỳ Thủ Mới
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-background"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePlayer} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Tên Chính Thức (Canonical Name) *
                </label>
                <input
                  type="text"
                  required
                  value={canonicalName}
                  onChange={(e) => setCanonicalName(e.target.value)}
                  placeholder="VD: Carlsen, Magnus hoặc Hikaru Nakamura"
                  className="w-full bg-background border border-border/60 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                    Danh Hiệu (Title)
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="GM, IM, FM, CM..."
                    className="w-full bg-background border border-border/60 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                    FIDE ID (Tùy chọn)
                  </label>
                  <input
                    type="number"
                    value={fideId}
                    onChange={(e) => setFideId(e.target.value)}
                    placeholder="VD: 1503014"
                    className="w-full bg-background border border-border/60 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Ghi Chú Đặc Điểm Kỳ Thủ
                </label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Đặc điểm phong cách, khai cuộc ưa chuộng, điểm mạnh/yếu cần theo dõi..."
                  className="w-full bg-background border border-border/60 rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              <div className="pt-3 border-t border-border/40 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl border border-border/60 text-muted-foreground hover:text-foreground text-xs font-medium"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={creating || !canonicalName.trim()}
                  className="px-5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
                >
                  {creating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Lưu Kỳ Thủ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
