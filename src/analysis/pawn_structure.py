"""
Pawn Structure Detection & Performance Analysis Module
------------------------------------------------------
Chức năng: Nhận diện cấu trúc Tốt (Pawn Structure) bằng luật giải định bộ khung Tốt (Deterministic Pawn Skeleton Rules)
qua python-chess, chuẩn hóa 100% theo bố cục cuốn sách kinh điển:
Mauricio Flores Rios - "Chess Structures: A Grandmaster Guide" (Quality Chess).

Tổ chức thành 5 Họ cấu trúc (Family One -> Family Five, Chương 1-21) và nhóm Miscellaneous (Chương 22):
- Family One   (family_1)      : d4 & ...d5 (Isolani, Hanging Pawns, Caro-Kann, Slav, Carlsbad, Stonewall, Grünfeld Centre)
- Family Two   (family_2)      : Open Sicilian (Najdorf Type I, Najdorf Type II, The Hedgehog, The Maroczy)
- Family Three (family_3)      : Benoni (Asymmetric Benoni, Symmetric Benoni)
- Family Four  (family_4)      : King's Indian (KID Type I, KID Type II, KID Type III, Open KID, KID Complex)
- Family Five  (family_5)      : French (French Type I, French Type II, French Type III)
- Miscellaneous (miscellaneous): Various Structures - Ch. 22 (3-3 vs. 4-2, Panov, Dragon, Scheveningen, Benko, Closed Ruy Lopez, Lopez Formation)
"""

import re
from typing import List, Dict, Any, Optional, Tuple
import chess
from src.utils import determine_game_outcome
from src.statistics import calculate_score_percentage



FLORES_RIOS_GROUPS: Dict[str, Dict[str, Any]] = {
    "family_1": {
        "title": "Family One – d4 & ...d5",
        "order": 1,
    },
    "family_2": {
        "title": "Family Two – Open Sicilian",
        "order": 2,
    },
    "family_3": {
        "title": "Family Three – Benoni",
        "order": 3,
    },
    "family_4": {
        "title": "Family Four – King's Indian",
        "order": 4,
    },
    "family_5": {
        "title": "Family Five – French",
        "order": 5,
    },
    "miscellaneous": {
        "title": "Miscellaneous – Various Structures",
        "order": 6,
    },
}


