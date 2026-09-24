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
  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [isGuest, setIsGuest] = useState(false);

  // Create Form state
  const [canonicalName, setCanonicalName] = useState("");
  const [title, setTitle] = useState("");
  const [fideId, setFideId] = useState("");
  const [notes, setNotes] = useState("");

  // Edit state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [editName, setEditName] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editFideId, setEditFideId] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [updating, setUpdating] = useState(false);

  // Delete state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
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
      setShowModal(false);
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
    setShowEditModal(true);
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
      setShowEditModal(false);
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
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingPlayer) return;

    setDeleting(true);
    try {
      await apiClient.deletePlayer(deletingPlayer.id);
      setPlayers(prev => prev.filter(p => p.id !== deletingPlayer.id));
      setShowDeleteModal(false);
      showToast(`Đã xóa hồ sơ kỳ thủ "${deletingPlayer.canonical_name}" thành công`);
      setDeletingPlayer(null);
    } catch (err: any) {
      showToast(err.message || "Lỗi khi xóa hồ sơ kỳ thủ", "error");
    } finally {
      setDeleting(false);
    }
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
                onClick={() => setShowModal(true)}
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
                onClick={() => setShowModal(true)}
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
                    <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleOpenEdit(player)}
                        title={`Sửa hồ sơ ${player.canonical_name}`}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleOpenDelete(player)}
                        title={`Xóa hồ sơ ${player.canonical_name}`}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
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

                <div className="pt-2 flex items-center gap-1.5">
                  <Link
                    href={`/players/${player.id}`}
                    className="flex-1 py-2 px-3 text-xs font-semibold rounded-xl bg-secondary text-secondary-foreground hover:bg-primary hover:text-primary-foreground transition-all flex items-center justify-center gap-1.5"
                  >
                    Xem Hồ Sơ Chi Tiết
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                  <button
                    onClick={() => handleOpenEdit(player)}
                    className="py-2 px-2.5 text-xs font-medium rounded-xl border border-border/60 hover:border-primary/40 text-muted-foreground hover:text-primary hover:bg-primary/5 transition-all flex items-center gap-1"
                    title="Chỉnh sửa thông tin hồ sơ"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Sửa</span>
                  </button>
                  <button
                    onClick={() => handleOpenDelete(player)}
                    className="py-2 px-2.5 text-xs font-medium rounded-xl border border-border/60 hover:border-rose-500/40 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-all flex items-center gap-1"
                    title="Xóa hồ sơ kỳ thủ"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Xóa</span>
                  </button>
                  <Link
                    href={`/import?playerId=${player.id}&playerName=${encodeURIComponent(player.canonical_name)}`}
                    className="py-2 px-2.5 text-xs font-medium rounded-xl border border-border/60 hover:bg-card text-muted-foreground hover:text-foreground transition-all"
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

      {/* Edit Player Modal Dialog */}
      {showEditModal && editingPlayer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-card border border-border/80 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-scale-in">
            <div className="flex items-center justify-between border-b border-border/40 pb-4">
              <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
                <Pencil className="w-5 h-5 text-primary" />
                Chỉnh Sửa Hồ Sơ Kỳ Thủ
              </h3>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingPlayer(null);
                }}
                className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-background"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdatePlayer} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Tên Chính Thức (Canonical Name) *
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
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
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
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
                    value={editFideId}
                    onChange={(e) => setEditFideId(e.target.value)}
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
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Đặc điểm phong cách, khai cuộc ưa chuộng, điểm mạnh/yếu cần theo dõi..."
                  className="w-full bg-background border border-border/60 rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              <div className="pt-3 border-t border-border/40 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingPlayer(null);
                  }}
                  className="px-4 py-2 rounded-xl border border-border/60 text-muted-foreground hover:text-foreground text-xs font-medium"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={updating || !editName.trim()}
                  className="px-5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2 shadow-md shadow-primary/20"
                >
                  {updating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Lưu Thay Đổi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal Dialog */}
      {showDeleteModal && deletingPlayer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-card border border-rose-500/30 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-scale-in">
            <div className="flex items-center gap-3 text-rose-500 border-b border-border/40 pb-4">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-rose-500" />
              </div>
              <div>
                <h3 className="font-bold text-base text-foreground">
                  Xác Nhận Xóa Hồ Sơ Kỳ Thủ
                </h3>
                <p className="text-xs text-muted-foreground">Thao tác này sẽ xóa vĩnh viễn dữ liệu</p>
              </div>
            </div>

            <div className="space-y-3 text-xs leading-relaxed text-muted-foreground">
              <p>
                Bạn có chắc chắn muốn xóa hồ sơ của kỳ thủ{" "}
                <strong className="text-foreground font-bold">
                  {deletingPlayer.canonical_name}
                </strong>
                ?
              </p>
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 space-y-1">
                <p className="font-semibold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  Cảnh báo quan trọng:
                </p>
                <p className="text-[11px] leading-normal">
                  Toàn bộ ván đấu, tập dữ liệu nhập vào (PGN / Lichess / Chess.com) và kết quả phân tích chiến lược liên quan đến kỳ thủ này sẽ bị xóa hoàn toàn khỏi hệ thống và không thể khôi phục.
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-border/40 flex items-center justify-end gap-3">
              <button
                type="button"
                disabled={deleting}
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeletingPlayer(null);
                }}
                className="px-4 py-2 rounded-xl border border-border/60 text-muted-foreground hover:text-foreground text-xs font-medium"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleConfirmDelete}
                className="px-5 py-2 rounded-xl bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 disabled:opacity-50 flex items-center gap-2 shadow-md shadow-rose-600/20 transition-all"
              >
                {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Xóa Vĩnh Viễn
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
