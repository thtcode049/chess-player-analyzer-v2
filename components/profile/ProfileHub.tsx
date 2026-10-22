"use client";

import React, { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import {
  Users,
  UserPlus,
  Search,
  Upload,
  Swords,
  Layers,
  Pencil,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  X,
  Loader2,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  ChevronRight,
  ExternalLink,
  Info,
} from "lucide-react";
import { Player } from "@/lib/api/types";
import { apiClient } from "@/lib/api/client";
import { useProfileWorkspaceStore, ColorRole } from "@/lib/stores/profileWorkspaceStore";

export default function ProfileHub() {
  const {
    players,
    loadingPlayers,
    refreshPlayersList,
    selectSingleProfile,
    multiProfiles,
    setMultiProfileRole,
    clearMultiProfiles,
    openMatchupBoard,
    cachedProfiles,
  } = useProfileWorkspaceStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [hubMode, setHubMode] = useState<"single" | "multi">("single");

  // Modal actions: "create" | "edit" | "delete" | "none"
  const [modalAction, setModalAction] = useState<"none" | "create" | "edit" | "delete">("none");

  // Create Form State
  const [createName, setCreateName] = useState("");
  const [createTitle, setCreateTitle] = useState("");
  const [createFideId, setCreateFideId] = useState("");
  const [createNotes, setCreateNotes] = useState("");
  const [creating, setCreating] = useState(false);

  // Edit Form State
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [editName, setEditName] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editFideId, setEditFideId] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [updating, setUpdating] = useState(false);

  // Delete State
  const [deletingPlayer, setDeletingPlayer] = useState<Player | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Toast notice
  const [notice, setNotice] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setNotice({ message, type });
    setTimeout(() => setNotice(null), 4000);
  };

  // Switch to multi-mode automatically if multiProfiles has selections
  useEffect(() => {
    if (multiProfiles.length > 0) {
      setHubMode("multi");
    }
  }, [multiProfiles.length]);

  // Filter players by search query
  const filteredPlayers = useMemo(() => {
    if (!searchQuery.trim()) return players;
    const q = searchQuery.toLowerCase().trim();
    return players.filter((p) => {
      const matchName = (p.canonical_name || "").toLowerCase().includes(q);
      const matchTitle = (p.title || "").toLowerCase().includes(q);
      const matchFide = p.fide_id ? String(p.fide_id).includes(q) : false;
      const matchNotes = (p.notes || "").toLowerCase().includes(q);
      return matchName || matchTitle || matchFide || matchNotes;
    });
  }, [players, searchQuery]);

  // Matchup summary counts
  const whiteAssigned = useMemo(
    () => multiProfiles.filter((m) => m.role === "white" || m.role === "both"),
    [multiProfiles]
  );
  const blackAssigned = useMemo(
    () => multiProfiles.filter((m) => m.role === "black" || m.role === "both"),
    [multiProfiles]
  );

  // Handlers for Create
  const handleOpenCreate = () => {
    setCreateName("");
    setCreateTitle("");
    setCreateFideId("");
    setCreateNotes("");
    setModalAction("create");
  };

  const handleCreatePlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createName.trim()) return;
    setCreating(true);
    try {
      const newP = await apiClient.createPlayer({
        canonical_name: createName.trim(),
        title: createTitle.trim() || undefined,
        fide_id: createFideId.trim() ? parseInt(createFideId.trim(), 10) : undefined,
        notes: createNotes.trim() || undefined,
      });
      await refreshPlayersList();
      setModalAction("none");
      showToast(`Đã tạo hồ sơ "${newP.canonical_name}" thành công`);
    } catch (err: any) {
      showToast(err.message || "Lỗi tạo hồ sơ kỳ thủ", "error");
    } finally {
      setCreating(false);
    }
  };

  // Handlers for Edit
  const handleOpenEdit = (p: Player, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingPlayer(p);
    setEditName(p.canonical_name);
    setEditTitle(p.title || "");
    setEditFideId(p.fide_id ? String(p.fide_id) : "");
    setEditNotes(p.notes || "");
    setModalAction("edit");
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
        notes: editNotes.trim() || undefined,
      });
      await refreshPlayersList();
      setModalAction("none");
      showToast(`Đã cập nhật hồ sơ "${updated.canonical_name}"`);
    } catch (err: any) {
      showToast(err.message || "Lỗi cập nhật hồ sơ", "error");
    } finally {
      setUpdating(false);
    }
  };

  // Handlers for Delete
  const handleOpenDelete = (p: Player, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingPlayer(p);
    setModalAction("delete");
  };

  const handleConfirmDelete = async () => {
    if (!deletingPlayer) return;
    setDeleting(true);
    try {
      await apiClient.deletePlayer(deletingPlayer.id);
      await refreshPlayersList();
      setModalAction("none");
      showToast(`Đã xóa hồ sơ kỳ thủ thành công`);
    } catch (err: any) {
      showToast(err.message || "Lỗi xóa hồ sơ", "error");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="w-full max-w-[1720px] mx-auto space-y-6 sm:space-y-8 animate-fade-in pb-28">
      {/* Toast Notice */}
      {notice && (
        <div
          className={`fixed top-20 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border backdrop-blur-md transition-all animate-slide-in ${
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

      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-xl bg-card border border-border/80 p-5 sm:p-6 shadow-xs">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-1.5 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-bold tracking-wider uppercase">
              <Users className="w-3.5 h-3.5" />
              <span>Thư Viện Hồ Sơ Kỳ Thủ</span>
            </div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-foreground">
              Quản Lý & Không Gian Phân Tích
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Chọn một kỳ thủ để phân tích chuyên sâu dữ liệu ván đấu và hệ thống khai cuộc, hoặc bật chế độ
              ghép đôi nhiều hồ sơ để chuẩn bị phương án đối đầu Trắng vs Đen.
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={handleOpenCreate}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-secondary hover:bg-secondary/80 border border-border text-foreground text-xs font-bold shadow-2xs transition active:scale-95"
            >
              <UserPlus className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>+ Tạo Hồ Sơ</span>
            </button>
            <Link
              href="/import"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-xs transition active:scale-95"
            >
              <Upload className="w-4 h-4" />
              <span>+ Nạp Ván Mới (PGN/Lichess)</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Control Bar: Mode Toggle + Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-3.5 sm:p-4 rounded-xl bg-card border border-border/80 shadow-xs">
        {/* Mode Switcher */}
        <div className="inline-flex items-center gap-1.5 p-1 rounded-lg bg-muted/60 border border-border/60 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => {
              setHubMode("single");
            }}
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-bold transition-all ${
              hubMode === "single"
                ? "bg-background text-foreground shadow-2xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Users className="w-3.5 h-3.5 text-emerald-500" />
            <span>Phân tích 1 kỳ thủ (Single)</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setHubMode("multi");
            }}
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-bold transition-all ${
              hubMode === "multi"
                ? "bg-emerald-600 text-white shadow-2xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Swords className="w-3.5 h-3.5" />
            <span>Ghép Trắng/Đen (Matchup Mode)</span>
            {multiProfiles.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-white/25 text-white">
                {multiProfiles.length}
              </span>
            )}
          </button>
        </div>

        {/* Search Input */}
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm kiếm kỳ thủ theo tên, danh hiệu..."
            className="w-full bg-background border border-border/70 rounded-xl pl-10 pr-9 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded-md hover:bg-muted"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Players Grid */}
      {loadingPlayers ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
          <p className="text-sm text-muted-foreground font-medium">Đang tải danh sách hồ sơ kỳ thủ...</p>
        </div>
      ) : filteredPlayers.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center rounded-xl border border-dashed border-border/80 bg-card/40 space-y-4">
          <div className="w-14 h-14 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <Users className="w-7 h-7" />
          </div>
          <div className="space-y-1 max-w-md">
            <h3 className="font-bold text-base text-foreground">
              {searchQuery ? "Không tìm thấy kỳ thủ phù hợp" : "Chưa có hồ sơ kỳ thủ nào"}
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {searchQuery
                ? `Không có kết quả nào khớp với "${searchQuery}". Hãy thử từ khóa khác.`
                : "Bắt đầu bằng cách nạp ván cờ từ Lichess, Chess.com hoặc tệp PGN để tự động tạo hồ sơ."}
            </p>
          </div>
          <div className="flex items-center gap-3 pt-2">
            <Link
              href="/import"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-xs"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Nạp Ván Đấu Ngay</span>
            </Link>
            <button
              onClick={handleOpenCreate}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border hover:bg-muted text-foreground text-xs font-semibold transition"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Tạo Hồ Sơ Thủ Công</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
          {filteredPlayers.map((player) => {
            const isCached = !!cachedProfiles[player.id];
            const cachedData = cachedProfiles[player.id];
            const totalGames = cachedData ? cachedData.games.length : player.total_games || 0;

            // Check multi-profile role
            const multiItem = multiProfiles.find((m) => m.player.id === player.id);
            const activeRole = multiItem ? multiItem.role : null;

            return (
              <div
                key={player.id}
                onClick={() => {
                  if (hubMode === "single") {
                    selectSingleProfile(player.id, "profile");
                  }
                }}
                className={`group relative flex flex-col justify-between p-4 sm:p-5 rounded-xl border transition-all duration-200 ${
                  hubMode === "single"
                    ? "cursor-pointer bg-card hover:border-emerald-500/50 hover:shadow-md hover:shadow-emerald-500/5 hover:-translate-y-0.5 border-border/80"
                    : activeRole
                    ? "bg-emerald-500/[0.04] dark:bg-emerald-500/[0.07] border-emerald-500 ring-1 ring-emerald-500 shadow-sm shadow-emerald-500/10"
                    : "bg-card border-border/80 hover:border-border"
                }`}
              >
                {/* Top Row: Avatar & Badges & Action Buttons */}
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center font-black text-base shadow-2xs shrink-0">
                        {player.canonical_name ? player.canonical_name[0].toUpperCase() : "P"}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h3 className="font-extrabold text-sm sm:text-base text-foreground truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                            {player.canonical_name}
                          </h3>
                          {player.title && (
                            <span className="px-1.5 py-0.2 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-[10px] font-black shrink-0">
                              {player.title}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {player.fide_id ? `FIDE ID: ${player.fide_id}` : "Hồ sơ kỳ thủ"}
                        </p>
                      </div>
                    </div>

                    {/* Card Actions (Edit/Delete) */}
                    <div className="flex items-center gap-1 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => handleOpenEdit(player, e)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition"
                        title="Chỉnh sửa hồ sơ"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => handleOpenDelete(player, e)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition"
                        title="Xóa hồ sơ"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Datasets & Source Badges */}
                  <div className="flex items-center gap-1.5 flex-wrap pt-1">
                    <span className="px-2.5 py-0.5 rounded-lg bg-muted/60 text-foreground text-[11px] font-bold font-mono">
                      {totalGames} ván đấu
                    </span>
                    {isCached && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-bold">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        Đã nạp bộ nhớ
                      </span>
                    )}
                  </div>
                </div>

                {/* Bottom Row / Interaction Mode Actions */}
                <div className="pt-4 mt-4 border-t border-border/60">
                  {hubMode === "single" ? (
                    <div className="flex items-center justify-between text-xs font-semibold text-emerald-600 dark:text-emerald-400 group-hover:translate-x-0.5 transition-transform">
                      <span>Mở không gian phân tích</span>
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  ) : (
                    /* Multi-Profile Matchup Role Buttons */
                    <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-between text-[11px] font-bold text-muted-foreground">
                        <span>Gán vai trò cầm quân:</span>
                        {activeRole && (
                          <button
                            type="button"
                            onClick={() => setMultiProfileRole(player, null)}
                            className="text-[10px] text-rose-500 hover:underline"
                          >
                            Bỏ chọn
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            setMultiProfileRole(player, activeRole === "white" ? null : "white")
                          }
                          className={`py-1.5 px-2 rounded-xl text-[11px] font-bold transition flex items-center justify-center gap-1 border ${
                            activeRole === "white"
                              ? "bg-slate-100 text-slate-900 border-slate-300 dark:bg-slate-200 dark:text-slate-900 dark:border-slate-100 shadow-xs ring-2 ring-emerald-500"
                              : "bg-muted/40 hover:bg-muted text-muted-foreground border-border/70"
                          }`}
                        >
                          <span>⚪ Trắng</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setMultiProfileRole(player, activeRole === "black" ? null : "black")
                          }
                          className={`py-1.5 px-2 rounded-xl text-[11px] font-bold transition flex items-center justify-center gap-1 border ${
                            activeRole === "black"
                              ? "bg-slate-900 text-white border-slate-700 dark:bg-slate-950 dark:text-white dark:border-slate-600 shadow-xs ring-2 ring-emerald-500"
                              : "bg-muted/40 hover:bg-muted text-muted-foreground border-border/70"
                          }`}
                        >
                          <span>⚫ Đen</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setMultiProfileRole(player, activeRole === "both" ? null : "both")
                          }
                          className={`py-1.5 px-2 rounded-xl text-[11px] font-bold transition flex items-center justify-center gap-1 border ${
                            activeRole === "both"
                              ? "bg-emerald-600 text-white border-emerald-500 shadow-xs ring-2 ring-emerald-500"
                              : "bg-muted/40 hover:bg-muted text-muted-foreground border-border/70"
                          }`}
                        >
                          <span>⚪⚫ Cả hai</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Floating Action Bar (Sticky at bottom in Multi-Profile Matchup Mode) */}
      {hubMode === "multi" && multiProfiles.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-full max-w-3xl px-4 animate-in slide-in-from-bottom-5 duration-300">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 sm:p-5 rounded-xl bg-slate-900/95 dark:bg-slate-900/95 text-white border border-emerald-500/40 shadow-xl shadow-emerald-950/40 backdrop-blur-xl">
            <div className="space-y-1 text-center sm:text-left min-w-0">
              <div className="flex items-center gap-2 justify-center sm:justify-start">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-400">
                  Tổ hợp Matchup ({multiProfiles.length} kỳ thủ)
                </span>
              </div>
              <p className="text-xs text-slate-200 truncate max-w-md">
                Đang chọn:{" "}
                <b className="text-white">
                  ⚪ Trắng ({whiteAssigned.map((m) => m.player.canonical_name).join(", ") || "Chưa chọn"})
                </b>{" "}
                vs{" "}
                <b className="text-white">
                  ⚫ Đen ({blackAssigned.map((m) => m.player.canonical_name).join(", ") || "Chưa chọn"})
                </b>
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={clearMultiProfiles}
                className="px-3 py-2 rounded-lg text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition"
              >
                Đặt lại
              </button>
              <button
                type="button"
                onClick={openMatchupBoard}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 text-xs font-black shadow-md shadow-emerald-500/25 transition active:scale-95"
              >
                <Swords className="w-4 h-4 text-slate-950" />
                <span>Mở Bàn Cờ & Cây Khai Cuộc</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Dialog: Tạo Hồ Sơ */}
      {modalAction === "create" && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in"
          onClick={() => setModalAction("none")}
        >
          <div
            className="w-full max-w-md bg-card border border-border rounded-xl p-6 shadow-2xl space-y-5 animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-border/60">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <UserPlus className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-base text-foreground">Tạo Hồ Sơ Kỳ Thủ Mới</h3>
              </div>
              <button
                onClick={() => setModalAction("none")}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreatePlayer} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-foreground mb-1.5 uppercase tracking-wider text-[11px]">
                  Tên Kỳ Thủ (Canonical Name) *
                </label>
                <input
                  type="text"
                  required
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="VD: Carlsen, Magnus hoặc nganbanghe"
                  className="w-full bg-background border border-border/70 rounded-lg px-3.5 py-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-foreground mb-1.5 uppercase tracking-wider text-[11px]">
                    Danh Hiệu (Title)
                  </label>
                  <input
                    type="text"
                    value={createTitle}
                    onChange={(e) => setCreateTitle(e.target.value)}
                    placeholder="GM, IM, FM..."
                    className="w-full bg-background border border-border/70 rounded-lg px-3.5 py-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  />
                </div>
                <div>
                  <label className="block font-bold text-foreground mb-1.5 uppercase tracking-wider text-[11px]">
                    FIDE ID
                  </label>
                  <input
                    type="number"
                    value={createFideId}
                    onChange={(e) => setCreateFideId(e.target.value)}
                    placeholder="1503014"
                    className="w-full bg-background border border-border/70 rounded-lg px-3.5 py-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-foreground mb-1.5 uppercase tracking-wider text-[11px]">
                  Ghi Chú
                </label>
                <textarea
                  value={createNotes}
                  onChange={(e) => setCreateNotes(e.target.value)}
                  placeholder="Ghi chú sở trường, CLB, giải đấu..."
                  rows={2}
                  className="w-full bg-background border border-border/70 rounded-lg p-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/40 resize-none"
                />
              </div>

              <div className="pt-3 border-t border-border/60 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setModalAction("none")}
                  className="px-4 py-2 rounded-lg border border-border text-foreground hover:bg-muted text-xs font-semibold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/25 flex items-center gap-1.5 disabled:opacity-50"
                >
                  {creating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Lưu Hồ Sơ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Dialog: Sửa Hồ Sơ */}
      {modalAction === "edit" && editingPlayer && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in"
          onClick={() => setModalAction("none")}
        >
          <div
            className="w-full max-w-md bg-card border border-border rounded-xl p-6 shadow-2xl space-y-5 animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-border/60">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  <Pencil className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-base text-foreground">Chỉnh Sửa Hồ Sơ Kỳ Thủ</h3>
              </div>
              <button
                onClick={() => setModalAction("none")}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdatePlayer} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-foreground mb-1.5 uppercase tracking-wider text-[11px]">
                  Tên Chính Thức (Canonical Name) *
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-background border border-border/70 rounded-lg px-3.5 py-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-foreground mb-1.5 uppercase tracking-wider text-[11px]">
                    Danh Hiệu (Title)
                  </label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    placeholder="GM, IM, FM..."
                    className="w-full bg-background border border-border/70 rounded-lg px-3.5 py-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  />
                </div>
                <div>
                  <label className="block font-bold text-foreground mb-1.5 uppercase tracking-wider text-[11px]">
                    FIDE ID
                  </label>
                  <input
                    type="number"
                    value={editFideId}
                    onChange={(e) => setEditFideId(e.target.value)}
                    placeholder="1503014"
                    className="w-full bg-background border border-border/70 rounded-lg px-3.5 py-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-foreground mb-1.5 uppercase tracking-wider text-[11px]">
                  Ghi Chú
                </label>
                <textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Ghi chú sở trường, CLB, giải đấu..."
                  rows={2}
                  className="w-full bg-background border border-border/70 rounded-lg p-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/40 resize-none"
                />
              </div>

              <div className="pt-3 border-t border-border/60 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setModalAction("none")}
                  className="px-4 py-2 rounded-lg border border-border text-foreground hover:bg-muted text-xs font-semibold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={updating}
                  className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/25 flex items-center gap-1.5 disabled:opacity-50"
                >
                  {updating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Cập Nhật
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Dialog: Xóa Hồ Sơ */}
      {modalAction === "delete" && deletingPlayer && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in"
          onClick={() => setModalAction("none")}
        >
          <div
            className="w-full max-w-md bg-card border border-border rounded-xl p-6 shadow-2xl space-y-4 animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20">
                <AlertTriangle className="w-6 h-6 text-rose-500" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-foreground">Xác Nhận Xóa Hồ Sơ</h3>
                <p className="text-xs text-muted-foreground">Hành động này không thể hoàn tác</p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Bạn có chắc chắn muốn xóa vĩnh viễn hồ sơ kỳ thủ{" "}
              <b className="text-foreground">{deletingPlayer.canonical_name}</b> cùng toàn bộ ván đấu
              đã nhập vào hệ thống không?
            </p>

            <div className="pt-3 border-t border-border/60 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setModalAction("none")}
                className="px-4 py-2 rounded-lg border border-border text-foreground hover:bg-muted text-xs font-semibold"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleConfirmDelete}
                className="px-5 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-md shadow-rose-600/25 flex items-center gap-1.5 disabled:opacity-50"
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
