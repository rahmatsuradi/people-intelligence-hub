-- ============================================================
-- People Intelligence — DEFINISI SURVEI PULSE CHECK (instance Lencir)
--
-- Database Lencir dibuat dari struktur kosong, jadi belum punya definisi
-- survei apa pun (di Rica Rico definisinya diimpor terpisah). Tanpa baris ini,
-- /pulse kosong dan link survei tidak bisa dibuat.
--
-- Isi: Monthly Pulse Check Lencir, pertanyaannya mengikuti formulir Google
-- Form "Monthly Pulse Check (Lencir x Rica Rico Marketing)" versi 2026:
-- apresiasi satu divisi & luar divisi, aktivitas engagement, waktu
-- pelaksanaan, dan pelatihan. Hanya DEFINISI pertanyaan — tidak ada
-- jawaban/data karyawan (jawaban lama diimpor terpisah, di luar repo).
--
-- Kunci pertanyaan sama dengan Pulse Rica Rico (happiness, stress_freq,
-- appreciated_names) karena dashboard /pulse membaca kunci itu.
-- appreciated_names = rekan LUAR divisi, appreciated_names_team = SATU divisi.
-- Aman dijalankan ulang (upsert per tenant + key).
--
-- Setelah Run: buka /pulse -> tab "Kirim survei" -> buat link bulan ini.
-- ============================================================