STRATEGIC_PLANS: Dict[str, Dict[str, List[str]]] = {
    # =========================================================================
    # FAMILY ONE: d4 and ...d5 (Chapters 1 - 7)
    # =========================================================================
    "Isolani": {
        "ideas": [
            "Tạo mũi tấn công cánh Vua: đặt Mã tiền đồn e5, phối hợp Bg5, dàn đại bác Qd3-Bc2 và chuyển Xe qua hàng 3 (Re1-e3-h3), sẵn sàng thí quân phá thành.",
            "Chọn thời cơ đột phá trung tâm bằng d4-d5 (hoặc ...d5-d4) nhằm đổi bớt tốt cô lập và mở tung các đường công kích với sáng kiến áp đảo.",
        ],
        "counter_ideas": [
            "Chủ động đổi quân nhẹ đưa về tàn cuộc ưu thế; đặc biệt ưu tiên đổi Tượng tốt cùng màu ô với Tượng mạnh của bên giữ Isolani (Tượng ô trắng khi Trắng giữ d4).",
            "Phong tỏa kiên cố ô ngay trước mặt tốt cô lập (d5 hoặc d4) bằng Mã nhằm ngăn đòn d4-d5; về tàn cuộc đặt Xe, Tượng hoặc cả Vua vào ô phong tỏa này.",
        ],
    },
    "Hanging_Pawns": {
        "ideas": [
            "Phát động tấn công cánh Vua dựa trên ưu thế kiểm soát trung tâm và không gian (Ne5, Bc2, Qd3 kết hợp chuyển Xe dọc hàng 3 Re1-e3-h3).",
            "Chọn đúng thời điểm đẩy d4-d5 (hoặc ...d5-d4) để mở đường chéo công kích hoặc tạo tốt thông nguy hiểm trên cột d.",
        ],
        "counter_ideas": [
            "Đổi bớt quân nhằm triệt tiêu sức công thành của đối phương và đưa về tàn cuộc nơi cặp tốt treo phơi mình trên hai cột nửa mở c, d rất dễ tổn thương.",
            "Dồn quân nặng gây sức ép trực diện trên hai cột nửa mở c, d; hoặc tung đòn công phá hông ...b6-b5 hay ...e6-e5 để bẻ gãy sự liên kết của cặp tốt treo.",
        ],
    },
    "Caro_Kann_Formation": {
        "ideas": [
            "Tấn công trực diện cánh Vua: cắm Mã vào tiền đồn mạnh e5, phối hợp Hậu và Tượng từ d3 nhắm vào h7.",
            "Mở rộng không gian bằng c3-c4, h2-h4; hoặc đẩy c4-c5 ngăn chặn đòn giải phóng ...c6-c5 của đối phương và chiếm quyền kiểm soát ô d6.",
        ],
        "counter_ideas": [
            "Chuẩn bị và thực hiện đòn đột phá giải phóng số một ...c6-c5 (chuyển thế trận về cấu trúc cân bằng 3-3 vs. 4-2 sau dxc5), hoặc ...e6-e5 nếu kiểm soát được e5.",
            "Gây áp lực trực diện lên tốt d4 sau khi đối phương đẩy c3-c4, hoặc đẩy ...b7-b5 tranh chấp quyền kiểm soát ô d5.",
        ],
    },
    "Slav_Formation": {
        "ideas": [
            "Tấn công cánh Vua bằng h2-h4-h5-h6 kết hợp dâng trung tâm e3-e4-e5 cố định thế trận và kiểm soát chặt ô d6.",
            "Đặt các quân Mã lên hai tiền đồn mạnh e5 và c5; hoặc phát động đòn tấn công thiểu số cánh Hậu a2-a4, b2-b4-b5 ngăn đòn ...c6-c5.",
        ],
        "counter_ideas": [
            "Tìm thời cơ thực hiện đòn đột phá giải phóng khả thi nhất ...e6-e5 (đưa về cấu trúc 4-2 vs. 3-3 cân bằng), hoặc ...c6-c5 trước khi đối phương khóa cột c.",
            "Gây sức ép lên tốt d4 một khi đối phương đã đẩy e3-e4, hoặc đánh phá hông trung tâm bằng đòn ...f7-f5.",
        ],
    },
    "Carlsbad_Formation": {
        "ideas": [
            "Đưa Tượng ra ngoài xích tốt (Bg5/Bf4), sau đó triển khai Đòn tấn công thiểu số (Minority Attack) b2-b4-b5 nhằm tạo điểm yếu tĩnh tại c6 hoặc d5.",
            "Triển khai kế hoạch trung tâm: chuẩn bị f2-f3 rồi đẩy e3-e4 (hoặc e3-e4 trực tiếp) để mở rộng không gian và tạo mũi công thành cánh Vua.",
        ],
        "counter_ideas": [
            "Cắm Mã vào tiền đồn mạnh e4 (hoặc e5 ở cấu trúc đảo) kết hợp tổ chức tấn công trực diện vào cánh Vua đối phương.",
            "Phản công trung tâm bằng ...b7-b6 và ...c6-c5 (chuyển sang Hanging Pawns/Isolani), hoặc đáp trả b4 bằng ...b7-b5 để chiếm tiền đồn c4 cho Mã.",
        ],
    },
    "Stonewall": {
        "ideas": [
            "Tổ chức tấn công cánh Vua nhưng tuyệt đối không được buông lỏng quyền kiểm soát ô trung tâm trọng yếu e5 (hoặc e4 khi Trắng lập Stonewall).",
            "Cải thiện Tượng xấu bị giam sau xích tốt bằng lộ trình ...Bd7-e8-h5 (hoặc ...b7-b6, ...Ba6); hoặc tạo sức căng trung tâm bằng ...b7-b6 và ...c6-c5.",
        ],
        "counter_ideas": [
            "Thiết lập quyền kiểm soát tuyệt đối trên lỗ hổng e5 (hoặc e4) và đặt Mã chốt giữ kiên cố tại đó.",
            "Đổi Tượng cùng màu với các ô yếu của Stonewall (đổi Tượng ô đen khi chống Dutch Stonewall) và mở cột c vào thời điểm thuận lợi để Xe đột nhập.",
        ],
    },
    "Grunfeld_Centre": {
        "ideas": [
            "Tranh chấp quyết liệt cột mở c và đẩy d4-d5 tạo tốt thông trung tâm mạnh, phát huy tối đa ưu thế không gian ở trung cuộc.",
            "Tấn công cánh Vua với h2-h4-h5 kết hợp e4-e5 nhằm khoét sâu vào ô f6 suy yếu quanh Tượng fianchetto g7.",
        ],
        "counter_ideas": [
            "Chủ động đổi quân đưa về tàn cuộc và thúc đẩy đa số tốt cánh Hậu (2 đánh 1 trên cột a, b) nhằm tạo tốt thông xa quyết định.",
            "Đặt Xe trên cột d kết hợp Tượng g7 gây sức ép liên tục lên cặp tốt trung tâm d4+e4 và tranh quyền kiểm soát cột mở c.",
        ],
    },

    # =========================================================================
    # FAMILY TWO: Open Sicilian (Chapters 8 - 11)
    # =========================================================================
    "Najdorf_Type_I": {
        "ideas": [
            "Dâng đa số tốt cánh Hậu bằng b2-b4 và c2-c4-c5 nhằm tạo tốt thông mạnh, đồng thời tìm cách cải thiện hoặc đổi Tượng ô trắng thụ động.",
            "Khi Đen đã đẩy ...f7-f5, đặt Tượng trên đường chéo b1-h7 và tung đòn phản kích g2-g4 phá vỡ cấu trúc cánh Vua Đen.",
        ],
        "counter_ideas": [
            "Mở rộng cánh Vua bằng ...f7-f5 phát động tấn công thành Vua và phát huy tối đa sức mạnh Tượng ô đen rất cơ động trong cấu trúc này.",
            "Kìm hãm và chia cắt đa số tốt cánh Hậu của Trắng bằng đòn ...b7-b5 kịp thời.",
        ],
    },
    "Najdorf_Type_II": {
        "ideas": [
            "Đưa Mã chiếm đóng lỗ hổng d5 và duy trì đủ quân nhẹ tiếp ứng để luôn ăn lại trên d5 bằng quân chứ không phải bằng tốt.",
            "Loại bỏ quân Mã f6 bảo vệ ô d5 (g2-g4-g5 hoặc Bg5xf6), đẩy f2-f4-f5 ngăn Tượng Đen đứng e6, hoặc đi c4 khóa vĩnh viễn đòn ...d6-d5.",
        ],
        "counter_ideas": [
            "Chuẩn bị kỹ lưỡng và thực hiện đòn đột phá trung tâm ...d6-d5 để giải phóng thế trận và xóa bỏ lỗ hổng d5.",
            "Gây áp lực dọc cột nửa mở c nhắm vào c2 để ghim chân Mã c3, hoặc đẩy ...b7-b5-b4 xua đuổi Mã c3 trước khi Trắng kịp củng cố d5.",
        ],
    },
    "Hedgehog": {
        "ideas": [
            "Chuẩn bị kỹ lưỡng một trong ba đòn mở cánh Hậu: c4-c5 (phổ biến nhất), b4-b5, hoặc a4-a5 để phát huy ưu thế không gian.",
            "Đổi bớt quân nhẹ làm giảm sức bật phản công của hàng gai nhím rồi mới tập trung quân nặng đánh vào điểm yếu d6.",
        ],
        "counter_ideas": [
            "Rình rập thời cơ bung đòn giải phóng trung tâm ...d6-d5! hoặc cánh Hậu ...b6-b5! đập tan gọng kìm không gian.",
            "Nếu đối phương chưa fianchetto cánh Vua, phát động tấn công với ...Kh8, ...Rg8, ...g7-g5-g4; hoặc kiên nhẫn chờ đối phương lộ sơ hở trong khi giữ thế trận mềm dẻo.",
        ],
    },
    "Maroczy": {
        "ideas": [
            "Mở rộng không gian cánh Hậu, đặt Mã ở d5 và/hoặc dâng f2-f4, sau đó tập trung Xe ở trung lộ để đột phá e4-e5 hoặc f4-f5.",
            "Đưa Mã vào d5 buộc đối phương đổi quân tại d5 nhằm chuyển đổi có lợi sang cấu trúc Najdorf Type I (exd5) hoặc Benoni bất đối xứng (cxd5).",
        ],
        "counter_ideas": [
            "Tích cực đổi bớt quân nhẹ để giảm tình trạng ngột ngạt do thiếu không gian cơ động.",
            "Phản công cánh Hậu bằng ...b6-b5 (mở cột a sau cxb5 axb5) hoặc ...Qb6-b4 kết hợp ...a7-a5-a4; hoặc phản kích cánh Vua bằng đòn ...f7-f5.",
        ],
    },

    # =========================================================================
    # FAMILY THREE: Benoni (Chapters 12 - 13)
    # =========================================================================
    "Asymmetric_Benoni": {
        "ideas": [
            "Giữ nhiều quân trên bàn cờ (tránh đổi quân nhẹ) và chuẩn bị đòn đột phá trung tâm chủ lực e4-e5 nối tiếp bằng f4-f5 công thành hoặc tạo tốt thông.",
            "Đột phá trực tiếp f4-f5 mở cột f tấn công Vua đối phương, đồng thời đi a2-a4 hoặc b2-b4 kìm hãm đa số tốt cánh Hậu của đối thủ.",
        ],
        "counter_ideas": [
            "Thúc đẩy đa số tốt cánh Hậu ...b7-b5, ...c5-c4, ...b5-b4 tạo tốt thông xa và tích cực đổi quân nhẹ để hướng về tàn cuộc có lợi.",
            "Chồng quân nặng dọc cột nửa mở e ngăn đòn e4-e5, hoặc phản kích trung tâm bằng ...f7-f5 (đặc biệt mạnh khi đối phương đã đi f4 làm lỏng căn cứ d5).",
        ],
    },
    "Symmetric_Benoni": {
        "ideas": [
            "Mở rộng không gian cánh Vua bằng f2-f4 và g2-g4 nhằm bóp nghẹt không gian hoạt động của quân đối phương và tạo mũi công thành.",
            "Gây sức ép liên tục lên tốt yếu d6 bằng Tượng trên đường chéo h2-b8 phối hợp Mã chiếm đóng ô trung tâm e4.",
        ],
        "counter_ideas": [
            "Tranh chấp quyết liệt ô e4 (đặt Mã tại e4) và đáp trả f2-f4 bằng ...f7-f5 kịp thời để ngăn đối phương đẩy g2-g4.",
            "Phản công cánh Hậu bằng đòn bẻ gãy ...b7-b5 (kể cả thí tốt) nhằm mở đường phản kích, kết hợp đổi bớt quân nhẹ (...Qb6, ...Bf5, ...Ne4).",
        ],
    },

    # =========================================================================
    # FAMILY FOUR: King's Indian (Chapters 14 - 18)
    # =========================================================================
    "KID_Type_I": {
        "ideas": [
            "Che chắn các điểm xâm nhập trên cột mở c (nhất là c2), tận dụng ưu thế không gian điều quân giành lại cột mở c và đột nhập hàng 7 bắt tốt b7.",
            "Dâng tốt cánh Hậu a2-a4-a5 bóp nghẹt cánh Hậu đối phương và khai thác điểm yếu c6/b7.",
        ],
        "counter_ideas": [
            "Chồng Xe tranh quyền kiểm soát cột mở c nếu có điểm thâm nhập thực sự ở c2.",
            "Ưu tiên phản công tốc độ cao ở cánh Vua bằng ...f7-f5xe4 mở cột f kèm ...Bg7-f6-g5, hoặc điều chuyển Tượng ô đen qua lộ trình ...Bf6-d8-b6.",
        ],
    },
    "KID_Type_II": {
        "ideas": [
            "Mở mặt trận cánh Hậu bằng đòn đột phá b2-b4 rồi đưa quân nặng đột nhập dọc cột mở b.",
            "Hoặc đánh trung tâm/cánh Vua bằng f2-f4, hoặc khóa cánh Vua trước với g2-g4 rồi tổng tiến công cánh Hậu; ưu tiên đổi Tượng ô trắng để giảm sức công thành của Đen.",
        ],
        "counter_ideas": [
            "Nhờ cánh Hậu đã được chốt c5 làm chậm nhịp đối phương, phát động bão tốt chiếu hết kinh điển ...f7-f5-f4 và ...g6-g5-g4.",
            "Nếu đối phương triển khai nhanh ở cánh Hậu, chuyển sang phương án tốc độ ...f7-f5xe4 mở cột f hoặc đẩy ...h7-h5-h4 kích hoạt Tượng Bh6.",
        ],
    },
    "KID_Type_III": {
        "ideas": [
            "Công phá thẳng vào gốc xích d6 bằng đòn c4-c5xd6 rồi đột nhập quân nặng dọc cột c; hoặc đẩy c4-c5-c6 bóp nghẹt hoàn toàn cánh Hậu Đen.",
            "Có thể khóa cánh Vua bằng g2-g4 trước khi dồn lực sang cánh Hậu, đồng thời tìm cách đổi Tượng ô trắng nguy hiểm của đối phương.",
        ],
        "counter_ideas": [
            "Đua tốc độ công thành cánh Vua bằng bão tốt vũ bão ...f7-f5-f4 tiếp theo ...g6-g5-g4-g3 (hoặc ...gxf3 công kích gốc xích mới f3).",
            "Hoặc đổi ...f7-f5xe4 mở đường cho quân nhẹ chiếm e5/f4, đẩy ...h7-h5-h4 kèm ...Bh6, hoặc đi ...c7-c6 / ...c7-c5 chuyển sang KID Type I / Type II.",
        ],
    },
    "Open_KID": {
        "ideas": [
            "Chồng quân nặng trên cột nửa mở d gây sức ép trực diện lên tốt yếu d6 và hạn chế đổi quân nhẹ để phát huy tối đa ưu thế không gian.",
            "Mở rộng cánh Vua bằng f2-f4, g2-g4 rồi đột phá e4-e5 hoặc f4-f5 đúng lúc, hoặc mở rộng thêm không gian cánh Hậu bằng a3, b4.",
        ],
        "counter_ideas": [
            "Chủ động đổi bớt 1-2 cặp quân nhẹ để giải tỏa sự chật chội về không gian.",
            "Đặt Mã tại e5 và c5 kết hợp ...Qb6-b4 công kích c4 (hoặc phá bằng ...a6, ...c6, ...b5), phản kích với ...f7-f5 hoặc tìm cơ hội đẩy ...d6-d5.",
        ],
    },
    "KID_Complex": {
        "ideas": [
            "Đẩy c4-c5 mở rộng không gian cánh Hậu và thiết lập tiền đồn lợi hại cho quân nhẹ tại ô d6.",
            "Kiểm soát chặt ô d4 (ngăn Mã đối phương nhảy vào), chiếm cột mở d đột nhập hàng 7 và mở rộng cánh Hậu với a3, b4.",
        ],
        "counter_ideas": [
            "Triệt để ngăn chặn c4-c5 (đi ...c6-c5 khi cần), chiến đấu giành các ô đen (đổi Tượng ô đen, đi ...a7-a5, đặt Mã c5) và đưa Mã chiếm tiền đồn d4.",
            "Tạo đối công sắc bén ở cánh Vua bằng đòn ...f7-f5 nhằm đánh lạc hướng kế hoạch siết cánh Hậu của đối phương.",
        ],
    },

    # =========================================================================
    # FAMILY FIVE: French (Chapters 19 - 21)
    # =========================================================================
    "French_Type_I": {
        "ideas": [
            "Chiếm quyền kiểm soát tuyệt đối ô trung tâm e5 và đặt Mã (hoặc Xe/Tượng) làm bàn đạp thống trị thế trận.",
            "Chồng Xe trên cột nửa mở e gây sức ép lên tốt lạc hậu e6; sau khi làm chủ hoàn toàn e5 mới dâng f2-f4 hoặc h2-h4-h5 công thành.",
        ],
        "counter_ideas": [
            "Công kích dữ dội tốt d4 bằng ...c7-c5xd4, ...Nc6, ...Qb6 để không cho đối phương rảnh tay chiếm đóng ô e5.",
            "Đưa Tượng ô trắng vào cuộc qua ...Bd7-e8-h5 (g6), chồng Xe trên cột nửa mở f (sẵn sàng thí chất ...Rxf3) hoặc đột phá giải phóng ...e6-e5.",
        ],
    },
    "French_Type_II": {
        "ideas": [
            "Làm chủ hoàn toàn ô d4, đặt Mã vững chắc tại d4 được củng cố bởi c2-c3, Be3 và Rd1.",
            "Công kích gốc xích bằng f4-f5xe6 hoặc đẩy f4-f5-f6 phối hợp Qh5, Rf3-h3, Bd3 công thành (hoặc bão tốt h4-h5, g4-g5 khi nhập thành dài).",
        ],
        "counter_ideas": [
            "Phá mũi nhọn e5 bằng đòn trung tâm ...f7-f6 hoặc đòn hông ...g7-g5 (kể cả thí tốt) nhằm hóa giải áp lực công thành.",
            "Đổi bớt quân nhẹ, đưa hoặc đổi Tượng xấu ô trắng ra ngoài xích tốt (đường chéo b1-h7), và triển khai tấn công thiểu số cánh Hậu ...b7-b5-b4.",
        ],
    },
    "French_Type_III": {
        "ideas": [
            "Đánh thẳng vào gốc xích e6 bằng f2-f4-f5xe6, hoặc đẩy f2-f4-f5-f6 tạo các đe dọa chiếu hết trực tiếp quanh g7.",
            "Tổ chức công thành cánh Vua bằng Xe chuyển ngang hàng 3, Tượng trên đường chéo b1-h7, Qh5, h4-h5 và sẵn sàng thí quân phá thành.",
        ],
        "counter_ideas": [
            "Dồn toàn lực công kích gốc xích d4 bằng ...c7-c5xd4, ...Nc6, ...Qb6 và xâm nhập quân nặng dọc cột c.",
            "Hoặc khóa cánh Hậu với ...c7-c5-c4 rồi công phá gốc mới c3 bằng ...b7-b5-b4; đổi Tượng xấu ô trắng qua ...b6, ...Ba6 hoặc phản kích ...f7-f6.",
        ],
    },

    # =========================================================================
    # MISCELLANEOUS: Chapter 22 - Various Structures (22.1 - 22.7)
    # =========================================================================
    "Structure_33_vs_42": {
        "ideas": [
            "Bên giữ cấu trúc 3-3 tranh quyền kiểm soát cột mở d để đột nhập hàng 7, đồng thời thúc đẩy đa số tốt cánh Hậu (3 đánh 2 trên cột a, b, c) tạo tốt thông.",
            "Kết hợp ưu thế không gian cánh Hậu với các quân nặng kiểm soát trung lộ để buộc đối phương rơi vào thế phòng thủ thụ động.",
        ],
        "counter_ideas": [
            "Bên giữ cấu trúc 4-2 tranh chấp cột mở d và phát huy tối đa sức mạnh cặp Tượng trong thế cờ thoáng.",
            "Mở đòn tấn công thiểu số ...a5, ...b5-b4 nhằm xóa sổ cụm tốt cánh Hậu đối phương, hướng tới tàn cuộc thắng nhờ đa số tốt 4 đánh 3 ở cánh Vua.",
        ],
    },
    "Panov_Structure": {
        "ideas": [
            "Thúc đẩy đa số tốt cánh Hậu bằng b2-b4-b5 tiếp theo là c5-c6 nhằm tạo quân tốt thông cực kỳ nguy hiểm.",
            "Củng cố vững chắc chốt d4 và kiểm soát tiền đồn e5 để yểm trợ cho chiến dịch dâng tốt cánh Hậu.",
        ],
        "counter_ideas": [
            "Đánh trực diện vào đầu xích c5 bằng đòn ...b7-b6 kịp thời để đổi bớt tốt nguy hiểm trước khi đối phương kịp củng cố b4.",
            "Gia tăng áp lực lên gốc d4 (...Nc6, ...Bf6), cắm Mã vào tiền đồn e4 và mở rộng cánh Vua bằng ...f7-f5.",
        ],
    },
    "Dragon_Formation": {
        "ideas": [
            "Khi nhập thành dài: phát động cuộc đua chiếu hết tốc độ cao ở cánh Vua bằng h2-h4-h5, Bh6 đổi Tượng g7 và mở toang cột h.",
            "Khi nhập thành ngắn: triển khai thế trận chiến lược trung tâm với Xe cột d, hạn chế sức mạnh Tượng g7 và đưa Mã nhảy vào d5.",
        ],
        "counter_ideas": [
            "Khi đối phương nhập thành dài: phản công thần tốc dọc cột nửa mở c kết hợp dâng tốt a, b và sẵn sàng tung đòn thí chất kinh điển ...Rxc3.",
            "Khi đối phương nhập thành ngắn: khai thác cột nửa mở c, đặt quân nhẹ vào tiền đồn c4 và tìm cơ hội thực hiện đòn giải phóng ...d6-d5.",
        ],
    },
    "Scheveningen_Structure": {
        "ideas": [
            "Phát động bão tốt cánh Vua g2-g4-g5, h2-h4-h5 (đòn tấn công Keres) nhằm xua đuổi Mã f6 và ép lùi hàng phòng ngự Đen.",
            "Hoặc đẩy f2-f4-f5 gây sức ép trực diện lên điểm e6 (hoặc chuẩn bị đột phá trung tâm e4-e5).",
        ],
        "counter_ideas": [
            "Duy trì lá chắn linh hoạt d6+e6 và chuẩn bị thời cơ tung đòn phản kích trung tâm kinh điển ...d6-d5.",
            "Khai thác cột nửa mở c với Mã nhảy vào c4 (sẵn sàng thí chất ...Rxc3) và dâng ...b7-b5-b4, ...a6-a5 nếu đối phương nhập thành dài.",
        ],
    },
    "Benko_Structure": {
        "ideas": [
            "Xây dựng pháo đài phòng thủ cánh Hậu (b2-b3, a2-a4 với quân nhẹ bảo vệ chặt b3/a4) nhằm vô hiệu hóa sức ép trên hai cột a, b.",
            "Sau khi ổn định cánh Hậu, kiên quyết chuẩn bị đòn đột phá trung tâm e4-e5 hoặc f4-f5 để giành lại quyền chủ động.",
        ],
        "counter_ideas": [
            "Đặt cặp Xe và Hậu kiểm soát hai cột nửa mở a, b phối hợp Tượng fianchetto g7 kìm chặt hoàn toàn cánh Hậu Trắng.",
            "Đổi bớt quân nhẹ hợp lý và khai thác ưu thế cấu trúc dài hạn (1 đảo 6 tốt liên kết đấu với 2 đảo tốt bị chia cắt) ngay cả trong tàn cuộc.",
        ],
    },
    "Closed_Ruy_Lopez": {
        "ideas": [
            "Tập trung tấn công cánh Vua bằng g2-g4 kết hợp lộ trình điều Mã kinh điển Nbd2-f1-g3-f5 (sẵn sàng thí quân ở f5), hoặc mở cột bằng f2-f4.",
            "Hoặc khóa/tranh chấp cánh Hậu trước bằng b2-b4, a2-a4 để chiếm cột mở a rồi mới chuyển hướng tổng công kích cánh Vua.",
        ],
        "counter_ideas": [
            "Chủ động mở mặt trận cánh Hậu bằng ...a7-a5, ...b7-b5-b4 (rất hiệu quả vì đối phương chỉ có tốt ở c3 chứ không có không gian c4 như KID).",
            "Hoặc củng cố cánh Vua rồi phản công bằng đòn dâng tốt ...f7-f5-f4 tương tự họ cấu trúc King's Indian.",
        ],
    },
    "Lopez_Formation": {
        "ideas": [
            "Duy trì sức căng trung tâm c3+d4+e4 linh hoạt để chọn thời điểm tối ưu đóng d4-d5, đổi dxe5 chiếm cột d, hoặc điều quân sang cánh Vua.",
            "Nếu đối phương đổi hai lần trên d4 (chuyển về cấu trúc e4 đấu d6 với cột c mở), nhanh chóng huy động quân nặng khai thác điểm yếu tĩnh d6.",
        ],
        "counter_ideas": [
            "Gia tăng áp lực lên trung tâm d4 để buộc đối phương sớm bộc lộ ý đồ đóng d4-d5 (kịp đáp trả ...c5-c4) hoặc giải tỏa căng thẳng.",
            "Chọn thời điểm thuận lợi đổi hai tốt trên d4 (...cxd4 và ...exd4) nhằm phản kích trực diện vào tốt e4 trước khi đối phương kịp củng cố.",
        ],
    },
}

