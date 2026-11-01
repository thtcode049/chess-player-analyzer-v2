/**
 * Pawn Structure Descriptions & Explanations (Vietnamese)
 * Cung cấp định nghĩa, đặc điểm chiến lược và giải thích cho từng cấu trúc Tốt (Nhóm A & Nhóm B).
 */

export const PAWN_STRUCTURE_DESCRIPTIONS: Record<string, string> = {
  // Nhóm A: Cấu trúc nền tảng và trạng thái trung tâm
  iqp: "Tốt d cô lập (không có tốt đồng minh trên cột c và e bảo vệ). Bên sở hữu có ưu thế không gian và các ô tiền đồn mạnh c5/e5 để phát triển tấn công, nhưng tốt d dễ trở thành điểm yếu bị phong tỏa về tàn cuộc.",
  isolated_queens_pawn: "Tốt d cô lập (không có tốt đồng minh trên cột c và e bảo vệ). Bên sở hữu có ưu thế không gian và các ô tiền đồn mạnh c5/e5 để phát triển tấn công, nhưng tốt d dễ trở thành điểm yếu bị phong tỏa về tàn cuộc.",
  hanging_pawns: "Cặp tốt c và d song song cùng tiến lên hàng 4 (Trắng: c4+d4) hoặc hàng 5 (Đen: c5+d5) trên các cột mở b và e. Cặp tốt này kiểm soát trung tâm cơ động nhưng dễ bị cô lập hoặc trở thành tốt lạc hậu nếu bị đối phương ép dâng lên.",
  open: "Trung tâm mở: Cả hai bên đều đã đổi hết tốt ở các cột trung tâm (d và e), mở toang các đường cho quân nặng (Xe, Hậu) chiếm lĩnh cột và quân nhẹ chiến đấu tầm xa.",
  open_structure: "Trung tâm mở: Cả hai bên đều đã đổi hết tốt ở các cột trung tâm (d và e), mở toang các đường cho quân nặng (Xe, Hậu) chiếm lĩnh cột và quân nhẹ chiến đấu tầm xa.",
  semi_open: "Trung tâm nửa mở: Một bên còn tốt trung tâm trong khi bên kia đã mở một cột trung tâm, tạo ra một cột mở và một cột nửa mở để hai bên cạnh tranh kiểm soát.",
  semi_open_structure: "Trung tâm nửa mở: Một bên còn tốt trung tâm trong khi bên kia đã mở một cột trung tâm, tạo ra một cột mở và một cột nửa mở để hai bên cạnh tranh kiểm soát.",
  closed: "Trung tâm đóng: Các tốt trung tâm d và e của hai bên đối đầu trực diện và khóa chặt lẫn nhau, buộc trọng tâm giao tranh chiến lược phải chuyển dịch sang tác chiến trên hai cánh.",
  closed_structure: "Trung tâm đóng: Các tốt trung tâm d và e của hai bên đối đầu trực diện và khóa chặt lẫn nhau, buộc trọng tâm giao tranh chiến lược phải chuyển dịch sang tác chiến trên hai cánh.",
  symmetrical: "Trung tâm đối xứng: Cấu trúc tốt trung tâm của hai bên hoàn toàn đối xứng nhau qua trục ngang. Thế trận cân bằng chặt chẽ, đòi hỏi tính chính xác vi mô để tích lũy lợi thế nhỏ.",
  symmetrical_structure: "Trung tâm đối xứng: Cấu trúc tốt trung tâm của hai bên hoàn toàn đối xứng nhau qua trục ngang. Thế trận cân bằng chặt chẽ, đòi hỏi tính chính xác vi mô để tích lũy lợi thế nhỏ.",

  // Nhóm B: Cấu trúc chiến lược kinh điển
  carlsbad: "Cấu trúc Carlsbad: Kinh điển từ Gambit Hậu đổi (Trắng có c3, d4, e3 vs Đen có c6, d5, e6). Trắng thường phát động đòn Tấn công thiểu số cánh Hậu (a4, b4-b5), còn Đen thiết lập tiền đồn Mã e4 phản công cánh Vua.",
  carlsbad_structure: "Cấu trúc Carlsbad: Kinh điển từ Gambit Hậu đổi (Trắng có c3, d4, e3 vs Đen có c6, d5, e6). Trắng thường phát động đòn Tấn công thiểu số cánh Hậu (a4, b4-b5), còn Đen thiết lập tiền đồn Mã e4 phản công cánh Vua.",
  french_chain: "Xích tốt Pháp: Xích tốt d4-e5 của Trắng cắm sâu vào trận địa Đen đối đầu xích tốt c6-d5-e6. Trắng chiếm ưu thế không gian cánh Vua để tấn công thành, còn Đen dồn lực công phá gốc xích d4 bằng ...c5, ...Nc6, ...Qb6.",
  kings_indian: "Cấu trúc King's Indian: Trung tâm khóa kín với d4-d5 của Trắng và c7-d6-e5 của Đen. Trắng công kích dữ dội cánh Hậu (c4-c5), còn Đen phát động đợt bão tốt cánh Vua (f7-f5-f4, g5-g4) tấn công thành Vua.",
  kings_indian_structure: "Cấu trúc King's Indian: Trung tâm khóa kín với d4-d5 của Trắng và c7-d6-e5 của Đen. Trắng công kích dữ dội cánh Hậu (c4-c5), còn Đen phát động đợt bão tốt cánh Vua (f7-f5-f4, g5-g4) tấn công thành Vua.",
  scheveningen: "Cấu trúc Scheveningen: Đen thiết lập lá chắn trung tâm kiên cố với d6 và e6 (từ phòng thủ Sicilian), kìm hãm tốt d4/e4 của Trắng và chuẩn bị phản công sắc bén trên cột c nửa mở.",
  scheveningen_structure: "Cấu trúc Scheveningen: Đen thiết lập lá chắn trung tâm kiên cố với d6 và e6 (từ phòng thủ Sicilian), kìm hãm tốt d4/e4 của Trắng và chuẩn bị phản công sắc bén trên cột c nửa mở.",
  boleslavsky: "Lỗ hổng Boleslavsky: Đen đẩy ...e7-e5 kiểm soát d4 nhưng tạo ra lỗ hổng tĩnh tại ô d5 và tốt d6 lạc hậu. Trắng nhắm vào phong tỏa ô d5, trong khi Đen tận dụng tính cơ động quân nhẹ bù đắp.",
  boleslavsky_hole: "Lỗ hổng Boleslavsky: Đen đẩy ...e7-e5 kiểm soát d4 nhưng tạo ra lỗ hổng tĩnh tại ô d5 và tốt d6 lạc hậu. Trắng nhắm vào phong tỏa ô d5, trong khi Đen tận dụng tính cơ động quân nhẹ bù đắp.",
  maroczy: "Gông cùm Maroczy: Trắng dựng hai chốt c4 và e4 siết chặt ô d5, bóp nghẹt không gian hoạt động của Đen và ngăn chặn mọi ý đồ đột phá trung tâm giải phóng cờ.",
  maroczy_bind: "Gông cùm Maroczy: Trắng dựng hai chốt c4 và e4 siết chặt ô d5, bóp nghẹt không gian hoạt động của Đen và ngăn chặn mọi ý đồ đột phá trung tâm giải phóng cờ.",
  hedgehog: "Thế trận Nhím (Hedgehog): Đen dàn toàn bộ tốt trên hàng 6 (a6, b6, d6, e6) như gai nhím, co cụm phòng thủ chặt chẽ và chực chờ thời cơ bùng nổ phản công bằng các đòn đẩy tốt ...d5 hoặc ...b5.",
  hedgehog_structure: "Thế trận Nhím (Hedgehog): Đen dàn toàn bộ tốt trên hàng 6 (a6, b6, d6, e6) như gai nhím, co cụm phòng thủ chặt chẽ và chực chờ thời cơ bùng nổ phản công bằng các đòn đẩy tốt ...d5 hoặc ...b5.",
  stonewall: "Bức tường đá Stonewall: Khối tốt hình chữ W kiên cố (c3-d4-e3-f4 hoặc c6-d5-e6-f5), tạo tiền đồn bất khả xâm phạm ở e5 (hoặc e4) nhưng để lại lỗ hổng ở e4 (hoặc e5) và Tượng xấu.",
  stonewall_structure: "Bức tường đá Stonewall: Khối tốt hình chữ W kiên cố (c3-d4-e3-f4 hoặc c6-d5-e6-f5), tạo tiền đồn bất khả xâm phạm ở e5 (hoặc e4) nhưng để lại lỗ hổng ở e4 (hoặc e5) và Tượng xấu.",
};

export function getPawnStructureDescription(nameOrKey?: string | null): string {
  if (!nameOrKey) return "Cấu trúc thế trận Tốt trong cờ vua.";
  const normalized = nameOrKey
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, "_")
    .replace(/_+/g, "_");

  for (const [k, desc] of Object.entries(PAWN_STRUCTURE_DESCRIPTIONS)) {
    if (normalized.includes(k) || k.includes(normalized)) {
      return desc;
    }
  }

  return "Cấu trúc Tốt định hình thế trận trung cuộc, quyết định kế hoạch chiến lược và phương án tác chiến của hai bên.";
}