insert into public.pi_surveys (tenant_id, key, title, description, audience, cadence, headline, segments, source, config, questions)
values (
  '55555555-5555-4555-8555-555555555555',
  'pulse_bulanan',
  'Pulse Check Bulanan',
  'Denyut bulanan: seberapa tertekan dan seberapa bahagia tim, apa penyebabnya, dan apa yang bisa dibantu.',
  'Seluruh karyawan Lencir (termasuk tim Marketing Rica Rico)',
  'bulanan',
  array['happiness','stress_freq'],
  array['divisi','tenure'],
  'Google Form "Monthly Pulse Check (Lencir x Rica Rico Marketing)"; kini formulir web Lencir',
  $c${
    "kind":"pulse","order":1,"navLabel":"Pulse Check",
    "who":"Karyawan menilai kondisi dirinya sendiri: stres, bahagia, dan apresiasi untuk rekan satu divisi maupun luar divisi.",
    "themes":[
      {"key":"gaji","label":"Gaji & insentif","pattern":"gaji|salary|gapok|insentif|komisi|\\ythr\\y|bonus","fields":["stress_detail","unhappy_detail","help_wish","workplace_idea"]},
      {"key":"bpjs","label":"BPJS & jaminan","pattern":"bpjs|\\yjht\\y|asuransi","fields":["stress_detail","unhappy_detail","help_wish","workplace_idea"]},
      {"key":"fasilitas","label":"Ruang, fasilitas & kebersihan kantor","pattern":"fasilitas|ruangan|ruang kerja|kantor|parkir|toilet|kamar mandi|pantr|\\ymeja|\\yac\\y|tempat sampah|kebersihan|bersih|jorok|sholat|solat","fields":["stress_detail","unhappy_detail","help_wish","workplace_idea"]},
      {"key":"approval","label":"Approval & alur kerja","pattern":"approv|persetujuan|revisi|alur kerja|flow kerja|prioritas","fields":["stress_detail","unhappy_detail","help_wish","workplace_idea"]},
      {"key":"beban","label":"Beban kerja & deadline","pattern":"deadline|beban|numpuk|menumpuk|penumpukan|mendadak|dadakan|lembur|banyak (kerjaan|pekerjaan)|kerjaan (banyak|byk)|target|mepet","fields":["stress_detail","unhappy_detail","help_wish","workplace_idea"]},
      {"key":"karier","label":"Karier & pelatihan","pattern":"karir|karier|pelatihan|training|workshop|bootcamp|skill|keterampilan|pengembangan","fields":["stress_detail","unhappy_detail","help_wish","workplace_idea"]},
      {"key":"komunikasi","label":"Komunikasi & kepemimpinan","pattern":"komunikasi|koordinasi|jutek|\\yego\\y|konflik|antar divisi|lintas divisi|leader|atasan|manager|manajer|dihargai|didengar","fields":["stress_detail","unhappy_detail","help_wish","workplace_idea"]},
      {"key":"jobdesc","label":"Kejelasan jobdesc","pattern":"job ?des|jobdesk|scope of work|di ?luar jobdesk","fields":["stress_detail","unhappy_detail","help_wish","workplace_idea"]},
      {"key":"kegiatan","label":"Gathering & kegiatan bersama","pattern":"gathering|outing|refreshing|healing|liburan|olahraga|senam|kegiatan (bareng|bersama)|jalan-jalan","fields":["stress_detail","unhappy_detail","help_wish","workplace_idea"]}
    ]
  }$c$::jsonb,
  $q$[
    {"key":"tenure","label":"Sudah berapa lama kamu bekerja di Lencir / Valen Persada Nusantara?","type":"choice","section":"Tentang kamu","required":true,
     "options":[{"value":"< 1 Tahun"},{"value":"1 - 2 Tahun"},{"value":"2 - 3 tahun","label":"2 - 3 Tahun"},{"value":"3 - 4 Tahun"},{"value":"> 4 Tahun"}]},
    {"key":"divisi","label":"Dari divisi apa kamu?","type":"choice","section":"Tentang kamu","required":true,
     "options":[{"value":"Marketing"},{"value":"Operasional"},{"value":"Lainnya (HR & Finance)"}]},

    {"key":"stress_freq","label":"Seberapa besar tingkat stres yang kamu rasakan selama sebulan terakhir?","type":"choice","section":"Stres","required":true,"higherIsBetter":false,
     "kpiLabel":"Stres tinggi","kpiHint":"Stres 2 kali seminggu atau lebih",
     "risk":["2 - 3x dalam seminggu","> 3x dalam seminggu","Setiap hari"],
     "options":[
       {"value":"Tidak sama sekali","score":0},{"value":"1x dalam 2 Minggu","score":1},{"value":"1x dalam setiap Minggu","score":2},
       {"value":"2 - 3x dalam seminggu","score":3},{"value":"> 3x dalam seminggu","score":4},{"value":"Setiap hari","score":5}]},
    {"key":"stress_source","label":"Hal apa yang paling sering bikin kamu merasa tertekan belakangan ini?","type":"choice","section":"Stres",
     "showIf":{"key":"stress_freq","in":["2 - 3x dalam seminggu","> 3x dalam seminggu","Setiap hari"]},
     "options":[{"value":"Berhubungan dengan pekerjaan"},{"value":"Tidak berhubungan dengan pekerjaan"},{"value":"Keduanya"}]},
    {"key":"stress_detail","label":"Apa saja situasi atau kondisi yang biasanya bikin kamu merasa tertekan?","type":"text","section":"Stres",
     "showIf":{"key":"stress_freq","in":["2 - 3x dalam seminggu","> 3x dalam seminggu","Setiap hari"]}},

    {"key":"happiness","label":"Bagaimana kamu menilai rasa bahagiamu bulan ini?","type":"choice","section":"Bahagia","required":true,"higherIsBetter":true,
     "kpiLabel":"Indeks bahagia","kpiHint":"Menjawab Bahagia atau Sangat Bahagia",
     "favorable":["Bahagia","Sangat Bahagia"],
     "options":[
       {"value":"Sangat Tidak Bahagia","score":1},{"value":"Tidak Bahagia","score":2},{"value":"Bahagia","score":3},{"value":"Sangat Bahagia","score":4}]},
    {"key":"happy_reasons","label":"Apa saja yang jadi alasan kamu merasa senang?","type":"multi","section":"Bahagia",
     "showIf":{"key":"happiness","in":["Bahagia","Sangat Bahagia"]},
     "options":[{"value":"Job-Related"},{"value":"Personal Growth & Learning"},{"value":"Work-Life Harmony"},{"value":"Reward & Recognition"},{"value":"Work Environment"},{"value":"Personal Factors"}]},
    {"key":"unhappy_source","label":"Hal apa yang belakangan ini bikin kamu kurang merasa bahagia?","type":"choice","section":"Bahagia",
     "showIf":{"key":"happiness","in":["Sangat Tidak Bahagia","Tidak Bahagia"]},
     "options":[{"value":"Berhubungan dengan pekerjaan"},{"value":"Tidak berhubungan dengan pekerjaan"},{"value":"Keduanya"}]},
    {"key":"unhappy_detail","label":"Coba sharing hal-hal yang bikin kamu kurang bahagia belakangan ini.","type":"text","section":"Bahagia",
     "showIf":{"key":"happiness","in":["Sangat Tidak Bahagia","Tidak Bahagia"]}},

    {"key":"appreciate_team","label":"Adakah rekan kerja satu divisi yang ingin kamu apresiasi?","type":"choice","section":"Apresiasi",
     "options":[{"value":"Ya"},{"value":"Tidak"}]},
    {"key":"appreciated_names_team","label":"Siapa rekan kerja satu divisi yang ingin kamu apresiasi?","type":"text","section":"Apresiasi",
     "showIf":{"key":"appreciate_team","in":["Ya"]}},
    {"key":"appreciate_team_reason","label":"Boleh ceritakan tindakan atau bantuan apa yang membuatmu ingin mengapresiasi mereka?","type":"text","section":"Apresiasi",
     "showIf":{"key":"appreciate_team","in":["Ya"]}},
    {"key":"appreciate_cross","label":"Adakah rekan kerja di luar divisimu yang ingin kamu apresiasi?","type":"choice","section":"Apresiasi",
     "options":[{"value":"Ya"},{"value":"Tidak"}]},
    {"key":"appreciated_names","label":"Siapa rekan kerja di luar divisimu yang ingin kamu apresiasi?","type":"text","section":"Apresiasi",
     "showIf":{"key":"appreciate_cross","in":["Ya"]}},
    {"key":"appreciate_cross_reason","label":"Boleh ceritakan tindakan atau bantuan apa yang membuatmu ingin mengapresiasi mereka?","type":"text","section":"Apresiasi",
     "showIf":{"key":"appreciate_cross","in":["Ya"]}},

    {"key":"help_wish","label":"Apakah ada yang bisa kami lakukan untuk membantu mengurangi stres atau meningkatkan kebahagiaanmu?","type":"text","section":"Masukan"},
    {"key":"workplace_idea","label":"Menurutmu, apa yang bisa membuat lingkungan kerja kita jadi tempat kerja yang lebih baik?","type":"text","section":"Masukan"},

    {"key":"engagement_activity","label":"Aktivitas engagement seperti apa yang paling ingin kamu ikuti ke depannya? (pilih maksimal 3)","type":"multi","section":"Engagement & pelatihan",
     "options":[
       {"value":"Sport Activity / Olahraga Bersama (Badminton, Tenis, Bowling, dll)","label":"Olahraga bersama (badminton, tenis, bowling, dll)"},
       {"value":"Games & Competition (Board game, Escape room, Go Kart, dll)","label":"Games & kompetisi (board game, escape room, go kart, dll)"},
       {"value":"Creative Workshop (Matcha Making, Coffee Brewing, Pottery, dll)","label":"Workshop kreatif (matcha making, coffee brewing, pottery, dll)"},
       {"value":"Movie / Entertainment Night (Nonton bioskop bersama, Karaoke, stand-up comedy, dll)","label":"Nonton / hiburan (bioskop, karaoke, stand-up comedy, dll)"},
       {"value":"Wellness Activity (Yoga, Pilates, dll)","label":"Wellness (yoga, pilates, dll)"},
       {"value":"Food Hunting (Makan bersama tim, Cafe hopping, Food festival, dll)","label":"Food hunting (makan bersama, cafe hopping, food festival, dll)"}]},
    {"key":"engagement_other","label":"Ada aktivitas lain yang kamu inginkan?","type":"text","section":"Engagement & pelatihan"},
    {"key":"engagement_time","label":"Waktu pelaksanaan yang paling nyaman untuk mengikuti kegiatan engagement?","type":"choice","section":"Engagement & pelatihan",
     "options":[{"value":"Hari Jumat Sore"},{"value":"Setelah Jam Kerja"},{"value":"Sabtu"}]},
    {"key":"training_wish","label":"Pelatihan apa yang ingin kamu ikuti untuk mendukung pengembangan diri dan pekerjaanmu?","type":"text","section":"Engagement & pelatihan"},
    {"key":"training_doc","label":"Link Google Docs rincian program pelatihan tersebut (opsional)","type":"text","section":"Engagement & pelatihan"}
  ]$q$::jsonb
)
on conflict (tenant_id, key) do update
  set title = excluded.title, description = excluded.description, audience = excluded.audience,
      cadence = excluded.cadence, headline = excluded.headline, segments = excluded.segments,
      source = excluded.source, config = excluded.config, questions = excluded.questions,
      updated_at = now();

select key, title, jsonb_array_length(questions) as jumlah_pertanyaan from public.pi_surveys;
