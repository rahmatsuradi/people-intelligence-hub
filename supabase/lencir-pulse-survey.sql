-- ============================================================
-- People Intelligence — DEFINISI SURVEI PULSE CHECK (instance Lencir)
--
-- Database Lencir dibuat dari struktur kosong, jadi definisi survei ada di sini.
-- Hanya DEFINISI pertanyaan — tidak ada jawaban/data karyawan.
--
-- Versi 6 Nov 2026, dipakai mulai link Oktober 2026 (0 jawaban saat diganti):
--   - tambah masalah terberat (untuk SEMUA orang, bukan hanya yang stres), 9 penilaian
--     kondisi kerja (dari keluhan terbanyak di Action List), tindak lanjut, keinginan
--     bertahan, dan permintaan dihubungi HR;
--   - apresiasi diringkas; engagement tetap tiap bulan; pelatihan tidak ditanyakan lagi.
--   - Pertanyaan lama TIDAK dihapus: `hidden` + section "Arsip", supaya jawaban lama tetap
--     terbaca di laporan. happiness & stress_freq tidak berubah supaya tren tidak putus.
-- Kunci sama dengan Pulse Rica Rico (happiness, stress_freq, appreciated_names) karena
-- dashboard /pulse membaca kunci itu. Aman dijalankan ulang (upsert per tenant + key).
-- ============================================================