# =========================================================================
# CANONICAL PAWN SKELETONS (28 Structures - Mauricio Flores Rios Ground Truth)
# "Chess Structures: A Grandmaster Guide" (Quality Chess)
# =========================================================================
CANONICAL_PAWN_SKELETONS: Dict[str, Dict[str, Any]] = {
    # =========================================================================
    # FAMILY ONE: d4 and ...d5 (Chapters 1 - 7)
    # =========================================================================
    "Isolani": {
        "name": "The Isolani",
        "vietnamese_name": "Cấu trúc Tốt đơn độc Isolani (IQP)",
        "group": "family_1",
        "group_title": "Nhóm 1: Các cấu trúc d4 và ...d5 (Chương 1 - 7)",
        "chapter": "Chương 1 (Chapter 1)",
        "fen": "8/pp3ppp/4p3/8/3P4/8/PP3PPP/8 w - - 0 1",
        "white_pawns": ["a2", "b2", "d4", "f2", "g2", "h2"],
        "black_pawns": ["a7", "b7", "e6", "f7", "g7", "h7"],
        "description": "Trắng sở hữu Tốt đơn độc d4 (không còn Tốt ở cột c và e bảo vệ), đổi lại kiểm soát các ô tiền đồn quan trọng c5/e5 và hai cột mở/nửa mở c, e; Đen nhắm vào phong tỏa ô d5 và gia tăng sức ép công kích tốt d4.",
        "aliases": ["isolani", "iqp", "tot co lap", "tốt cô lập", "tot don doc", "tốt đơn độc", "isolated queen pawn", "isolated pawn"],
    },
    "Hanging_Pawns": {
        "name": "Hanging Pawns",
        "vietnamese_name": "Cấu trúc Tốt treo (Hanging Pawns)",
        "group": "family_1",
        "group_title": "Nhóm 1: Các cấu trúc d4 và ...d5 (Chương 1 - 7)",
        "chapter": "Chương 2 (Chapter 2)",
        "fen": "8/pp3ppp/4p3/8/2PP4/8/P4PPP/8 w - - 0 1",
        "white_pawns": ["a2", "c4", "d4", "f2", "g2", "h2"],
        "black_pawns": ["a7", "b7", "e6", "f7", "g7", "h7"],
        "description": "Trắng sở hữu cặp Tốt treo c4 và d4 đứng cạnh nhau ở trung tâm trên hai cột bán mở, hai cột lân cận b và e không còn Tốt che chở; Đen gây sức ép trực diện dọc cột c và d nhằm buộc một Tốt phải tiến lên hoặc bị cô lập.",
        "aliases": ["hanging pawns", "hanging pawn", "tot treo", "tốt treo", "cap tot treo", "cặp tốt treo", "hanging"],
    },
    "Caro_Kann_Formation": {
        "name": "Caro-Kann Formation",
        "vietnamese_name": "Cấu trúc Caro-Kann (Caro-Kann Formation)",
        "group": "family_1",
        "group_title": "Nhóm 1: Các cấu trúc d4 và ...d5 (Chương 1 - 7)",
        "chapter": "Chương 3 (Chapter 3)",
        "fen": "8/pp3ppp/2p1p3/8/3P4/2P5/PP3PPP/8 w - - 0 1",
        "white_pawns": ["a2", "b2", "c3", "d4", "f2", "g2", "h2"],
        "black_pawns": ["a7", "b7", "c6", "e6", "f7", "g7", "h7"],
        "description": "Trắng có Tốt c3+d4 vững chắc (mất Tốt e); Đen giữ cấu trúc c6+e6 kiên cố (mất Tốt d). Trắng nhắm vào kiểm soát tiền đồn e5 và tấn công cánh Vua; Đen phản công bằng các đòn giải phóng trung tâm ...c5 hoặc ...e5.",
        "aliases": ["caro kann formation", "caro-kann formation", "caro kann", "caro-kann", "cau truc caro kann", "cấu trúc caro kann"],
    },
    "Slav_Formation": {
        "name": "Slav Formation",
        "vietnamese_name": "Cấu trúc Slav (Slav Formation)",
        "group": "family_1",
        "group_title": "Nhóm 1: Các cấu trúc d4 và ...d5 (Chương 1 - 7)",
        "chapter": "Chương 4 (Chapter 4)",
        "fen": "8/pp3ppp/2p1p3/8/3P4/4P3/PP3PPP/8 w - - 0 1",
        "white_pawns": ["a2", "b2", "d4", "e3", "f2", "g2", "h2"],
        "black_pawns": ["a7", "b7", "c6", "e6", "f7", "g7", "h7"],
        "description": "Trắng kiểm soát trung tâm với d4 và cặp tốt e3/e4 (cột c nửa mở sau khi Đen đổi ...dxc4); Đen giữ bộ khung phòng ngự vững chắc c6+e6 (cột d nửa mở). Kế hoạch của Trắng là tấn công cánh Vua (h4-h5, e4-e5), chiếm tiền đồn c5/e5 hoặc dâng tốt cánh Hậu b2-b4-b5 kìm hãm đối thủ; Đen tìm cách đột phá giải phóng trung tâm bằng ...c6-c5 hoặc ...e6-e5.",
        "aliases": ["slav formation", "slav", "cau truc slav", "cấu trúc slav"],
    },
    "Carlsbad_Formation": {
        "name": "The Carlsbad Formation",
        "vietnamese_name": "Cấu trúc Carlsbad (The Carlsbad Formation)",
        "group": "family_1",
        "group_title": "Nhóm 1: Các cấu trúc d4 và ...d5 (Chương 1 - 7)",
        "chapter": "Chương 5 (Chapter 5)",
        "fen": "8/pp3ppp/2p5/3p4/3P4/4P3/PP3PPP/8 w - - 0 1",
        "white_pawns": ["a2", "b2", "d4", "e3", "f2", "g2", "h2"],
        "black_pawns": ["a7", "b7", "c6", "d5", "f7", "g7", "h7"],
        "description": "Cấu trúc bất đối xứng kinh điển: Trắng có d4+e3 (mất Tốt c, mở cột c); Đen có c6+d5 (mất Tốt e, mở cột e). Kế hoạch đặc trưng là Trắng tấn công thiểu số b2-b4-b5 công phá c6, hoặc đột phá trung tâm e3-e4.",
        "aliases": ["carlsbad", "carlsbad formation", "the carlsbad formation", "cau truc carlsbad", "cấu trúc carlsbad"],
    },
    "Stonewall": {
        "name": "The Stonewall",
        "vietnamese_name": "Cấu trúc Bức tường đá (The Stonewall)",
        "group": "family_1",
        "group_title": "Nhóm 1: Các cấu trúc d4 và ...d5 (Chương 1 - 7)",
        "chapter": "Chương 6 (Chapter 6)",
        "fen": "8/pp4pp/2p1p3/3p1p2/2PP4/4P3/PP3PPP/8 w - - 0 1",
        "white_pawns": ["a2", "b2", "c4", "d4", "e3", "f2", "g2", "h2"],
        "black_pawns": ["a7", "b7", "c6", "d5", "e6", "f5", "g7", "h7"],
        "description": "Bức tường đá trung tâm với xích Tốt c6-d5-e6-f5 kiểm soát vững chắc ô tiền đồn e4 nhưng để lại lỗ hổng cố hữu tại ô e5 và Tượng ô trắng c8 bị phong tỏa sau hàng Tốt.",
        "aliases": ["stonewall", "the stonewall", "buc tuong da", "bức tường đá", "cau truc stonewall", "cấu trúc stonewall"],
    },
    "Grunfeld_Centre": {
        "name": "Grünfeld Centre",
        "vietnamese_name": "Cấu trúc Trung tâm Grünfeld (Grünfeld Centre)",
        "group": "family_1",
        "group_title": "Nhóm 1: Các cấu trúc d4 và ...d5 (Chương 1 - 7)",
        "chapter": "Chương 7 (Chapter 7)",
        "fen": "8/pp2pp1p/6p1/8/3PP3/8/P4PPP/8 w - - 0 1",
        "white_pawns": ["a2", "d4", "e4", "f2", "g2", "h2"],
        "black_pawns": ["a7", "b7", "e7", "f7", "g6", "h7"],
        "description": "Trắng kiểm soát cặp Tốt trung tâm áp đảo d4+e4 (sau khi đổi c-pawn trên c6); Đen sử dụng Tượng fianchetto g7 phối hợp cùng các đòn phản công ...c5, ...Nc6, ...Qa5 để phá hủy trung tâm Trắng.",
        "aliases": ["grunfeld centre", "grünfeld centre", "grunfeld center", "grünfeld center", "grunfeld", "grünfeld", "trung tam grunfeld", "trung tâm grünfeld"],
    },

    # =========================================================================
    # FAMILY TWO: Open Sicilian (Chapters 8 - 11)
    # =========================================================================
    "Najdorf_Type_I": {
        "name": "Najdorf Type I",
        "vietnamese_name": "Cấu trúc Najdorf Type I",
        "group": "family_2",
        "group_title": "Nhóm 2: Các cấu trúc Sicilian Mở (Chương 8 - 11)",
        "chapter": "Chương 8 (Chapter 8)",
        "fen": "8/pp3ppp/3p4/3Pp3/2P5/8/PP3PPP/8 w - - 0 1",
        "white_pawns": ["a2", "b2", "c4", "d5", "f2", "g2", "h2"],
        "black_pawns": ["a7", "b7", "d6", "e5", "f7", "g7", "h7"],
        "description": "Trắng chiếm cứ tiền đồn d5 bằng Tốt d5 được bảo vệ bởi c4; Đen chấp nhận Tốt lạc hậu d6 để giữ vững e5 và tập trung phản công cánh Hậu bằng ...b7-b5.",
        "aliases": ["najdorf type i", "najdorf type 1", "najdorf 1", "najdorf i"],
    },
    "Najdorf_Type_II": {
        "name": "Najdorf Type II",
        "vietnamese_name": "Cấu trúc Najdorf Type II",
        "group": "family_2",
        "group_title": "Nhóm 2: Các cấu trúc Sicilian Mở (Chương 8 - 11)",
        "chapter": "Chương 9 (Chapter 9)",
        "fen": "8/pp3ppp/3p4/4p3/4P3/8/PPP2PPP/8 w - - 0 1",
        "white_pawns": ["a2", "b2", "c2", "e4", "f2", "g2", "h2"],
        "black_pawns": ["a7", "b7", "d6", "e5", "f7", "g7", "h7"],
        "description": "Hình thái Sicilian kinh điển sau khi Đen đẩy ...e5: Trắng chiếm ô tiền đồn tuyệt đối d5; Đen có cột nửa mở c để tạo áp lực cánh Hậu và bù đắp cho lỗ hổng d5.",
        "aliases": ["najdorf type ii", "najdorf type 2", "najdorf 2", "najdorf ii", "najdorf"],
    },
    "Hedgehog": {
        "name": "The Hedgehog",
        "vietnamese_name": "Cấu trúc Nhím (The Hedgehog)",
        "group": "family_2",
        "group_title": "Nhóm 2: Các cấu trúc Sicilian Mở (Chương 8 - 11)",
        "chapter": "Chương 10 (Chapter 10)",
        "fen": "8/5ppp/pp1pp3/8/2P1P3/1P6/P4PPP/8 w - - 0 1",
        "white_pawns": ["a2", "b3", "c4", "e4", "f2", "g2", "h2"],
        "black_pawns": ["a6", "b6", "d6", "e6", "f7", "g7", "h7"],
        "description": "Cấu trúc Con Nhím: Toàn bộ Tốt Đen nằm khiêm tốn ở hàng 6 (a6, b6, d6, e6) như những chiếc gai bảo vệ vững chắc trận địa, kiên nhẫn chờ thời cơ nổ đòn giải phóng ...b5 hoặc ...d5 công phá trung tâm Trắng (c4+e4).",
        "aliases": ["hedgehog", "the hedgehog", "cau truc nhim", "cấu trúc nhím", "nhim", "nhím"],
    },
    "Maroczy": {
        "name": "The Maróczy Bind",
        "vietnamese_name": "Gọng kìm Maróczy (The Maróczy Bind)",
        "group": "family_2",
        "group_title": "Nhóm 2: Các cấu trúc Sicilian Mở (Chương 8 - 11)",
        "chapter": "Chương 11 (Chapter 11)",
        "fen": "8/pp2pp1p/3p2p1/8/2P1P3/8/PP3PPP/8 w - - 0 1",
        "white_pawns": ["a2", "b2", "c4", "e4", "f2", "g2", "h2"],
        "black_pawns": ["a7", "b7", "d6", "e7", "f7", "g6", "h7"],
        "description": "Gọng kìm trứ danh của Trắng với cặp Tốt c4+e4 siết chặt ô d5 và dập tắt các đòn bứt phá ...d5 của Đen; Đen thường đưa Tượng lên g7 và tìm cách đổi bớt quân nhẹ để giảm bớt sự ngột ngạt.",
        "aliases": ["maroczy", "maróczy", "the maroczy", "the maróczy", "maroczy bind", "maróczy bind", "gong kim maroczy", "gọng kìm maróczy"],
    },

    # =========================================================================
    # FAMILY THREE: Benoni (Chapters 12 - 13)
    # =========================================================================
    "Asymmetric_Benoni": {
        "name": "Asymmetric Benoni",
        "vietnamese_name": "Cấu trúc Benoni Bất đối xứng (Asymmetric Benoni)",
        "group": "family_3",
        "group_title": "Nhóm 3: Các cấu trúc Benoni (Chương 12 - 13)",
        "chapter": "Chương 12 (Chapter 12)",
        "fen": "8/pp3ppp/3p4/2pP4/4P3/8/PP3PPP/8 w - - 0 1",
        "white_pawns": ["a2", "b2", "d5", "e4", "f2", "g2", "h2"],
        "black_pawns": ["a7", "b7", "c5", "d6", "f7", "g7", "h7"],
        "description": "Benoni bất đối xứng với cột c mở cho Trắng và cột e mở cho Đen; Trắng tận dụng Tốt d5 làm điểm tựa đẩy e4-e5 hoặc chiếm d6, trong khi Đen tấn công cánh Hậu bằng đa số Tốt a7-b7-c5.",
        "aliases": ["asymmetric benoni", "benoni bat doi xung", "benoni bất đối xứng", "benoni type 1", "benoni 1"],
    },
    "Symmetric_Benoni": {
        "name": "Symmetric Benoni",
        "vietnamese_name": "Cấu trúc Benoni Đối xứng (Symmetric Benoni)",
        "group": "family_3",
        "group_title": "Nhóm 3: Các cấu trúc Benoni (Chương 12 - 13)",
        "chapter": "Chương 13 (Chapter 13)",
        "fen": "8/pp3ppp/3p4/2pP4/2P5/8/PP3PPP/8 w - - 0 1",
        "white_pawns": ["a2", "b2", "c4", "d5", "f2", "g2", "h2"],
        "black_pawns": ["a7", "b7", "c5", "d6", "f7", "g7", "h7"],
        "description": "Benoni đối xứng: Cả hai bên đều đã khóa cánh Hậu với c4+d5 đối đầu c5+d6; Trắng kiểm soát không gian lớn hơn và tìm cách thâm nhập qua cột b hoặc đẩy f2-f4; Đen nỗ lực đục cánh Hậu bằng ...b5 hoặc bứt phá ...f5.",
        "aliases": ["symmetric benoni", "benoni doi xung", "benoni đối xứng", "benoni", "cau truc benoni", "cấu trúc benoni"],
    },

    # =========================================================================
    # FAMILY FOUR: King's Indian (Chapters 14 - 18)
    # =========================================================================
    "KID_Type_I": {
        "name": "KID Type I",
        "vietnamese_name": "Cấu trúc KID Type I",
        "group": "family_4",
        "group_title": "Nhóm 4: Các cấu trúc King's Indian (Chương 14 - 18)",
        "chapter": "Chương 14 (Chapter 14)",
        "fen": "8/pp3p1p/3p2p1/3Pp3/4P3/5P2/PP4PP/8 w - - 0 1",
        "white_pawns": ["a2", "b2", "d5", "e4", "f3", "g2", "h2"],
        "black_pawns": ["a7", "b7", "d6", "e5", "f7", "g6", "h7"],
        "description": "KID Type I với cột c hoàn toàn mở sau khi đổi Tốt; Trắng dồn quân nặng tranh đoạt cột c và xâm nhập hàng 7 cánh Hậu; Đen tổ chức bão Tốt công thành cánh Vua bằng ...f5-f4 và ...g5-g4.",
        "aliases": ["kid type i", "kid type 1", "kid 1", "kid i", "kings indian 1", "king's indian 1"],
    },
    "KID_Type_II": {
        "name": "KID Type II",
        "vietnamese_name": "Cấu trúc KID Type II",
        "group": "family_4",
        "group_title": "Nhóm 4: Các cấu trúc King's Indian (Chương 14 - 18)",
        "chapter": "Chương 15 (Chapter 15)",
        "fen": "8/pp3p1p/3p2p1/2pPp3/2P1P3/8/PP3PPP/8 w - - 0 1",
        "white_pawns": ["a2", "b2", "c4", "d5", "e4", "f2", "g2", "h2"],
        "black_pawns": ["a7", "b7", "c5", "d6", "e5", "f7", "g6", "h7"],
        "description": "KID Type II với trung tâm bị khóa chặt hoàn toàn (c4+d5+e4 đối đầu c5+d6+e5): Trắng tấn công bứt phá cánh Hậu bằng c4-c5 hoặc b2-b4; Đen dồn toàn lực phản công chiếu sát Vua bằng ...f7-f5-f4.",
        "aliases": ["kid type ii", "kid type 2", "kid 2", "kid ii", "kings indian 2", "king's indian 2"],
    },
    "KID_Type_III": {
        "name": "KID Type III",
        "vietnamese_name": "Cấu trúc KID Type III",
        "group": "family_4",
        "group_title": "Nhóm 4: Các cấu trúc King's Indian (Chương 14 - 18)",
        "chapter": "Chương 16 (Chapter 16)",
        "fen": "8/ppp2p1p/3p2p1/3Pp3/2P1P3/8/PP3PPP/8 w - - 0 1",
        "white_pawns": ["a2", "b2", "c4", "d5", "e4", "f2", "g2", "h2"],
        "black_pawns": ["a7", "b7", "c7", "d6", "e5", "f7", "g6", "h7"],
        "description": "KID Type III với Tốt Đen ở c7 được giữ lại (chưa đẩy c5): Đen duy trì tính cơ động cao có thể đẩy ...c6 đục trung tâm d5 hoặc chuẩn bị ...f5; Trắng tranh thủ thời cơ bành trướng cánh Hậu với c4-c5.",
        "aliases": ["kid type iii", "kid type 3", "kid 3", "kid iii", "kings indian 3", "king's indian 3"],
    },
    "Open_KID": {
        "name": "Open KID",
        "vietnamese_name": "Cấu trúc Open KID (KID Mở)",
        "group": "family_4",
        "group_title": "Nhóm 4: Các cấu trúc King's Indian (Chương 14 - 18)",
        "chapter": "Chương 17 (Chapter 17)",
        "fen": "8/pp3p1p/2pp2p1/8/2P1P3/8/PP3PPP/8 w - - 0 1",
        "white_pawns": ["a2", "b2", "c4", "e4", "f2", "g2", "h2"],
        "black_pawns": ["a7", "b7", "c6", "d6", "f7", "g6", "h7"],
        "description": "KID Mở sau khi Tốt d4 và e5 được đổi: Cột d hoàn toàn mở; Trắng kiểm soát không gian trung tâm với c4+e4; Đen sử dụng ô d4 làm tiền đồn cho Mã và gây sức ép dọc cột d.",
        "aliases": ["open kid", "kid mo", "kid mở", "kings indian open", "king's indian open"],
    },
    "KID_Complex": {
        "name": "KID Complex",
        "vietnamese_name": "Cấu trúc KID Phức hợp (KID Complex)",
        "group": "family_4",
        "group_title": "Nhóm 4: Các cấu trúc King's Indian (Chương 14 - 18)",
        "chapter": "Chương 18 (Chapter 18)",
        "fen": "8/pp3p1p/2pp2p1/4p3/2PPP3/8/PP3PPP/8 w - - 0 1",
        "white_pawns": ["a2", "b2", "c4", "d4", "e4", "f2", "g2", "h2"],
        "black_pawns": ["a7", "b7", "c6", "d6", "e5", "f7", "g6", "h7"],
        "description": "KID Phức hợp với bộ ba Tốt c4+d4+e4 của Trắng đối đầu c6+d6+e5 của Đen; Trung tâm căng thẳng cao độ đòi hỏi tính toán chính xác việc duy trì áp lực d4 hay khóa trung tâm d4-d5.",
        "aliases": ["kid complex", "kid phuc hop", "kid phức hợp", "kings indian complex", "king's indian complex"],
    },

    # =========================================================================
    # FAMILY FIVE: French (Chapters 19 - 21)
    # =========================================================================
    "French_Type_I": {
        "name": "French Type I",
        "vietnamese_name": "Cấu trúc Pháp Type I (French Type I)",
        "group": "family_5",
        "group_title": "Nhóm 5: Các cấu trúc Phòng thủ Pháp (Chương 19 - 21)",
        "chapter": "Chương 19 (Chapter 19)",
        "fen": "8/pp4pp/2p1p3/3p4/3P4/2P5/PP3PPP/8 w - - 0 1",
        "white_pawns": ["a2", "b2", "c3", "d4", "f2", "g2", "h2"],
        "black_pawns": ["a7", "b7", "c6", "d5", "e6", "g7", "h7"],
        "description": "Cấu trúc Pháp Type I sau khi Đen đổi ...f6 exf6: Cột e mở cho Trắng dồn quân nặng gây sức ép lên tốt lạc hậu e6 và chiếm cứ tiền đồn e5; Đen có cột nửa mở f để phản công cánh Vua và gây sức ép lên d4.",
        "aliases": ["french type i", "french type 1", "french 1", "french i", "phap type 1", "pháp type 1"],
    },
    "French_Type_II": {
        "name": "French Type II",
        "vietnamese_name": "Cấu trúc Pháp Type II (French Type II)",
        "group": "family_5",
        "group_title": "Nhóm 5: Các cấu trúc Phòng thủ Pháp (Chương 19 - 21)",
        "chapter": "Chương 20 (Chapter 20)",
        "fen": "8/pp3ppp/4p3/3pP3/5P2/8/PPP3PP/8 w - - 0 1",
        "white_pawns": ["a2", "b2", "c2", "e5", "f4", "g2", "h2"],
        "black_pawns": ["a7", "b7", "d5", "e6", "f7", "g7", "h7"],
        "description": "Cấu trúc Pháp Type II sau khi Đen đổi ...cxd4 Nxd4: Trắng giữ mũi nhọn e5 được yểm trợ bởi f4 và chốt Mã tiền đồn cực mạnh tại d4; Đen phản công bằng bão tốt cánh Hậu ...b5-b4 hoặc bẻ gãy mũi nhọn e5 bằng ...f6/ ...g5.",
        "aliases": ["french type ii", "french type 2", "french 2", "french ii", "phap type 2", "pháp type 2"],
    },
    "French_Type_III": {
        "name": "French Type III",
        "vietnamese_name": "Cấu trúc Pháp Type III (French Type III)",
        "group": "family_5",
        "group_title": "Nhóm 5: Các cấu trúc Phòng thủ Pháp (Chương 19 - 21)",
        "chapter": "Chương 21 (Chapter 21)",
        "fen": "8/pp4pp/4p3/2ppP3/3P1P2/2P5/PP4PP/8 w - - 0 1",
        "white_pawns": ["a2", "b2", "c3", "d4", "e5", "f4", "g2", "h2"],
        "black_pawns": ["a7", "b7", "c5", "d5", "e6", "g7", "h7"],
        "description": "Xích Tốt Pháp Advance nguyên vẹn (d4+e5 đối đầu d5+e6): Trắng công kích gốc xích e6 bằng f4-f5 kết hợp tấn công cánh Vua; Đen dồn lực công kích gốc xích d4 bằng ...c5 và xâm nhập dọc cột mở c.",
        "aliases": ["french type iii", "french type 3", "french 3", "french iii", "phap type 3", "pháp type 3", "french", "phap", "pháp", "french advance"],
    },

    # =========================================================================
    # MISCELLANEOUS: Chapter 22 - Various Structures (22.1 - 22.7)
    # =========================================================================
    "Structure_33_vs_42": {
        "name": "The 3-3 vs. 4-2 Structure",
        "vietnamese_name": "Cấu trúc 3-3 đấu 4-2 (The 3-3 vs. 4-2 Structure)",
        "group": "miscellaneous",
        "group_title": "Nhóm Khác: Các cấu trúc hỗn hợp (Chương 22.1 - 22.7)",
        "chapter": "Chương 22.1 (Chapter 22.1)",
        "fen": "8/pp3ppp/4p3/8/8/2P5/PP3PPP/8 w - - 0 1",
        "white_pawns": ["a2", "b2", "c3", "f2", "g2", "h2"],
        "black_pawns": ["a7", "b7", "e6", "f7", "g7", "h7"],
        "description": "Hai cột trung tâm d và e đều mở hoàn toàn: Trắng sở hữu đa số Tốt cánh Hậu (3 đấu 2 trên cột a, b, c) tạo điều kiện đẩy tốt thông trong tàn cuộc; Đen sở hữu đa số Tốt cánh Vua (4 đấu 3) và phát huy sức mạnh cặp Tượng trong thế cờ mở.",
        "aliases": ["3-3 vs 4-2", "3-3 vs. 4-2", "structure 33 vs 42", "3 3 vs 4 2", "33 vs 42", "cau truc 3-3"],
    },
    "Panov_Structure": {
        "name": "The Panov Structure",
        "vietnamese_name": "Cấu trúc Panov (The Panov Structure)",
        "group": "miscellaneous",
        "group_title": "Nhóm Khác: Các cấu trúc hỗn hợp (Chương 22.1 - 22.7)",
        "chapter": "Chương 22.2 (Chapter 22.2)",
        "fen": "8/p4ppp/1p2p3/2Pp4/1P1P4/8/P4PPP/8 w - - 0 1",
        "white_pawns": ["a2", "b4", "c5", "d4", "f2", "g2", "h2"],
        "black_pawns": ["a7", "b6", "d5", "e6", "f7", "g7", "h7"],
        "description": "Xuất phát từ Đòn tấn công Panov (Caro-Kann) khi Trắng đẩy c4-c5 và b2-b4 cố thủ mũi nhọn cánh Hậu c5; Đen phản công gốc xích bằng ...b6 hoặc bứt phá trung tâm ...e5.",
        "aliases": ["panov", "the panov structure", "panov structure", "cau truc panov", "cấu trúc panov"],
    },
    "Dragon_Formation": {
        "name": "The Dragon Formation",
        "vietnamese_name": "Cấu trúc Rồng (The Dragon Formation)",
        "group": "miscellaneous",
        "group_title": "Nhóm Khác: Các cấu trúc hỗn hợp (Chương 22.1 - 22.7)",
        "chapter": "Chương 22.3 (Chapter 22.3)",
        "fen": "8/pp2pp1p/3p2p1/8/4P3/8/PPP2PPP/8 w - - 0 1",
        "white_pawns": ["a2", "b2", "c2", "e4", "f2", "g2", "h2"],
        "black_pawns": ["a7", "b7", "d6", "e7", "f7", "g6", "h7"],
        "description": "Cấu trúc Sicilian Rồng với 'đuôi rồng' g6-f7-e7-d6: Trắng nhắm vào bão Tốt h4-h5 mở toang thành Vua Đen và đổi Tượng g7; Đen dồn hỏa lực dọc cột nửa mở c (sẵn sàng thí Xe ...Rxc3) và sức ép chéo từ Tượng g7.",
        "aliases": ["dragon", "the dragon formation", "dragon formation", "cau truc rong", "cấu trúc rồng", "sicilian dragon"],
    },
    "Scheveningen_Structure": {
        "name": "The Scheveningen Structure",
        "vietnamese_name": "Cấu trúc Scheveningen (The Scheveningen Structure)",
        "group": "miscellaneous",
        "group_title": "Nhóm Khác: Các cấu trúc hỗn hợp (Chương 22.1 - 22.7)",
        "chapter": "Chương 22.4 (Chapter 22.4)",
        "fen": "8/pp3ppp/3pp3/8/4PP2/8/PPP3PP/8 w - - 0 1",
        "white_pawns": ["a2", "b2", "c2", "e4", "f4", "g2", "h2"],
        "black_pawns": ["a7", "b7", "d6", "e6", "f7", "g7", "h7"],
        "description": "Bộ đôi 'Tốt tí hon' d6+e6 của Đen kiểm soát vững chắc hàng 5 (c5, d5, e5, f5); Trắng thường mở đợt tấn công Keres g4-g5 hoặc f4-f5 công phá cánh Vua; Đen triển khai phản công cánh Hậu bằng ...a6, ...b5 và khai thác cột c.",
        "aliases": ["scheveningen", "the scheveningen structure", "scheveningen structure", "cau truc scheveningen", "cấu trúc scheveningen"],
    },
    "Benko_Structure": {
        "name": "The Benko Structure",
        "vietnamese_name": "Cấu trúc Benko Gambit (The Benko Structure)",
        "group": "miscellaneous",
        "group_title": "Nhóm Khác: Các cấu trúc hỗn hợp (Chương 22.1 - 22.7)",
        "chapter": "Chương 22.5 (Chapter 22.5)",
        "fen": "8/4pp1p/3p2p1/2pP4/4P3/8/PP3PPP/8 w - - 0 1",
        "white_pawns": ["a2", "b2", "d5", "e4", "f2", "g2", "h2"],
        "black_pawns": ["c5", "d6", "e7", "f7", "g6", "h7"],
        "description": "Benko Gambit sau khi Đen thí Tốt a và b để mở thông hoàn toàn hai cột a và b: Đen sở hữu áp lực đè nặng cánh Hậu suốt từ trung cuộc đến tàn cuộc; Trắng cố gắng giữ vững Tốt hơn và trung hòa sức ép trên hai cột mở.",
        "aliases": ["benko", "the benko structure", "benko structure", "cau truc benko", "cấu trúc benko", "benko gambit"],
    },
    "Closed_Ruy_Lopez": {
        "name": "The Closed Ruy Lopez",
        "vietnamese_name": "Cấu trúc Tây Ban Nha Đóng (The Closed Ruy Lopez)",
        "group": "miscellaneous",
        "group_title": "Nhóm Khác: Các cấu trúc hỗn hợp (Chương 22.1 - 22.7)",
        "chapter": "Chương 22.6 (Chapter 22.6)",
        "fen": "8/5ppp/p2p4/1p1Pp3/4P3/2P5/PP3PPP/8 w - - 0 1",
        "white_pawns": ["a2", "b2", "c3", "d5", "e4", "f2", "g2", "h2"],
        "black_pawns": ["a6", "b5", "d6", "e5", "f7", "g7", "h7"],
        "description": "Cấu trúc Tây Ban Nha Đóng sau khi Trắng khóa trung tâm bằng d4-d5 và Đen giữ e5 cùng b5: Trắng cơ động Mã cánh Hậu sang cánh Vua (Nbd2-f1-g3/e3) phục vụ công thành; Đen cơ động Mã sang c4 hoặc phản công ...c6.",
        "aliases": ["closed ruy lopez", "the closed ruy lopez", "tay ban nha dong", "tây ban nha đóng", "ruy lopez", "ruy lopez dong"],
    },
    "Lopez_Formation": {
        "name": "The Lopez Formation",
        "vietnamese_name": "Cấu trúc Lopez Mở/Mềm (The Lopez Formation)",
        "group": "miscellaneous",
        "group_title": "Nhóm Khác: Các cấu trúc hỗn hợp (Chương 22.1 - 22.7)",
        "chapter": "Chương 22.7 (Chapter 22.7)",
        "fen": "8/pp3ppp/2pp4/4p3/3PP3/2P5/PP3PPP/8 w - - 0 1",
        "white_pawns": ["a2", "b2", "c3", "d4", "e4", "f2", "g2", "h2"],
        "black_pawns": ["a7", "b7", "c6", "d6", "e5", "f7", "g7", "h7"],
        "description": "Cấu trúc trung tâm Lopez kinh điển với căng thẳng d4 đối đầu e5: Trắng duy trì cặp Tốt trung tâm lý tưởng d4+e4 được hậu thuẫn bởi c3; Đen kìm giữ điểm tựa e5 và sẵn sàng phản kích trung tâm bằng ...d5 khi Trắng bộc lộ sơ hở.",
        "aliases": ["lopez formation", "the lopez formation", "cau truc lopez", "cấu trúc lopez"],
    },
}

