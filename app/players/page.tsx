"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Users,
  UserPlus,
  Search,
  Sparkles,
  ChevronRight,
  Calendar,
  X,
  Loader2,
  Upload,
  Pencil,
  Trash2,
  AlertTriangle,
  CheckCircle2
} from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { Player } from "@/lib/api/types";

export default function PlayersPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isGuest, setIsGuest] = useState(false);

  // Active on-page action: "none" | "create" | "edit" | "delete"
  const [activeAction, setActiveAction] = useState<"none" | "create" | "edit" | "delete">("none");
  const [creating, setCreating] = useState(false);

  // Create Form state
  const [canonicalName, setCanonicalName] = useState("");
  const [title, setTitle] = useState("");
  const [fideId, setFideId] = useState("");
  const [notes, setNotes] = useState("");

  // Edit state
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [editName, setEditName] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editFideId, setEditFideId] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [updating, setUpdating] = useState(false);

  // Delete state
  const [deletingPlayer, setDeletingPlayer] = useState<Player | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Notification state
  const [notice, setNotice] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setNotice({ message, type });
    setTimeout(() => {
      setNotice(null);
    }, 4000);
  };

  // Handle Escape key and body scroll locking when modal dialog is open
  useEffect(() => {
    if (activeAction !== "none") {
      const originalStyle = window.getComputedStyle(document.body).overflow;
      document.body.style.overflow = "hidden";
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          handleCloseAction();
        }
      };
      window.addEventListener("keydown", handleKeyDown);
      return () => {
        document.body.style.overflow = originalStyle;
        window.removeEventListener("keydown", handleKeyDown);
      };
    }
  }, [activeAction]);

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
      const data = await apiClient.getPlayers();
      setPlayers(data || []);
    } catch (err: any) {
      console.warn("Không thể tải danh sách kỳ thủ:", err);
      setPlayers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlayers();
  }, []);

  const handleOpenCreate = () => {
    setCanonicalName("");
    setTitle("");
    setFideId("");
    setNotes("");
    setActiveAction("create");
  };

  const handleCreatePlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canonicalName.trim()) return;

    setCreating(true);
    try {
      const newPlayer = await apiClient.createPlayer({
        canonical_name: canonicalName.trim(),
        title: title.trim() || undefined,
        fide_id: fideId.trim() ? parseInt(fideId.trim(), 10) : undefined,
        notes: notes.trim() || undefined
      });
      setPlayers(prev => [newPlayer, ...prev]);
      setActiveAction("none");
      setCanonicalName("");
      setTitle("");
      setFideId("");
      setNotes("");
      showToast(`Đã tạo hồ sơ kỳ thủ "${newPlayer.canonical_name}" thành công`);
    } catch (err: any) {
      showToast(err.message || "Lỗi khi tạo kỳ thủ", "error");
    } finally {
      setCreating(false);
    }
  };

  const handleOpenEdit = (player: Player) => {
    setEditingPlayer(player);
    setEditName(player.canonical_name);
    setEditTitle(player.title || "");
    setEditFideId(player.fide_id ? String(player.fide_id) : "");
    setEditNotes(player.notes || "");
    setActiveAction("edit");
  };

  const handleUpdatePlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlayer || !editName.trim()) return;

    setUpdating(true);
    try {
      const updated = await apiClient.updatePlayer(editingPlayer.id, {
        canonical_name: editName.trim(),
        title: editTitle.trim() || undefined,
        fide_id: editFideId.trim() ? parseInt(editFideId.trim(), 10) : undefined,
        notes: editNotes.trim() || undefined
      });
      setPlayers(prev => prev.map(p => (p.id === updated.id ? { ...p, ...updated } : p)));
      setActiveAction("none");
      setEditingPlayer(null);
      showToast(`Đã cập nhật hồ sơ kỳ thủ "${updated.canonical_name}" thành công`);
    } catch (err: any) {
      showToast(err.message || "Lỗi khi cập nhật hồ sơ kỳ thủ", "error");
    } finally {
      setUpdating(false);
    }
  };

  const handleOpenDelete = (player: Player) => {
    setDeletingPlayer(player);
    setActiveAction("delete");
  };

  const handleConfirmDelete = async () => {
    if (!deletingPlayer) return;

    setDeleting(true);
    try {
      await apiClient.deletePlayer(deletingPlayer.id);
      setPlayers(prev => prev.filter(p => p.id !== deletingPlayer.id));
      setActiveAction("none");
      showToast(`Đã xóa hồ sơ kỳ thủ "${deletingPlayer.canonical_name}" thành công`);
      setDeletingPlayer(null);
    } catch (err: any) {
      showToast(err.message || "Lỗi khi xóa hồ sơ kỳ thủ", "error");
    } finally {
      setDeleting(false);
    }
  };

  const handleCloseAction = () => {
    setActiveAction("none");
    setEditingPlayer(null);
    setDeletingPlayer(null);
  };

  const filteredPlayers = players.filter(p =>
    p.canonical_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.title && p.title.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-fade-in relative">
      {/* Toast Notification */}
      {notice && (
        <div
          className={`fixed top-20 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl border backdrop-blur-md transition-all animate-slide-in ${
            notice.type === "success"
              ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-800 dark:text-emerald-300"
              : "bg-rose-500/15 border-rose-500/40 text-rose-800 dark:text-rose-300"
          }`}
        >
          {notice.type === "success" ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0" />
          )}
          <span className="text-xs font-semibold">{notice.message}</span>
          <button
            onClick={() => setNotice(null)}
            className="ml-2 text-muted-foreground hover:text-foreground p-0.5 rounded-md"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/40 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-3">
            <Users className="w-8 h-8 text-primary" />
            Hồ Sơ Kỳ Thủ
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Quản lý kho dữ liệu ván đấu, chân dung phong cách 8 trục và kho lưu trữ phân tích theo từng kỳ thủ.
          </p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold transition-all shadow-md bg-primary text-primary-foreground hover:bg-primary/90 shadow-primary/20"
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
        searchQuery ? (
          <div className="text-center py-16 bg-card border border-border/40 rounded-2xl p-8 animate-fade-in">
            <Search className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <h3 className="text-lg font-bold text-foreground">Không tìm thấy kỳ thủ phù hợp</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              Không có hồ sơ nào khớp với từ khóa &ldquo;{searchQuery}&rdquo;.
            </p>
            <button
              onClick={() => setSearchQuery("")}
              className="mt-4 px-4 py-2 border border-border/60 text-xs font-semibold rounded-lg hover:bg-card transition-all"
            >
              Xóa bộ lọc tìm kiếm
            </button>
          </div>
        ) : isGuest ? (
          <div className="text-center py-16 bg-card/60 border border-primary/20 rounded-2xl p-8 max-w-xl mx-auto space-y-4 shadow-sm animate-fade-in">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto text-primary">
              <Sparkles className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-foreground">Chưa có hồ sơ trong phiên khách</h3>
              <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed max-w-md mx-auto">
                Bạn đang ở <b>Chế độ Khách</b>. Dữ liệu chỉ được lưu tạm thời trong phiên làm việc hiện tại và không lưu vào CSDL. Hãy tạo hồ sơ hoặc nạp ván đấu để bắt đầu khám phá!
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                onClick={handleOpenCreate}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground text-xs font-semibold rounded-xl hover:bg-primary/90 transition-all shadow-md shadow-primary/20"
              >
                <UserPlus className="w-4 h-4" />
                Tạo Kỳ Thủ Mới
              </button>
              <Link
                href="/import"
                className="inline-flex items-center gap-2 px-4 py-2.5 border border-border/60 bg-card hover:bg-accent text-foreground text-xs font-semibold rounded-xl transition-all"
              >
                <Upload className="w-4 h-4 text-primary" />
                Nhập Ván Đấu (PGN / Lichess / Chess.com)
              </Link>
            </div>
            <p className="text-[11px] text-muted-foreground pt-2">
              Muốn lưu trữ hồ sơ và phân tích vĩnh viễn?{" "}
              <Link href="/login" className="text-primary font-semibold hover:underline">
                Đăng nhập tài khoản &rarr;
              </Link>
            </p>
          </div>
        ) : (
          <div className="text-center py-16 bg-card border border-border/40 rounded-2xl p-8 animate-fade-in">
            <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <h3 className="text-lg font-bold text-foreground">Thư viện kỳ thủ đang trống</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              Chưa có hồ sơ kỳ thủ nào trong tài khoản của bạn. Hãy tạo hồ sơ hoặc nạp tập ván đấu để bắt đầu phân tích phong cách và khai cuộc.
            </p>
            <div className="flex items-center justify-center gap-3 mt-5">
              <button
                onClick={handleOpenCreate}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-lg hover:bg-primary/90 transition-all shadow-sm"
              >
                <UserPlus className="w-4 h-4" />
                Tạo Kỳ Thủ Đầu Tiên
              </button>
              <Link
                href="/import"
                className="inline-flex items-center gap-2 px-4 py-2 border border-border/60 text-xs font-semibold rounded-lg hover:bg-card transition-all"
              >
                <Upload className="w-4 h-4 text-primary" />
                Nhập Ván Đấu
              </Link>
            </div>
          </div>
        )
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
                className="bg-card border border-border/60 hover:border-primary/40 rounded-2xl p-6 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 flex flex-col justify-between group relative"
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

                    {/* Quick Card Top Action Icons */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleOpenEdit(player)}
                        title={`Sửa thông tin hồ sơ ${player.canonical_name}`}
                        className="p-2 rounded-xl text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all border border-transparent hover:border-primary/20"
                        aria-label={`Sửa ${player.canonical_name}`}
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleOpenDelete(player)}
                        title={`Xóa hồ sơ ${player.canonical_name}`}
                        className="p-2 rounded-xl text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-all border border-transparent hover:border-rose-500/20"
                        aria-label={`Xóa ${player.canonical_name}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
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
                    href={`/import?playerId=${player.id}&playerName=${encodeURIComponent(player.canonical_name)}`}
                    className="py-2 px-3 text-xs font-medium rounded-xl border border-border/60 hover:bg-card text-muted-foreground hover:text-foreground transition-all"
                    title={`Nhập thêm ván cho kỳ thủ ${player.canonical_name}`}
                  >
                    + Ván
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {/* Modal Hộp thoại nổi Thêm / Sửa / Xóa Hồ Sơ (Không có lớp phủ xám, Popup nổi với bóng đổ tách biệt) */}
      {activeAction !== "none" && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
          onClick={handleCloseAction}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800 rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-[0_25px_70px_-15px_rgba(0,0,0,0.35)] space-y-5 animate-scale-in relative max-h-[90vh] overflow-y-auto ring-1 ring-black/10 dark:ring-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 1. Hộp Thêm Kỳ Thủ Mới */}
            {activeAction === "create" && (
              <div className="space-y-5">
                <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                      <UserPlus className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-lg text-zinc-900 dark:text-white">
                        Thêm Hồ Sơ Kỳ Thủ Mới
                      </h3>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        Nhập thông tin định danh để tạo hồ sơ kỳ thủ và theo dõi hệ thống ván đấu.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleCloseAction}
                    className="text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white p-1.5 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                    title="Đóng hộp thoại"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleCreatePlayer} className="space-y-4 text-sm">
                  <div>
                    <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5">
                      Tên Chính Thức (Canonical Name) *
                    </label>
                    <input
                      type="text"
                      required
                      value={canonicalName}
                      onChange={(e) => setCanonicalName(e.target.value)}
                      placeholder="VD: Carlsen, Magnus hoặc Hikaru Nakamura"
                      className="w-full bg-zinc-50 dark:bg-zinc-800/90 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
                      autoFocus
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5">
                        Danh Hiệu (Title)
                      </label>
                      <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="GM, IM, FM, CM..."
                        className="w-full bg-zinc-50 dark:bg-zinc-800/90 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5">
                        FIDE ID (Tùy chọn)
                      </label>
                      <input
                        type="number"
                        value={fideId}
                        onChange={(e) => setFideId(e.target.value)}
                        placeholder="VD: 1503014"
                        className="w-full bg-zinc-50 dark:bg-zinc-800/90 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5">
                      Ghi Chú Đặc Điểm Kỳ Thủ
                    </label>
                    <textarea
                      rows={3}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Đặc điểm phong cách, khai cuộc ưa chuộng, điểm mạnh/yếu cần theo dõi..."
                      className="w-full bg-zinc-50 dark:bg-zinc-800/90 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
                    />
                  </div>

                  <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={handleCloseAction}
                      className="px-4 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-semibold transition"
                    >
                      Hủy bỏ
                    </button>
                    <button
                      type="submit"
                      disabled={creating || !canonicalName.trim()}
                      className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2 shadow-md shadow-primary/20 transition-all"
                    >
                      {creating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      Lưu Kỳ Thủ
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* 2. Hộp Chỉnh Sửa Hồ Sơ */}
            {activeAction === "edit" && editingPlayer && (
              <div className="space-y-5">
                <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
                      <Pencil className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-lg text-zinc-900 dark:text-white">
                        Chỉnh Sửa Hồ Sơ Kỳ Thủ
                      </h3>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        {editingPlayer.canonical_name}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleCloseAction}
                    className="text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white p-1.5 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                    title="Đóng hộp thoại"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleUpdatePlayer} className="space-y-4 text-sm">
                  <div>
                    <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5">
                      Tên Chính Thức (Canonical Name) *
                    </label>
                    <input
                      type="text"
                      required
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="VD: Carlsen, Magnus hoặc Hikaru Nakamura"
                      className="w-full bg-zinc-50 dark:bg-zinc-800/90 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
                      autoFocus
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5">
                        Danh Hiệu (Title)
                      </label>
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        placeholder="GM, IM, FM, CM..."
                        className="w-full bg-zinc-50 dark:bg-zinc-800/90 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5">
                        FIDE ID (Tùy chọn)
                      </label>
                      <input
                        type="number"
                        value={editFideId}
                        onChange={(e) => setEditFideId(e.target.value)}
                        placeholder="VD: 1503014"
                        className="w-full bg-zinc-50 dark:bg-zinc-800/90 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5">
                      Ghi Chú Đặc Điểm Kỳ Thủ
                    </label>
                    <textarea
                      rows={3}
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      placeholder="Đặc điểm phong cách, khai cuộc ưa chuộng, điểm mạnh/yếu cần theo dõi..."
                      className="w-full bg-zinc-50 dark:bg-zinc-800/90 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
                    />
                  </div>

                  <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={handleCloseAction}
                      className="px-4 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-semibold transition"
                    >
                      Hủy bỏ
                    </button>
                    <button
                      type="submit"
                      disabled={updating || !editName.trim()}
                      className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2 shadow-md shadow-primary/20 transition-all"
                    >
                      {updating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      Lưu Thay Đổi
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* 3. Hộp Xác Nhận Xóa Hồ Sơ */}
            {activeAction === "delete" && deletingPlayer && (
              <div className="space-y-5">
                <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-4">
                  <div className="flex items-center gap-3 text-rose-500">
                    <div className="w-10 h-10 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shrink-0">
                      <Trash2 className="w-5 h-5 text-rose-500" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-lg text-zinc-900 dark:text-white">
                        Xác Nhận Xóa Hồ Sơ Kỳ Thủ
                      </h3>
                      <p className="text-xs text-rose-500 font-medium">Thao tác này sẽ xóa vĩnh viễn dữ liệu</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleCloseAction}
                    className="text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white p-1.5 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                    title="Đóng hộp thoại"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-3 text-xs leading-relaxed text-zinc-700 dark:text-zinc-300">
                  <p>
                    Bạn có chắc chắn muốn xóa hồ sơ của kỳ thủ{" "}
                    <strong className="text-zinc-950 dark:text-white font-bold text-sm">
                      {deletingPlayer.canonical_name}
                    </strong>
                    ?
                  </p>
                  <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-200 space-y-1.5">
                    <p className="font-bold flex items-center gap-1.5 text-xs text-rose-700 dark:text-rose-300">
                      <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
                      Cảnh báo quan trọng:
                    </p>
                    <p className="text-[11px] leading-relaxed opacity-95">
                      Toàn bộ ván đấu, tập dữ liệu nhập vào (PGN / Lichess / Chess.com) và kết quả phân tích chiến lược liên quan đến kỳ thủ này sẽ bị xóa hoàn toàn khỏi hệ thống và không thể khôi phục.
                    </p>
                  </div>
                </div>

                <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    disabled={deleting}
                    onClick={handleCloseAction}
                    className="px-4 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-semibold transition"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="button"
                    disabled={deleting}
                    onClick={handleConfirmDelete}
                    className="px-5 py-2.5 rounded-xl bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-rose-600/30 transition-all"
                  >
                    {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Xóa Vĩnh Viễn
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
