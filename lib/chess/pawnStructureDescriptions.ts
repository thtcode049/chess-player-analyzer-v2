/**
 * Pawn Structure Descriptions & Explanations (Vietnamese)
 * Chuẩn hóa theo cuốn sách kinh điển của GM Mauricio Flores Rios:
 * "Chess Structures: A Grandmaster Guide" (28 cấu trúc).
 */

export const PAWN_STRUCTURE_DESCRIPTIONS: Record<string, string> = {
  // =========================================================================
  // FAMILY ONE: d4 and ...d5
  // =========================================================================
  isolani:
    "The Isolani: Tốt d cô lập (không có tốt đồng minh trên cột c và e). Bên giữ Isolani có ưu thế không gian và tiền đồn e5/d4 để phát động tấn công cánh Vua hoặc đòn phá d4-d5 (...d5-d4); bên phòng thủ tìm cách phong tỏa ô trước mặt tốt cô lập và đổi quân đưa về tàn cuộc.",
  hanging_pawns:
    "Hanging Pawns: Cặp tốt c và d song song phơi mình trên hai cột nửa mở c và d, không có tốt đồng minh ở cột b và e. Cặp tốt này kiểm soát trung tâm cơ động (sẵn sàng đẩy d4-d5), nhưng có thể bị đối phương phong tỏa và công phá bằng đòn b6-b5 hoặc e6-e5.",
  caro_kann_formation:
    "Caro-Kann Formation: Xuất hiện sau khi tốt d5 của Đen đổi lấy tốt e4 của Trắng (...d5xe4). Trắng nắm d4 và ưu thế không gian cánh Vua; Đen lập bộ khung c6+e6 và rình rập đòn giải phóng trung tâm then chốt ...c6-c5 (hoặc ...e6-e5).",
  slav_formation:
    "Slav Formation: Xuất hiện sau khi tốt d5 của Đen đổi lấy tốt c4 của Trắng (...dxc4). Trắng nắm d4 và cột c nửa mở để tấn công cánh Vua (h4, e4-e5); Đen giữ bộ khung c6+e6/e7 và chuẩn bị các đòn đột phá trung tâm ...e6-e5 hoặc ...c6-c5.",
  carlsbad_formation:
    "The Carlsbad Formation: Bộ khung kinh điển từ Gambit Hậu đổi (Trắng giữ d4+e3, Đen giữ c6+d5, hoặc cấu trúc đảo). Kế hoạch đặc trưng là Đòn tấn công thiểu số cánh Hậu (b4-b5) của Trắng hoặc phản công cánh Vua với Mã tiền đồn e4 của Đen.",
  stonewall:
    "Stonewall: Khối tường đá vững chắc c6-d5-e6-f5 (Dutch Stonewall) hoặc c3-d4-e3-f4. Bên chơi Stonewall chiếm cứ tiền đồn e4/e5 mở cuộc tấn công cánh Vua; bên chống trả khai thác lỗ hổng đối ứng e5/e4 và tìm cách đổi Tượng cùng màu với các ô yếu.",
  grunfeld_centre:
    "Grünfeld Centre: Trắng giữ cặp tốt trung tâm hùng mạnh d4+e4 và chỉ còn 1 tốt cánh Hậu (cột b, c mở); Đen sở hữu đa số 2 đánh 1 ở cánh Hậu (a, b) và dùng Xe cột c/d cùng Tượng fianchetto g7 gây áp lực tối đa lên trung tâm Trắng.",

  // =========================================================================
  // FAMILY TWO: Open Sicilian
  // =========================================================================
  najdorf_type_i:
    "Najdorf Type I: Xuất hiện sau khi Trắng ăn đổi exd5. Trắng có chốt d5 và đa số tốt cánh Hậu (b4, c4-c5); Đen có d6+e5 và dồn toàn lực mở rộng cánh Vua bằng đòn ...f7-f5 kết hợp Tượng ô đen cơ động.",
  najdorf_type_ii:
    "Najdorf Type II: Lỗ hổng d5 kinh điển của Sicilian Najdorf/Sveshnikov (Đen d6+e5 trên cột c mở, Trắng e4). Trắng nhắm vào ô tiền đồn d5 và tốt lạc hậu d6; Đen tìm mọi cách thực hiện đòn giải phóng trung tâm ...d6-d5.",
  hedgehog:
    "The Hedgehog: Đen thu mình sau hàng gai nhím a6-b6-d6-e6 chống lại gọng kìm c4+e4 của Trắng. Đen bảo vệ chặt chẽ các ô yếu và kiên nhẫn chờ thời điểm bùng nổ phản công bằng các đòn giải phóng ...d6-d5! hoặc ...b6-b5!.",
  maroczy:
    "The Maroczy: Gọng kìm c4+e4 kiểm soát chặt ô d5 trước hệ thống fianchetto Tượng g7 của Đen (Accelerated Dragon / English). Trắng tận dụng ưu thế không gian; Đen tích cực đổi bớt quân nhẹ và tìm đòn phản công ...b6-b5 hoặc ...f7-f5.",

  // =========================================================================
  // FAMILY THREE: Benoni
  // =========================================================================
  asymmetric_benoni:
    "Asymmetric Benoni: Xuất hiện sau ...exd5 và Trắng ăn lại bằng tốt c (cxd5). Trắng có đa số tốt trung tâm d5+e4 hướng tới đòn đột phá e4-e5; Đen có đa số tốt cánh Hậu c5+b5+a6 đua nhau dâng tốt tạo tốt thông xa.",
  symmetric_benoni:
    "Symmetric Benoni: Xuất hiện sau khi Trắng ăn lại bằng tốt e (exd5), mở toang cột e. Trắng giữ c4+d5 mở rộng cánh Vua với f4, g4; Đen giữ c5+d6 tranh chấp tiền đồn e4 và chuẩn bị phản công cánh Hậu bằng ...b7-b5.",

  // =========================================================================
  // FAMILY FOUR: King's Indian
  // =========================================================================
  kid_type_i:
    "KID Type I: Nêm trung tâm d5+e4 đối đầu d6+e5 với cột c đã mở hoàn toàn. Cuộc chiến xoay quanh việc kiểm soát cột c để xâm nhập hàng 7 và tốc độ phản công cánh Vua của Đen bằng ...f7-f5xe4.",
  kid_type_ii:
    "KID Type II: Khóa cứng cả trung tâm lẫn cột c (c4-d5-e4 đối đầu c5-d6-e5). Nhịp độ chậm hơn cho phép Đen phát động bão tốt vũ bão cánh Vua ...f7-f5-f4 và ...g6-g5-g4, trong khi Trắng mở cánh Hậu bằng b2-b4.",
  kid_type_iii:
    "KID Type III: Cấu trúc Mar del Plata kinh điển (c4-d5-e4 đối đầu c7/c6-d6-e5). Cuộc đua nghẹt thở giữa Trắng công phá cánh Hậu (c4-c5xd6 hoặc c4-c5-c6) và Đen dồn toàn lực bão tốt chiếu hết cánh Vua (...f5-f4, ...g5-g4-g3).",
  open_kid:
    "Open KID: Xuất hiện sau khi Đen đổi ...exd4 nhưng vẫn giữ tốt c7 hoặc c6 (khác Maroczy nơi Đen mất tốt c). Trắng dùng c4+e4 ép vào tốt yếu d6 trên cột d nửa mở; Đen đặt Mã ở e5/c5 và chuẩn bị ...f7-f5.",
  kid_complex:
    "KID Complex: Cấu trúc biến ảo xuất phát từ sức căng c4+d4+e4 vs c6+d6+e5 hoặc sau dxe5 dxe5 mở cột d. Trắng đẩy c4-c5 tạo tiền đồn d6, Đen chiến đấu giành quyền kiểm soát ô đen then chốt d4.",

  // =========================================================================
  // FAMILY FIVE: French
  // =========================================================================
  french_type_i:
    "French Type I: Xuất hiện sau đòn ...f7-f6 và Trắng ăn e5xf6. Trắng nhắm vào kiểm soát ô tiền đồn e5 và tốt lạc hậu e6 trên cột e nửa mở; Đen dồn lực công kích tốt d4 và phản công dọc cột f nửa mở.",
  french_type_ii:
    "French Type II: Mũi nhọn e5 sau khi Đen đã đổi tốt c5 lấy d4 (...cxd4 Nxd4). Trắng chốt Mã vững chắc tại d4 và phát động bão tốt cánh Vua f4-f5; Đen phản kích bằng ...f7-f6, ...g7-g5 hoặc tấn công thiểu số cánh Hậu ...b5-b4.",
  french_type_iii:
    "French Type III: Xích tốt nguyên vẹn d4+e5 đối đầu d5+e6 (French Advance, Caro-Kann Advance, Catalan e5). Trắng công kích gốc xích e6 và cánh Vua; Đen dồn hỏa lực công phá gốc xích d4 bằng ...c7-c5 và mở cột c.",

  // =========================================================================
  // MISCELLANEOUS: Various Structures
  // =========================================================================
  structure_33_vs_42:
    "The 3-3 vs. 4-2 Structure: Cột d mở hoàn toàn; một bên giữ 3-3 (3 tốt cánh Hậu a,b,c đấu 2 tốt) và bên kia giữ 4-2 (4 tốt cánh Vua e,f,g,h đấu 3 tốt). Cuộc chiến phân định giữa đòn tạo tốt thông cánh Hậu và sức mạnh cặp Tượng trong thế cờ thoáng.",
  panov_structure:
    "The Panov Structure: Trắng có mũi nhọn c5+d4 tạo ưu thế không gian và tiềm năng tạo tốt thông cánh Hậu với b4-b5; Đen giữ d5+e6 và phản kích bằng đòn bẻ gãy đầu xích ...b7-b6 cùng áp lực lên gốc d4.",
  dragon_formation:
    "The Dragon Formation: Cấu trúc Rồng Sicilian (Trắng e4 không khóa c4, Đen d6+g6+e7 trên cột c mở). Khi nhập thành khác phía, hai bên bước vào cuộc đua công thành sinh tử dọc theo cột c (Đen) và cột h (Trắng).",
  scheveningen_structure:
    "The Scheveningen Structure: Đen dựng lá chắn trung tâm nhỏ d6+e6 kìm hãm tốt e4 của Trắng. Trắng tấn công cánh Vua bằng bão tốt Keres (g4-g5, h4-h5) hoặc f4-f5; Đen phản công dọc cột c và chực chờ đòn giải phóng ...d6-d5.",
  benko_structure:
    "The Benko Structure: Cấu trúc Gambit Benko kinh điển. Đen thí sạch hai tốt a, b để chiếm trọn hai cột nửa mở a, b và đường chéo lớn của Tượng g7, tạo áp lực tê liệt vĩnh viễn lên cánh Hậu Trắng kéo dài tới tận tàn cuộc.",
  closed_ruy_lopez:
    "The Closed Ruy Lopez: Cấu trúc c3-d5-e4 đối đầu d6-e5 từ khai cuộc Ruy Lopez. Do Trắng không có tốt ở c4 nên Đen có không gian phản công cánh Hậu bằng ...a5, ...b5-b4, trong khi Trắng điều chuyển Mã Nbd2-f1-g3-f5 công thành cánh Vua.",
  lopez_formation:
    "The Lopez Formation: Cấu trúc trung gian linh hoạt từ Ruy Lopez với sức căng c3+d4+e4 trước d6-e5, hoặc sau khi Đen đổi đôi tốt tại d4 (tạo thế e4 đấu d6 với cột c mở). Trắng khai thác điểm yếu d6, Đen phản kích trực diện vào e4.",

  // =========================================================================
  // Legacy Aliases (Tương thích ngược dữ liệu cũ trong CSDL)
  // =========================================================================
  iqp: "The Isolani: Tốt d cô lập (không có tốt đồng minh trên cột c và e). Bên giữ Isolani có ưu thế không gian và tiền đồn e5/d4 để phát triển tấn công, nhưng tốt d dễ trở thành điểm yếu bị phong tỏa về tàn cuộc.",
  isolated_queens_pawn:
    "The Isolani: Tốt d cô lập (không có tốt đồng minh trên cột c và e). Bên giữ Isolani có ưu thế không gian và tiền đồn e5/d4 để phát triển tấn công, nhưng tốt d dễ trở thành điểm yếu bị phong tỏa về tàn cuộc.",
  carlsbad:
    "The Carlsbad Formation: Bộ khung kinh điển từ Gambit Hậu đổi (Trắng giữ d4+e3, Đen giữ c6+d5, hoặc cấu trúc đảo). Kế hoạch đặc trưng là Đòn tấn công thiểu số cánh Hậu (b4-b5) của Trắng hoặc phản công cánh Vua với Mã tiền đồn e4 của Đen.",
  carlsbad_structure:
    "The Carlsbad Formation: Bộ khung kinh điển từ Gambit Hậu đổi (Trắng giữ d4+e3, Đen giữ c6+d5, hoặc cấu trúc đảo). Kế hoạch đặc trưng là Đòn tấn công thiểu số cánh Hậu (b4-b5) của Trắng hoặc phản công cánh Vua với Mã tiền đồn e4 của Đen.",
  french_chain:
    "French Type III: Xích tốt nguyên vẹn d4+e5 đối đầu d5+e6. Trắng công kích gốc xích e6 và cánh Vua, Đen công phá gốc xích d4 bằng ...c7-c5 và mở cột c.",
  kings_indian:
    "King's Indian Complex: Các dạng cấu trúc King's Indian đặc trưng (Type I, II, III, Open KID và KID Complex) theo chuẩn Flores Rios.",
  kings_indian_structure:
    "King's Indian Complex: Các dạng cấu trúc King's Indian đặc trưng (Type I, II, III, Open KID và KID Complex) theo chuẩn Flores Rios.",
  scheveningen:
    "The Scheveningen Structure: Đen dựng lá chắn trung tâm nhỏ d6+e6 kìm hãm tốt e4 của Trắng. Trắng tấn công cánh Vua bằng bão tốt Keres (g4-g5, h4-h5) hoặc f4-f5; Đen phản công dọc cột c và chực chờ đòn giải phóng ...d6-d5.",
  boleslavsky:
    "Najdorf Type II: Lỗ hổng d5 kinh điển của Sicilian Najdorf/Sveshnikov (Đen d6+e5 trên cột c mở, Trắng e4). Trắng nhắm vào ô tiền đồn d5 và tốt lạc hậu d6; Đen tìm mọi cách thực hiện đòn giải phóng trung tâm ...d6-d5.",
  boleslavsky_hole:
    "Najdorf Type II: Lỗ hổng d5 kinh điển của Sicilian Najdorf/Sveshnikov (Đen d6+e5 trên cột c mở, Trắng e4). Trắng nhắm vào ô tiền đồn d5 và tốt lạc hậu d6; Đen tìm mọi cách thực hiện đòn giải phóng trung tâm ...d6-d5.",
  maroczy_bind:
    "The Maroczy: Gọng kìm c4+e4 kiểm soát chặt ô d5 trước hệ thống fianchetto Tượng g7 của Đen.",
  open: "Trung tâm mở: Cả hai bên đều đã đổi hết tốt ở các cột trung tâm (d và e).",
  semi_open: "Trung tâm nửa mở: Có ít nhất một cột mở hoặc nửa mở ở trung tâm.",
  closed: "Trung tâm đóng: Tốt trung tâm bị khóa đối đầu trực diện.",
  symmetrical: "Trung tâm đối xứng: Cấu trúc tốt trung tâm đối xứng nhau qua trục ngang.",
};

export function getPawnStructureDescription(nameOrKey?: string | null): string {
  if (!nameOrKey) return "Cấu trúc thế trận Tốt trong cờ vua.";
  const normalized = nameOrKey
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, "_")
    .replace(/_+/g, "_");

  // 1. Kiểm tra khớp chính xác trước
  if (PAWN_STRUCTURE_DESCRIPTIONS[normalized]) {
    return PAWN_STRUCTURE_DESCRIPTIONS[normalized];
  }

  // 2. Khớp chuỗi con: sắp xếp các key theo chiều dài giảm dần để tránh key ngắn (như kid_type_i) nuốt key dài (kid_type_iii)
  const sortedKeys = Object.keys(PAWN_STRUCTURE_DESCRIPTIONS).sort((a, b) => b.length - a.length);
  for (const k of sortedKeys) {
    if (normalized.includes(k) || k.includes(normalized)) {
      return PAWN_STRUCTURE_DESCRIPTIONS[k];
    }
  }

  return "Cấu trúc Tốt định hình thế trận trung cuộc, quyết định kế hoạch chiến lược và phương án tác chiến của hai bên.";
}