def find_canonical_pawn_skeleton(query: str):
    q_norm = query.lower().strip()
    # Normalize punctuation and spaces
    q_clean = re.sub(r"[^\w\s\-\.]", " ", q_norm)
    q_clean = re.sub(r"\s+", " ", q_clean).strip()
    
    # 1. Exact alias match or substring in query
    best_match = None
    max_len = 0
    for key, data in CANONICAL_PAWN_SKELETONS.items():
        if key.lower() in q_clean:
            return key, data
        for alias in data["aliases"]:
            if alias in q_clean and len(alias) > max_len:
                best_match = (key, data)
                max_len = len(alias)
    if best_match:
        return best_match
    return None

def get_canonical_pawn_skeleton(structure_key: str) -> Optional[Dict[str, Any]]:
    """Lấy dữ liệu hình thái cấu trúc chuẩn (Canonical Pawn Skeleton) theo khóa cấu trúc."""
    return CANONICAL_PAWN_SKELETONS.get(structure_key)



def _make_detected(
    structure_key: str,
    name: str,
    group: str,
    chapter: str,
    side: str,
    square: str,
    evidence: str,
) -> Dict[str, Any]:
    group_meta = FLORES_RIOS_GROUPS[group]
    return {
        "structure": structure_key,
        "name": name,
        "chapter": chapter,
        "group": group,
        "group_title": group_meta["title"],
        "group_order": group_meta["order"],
        "side": side,
        "square": square,
        "evidence": evidence,
        "strategic_plan": STRATEGIC_PLANS[structure_key],
    }