insert into public.pi_surveys (tenant_id, key, title, description, audience, cadence, headline, segments, source, config, questions)
values (
  '55555555-5555-4555-8555-555555555555',
  'pulse_bulanan',
  'Pulse Check Bulanan',
  'Denyut bulanan: bagaimana kondisimu, apa yang menghambat, dan apa yang bisa dibantu.',
  'Seluruh karyawan Lencir (termasuk tim Marketing Rica Rico)',
  'bulanan',
  array['happiness','stress_freq','hr_contact'],
  array['divisi','tenure'],
  'Google Form "Monthly Pulse Check (Lencir x Rica Rico Marketing)"; kini formulir web Lencir',
  $c${
    "kind":"pulse","order":1,"navLabel":"Pulse Check",
    "who":"Karyawan menilai kondisi dirinya sendiri: stres, bahagia, kondisi kerja, dan apresiasi untuk rekan.",
    "themes":[
      {"key":"gaji","label":"Gaji & insentif","pattern":"gaji|salary|gapok|insentif|komisi|\\ythr\\y|bonus","fields":["problem_detail","wish_next","stress_detail","unhappy_detail","workplace_idea"]},
      {"key":"bpjs","label":"BPJS & jaminan","pattern":"bpjs|\\yjht\\y|asuransi","fields":["problem_detail","wish_next","stress_detail","unhappy_detail","workplace_idea"]},
      {"key":"fasilitas","label":"Ruang, fasilitas & kebersihan kantor","pattern":"fasilitas|ruangan|ruang kerja|kantor|parkir|toilet|kamar mandi|pantr|\\ymeja|\\yac\\y|tempat sampah|kebersihan|bersih|jorok|sholat|solat","fields":["problem_detail","wish_next","stress_detail","unhappy_detail","workplace_idea"]},
      {"key":"approval","label":"Approval & alur kerja","pattern":"approv|persetujuan|revisi|alur kerja|flow kerja|prioritas","fields":["problem_detail","wish_next","stress_detail","unhappy_detail","workplace_idea"]},
      {"key":"beban","label":"Beban kerja & deadline","pattern":"deadline|beban|numpuk|menumpuk|penumpukan|mendadak|dadakan|lembur|banyak (kerjaan|pekerjaan)|kerjaan (banyak|byk)|target|mepet","fields":["problem_detail","wish_next","stress_detail","unhappy_detail","workplace_idea"]},
      {"key":"karier","label":"Karier & pelatihan","pattern":"karir|karier|pelatihan|training|workshop|bootcamp|skill|keterampilan|pengembangan","fields":["problem_detail","wish_next","stress_detail","unhappy_detail","workplace_idea"]},
      {"key":"komunikasi","label":"Komunikasi & kepemimpinan","pattern":"komunikasi|koordinasi|jutek|\\yego\\y|konflik|antar divisi|lintas divisi|leader|atasan|manager|manajer|dihargai|didengar","fields":["problem_detail","wish_next","stress_detail","unhappy_detail","workplace_idea"]},
      {"key":"jobdesc","label":"Kejelasan jobdesc","pattern":"job ?des|jobdesk|scope of work|di ?luar jobdesk","fields":["problem_detail","wish_next","stress_detail","unhappy_detail","workplace_idea"]},
      {"key":"kegiatan","label":"Gathering & kegiatan bersama","pattern":"gathering|outing|refreshing|healing|liburan|olahraga|senam|kegiatan (bareng|bersama)|jalan-jalan","fields":["problem_detail","wish_next","stress_detail","unhappy_detail","workplace_idea"]}
    ]
  }$c$::jsonb,
  $q$[
    {"key":"tenure","label":"Sudah berapa lama kamu bekerja di Lencir / Valen Persada Nusantara?","type":"choice","section":"Tentang kamu","required":true,
     "options":[{"value":"< 1 Tahun"},{"value":"1 - 2 Tahun"},{"value":"2 - 3 tahun","label":"2 - 3 Tahun"},{"value":"3 - 4 Tahun"},{"value":"> 4 Tahun"}]},
    {"key":"divisi","label":"Dari divisi apa kamu?","type":"choice","section":"Tentang kamu","required":true,
     "options":[{"value":"Marketing"},{"value":"Operasional"},{"value":"Lainnya (HR & Finance)"}]},

    {"key":"happiness","label":"Bagaimana kamu menilai rasa bahagiamu bulan ini?","type":"choice","section":"Kondisimu bulan ini","required":true,"higherIsBetter":true,
     "kpiLabel":"Indeks bahagia","kpiHint":"Menjawab Bahagia atau Sangat Bahagia",
     "favorable":["Bahagia","Sangat Bahagia"],
     "options":[{"value":"Sangat Tidak Bahagia","score":1},{"value":"Tidak Bahagia","score":2},{"value":"Bahagia","score":3},{"value":"Sangat Bahagia","score":4}]},
    {"key":"stress_freq","label":"Seberapa sering kamu merasa stres selama sebulan terakhir?","type":"choice","section":"Kondisimu bulan ini","required":true,"higherIsBetter":false,
     "kpiLabel":"Stres tinggi","kpiHint":"Stres 2 kali seminggu atau lebih",
     "risk":["2 - 3x dalam seminggu","> 3x dalam seminggu","Setiap hari"],
     "options":[{"value":"Tidak sama sekali","score":0},{"value":"1x dalam 2 Minggu","score":1},{"value":"1x dalam setiap Minggu","score":2},{"value":"2 - 3x dalam seminggu","score":3},{"value":"> 3x dalam seminggu","score":4},{"value":"Setiap hari","score":5}]},
    {"key":"happy_reasons","label":"Apa saja yang membuatmu senang bulan ini?","type":"multi","section":"Kondisimu bulan ini",
     "showIf":{"key":"happiness","in":["Bahagia","Sangat Bahagia"]},
     "options":[{"value":"Job-Related","label":"Pekerjaan itu sendiri"},{"value":"Personal Growth & Learning","label":"Belajar & berkembang"},{"value":"Work-Life Harmony","label":"Keseimbangan kerja & hidup"},{"value":"Reward & Recognition","label":"Penghargaan & apresiasi"},{"value":"Work Environment","label":"Lingkungan kerja"},{"value":"Personal Factors","label":"Hal pribadi"}]},
    {"key":"problem_detail","label":"Apa masalah atau hal terberat yang kamu hadapi sebulan terakhir?","type":"text","section":"Kondisimu bulan ini"},
    {"key":"problem_source","label":"Masalah itu berhubungan dengan apa?","type":"choice","section":"Kondisimu bulan ini",
     "showIf":{"key":"problem_detail"},
     "options":[{"value":"Berhubungan dengan pekerjaan"},{"value":"Tidak berhubungan dengan pekerjaan"},{"value":"Keduanya"}]},

    {"key":"drv_beban","label":"Beban kerja saya bulan ini masih bisa saya tangani.","type":"scale","min":1,"max":5,"minLabel":"sangat tidak setuju","maxLabel":"sangat setuju","section":"Yang memengaruhi kerjamu","required":true,"favorableMin":4,"kpiLabel":"Beban kerja"},
    {"key":"drv_kejelasan","label":"Saya tahu jelas tugas dan prioritas saya.","type":"scale","min":1,"max":5,"minLabel":"sangat tidak setuju","maxLabel":"sangat setuju","section":"Yang memengaruhi kerjamu","required":true,"favorableMin":4,"kpiLabel":"Kejelasan tugas"},
    {"key":"drv_atasan","label":"Atasan saya memberi arahan dan keputusan tepat waktu.","type":"scale","min":1,"max":5,"minLabel":"sangat tidak setuju","maxLabel":"sangat setuju","section":"Yang memengaruhi kerjamu","required":true,"favorableMin":4,"kpiLabel":"Arahan atasan"},
    {"key":"drv_kerjasama","label":"Kerja sama dengan tim dan divisi lain berjalan baik.","type":"scale","min":1,"max":5,"minLabel":"sangat tidak setuju","maxLabel":"sangat setuju","section":"Yang memengaruhi kerjamu","required":true,"favorableMin":4,"kpiLabel":"Kerja sama"},
    {"key":"drv_dihargai","label":"Saya merasa dihargai atas pekerjaan saya.","type":"scale","min":1,"max":5,"minLabel":"sangat tidak setuju","maxLabel":"sangat setuju","section":"Yang memengaruhi kerjamu","required":true,"favorableMin":4,"kpiLabel":"Merasa dihargai"},
    {"key":"drv_fasilitas","label":"Fasilitas dan alat kerja saya memadai.","type":"scale","min":1,"max":5,"minLabel":"sangat tidak setuju","maxLabel":"sangat setuju","section":"Yang memengaruhi kerjamu","required":true,"favorableMin":4,"kpiLabel":"Fasilitas"},
    {"key":"drv_gaji","label":"Gaji dan benefit saya jelas dan tepat waktu.","type":"scale","min":1,"max":5,"minLabel":"sangat tidak setuju","maxLabel":"sangat setuju","section":"Yang memengaruhi kerjamu","required":true,"favorableMin":4,"kpiLabel":"Gaji & benefit"},
    {"key":"drv_berkembang","label":"Saya melihat peluang berkembang di sini.","type":"scale","min":1,"max":5,"minLabel":"sangat tidak setuju","maxLabel":"sangat setuju","section":"Yang memengaruhi kerjamu","required":true,"favorableMin":4,"kpiLabel":"Peluang berkembang"},
    {"key":"drv_aman","label":"Saya berani menyampaikan keluhan tanpa takut.","type":"scale","min":1,"max":5,"minLabel":"sangat tidak setuju","maxLabel":"sangat setuju","section":"Yang memengaruhi kerjamu","required":true,"favorableMin":4,"kpiLabel":"Berani bersuara"},

    {"key":"followup_status","label":"Masalah yang kamu sampaikan sebelumnya sudah ditindaklanjuti?","type":"choice","section":"Tindak lanjut","required":true,
     "options":[{"value":"Sudah selesai"},{"value":"Sedang berjalan"},{"value":"Belum"},{"value":"Tidak pernah menyampaikan"}]},
    {"key":"wish_next","label":"Satu hal yang paling ingin kamu kami bantu atau ubah bulan depan?","type":"text","section":"Tindak lanjut"},
    {"key":"stay_intent","label":"Kalau bisa memilih, seberapa ingin kamu tetap bekerja di Lencir 6 bulan ke depan?","type":"scale","min":1,"max":5,"minLabel":"sangat tidak ingin","maxLabel":"sangat ingin","section":"Tindak lanjut","required":true,"favorableMin":4,"kpiLabel":"Ingin bertahan"},
    {"key":"hr_contact","label":"Apakah kamu ingin HR menghubungimu secara pribadi?","type":"choice","section":"Tindak lanjut","required":true,
     "kpiLabel":"Butuh dukungan","kpiHint":"Ingin dihubungi HR secara pribadi","risk":["Ya"],
     "options":[{"value":"Tidak"},{"value":"Ya"}]},

    {"key":"appreciated_names","label":"Siapa rekan yang ingin kamu apresiasi? (boleh satu divisi atau divisi lain)","type":"text","section":"Apresiasi"},
    {"key":"appreciate_reason","label":"Apresiasi untuk hal apa?","type":"text","section":"Apresiasi","showIf":{"key":"appreciated_names"}},

    {"key":"engagement_activity","label":"Aktivitas engagement seperti apa yang paling ingin kamu ikuti ke depannya? (pilih maksimal 3)","type":"multi","section":"Engagement",
     "options":[
       {"value":"Sport Activity / Olahraga Bersama (Badminton, Tenis, Bowling, dll)","label":"Olahraga bersama (badminton, tenis, bowling, dll)"},
       {"value":"Games & Competition (Board game, Escape room, Go Kart, dll)","label":"Games & kompetisi (board game, escape room, go kart, dll)"},
       {"value":"Creative Workshop (Matcha Making, Coffee Brewing, Pottery, dll)","label":"Workshop kreatif (matcha making, coffee brewing, pottery, dll)"},
       {"value":"Movie / Entertainment Night (Nonton bioskop bersama, Karaoke, stand-up comedy, dll)","label":"Nonton / hiburan (bioskop, karaoke, stand-up comedy, dll)"},
       {"value":"Wellness Activity (Yoga, Pilates, dll)","label":"Wellness (yoga, pilates, dll)"},
       {"value":"Food Hunting (Makan bersama tim, Cafe hopping, Food festival, dll)","label":"Food hunting (makan bersama, cafe hopping, food festival, dll)"}]},
    {"key":"engagement_other","label":"Ada aktivitas lain yang kamu inginkan?","type":"text","section":"Engagement"},
    {"key":"engagement_time","label":"Waktu pelaksanaan yang paling nyaman untuk mengikuti kegiatan engagement?","type":"choice","section":"Engagement",
     "options":[{"value":"Hari Jumat Sore"},{"value":"Setelah Jam Kerja"},{"value":"Sabtu"}]},

    {"key":"stress_source","label":"Hal apa yang paling sering bikin kamu merasa tertekan belakangan ini?","type":"choice","section":"Arsip","hidden":true,
     "options":[{"value":"Berhubungan dengan pekerjaan"},{"value":"Tidak berhubungan dengan pekerjaan"},{"value":"Keduanya"}]},
    {"key":"stress_detail","label":"Apa saja situasi atau kondisi yang biasanya bikin kamu merasa tertekan?","type":"text","section":"Arsip","hidden":true},
    {"key":"unhappy_source","label":"Hal apa yang belakangan ini bikin kamu kurang merasa bahagia?","type":"choice","section":"Arsip","hidden":true,
     "options":[{"value":"Berhubungan dengan pekerjaan"},{"value":"Tidak berhubungan dengan pekerjaan"},{"value":"Keduanya"}]},
    {"key":"unhappy_detail","label":"Coba sharing hal-hal yang bikin kamu kurang bahagia belakangan ini.","type":"text","section":"Arsip","hidden":true},
    {"key":"appreciate_team","label":"Adakah rekan kerja satu divisi yang ingin kamu apresiasi?","type":"choice","section":"Arsip","hidden":true,"options":[{"value":"Ya"},{"value":"Tidak"}]},
    {"key":"appreciated_names_team","label":"Siapa rekan kerja satu divisi yang ingin kamu apresiasi?","type":"text","section":"Arsip","hidden":true},
    {"key":"appreciate_team_reason","label":"Tindakan atau bantuan rekan satu divisi yang diapresiasi","type":"text","section":"Arsip","hidden":true},
    {"key":"appreciate_cross","label":"Adakah rekan kerja di luar divisimu yang ingin kamu apresiasi?","type":"choice","section":"Arsip","hidden":true,"options":[{"value":"Ya"},{"value":"Tidak"}]},
    {"key":"appreciate_cross_reason","label":"Tindakan atau bantuan rekan luar divisi yang diapresiasi","type":"text","section":"Arsip","hidden":true},
    {"key":"help_wish","label":"Apakah ada yang bisa kami lakukan untuk membantu mengurangi stres atau meningkatkan kebahagiaanmu?","type":"choice","section":"Arsip","hidden":true,"options":[{"value":"Ya"},{"value":"Tidak"}]},
    {"key":"workplace_idea","label":"Menurutmu, apa yang bisa membuat lingkungan kerja kita jadi tempat kerja yang lebih baik?","type":"text","section":"Arsip","hidden":true},
    {"key":"training_doc","label":"Link Google Docs rincian program pelatihan tersebut","type":"text","section":"Arsip","hidden":true},
    {"key":"training_wish","label":"Pelatihan apa yang ingin kamu ikuti untuk mendukung pengembangan diri dan pekerjaanmu?","type":"text","section":"Arsip","hidden":true}
  ]$q$::jsonb
)
on conflict (tenant_id, key) do update
  set title = excluded.title, description = excluded.description, audience = excluded.audience,
      cadence = excluded.cadence, headline = excluded.headline, segments = excluded.segments,
      source = excluded.source, config = excluded.config, questions = excluded.questions,
      updated_at = now();

select key, title, jsonb_array_length(questions) as jumlah_pertanyaan from public.pi_surveys;