def detect_all_pawn_structures(board: chess.Board, ply: int = 20) -> List[Dict[str, Any]]:
    """
    Nhận diện chính xác các cấu trúc Tốt trên bàn cờ theo đúng 28 cấu trúc
    (Chương 1 -> Chương 22) trong cuốn "Chess Structures: A Grandmaster Guide" của GM Mauricio Flores Rios.
    Đảm bảo kiểm tra đầy đủ tọa độ chốt trung tâm, trạng thái mở/nửa mở của từng cột (a..h),
    loại trừ tốt chồng trên các chốt định danh và tách biệt đôi một (pairwise disjoint) giữa 28 cấu trúc.
    """
    w_pawns = set(board.pieces(chess.PAWN, chess.WHITE))
    b_pawns = set(board.pieces(chess.PAWN, chess.BLACK))

    w_file_counts = [0] * 8
    b_file_counts = [0] * 8
    for sq in w_pawns:
        w_file_counts[chess.square_file(sq)] += 1
    for sq in b_pawns:
        b_file_counts[chess.square_file(sq)] += 1

    def w_single(sq: chess.Square) -> bool:
        return (sq in w_pawns) and (w_file_counts[chess.square_file(sq)] == 1)

    def b_single(sq: chess.Square) -> bool:
        return (sq in b_pawns) and (b_file_counts[chess.square_file(sq)] == 1)

    def w_empty(f: int) -> bool:
        return w_file_counts[f] == 0

    def b_empty(f: int) -> bool:
        return b_file_counts[f] == 0

    def w_has(f: int) -> bool:
        return w_file_counts[f] > 0

    def b_has(f: int) -> bool:
        return b_file_counts[f] > 0

    A, B, C, D, E, F, G, H = range(8)
    detected: List[Dict[str, Any]] = []

    # Triệt tiêu nhận diện nhầm ở cờ tàn khi số tốt bị tiêu hao gần hết (tối thiểu 4 tốt mỗi bên)
    if len(w_pawns) < 4 or len(b_pawns) < 4:
        return detected

    # =========================================================================
    # FAMILY ONE: d4 and ...d5 (Chapters 1 - 7)
    # =========================================================================

    # Ch. 1: The Isolani
    w_isolani = (
        w_single(chess.D4)
        and w_empty(C)
        and w_empty(E)
        and b_empty(D)
        and (
            (b_empty(C) and (chess.E6 in b_pawns or chess.E7 in b_pawns))
            or (b_empty(E) and (chess.C6 in b_pawns or chess.C7 in b_pawns))
        )
    )
    b_isolani = (
        b_single(chess.D5)
        and b_empty(C)
        and b_empty(E)
        and w_empty(D)
        and (
            (w_empty(C) and (chess.E3 in w_pawns or chess.E2 in w_pawns or chess.E4 in w_pawns))
            or (w_empty(E) and (chess.C3 in w_pawns or chess.C2 in w_pawns or chess.C4 in w_pawns))
        )
    )
    if w_isolani:
        detected.append(_make_detected(
            "Isolani", "The Isolani", "family_1", "Ch. 1", "white", "d4",
            "Trắng giữ tốt cô lập d4 (hai cột c, e trống tốt Trắng; Đen không còn tốt d, tranh chấp ô phong tỏa d5).",
        ))
    elif b_isolani:
        detected.append(_make_detected(
            "Isolani", "The Isolani", "family_1", "Ch. 1", "black", "d5",
            "Đen giữ tốt cô lập d5 (hai cột c, e trống tốt Đen; Trắng không còn tốt d, tranh chấp ô phong tỏa d4).",
        ))

    # Ch. 2: Hanging Pawns (Chuẩn Flores Rios trang 38: c4+d4 trên hàng 4 vs e6/e7/e5, không còn tốt b, e)
    w_hanging = (
        w_single(chess.D4)
        and w_single(chess.C4)
        and w_empty(B)
        and w_empty(E)
        and b_empty(C)
        and b_empty(D)
        and (chess.E6 in b_pawns or chess.E7 in b_pawns or chess.E5 in b_pawns)
    )
    b_hanging = (
        b_single(chess.D5)
        and b_single(chess.C5)
        and b_empty(B)
        and b_empty(E)
        and w_empty(C)
        and w_empty(D)
        and (chess.E3 in w_pawns or chess.E2 in w_pawns or chess.E4 in w_pawns)
    )
    if w_hanging:
        detected.append(_make_detected(
            "Hanging_Pawns", "Hanging Pawns", "family_1", "Ch. 2", "white", "c4/d4",
            "Trắng sở hữu cặp tốt treo c4+d4 trên hàng 4 không có tốt đồng minh ở cột b, e và phơi mình trên hai cột nửa mở c, d.",
        ))
    elif b_hanging:
        detected.append(_make_detected(
            "Hanging_Pawns", "Hanging Pawns", "family_1", "Ch. 2", "black", "c5/d5",
            "Đen sở hữu cặp tốt treo c5+d5 trên hàng 5 không có tốt đồng minh ở cột b, e và phơi mình trên hai cột nửa mở c, d.",
        ))

    # Ch. 3: Caro-Kann Formation (...dxe4: một bên giữ d4 không tốt e, bên kia giữ c6+e6/e7 không tốt d)
    w_caro_kann = (
        w_single(chess.D4)
        and w_empty(E)
        and (w_single(chess.C2) or w_single(chess.C3) or w_single(chess.C4))
        and (w_has(A) or w_has(B))
        and b_empty(D)
        and b_single(chess.C6)
        and (chess.E6 in b_pawns or chess.E7 in b_pawns)
    )
    b_caro_kann = (
        b_single(chess.D5)
        and b_empty(E)
        and (b_single(chess.C7) or b_single(chess.C6) or b_single(chess.C5))
        and (b_has(A) or b_has(B))
        and w_empty(D)
        and w_single(chess.C3)
        and (chess.E3 in w_pawns or chess.E2 in w_pawns)
    )
    if w_caro_kann:
        detected.append(_make_detected(
            "Caro_Kann_Formation", "Caro-Kann Formation", "family_1", "Ch. 3", "white", "d4 vs c6/e6",
            "Trắng chiếm trung tâm với tốt d4 (cột e nửa mở cho Trắng), Đen lập bộ khung c6+e6/e7 (cột d nửa mở).",
        ))
    elif b_caro_kann:
        detected.append(_make_detected(
            "Caro_Kann_Formation", "Caro-Kann Formation", "family_1", "Ch. 3", "black", "c3/e3 vs d5",
            "Đen chiếm trung tâm với tốt d5 (cột e nửa mở cho Đen), Trắng lập bộ khung c3+e3/e2 (Caro-Kann đảo màu).",
        ))

    # Ch. 4: Slav Formation (...dxc4: Trắng giữ d4 không tốt c, Đen giữ c6+e6/e7 không tốt d)
    w_slav = (
        w_single(chess.D4)
        and w_empty(C)
        and (
            chess.E2 in w_pawns
            or chess.E3 in w_pawns
            or chess.E4 in w_pawns
            or chess.E5 in w_pawns
        )
        and (w_has(A) or w_has(B))
        and b_empty(D)
        and b_single(chess.C6)
        and (chess.E6 in b_pawns or chess.E7 in b_pawns)
    )
    if w_slav:
        detected.append(_make_detected(
            "Slav_Formation", "Slav Formation", "family_1", "Ch. 4", "white", "d4/e3 vs c6/e6",
            "Trắng kiểm soát d4 với cột c nửa mở sau đổi tốt cánh Hậu, Đen giữ bộ khung rắn chắc c6+e6/e7 (cột d nửa mở).",
        ))

    # Ch. 5: The Carlsbad Formation (Chuẩn QGD Exchange Flores Rios Ch. 5: Trắng d4+e3 cột c mở vs Đen c6+d5 cột e mở)
    std_carlsbad = (
        w_single(chess.D4)
        and (chess.E3 in w_pawns or chess.E2 in w_pawns)
        and (chess.E4 not in w_pawns)
        and (chess.E5 not in w_pawns)
        and w_empty(C)
        and (chess.F4 not in w_pawns)
        and b_single(chess.D5)
        and b_empty(E)
        and (b_single(chess.C6) or (b_single(chess.C7) and b_single(chess.B6) and chess.A7 in b_pawns))
        and b_has(F)
        and (chess.F5 not in b_pawns)
    )
    if std_carlsbad:
        detected.append(_make_detected(
            "Carlsbad_Formation", "The Carlsbad Formation", "family_1", "Ch. 5", "white", "d4/e3 vs c6/d5",
            "Cấu trúc Carlsbad chuẩn Flores Rios: Trắng giữ xích d4+e3 (cột c nửa mở), Đen giữ d5+c6/b6 (cột e nửa mở).",
        ))

    # Ch. 6: Stonewall (Tốt e bắt buộc đã dâng lên e6/e3 tạo lỗ hổng tĩnh e5/e4 và không bị khóa thành xích Pháp)
    b_stonewall = (
        b_single(chess.D5)
        and b_single(chess.E6)
        and b_single(chess.F5)
        and (chess.C6 in b_pawns or chess.C7 in b_pawns)
        and (w_single(chess.D4) or w_single(chess.D3))
        and (chess.E4 not in w_pawns)
        and (chess.E5 not in w_pawns)
    )
    w_stonewall = (
        w_single(chess.D4)
        and w_single(chess.E3)
        and w_single(chess.F4)
        and (chess.C3 in w_pawns or chess.C2 in w_pawns)
        and (b_single(chess.D5) or b_single(chess.D6))
        and (chess.E5 not in b_pawns)
        and (chess.E4 not in b_pawns)
    )
    if b_stonewall:
        detected.append(_make_detected(
            "Stonewall", "Stonewall", "family_1", "Ch. 6", "black", "c6/d5/e6/f5",
            "Đen thiết lập khối Stonewall c6(c7)-d5-e6-f5 kiểm soát e4 nhưng để lộ lỗ hổng chiến lược tại ô e5.",
        ))
    elif w_stonewall:
        detected.append(_make_detected(
            "Stonewall", "Stonewall", "family_1", "Ch. 6", "white", "c3/d4/e3/f4",
            "Trắng thiết lập khối Stonewall c3(c2)-d4-e3-f4 kiểm soát e5 nhưng để lộ lỗ hổng chiến lược tại ô e4.",
        ))

    # Ch. 7: Grünfeld Centre (Đa số tốt trung tâm d4+e4 chỉ còn tốt a cánh Hậu vs đa số 2 đánh 1 cánh Hậu a+b của Đen)
    w_grunfeld_main = (
        w_single(chess.D4)
        and w_single(chess.E4)
        and w_empty(B)
        and w_empty(C)
        and w_has(A)
        and b_empty(C)
        and b_empty(D)
        and b_has(A)
        and b_has(B)
        and (chess.E7 in b_pawns or chess.E6 in b_pawns)
    )
    w_grunfeld_tension = (
        w_single(chess.C3)
        and w_single(chess.D4)
        and w_single(chess.E4)
        and w_empty(B)
        and w_has(A)
        and b_single(chess.C5)
        and b_empty(D)
        and b_has(A)
        and b_has(B)
        and (chess.E7 in b_pawns or chess.E6 in b_pawns)
    )
    b_grunfeld_rev = (
        b_single(chess.D5)
        and b_single(chess.E5)
        and b_empty(B)
        and b_empty(C)
        and b_has(A)
        and w_empty(C)
        and w_empty(D)
        and w_has(A)
        and w_has(B)
        and (chess.E2 in w_pawns or chess.E3 in w_pawns)
    )
    if w_grunfeld_main or w_grunfeld_tension:
        detected.append(_make_detected(
            "Grunfeld_Centre", "Grünfeld Centre", "family_1", "Ch. 7", "white", "d4/e4 vs a7/b7",
            "Trắng nắm đa số tốt trung tâm hùng mạnh d4+e4, Đen nắm đa số tốt cánh Hậu 2 đánh 1 (a, b) phản kích trung tâm.",
        ))
    elif b_grunfeld_rev:
        detected.append(_make_detected(
            "Grunfeld_Centre", "Grünfeld Centre", "family_1", "Ch. 7", "black", "a2/b2 vs d5/e5",
            "Đen nắm cặp tốt trung tâm d5+e5, Trắng nắm đa số tốt cánh Hậu 2 đánh 1 (Grünfeld Centre đảo màu).",
        ))

    # =========================================================================
    # FAMILY TWO: Open Sicilian (Chapters 8 - 11)
    # =========================================================================

    # Ch. 8: Najdorf Type I (Sau exd5: Trắng có d5 không còn tốt e, còn tốt c vs Đen d6+e5 không còn tốt c)
    std_najdorf_1 = (
        w_single(chess.D5)
        and w_empty(E)
        and w_has(C)
        and b_single(chess.D6)
        and b_single(chess.E5)
        and b_empty(C)
    )
    rev_najdorf_1 = (
        b_single(chess.D4)
        and b_empty(E)
        and b_has(C)
        and w_single(chess.D3)
        and w_single(chess.E4)
        and w_empty(C)
    )
    if std_najdorf_1:
        detected.append(_make_detected(
            "Najdorf_Type_I", "Najdorf Type I", "family_2", "Ch. 8", "white", "d5 (no e) vs d6/e5",
            "Trắng đã ăn exd5 tạo mũi nhọn d5 và đa số tốt cánh Hậu (cột e nửa mở), Đen giữ d6+e5 chuẩn bị ...f7-f5 công thành.",
        ))
    elif rev_najdorf_1:
        detected.append(_make_detected(
            "Najdorf_Type_I", "Najdorf Type I", "family_2", "Ch. 8", "black", "d3/e4 vs d4 (no e)",
            "Đen đã ăn ...exd4 tạo chốt d4 và đa số tốt cánh Hậu, Trắng giữ d3+e4 (Najdorf Type I đảo màu).",
        ))

    # Ch. 9: Najdorf Type II (Lỗ hổng d5 kinh điển: Trắng e4 không tốt d vs Đen d6+e5 không tốt c)
    std_najdorf_2 = (
        w_single(chess.E4)
        and w_empty(D)
        and (chess.C4 not in w_pawns)
        and (chess.C5 not in w_pawns)
        and b_single(chess.D6)
        and b_single(chess.E5)
        and b_empty(C)
    )
    rev_najdorf_2 = (
        b_single(chess.E5)
        and b_empty(D)
        and w_single(chess.D3)
        and w_single(chess.E4)
        and w_empty(C)
    )
    if std_najdorf_2:
        detected.append(_make_detected(
            "Najdorf_Type_II", "Najdorf Type II", "family_2", "Ch. 9", "black", "e4 vs d6/e5",
            "Đen dựng cặp tốt d6+e5 (cột c nửa mở) chấp nhận lỗ hổng chiến lược tại d5 và tốt lạc hậu d6 trên cột d nửa mở.",
        ))
    elif rev_najdorf_2:
        detected.append(_make_detected(
            "Najdorf_Type_II", "Najdorf Type II", "family_2", "Ch. 9", "white", "d3/e4 vs e5",
            "Trắng dựng cặp tốt d3+e4 (cột c nửa mở) với lỗ hổng chiến lược d4 (Najdorf Type II đảo màu từ khai cuộc Anh).",
        ))

    # Ch. 10: The Hedgehog (c4+e4/e3 không tốt d vs hàng gai nhím b6+d6+e6 và a6/a7, không fianchetto g6)
    std_hedgehog = (
        w_single(chess.C4)
        and (w_single(chess.E4) or w_single(chess.E3))
        and w_empty(D)
        and b_single(chess.B6)
        and b_single(chess.D6)
        and b_single(chess.E6)
        and (chess.A6 in b_pawns or chess.A7 in b_pawns or chess.A5 in b_pawns)
        and (chess.G6 not in b_pawns)
        and b_empty(C)
    )
    rev_hedgehog = (
        b_single(chess.C5)
        and (b_single(chess.E5) or b_single(chess.E6))
        and b_empty(D)
        and w_single(chess.B3)
        and w_single(chess.D3)
        and w_single(chess.E3)
        and (chess.A3 in w_pawns or chess.A2 in w_pawns or chess.A4 in w_pawns)
        and (chess.G3 not in w_pawns)
        and w_empty(C)
    )
    if std_hedgehog:
        detected.append(_make_detected(
            "Hedgehog", "The Hedgehog", "family_2", "Ch. 10", "black", "c4/e4 vs a6/b6/d6/e6",
            "Trắng lập gọng kìm không gian c4+e4, Đen co cụm hàng gai nhím b6-d6-e6 (a6) chờ thời cơ phản kích ...d6-d5 hoặc ...b6-b5.",
        ))
    elif rev_hedgehog:
        detected.append(_make_detected(
            "Hedgehog", "The Hedgehog", "family_2", "Ch. 10", "white", "a3/b3/d3/e3 vs c5/e5",
            "Trắng dàn hàng gai nhím b3-d3-e3 (a3) chống lại gọng kìm không gian c5+e5 của Đen (Hedgehog đảo màu).",
        ))

    # Ch. 11: The Maroczy (c4+e4 không tốt d vs Đen fianchetto g6/Bg7, tốt e thường giữ ở e7, cột c Đen trống - trang 205)
    std_maroczy = (
        w_single(chess.C4)
        and w_single(chess.E4)
        and w_empty(D)
        and b_empty(C)
        and (b_single(chess.D6) or (b_single(chess.D7) and chess.G6 in b_pawns))
        and (chess.E5 not in b_pawns)
        and (chess.G6 in b_pawns or b_single(chess.E7))
        and not std_hedgehog
    )
    rev_maroczy = (
        b_single(chess.C5)
        and b_single(chess.E5)
        and b_empty(D)
        and w_empty(C)
        and (w_single(chess.D3) or (w_single(chess.D2) and chess.G3 in w_pawns))
        and (chess.E4 not in w_pawns)
        and (chess.G3 in w_pawns or w_single(chess.E2))
        and not rev_hedgehog
    )
    if std_maroczy:
        detected.append(_make_detected(
            "Maroczy", "The Maroczy", "family_2", "Ch. 11", "white", "c4/e4 vs d6/g6",
            "Trắng khóa chặt ô d5 bằng gọng kìm Maroczy c4+e4 trước hệ thống fianchetto d6+g6 (cột c Đen đã mở).",
        ))
    elif rev_maroczy:
        detected.append(_make_detected(
            "Maroczy", "The Maroczy", "family_2", "Ch. 11", "black", "d3/g3 vs c5/e5",
            "Đen khóa chặt ô d4 bằng gọng kìm Maroczy c5+e5 trước hệ thống fianchetto d3+g3 của Trắng (Maroczy đảo màu).",
        ))

    # =========================================================================
    # FAMILY THREE: Benoni (Chapters 12 - 13)
    # =========================================================================

    # Ch. 12: Asymmetric Benoni (cxd5: Trắng d5+e4/e3/e2 không tốt c vs Đen c5+d6 không tốt e, còn tốt a hoặc b)
    std_asym_benoni = (
        w_single(chess.D5)
        and w_empty(C)
        and (chess.E4 in w_pawns or chess.E3 in w_pawns or chess.E2 in w_pawns)
        and b_single(chess.C5)
        and b_single(chess.D6)
        and b_empty(E)
        and (b_has(A) or b_has(B))
    )
    rev_asym_benoni = (
        b_single(chess.D4)
        and b_empty(C)
        and (chess.E5 in b_pawns or chess.E6 in b_pawns or chess.E7 in b_pawns)
        and w_single(chess.C4)
        and w_single(chess.D3)
        and w_empty(E)
        and (w_has(A) or w_has(B))
    )
    if std_asym_benoni:
        detected.append(_make_detected(
            "Asymmetric_Benoni", "Asymmetric Benoni", "family_3", "Ch. 12", "white", "d5/e4 vs c5/d6",
            "Cấu trúc Benoni bất đối xứng: Trắng giữ đa số tốt trung tâm d5+e4 (cột c nửa mở), Đen giữ c5+d6 và đa số tốt cánh Hậu (cột e nửa mở).",
        ))
    elif rev_asym_benoni:
        detected.append(_make_detected(
            "Asymmetric_Benoni", "Asymmetric Benoni", "family_3", "Ch. 12", "black", "c4/d3 vs d4/e5",
            "Cấu trúc Benoni bất đối xứng đảo màu: Đen giữ đa số tốt trung tâm d4+e5, Trắng giữ c4+d3 và đa số tốt cánh Hậu.",
        ))

    # Ch. 13: Symmetric Benoni (exd5: Trắng c4+d5 vs Đen c5+d6 với cột e mở hoàn toàn)
    std_sym_benoni = (
        w_single(chess.C4)
        and w_single(chess.D5)
        and w_empty(E)
        and b_single(chess.C5)
        and b_single(chess.D6)
        and b_empty(E)
    )
    rev_sym_benoni = (
        b_single(chess.C5)
        and b_single(chess.D4)
        and b_empty(E)
        and w_single(chess.C4)
        and w_single(chess.D3)
        and w_empty(E)
    )
    if std_sym_benoni:
        detected.append(_make_detected(
            "Symmetric_Benoni", "Symmetric Benoni", "family_3", "Ch. 13", "white", "c4/d5 vs c5/d6 (e open)",
            "Cấu trúc Benoni đối xứng sau exd5: hai bên giữ c4+d5 đấu c5+d6 trên cột e mở hoàn toàn, Trắng ưu thế không gian.",
        ))
    elif rev_sym_benoni:
        detected.append(_make_detected(
            "Symmetric_Benoni", "Symmetric Benoni", "family_3", "Ch. 13", "black", "c4/d3 vs c5/d4 (e open)",
            "Cấu trúc Benoni đối xứng đảo màu: Đen giữ c5+d4 đấu c4+d3 trên cột e mở hoàn toàn.",
        ))

    # =========================================================================
    # FAMILY FOUR: King's Indian (Chapters 14 - 18)
    # =========================================================================
    # Hỗ trợ cả trạng thái e4 nguyên vẹn và Transformation A/B sau ...f7-f5 exf5 (Chương 15 & 16)
    w_kid_e_chain = w_single(chess.E4) or (
        w_empty(E) and (chess.F5 in b_pawns or chess.F4 in w_pawns or chess.F3 in w_pawns)
    )
    b_kid_e_chain_rev = b_single(chess.E5) or (
        b_empty(E) and (chess.F4 in w_pawns or chess.F5 in b_pawns or chess.F6 in b_pawns)
    )

    kid_locked_std = w_single(chess.D5) and w_kid_e_chain and b_single(chess.D6) and b_single(chess.E5)
    kid_locked_rev = b_single(chess.D4) and b_kid_e_chain_rev and w_single(chess.D3) and w_single(chess.E4)

    # Ch. 14: KID Type I (Trung tâm khóa d5/e4 vs d6/e5 với cột c mở hoàn toàn)
    if kid_locked_std and w_empty(C) and b_empty(C):
        detected.append(_make_detected(
            "KID_Type_I", "KID Type I", "family_4", "Ch. 14", "white", "d5/e4 vs d6/e5 (c open)",
            "Trung tâm khóa kiểu King's Indian (d5+e4 đấu d6+e5) với cột c đã mở hoàn toàn cho cuộc chiến xâm nhập hàng 7.",
        ))
    elif kid_locked_rev and b_empty(C) and w_empty(C):
        detected.append(_make_detected(
            "KID_Type_I", "KID Type I", "family_4", "Ch. 14", "black", "d3/e4 vs d4/e5 (c open)",
            "Trung tâm khóa kiểu King's Indian đảo màu (d4+e5 đấu d3+e4) với cột c mở hoàn toàn.",
        ))

    # Ch. 15: KID Type II (Khóa cả cột c: c4+d5+e4 vs c5+d6+e5)
    if kid_locked_std and w_single(chess.C4) and b_single(chess.C5):
        detected.append(_make_detected(
            "KID_Type_II", "KID Type II", "family_4", "Ch. 15", "both", "c4/d5/e4 vs c5/d6/e5",
            "Trung tâm và cột c cùng khóa cứng (c4-d5-e4 đấu c5-d6-e5): Trắng chuẩn bị b2-b4 hoặc f2-f4, Đen chuẩn bị bão tốt ...f7-f5.",
        ))
    elif kid_locked_rev and b_single(chess.C5) and w_single(chess.C4):
        detected.append(_make_detected(
            "KID_Type_II", "KID Type II", "family_4", "Ch. 15", "both", "c4/d3/e4 vs c5/d4/e5",
            "Trung tâm và cột c cùng khóa cứng đảo màu (c5-d4-e5 đấu c4-d3-e4).",
        ))

    # Ch. 16: KID Type III (Mar del Plata: c4(c2)+d5+e4 vs c7(c6)+d6+e5)
    if kid_locked_std and (w_single(chess.C4) or w_single(chess.C2)) and (b_single(chess.C7) or b_single(chess.C6)):
        detected.append(_make_detected(
            "KID_Type_III", "KID Type III", "family_4", "Ch. 16", "both", "c4/d5/e4 vs c7/d6/e5",
            "Cấu trúc Mar del Plata kinh điển: Trắng đua tốc độ c4-c5xd6 cánh Hậu, Đen đua bão tốt chiếu hết ...f5-f4, ...g5-g4-g3 cánh Vua.",
        ))
    elif kid_locked_rev and (b_single(chess.C5) or b_single(chess.C7)) and (w_single(chess.C2) or w_single(chess.C3)):
        detected.append(_make_detected(
            "KID_Type_III", "KID Type III", "family_4", "Ch. 16", "both", "c2/d3/e4 vs c5/d4/e5",
            "Cấu trúc King's Indian Type III đảo màu: Đen dâng nêm c5-d4-e5 đối đầu c2(c3)-d3-e4.",
        ))

    # Ch. 17: Open KID (...exd4 nhưng Đen vẫn giữ tốt c7 hoặc c6 - khác Maroczy nơi Đen đã mất tốt c)
    std_open_kid = (
        w_single(chess.C4)
        and w_single(chess.E4)
        and w_empty(D)
        and b_single(chess.D6)
        and b_empty(E)
        and (b_single(chess.C7) or b_single(chess.C6))
    )
    rev_open_kid = (
        b_single(chess.C5)
        and b_single(chess.E5)
        and b_empty(D)
        and w_single(chess.D3)
        and w_empty(E)
        and (w_single(chess.C2) or w_single(chess.C3))
    )
    if std_open_kid:
        detected.append(_make_detected(
            "Open_KID", "Open KID", "family_4", "Ch. 17", "white", "c4/e4 vs c6/d6",
            "Cấu trúc Open KID sau ...exd4: Trắng giữ gọng kìm c4+e4 và ép thẳng vào tốt d6 trên cột nửa mở d trong khi Đen còn tốt c6/c7.",
        ))
    elif rev_open_kid:
        detected.append(_make_detected(
            "Open_KID", "Open KID", "family_4", "Ch. 17", "black", "c3/d3 vs c5/e5",
            "Cấu trúc Open KID đảo màu: Đen giữ c5+e5 gây áp lực lên tốt d3 trên cột nửa mở d.",
        ))

    # Ch. 18: KID Complex (18A: c4+d4+e4 vs c6/c7+d6+e5; 18B: sau dxe5 dxe5 mở cột d với c4/c5+e4 vs c6/c7+e5)
    std_kid_complex_tension = (
        w_single(chess.C4)
        and w_single(chess.D4)
        and w_single(chess.E4)
        and (b_single(chess.C6) or b_single(chess.C7))
        and b_single(chess.D6)
        and b_single(chess.E5)
    )
    std_kid_complex_open_d = (
        (w_single(chess.C4) or w_single(chess.C5))
        and w_single(chess.E4)
        and w_empty(D)
        and (b_single(chess.C6) or b_single(chess.C7))
        and b_single(chess.E5)
        and b_empty(D)
    )
    rev_kid_complex_tension = (
        b_single(chess.C5)
        and b_single(chess.D5)
        and b_single(chess.E5)
        and (w_single(chess.C3) or w_single(chess.C2))
        and w_single(chess.D3)
        and w_single(chess.E4)
    )
    rev_kid_complex_open_d = (
        (b_single(chess.C5) or b_single(chess.C4))
        and b_single(chess.E5)
        and b_empty(D)
        and (w_single(chess.C3) or w_single(chess.C2))
        and w_single(chess.E4)
        and w_empty(D)
    )
    if std_kid_complex_tension or std_kid_complex_open_d:
        sq_desc = "c4/d4/e4 vs c6/d6/e5" if std_kid_complex_tension else "c4/e4 vs c6/e5 (d open)"
        detected.append(_make_detected(
            "KID_Complex", "KID Complex", "family_4", "Ch. 18", "both", sq_desc,
            "Cấu trúc KID Complex: cuộc chiến xoay quanh đòn c4-c5 chiếm tiền đồn d6 của Trắng và quyền kiểm soát ô đen d4 của Đen.",
        ))
    elif rev_kid_complex_tension or rev_kid_complex_open_d:
        detected.append(_make_detected(
            "KID_Complex", "KID Complex", "family_4", "Ch. 18", "both", "c3/e4 vs c5/e5",
            "Cấu trúc KID Complex đảo màu: Đen tìm đòn ...c5-c4 chiếm d3, Trắng tranh quyền kiểm soát ô d5.",
        ))

    # =========================================================================
    # FAMILY FIVE: French (Chapters 19 - 21)
    # =========================================================================

    # Ch. 19: French Type I (Sau ...f6 exf6: Trắng d4 không tốt e vs Đen d5+e6 không tốt f)
    std_french_1 = (
        w_single(chess.D4)
        and w_empty(E)
        and b_single(chess.D5)
        and b_single(chess.E6)
        and b_empty(F)
    )
    rev_french_1 = (
        b_single(chess.D5)
        and b_empty(E)
        and w_single(chess.D4)
        and w_single(chess.E3)
        and w_empty(F)
    )
    if std_french_1:
        detected.append(_make_detected(
            "French_Type_I", "French Type I", "family_5", "Ch. 19", "white", "d4 vs d5/e6 (f open)",
            "Cấu trúc Pháp Type I sau ...f6 exf6: Trắng nhắm vào ô tiền đồn e5 và tốt e6 trên cột e nửa mở; Đen phản công d4 và cột f nửa mở.",
        ))
    elif rev_french_1:
        detected.append(_make_detected(
            "French_Type_I", "French Type I", "family_5", "Ch. 19", "black", "d4/e3 vs d5 (f open)",
            "Cấu trúc Pháp Type I đảo màu sau f3 exf3: Đen nhắm vào tiền đồn e4 và tốt e3.",
        ))

    # Ch. 20: French Type II (Sau ...cxd4 Nxd4: Trắng giữ mũi nhọn e5 không tốt d vs Đen d5+e6 không tốt c)
    std_french_2 = (
        w_single(chess.E5)
        and w_empty(D)
        and b_single(chess.D5)
        and b_single(chess.E6)
        and b_empty(C)
    )
    rev_french_2 = (
        b_single(chess.E4)
        and b_empty(D)
        and w_single(chess.D4)
        and w_single(chess.E3)
        and w_empty(C)
    )
    if std_french_2:
        detected.append(_make_detected(
            "French_Type_II", "French Type II", "family_5", "Ch. 20", "both", "e5 vs d5/e6",
            "Cấu trúc Pháp Type II: Trắng chốt Mã tại d4 và công thành bằng f4-f5 dưới sự yểm trợ của mũi nhọn e5; Đen phản kích ...f6, ...g5 hoặc ...b5-b4.",
        ))
    elif rev_french_2:
        detected.append(_make_detected(
            "French_Type_II", "French Type II", "family_5", "Ch. 20", "both", "d4/e3 vs e4",
            "Cấu trúc Pháp Type II đảo màu: Đen giữ mũi nhọn e4 và chốt giữ ô trung tâm d5 đối đầu xích d4+e3 của Trắng.",
        ))

    # Ch. 21: French Type III (Xích tốt nguyên vẹn d4+e5 vs d5+e6 - bao gồm cả Pháp Advance, Caro-Kann Advance và Catalan e5)
    std_french_3 = w_single(chess.D4) and w_single(chess.E5) and b_single(chess.D5) and b_single(chess.E6)
    rev_french_3 = b_single(chess.D5) and b_single(chess.E4) and w_single(chess.D4) and w_single(chess.E3)
    if std_french_3:
        detected.append(_make_detected(
            "French_Type_III", "French Type III", "family_5", "Ch. 21", "both", "d4/e5 vs d5/e6",
            "Xích tốt Pháp Type III nguyên vẹn (d4+e5 đấu d5+e6): Trắng công kích gốc e6 và cánh Vua, Đen công phá gốc d4 bằng ...c5 và cột c.",
        ))
    elif rev_french_3:
        detected.append(_make_detected(
            "French_Type_III", "French Type III", "family_5", "Ch. 21", "both", "d4/e3 vs d5/e4",
            "Xích tốt Pháp Type III đảo màu (d5+e4 đấu d4+e3): Đen chiếm không gian cánh Vua, Trắng phản kích gốc d5.",
        ))

    # =========================================================================
    # MISCELLANEOUS: Chapter 22 - Various Structures (22.1 - 22.7)
    # =========================================================================

    # Ch. 22.1: The 3-3 vs. 4-2 Structure
    w_is_33 = (
        w_has(A) and w_has(B) and w_file_counts[C] == 1
        and w_empty(D) and w_empty(E)
        and w_has(F) and w_has(G) and w_has(H)
    )
    b_is_42 = (
        b_has(A) and b_has(B)
        and b_empty(C) and b_empty(D)
        and b_file_counts[E] == 1 and b_has(F) and b_has(G) and b_has(H)
    )
    b_is_33 = (
        b_has(A) and b_has(B) and b_file_counts[C] == 1
        and b_empty(D) and b_empty(E)
        and b_has(F) and b_has(G) and b_has(H)
    )
    w_is_42 = (
        w_has(A) and w_has(B)
        and w_empty(C) and w_empty(D)
        and w_file_counts[E] == 1 and w_has(F) and w_has(G) and w_has(H)
    )
    if w_is_33 and b_is_42:
        detected.append(_make_detected(
            "Structure_33_vs_42", "The 3-3 vs. 4-2 Structure", "miscellaneous", "Ch. 22.1", "white", "3-3 vs 4-2 (d open)",
            "Cấu trúc bất đối xứng cân bằng trên cột d mở: Trắng giữ 3-3 (đa số cánh Hậu a,b,c), Đen giữ 4-2 (đa số trung tâm/cánh Vua e,f,g,h).",
        ))
    elif b_is_33 and w_is_42:
        detected.append(_make_detected(
            "Structure_33_vs_42", "The 3-3 vs. 4-2 Structure", "miscellaneous", "Ch. 22.1", "black", "4-2 vs 3-3 (d open)",
            "Cấu trúc bất đối xứng cân bằng trên cột d mở: Đen giữ 3-3 (đa số cánh Hậu a,b,c), Trắng giữ 4-2 (đa số trung tâm/cánh Vua e,f,g,h).",
        ))

    # Ch. 22.2: The Panov Structure (Mũi nhọn c5+d4 đấu d5+e6/e7 không tốt c)
    std_panov = (
        w_single(chess.C5)
        and w_single(chess.D4)
        and (w_empty(E) or chess.E3 in w_pawns or chess.E2 in w_pawns)
        and (chess.E4 not in w_pawns)
        and (chess.E5 not in w_pawns)
        and b_single(chess.D5)
        and (chess.E6 in b_pawns or chess.E7 in b_pawns)
        and b_empty(C)
    )
    rev_panov = (
        b_single(chess.C4)
        and b_single(chess.D5)
        and (b_empty(E) or chess.E6 in b_pawns or chess.E7 in b_pawns)
        and (chess.E5 not in b_pawns)
        and (chess.E4 not in b_pawns)
        and w_single(chess.D4)
        and (chess.E3 in w_pawns or chess.E2 in w_pawns)
        and w_empty(C)
    )
    if std_panov:
        detected.append(_make_detected(
            "Panov_Structure", "The Panov Structure", "miscellaneous", "Ch. 22.2", "white", "c5/d4 vs d5/e6",
            "Cấu trúc Panov: Trắng cắm mũi nhọn c5+d4 tạo ưu thế không gian cánh Hậu, Đen giữ d5+e6 chuẩn bị bẻ gãy bằng ...b7-b6.",
        ))
    elif rev_panov:
        detected.append(_make_detected(
            "Panov_Structure", "The Panov Structure", "miscellaneous", "Ch. 22.2", "black", "d4/e3 vs c4/d5",
            "Cấu trúc Panov đảo màu: Đen cắm mũi nhọn c4+d5 trên cánh Hậu, Trắng giữ d4+e3 chuẩn bị b2-b3.",
        ))

    # Ch. 22.3: The Dragon Formation (e4 không tốt d, không có c4 vs Đen d6+g6+e7 không tốt c)
    std_dragon = (
        w_single(chess.E4)
        and w_empty(D)
        and (chess.C4 not in w_pawns)
        and (chess.C5 not in w_pawns)
        and b_single(chess.D6)
        and b_single(chess.E7)
        and (chess.G6 in b_pawns)
        and b_empty(C)
    )
    rev_dragon = (
        b_single(chess.E5)
        and b_empty(D)
        and (chess.C5 not in b_pawns)
        and (chess.C4 not in b_pawns)
        and w_single(chess.D3)
        and w_single(chess.E2)
        and (chess.G3 in w_pawns)
        and w_empty(C)
    )
    if std_dragon:
        detected.append(_make_detected(
            "Dragon_Formation", "The Dragon Formation", "miscellaneous", "Ch. 22.3", "black", "e4 vs d6/e7/g6",
            "Cấu trúc Sicilian Dragon: Trắng giữ e4 (không khóa c4), Đen giữ hệ thống Rồng d6+e7+g6 phản công sắc bén dọc cột nửa mở c.",
        ))
    elif rev_dragon:
        detected.append(_make_detected(
            "Dragon_Formation", "The Dragon Formation", "miscellaneous", "Ch. 22.3", "white", "d3/e2/g3 vs e5",
            "Cấu trúc Dragon đảo màu từ khai cuộc Anh (1.c4 e5): Trắng triển khai d3+e2+g3 và phản công dọc cột nửa mở c.",
        ))

    # Ch. 22.4: The Scheveningen Structure (e4 không tốt d, không có c4 vs Đen trung tâm nhỏ d6+e6 không tốt c)
    std_scheveningen = (
        w_single(chess.E4)
        and w_empty(D)
        and (chess.C4 not in w_pawns)
        and (chess.C5 not in w_pawns)
        and b_single(chess.D6)
        and b_single(chess.E6)
        and b_empty(C)
    )
    rev_scheveningen = (
        b_single(chess.E5)
        and b_empty(D)
        and (chess.C5 not in b_pawns)
        and (chess.C4 not in b_pawns)
        and w_single(chess.D3)
        and w_single(chess.E3)
        and w_empty(C)
    )
    if std_scheveningen:
        detected.append(_make_detected(
            "Scheveningen_Structure", "The Scheveningen Structure", "miscellaneous", "Ch. 22.4", "black", "e4 vs d6/e6",
            "Cấu trúc Scheveningen: Trắng giữ e4 trên cột d nửa mở, Đen dựng lá chắn trung tâm nhỏ d6+e6 và phản công dọc cột nửa mở c.",
        ))
    elif rev_scheveningen:
        detected.append(_make_detected(
            "Scheveningen_Structure", "The Scheveningen Structure", "miscellaneous", "Ch. 22.4", "white", "d3/e3 vs e5",
            "Cấu trúc Scheveningen đảo màu: Trắng dựng lá chắn trung tâm nhỏ d3+e3 chống lại e5 và khai thác cột nửa mở c.",
        ))

    # Ch. 22.5: The Benko Structure (Đen đã thí cả hai tốt a, b mở toang cột a+b trong cấu trúc c5+d6 vs d5)
    std_benko = (
        w_single(chess.D5)
        and w_empty(C)
        and w_has(A)
        and w_has(B)
        and b_single(chess.C5)
        and b_single(chess.D6)
        and b_empty(A)
        and b_empty(B)
    )
    rev_benko = (
        b_single(chess.D4)
        and b_empty(C)
        and b_has(A)
        and b_has(B)
        and w_single(chess.C4)
        and w_single(chess.D3)
        and w_empty(A)
        and w_empty(B)
    )
    if std_benko:
        detected.append(_make_detected(
            "Benko_Structure", "The Benko Structure", "miscellaneous", "Ch. 22.5", "black", "a2/b2/d5 vs c5/d6 (a/b open)",
            "Cấu trúc Gambit Benko: Đen đã đổi sạch hai tốt a, b để chiếm trọn hai cột nửa mở a, b gây sức ép dài hạn lên cánh Hậu Trắng.",
        ))
    elif rev_benko:
        detected.append(_make_detected(
            "Benko_Structure", "The Benko Structure", "miscellaneous", "Ch. 22.5", "white", "c4/d3 (a/b open) vs a7/b7/d4",
            "Cấu trúc Benko đảo màu: Trắng mở toang hai cột nửa mở a, b gây sức ép dài hạn lên cánh Hậu Đen.",
        ))

    # Ch. 22.6: The Closed Ruy Lopez (c3+d5+e4 vs d6+e5 - khác biệt chiến lược cốt lõi với KID ở chỗ tốt Trắng nằm tại c3)
    std_closed_ruy = (
        w_single(chess.C3)
        and w_single(chess.D5)
        and w_kid_e_chain
        and b_single(chess.D6)
        and b_single(chess.E5)
    )
    rev_closed_ruy = (
        b_single(chess.C6)
        and b_single(chess.D4)
        and b_kid_e_chain_rev
        and w_single(chess.D3)
        and w_single(chess.E4)
    )
    if std_closed_ruy:
        detected.append(_make_detected(
            "Closed_Ruy_Lopez", "The Closed Ruy Lopez", "miscellaneous", "Ch. 22.6", "both", "c3/d5/e4 vs d6/e5",
            "Cấu trúc Ruy Lopez Đóng (c3-d5-e4 đấu d6-e5): Trắng ưu tiên điều quân công thành cánh Vua, Đen có không gian phản công cánh Hậu.",
        ))
    elif rev_closed_ruy:
        detected.append(_make_detected(
            "Closed_Ruy_Lopez", "The Closed Ruy Lopez", "miscellaneous", "Ch. 22.6", "both", "d3/e4 vs c6/d4/e5",
            "Cấu trúc Ruy Lopez Đóng đảo màu (c6-d4-e5 đấu d3-e4).",
        ))

    # Ch. 22.7: The Lopez Formation (Căng thẳng c3+d4+e4 vs c5/c6/c7+d6+e5 hoặc dạng đổi đôi trên d4 trang 421: e4 vs d6 cột c mở)
    std_lopez_tension = (
        w_single(chess.C3)
        and w_single(chess.D4)
        and w_single(chess.E4)
        and (b_single(chess.C5) or b_single(chess.C6) or b_single(chess.C7))
        and b_single(chess.D6)
        and b_single(chess.E5)
    )
    std_lopez_double_trade = (
        w_single(chess.E4)
        and w_empty(C)
        and w_empty(D)
        and (w_has(A) or w_has(B))
        and b_single(chess.D6)
        and b_empty(C)
        and b_empty(E)
        and (b_has(A) or b_has(B))
    )
    rev_lopez_tension = (
        b_single(chess.C6)
        and b_single(chess.D5)
        and b_single(chess.E5)
        and (w_single(chess.C4) or w_single(chess.C3) or w_single(chess.C2))
        and w_single(chess.D3)
        and w_single(chess.E4)
    )
    rev_lopez_double_trade = (
        b_single(chess.E5)
        and b_empty(C)
        and b_empty(D)
        and (b_has(A) or b_has(B))
        and w_single(chess.D3)
        and w_empty(C)
        and w_empty(E)
        and (w_has(A) or w_has(B))
    )
    if std_lopez_tension or std_lopez_double_trade:
        sq_desc = "c3/d4/e4 vs c5/d6/e5" if std_lopez_tension else "e4 vs d6 (c open)"
        detected.append(_make_detected(
            "Lopez_Formation", "The Lopez Formation", "miscellaneous", "Ch. 22.7", "both", sq_desc,
            "Cấu trúc Lopez Formation từ Ruy Lopez: sức căng trung tâm c3-d4-e4 trước d6-e5 (hoặc sau đổi đôi tốt tại d4 tạo thế e4 đấu d6).",
        ))
    elif rev_lopez_tension or rev_lopez_double_trade:
        detected.append(_make_detected(
            "Lopez_Formation", "The Lopez Formation", "miscellaneous", "Ch. 22.7", "both", "d3/e4 vs c6/d5/e5",
            "Cấu trúc Lopez Formation đảo màu.",
        ))

    return detected


def detect_pawn_structure(board: chess.Board, ply: int = 20) -> Dict[str, Any]:
    """
    Hàm nhận diện cấu trúc Tốt đơn nhất tại một thế cờ.
    Trả về cấu trúc chuẩn Flores Rios nếu đã hình thành, hoặc Unclassified nếu chưa thuộc 28 cấu trúc.
    """
    all_structs = detect_all_pawn_structures(board, ply=ply)
    if not all_structs:
        return {
            "structure": "Unclassified",
            "name": "Unclassified Structure",
            "group": "unclassified",
            "group_title": "Chưa định hình cấu trúc Flores Rios",
            "side": "both",
            "square": "",
        }
    return all_structs[0]


def analyze_structural_performance(
    filtered_games: List[Dict[str, Any]],
    move_evaluations: Optional[List[Dict[str, Any]]] = None,
    min_move_window: int = 3,
    max_move_window: int = 16,
    min_persistence_plies: int = 3,
) -> Dict[str, Any]:
    """
    Phân tích hiệu suất thi đấu theo 28 Cấu trúc Tốt chuẩn Flores Rios.
    - Quét ply ((min_move_window - 1) * 2 + 1) đến (max_move_window * 2). Mặc định là ply 5–32; xác minh thêm đến ply 34.
    - Áp dụng Bộ lọc Độ bền Cấu trúc (Persistence Filter >= min_persistence_plies liên tiếp)
      để triệt tiêu hoàn toàn hiện tượng bắt nhầm 1-2 ply ăn đổi tốt dở dang giữa chừng.
    """
    struct_stats: Dict[str, Dict[str, Any]] = {}

    min_ply_window = max(1, (min_move_window - 1) * 2 + 1)
    max_ply_window = max_move_window * 2
    verify_ply_limit = max_ply_window + max(0, min_persistence_plies - 1)

    def _record_structure_in_game(
        st_meta: Dict[str, Any],
        snap: Dict[str, Any],
        game: Dict[str, Any],
        g_idx: int,
        player_color: str,
        result: str,
        is_win: bool,
        is_draw: bool,
        is_loss: bool,
    ) -> None:
        st_name = st_meta["name"]
        if st_name not in struct_stats:
            struct_stats[st_name] = {
                "name": st_name,
                "structure_key": st_meta["structure"],
                "chapter": st_meta.get("chapter", ""),
                "group": st_meta.get("group", "miscellaneous"),
                "group_title": st_meta.get("group_title", "Miscellaneous – Various Structures"),
                "group_order": st_meta.get("group_order", 6),
                "strategic_plan": st_meta.get("strategic_plan"),
                "games_count": 0,
                "wins": 0,
                "draws": 0,
                "losses": 0,
                "cpls": [],
                "formation_moves": [],
                "games": [],
            }

        stat = struct_stats[st_name]
        stat["games_count"] += 1
        stat["formation_moves"].append(snap["formation_move"])
        if is_win:
            stat["wins"] += 1
        elif is_draw:
            stat["draws"] += 1
        elif is_loss:
            stat["losses"] += 1

        stat["games"].append({
            "id": game.get("id"),
            "game_index": g_idx,
            "formation_move": snap["formation_move"],
            "formation_ply": snap["formation_ply"],
            "formation_fen": snap["formation_fen"],
            "evidence": snap["evidence"],
            "white": game.get("white", "Unknown"),
            "black": game.get("black", "Unknown"),
            "result": result,
            "opening": game.get("opening", "Unknown Opening"),
            "date": game.get("date", ""),
            "site": game.get("site", ""),
            "player_color": player_color,
            "is_win": is_win,
            "is_draw": is_draw,
            "is_loss": is_loss,
            "game_accuracy": game.get("game_accuracy"),
        })

    for g_idx, game in enumerate(filtered_games):
        moves = game.get("moves", [])
        player_color = game.get("player_color", "white")
        result = game.get("result", "")

        is_win, is_draw, is_loss = determine_game_outcome(player_color, result)

        board = chess.Board()
        seen_in_game = set()
        active_streaks: Dict[str, Dict[str, Any]] = {}
        last_pushed_ply = 0

        for ply, san in enumerate(moves, start=1):
            if ply > verify_ply_limit:
                break

            try:
                move_obj = board.parse_san(san)
                board.push(move_obj)
                last_pushed_ply = ply
            except Exception:
                break

            move_number = ((ply - 1) // 2) + 1
            all_detected = detect_all_pawn_structures(board, ply=ply)
            current_map = {st["name"]: st for st in all_detected}

            # Xóa các chuỗi cấu trúc đã biến mất ở ply hiện tại
            for existing_name in list(active_streaks.keys()):
                if existing_name not in current_map:
                    del active_streaks[existing_name]

            for st_name, st in current_map.items():
                if st_name in seen_in_game:
                    continue

                if st_name not in active_streaks:
                    # Không mở chuỗi mới sau max_ply_window (các ply > max_ply_window chỉ dùng xác thực độ bền)
                    if ply > max_ply_window:
                        continue
                    active_streaks[st_name] = {
                        "meta": st,
                        "total_streak": 1,
                        "window_streak": 1 if ply >= min_ply_window else 0,
                        "snap": {
                            "formation_move": move_number,
                            "formation_ply": ply,
                            "formation_fen": board.fen(),
                            "evidence": st.get("evidence", ""),
                        },
                    }
                else:
                    entry = active_streaks[st_name]
                    entry["total_streak"] += 1
                    if ply >= min_ply_window:
                        entry["window_streak"] += 1

                entry = active_streaks.get(st_name)
                if entry and entry["snap"] is not None and entry["window_streak"] >= min_persistence_plies:
                    seen_in_game.add(st_name)
                    _record_structure_in_game(
                        entry["meta"], entry["snap"], game, g_idx,
                        player_color, result, is_win, is_draw, is_loss,
                    )

        # Nếu ván đấu thực sự kết thúc sớm (ví dụ ván ngắn kết thúc ở nước 8-12) trong khi cấu trúc vẫn đứng vững trên bàn cờ
        if last_pushed_ply == len(moves) and last_pushed_ply >= min_ply_window:
            end_threshold = min(2, min_persistence_plies)
            for st_name, entry in active_streaks.items():
                if (
                    st_name not in seen_in_game
                    and entry["snap"] is not None
                    and entry["total_streak"] >= end_threshold
                ):
                    seen_in_game.add(st_name)
                    _record_structure_in_game(
                        entry["meta"], entry["snap"], game, g_idx,
                        player_color, result, is_win, is_draw, is_loss,
                    )

    if move_evaluations:
        for ev in move_evaluations:
            fen = ev.get("fen_before", "")
            cpl = ev.get("cpl", 0.0)
            if fen:
                try:
                    b = chess.Board(fen)
                    all_res = detect_all_pawn_structures(b)
                    for st_res in all_res:
                        st_name = st_res["name"]
                        if st_name in struct_stats:
                            struct_stats[st_name]["cpls"].append(cpl)
                except Exception:
                    pass

    result_list = []
    for name, data in struct_stats.items():
        g_count = data["games_count"]
        w, d, l = data["wins"], data["draws"], data["losses"]
        score_pct = calculate_score_percentage(w, d, g_count)
        cpls = data["cpls"]
        avg_acpl = round(sum(cpls) / len(cpls), 1) if cpls else 0.0

        formation_moves = data["formation_moves"]
        typical_move = round(sum(formation_moves) / len(formation_moves)) if formation_moves else 12

        struct_item = {
            "name": name,
            "structure_key": data["structure_key"],
            "chapter": data.get("chapter", ""),
            "group": data["group"],
            "group_title": data["group_title"],
            "group_order": data.get("group_order", 6),
            "strategic_plan": data["strategic_plan"],
            "games_count": g_count,
            "wins": w,
            "draws": d,
            "losses": l,
            "score_pct": score_pct,
            "avg_acpl": avg_acpl,
            "typical_formation_move": typical_move,
            "games": data["games"],
        }
        result_list.append(struct_item)

    result_list.sort(key=lambda x: (-x["games_count"], x.get("group_order", 99), x["name"]))

    return {
        "structures": result_list,
    }
