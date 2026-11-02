-- ============================================================
-- People Intelligence — DEFINISI SURVEI PULSE CHECK (instance Lencir)
--
-- Database Lencir dibuat dari struktur kosong, jadi belum punya definisi
-- survei apa pun (di Rica Rico definisinya diimpor terpisah). Tanpa baris ini,
-- /pulse kosong dan link survei tidak bisa dibuat.
--
-- Isi: Monthly Pulse Check Lencir, pertanyaannya mengikuti formulir Google
-- Form lama ("Monthly Pulse Check (Lencir x Rica Rico Marketing)"). Hanya
-- DEFINISI pertanyaan — tidak ada jawaban/data karyawan.
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
  'Seluruh karyawan Lencir',
  'bulanan',
  array['bahagia','stres'],
  array['tenure','divisi'],
  'Formulir web Lencir',
  '{"kind":"pulse","order":1,"navLabel":"Pulse Check","who":"Karyawan menilai kondisi dirinya sendiri: stres, bahagia, dan apresiasi untuk rekan."}'::jsonb,
  $q$[
    {"key":"tenure","label":"Sudah berapa lama Anda bekerja di Lencir?","type":"choice","section":"Tentang kamu","required":true,
     "options":[{"value":"< 1 Tahun"},{"value":"1 - 2 Tahun"},{"value":"2 - 3 tahun"},{"value":"3 - 4 Tahun"},{"value":"> 4 Tahun"}]},
    {"key":"divisi","label":"Dari divisi apa kamu?","type":"choice","section":"Tentang kamu","required":true,
     "options":[{"value":"Marketing"},{"value":"Operasional"},{"value":"Lainnya (HR & Finance)"}]},

    {"key":"stres","label":"Seberapa sering kamu merasa stres selama sebulan terakhir?","type":"choice","section":"Stres","required":true,"higherIsBetter":false,
     "kpiLabel":"Stres tinggi","kpiHint":"Stres 2 kali seminggu atau lebih",
     "risk":["2 - 3x dalam seminggu","> 3x dalam seminggu","Setiap hari"],
     "options":[
       {"value":"Tidak sama sekali","score":0},{"value":"1x dalam 2 Minggu","score":1},{"value":"1x dalam setiap Minggu","score":2},
       {"value":"2 - 3x dalam seminggu","score":3},{"value":"> 3x dalam seminggu","score":4},{"value":"Setiap hari","score":5}]},
    {"key":"stres_sumber","label":"Hal apa yang paling sering bikin kamu merasa tertekan belakangan ini?","type":"choice","section":"Stres",
     "showIf":{"key":"stres","notIn":["Tidak sama sekali"]},
     "options":[{"value":"Berhubungan dengan pekerjaan"},{"value":"Tidak berhubungan dengan pekerjaan"},{"value":"Keduanya"}]},
    {"key":"stres_detail","label":"Ceritakan situasi atau kondisi yang biasanya bikin kamu merasa tertekan.","type":"text","section":"Stres",
     "showIf":{"key":"stres","notIn":["Tidak sama sekali"]}},

    {"key":"bahagia","label":"Bagaimana kamu menilai rasa bahagiamu bulan ini?","type":"choice","section":"Bahagia","required":true,"higherIsBetter":true,
     "kpiLabel":"Indeks bahagia","kpiHint":"Menjawab Bahagia atau Sangat Bahagia",
     "favorable":["Bahagia","Sangat Bahagia"],
     "options":[
       {"value":"Sangat Tidak Bahagia","score":1},{"value":"Tidak Bahagia","score":2},{"value":"Bahagia","score":3},{"value":"Sangat Bahagia","score":4}]},
    {"key":"bahagia_alasan","label":"Apa saja yang jadi alasan kamu merasa senang?","type":"multi","section":"Bahagia",
     "showIf":{"key":"bahagia","in":["Bahagia","Sangat Bahagia"]},
     "options":[{"value":"Job-Related"},{"value":"Personal Growth & Learning"},{"value":"Work-Life Harmony"},{"value":"Reward & Recognition"},{"value":"Work Environment"},{"value":"Personal Factors"}]},
    {"key":"kurang_bahagia_sumber","label":"Hal apa yang belakangan ini bikin kamu kurang merasa bahagia?","type":"choice","section":"Bahagia",
     "showIf":{"key":"bahagia","in":["Sangat Tidak Bahagia","Tidak Bahagia"]},
     "options":[{"value":"Berhubungan dengan pekerjaan"},{"value":"Tidak berhubungan dengan pekerjaan"},{"value":"Keduanya"}]},
    {"key":"kurang_bahagia_detail","label":"Coba sharing hal-hal yang bikin kamu kurang bahagia belakangan ini.","type":"text","section":"Bahagia",
     "showIf":{"key":"bahagia","in":["Sangat Tidak Bahagia","Tidak Bahagia"]}},

    {"key":"apresiasi_lintas","label":"Adakah rekan kerja di luar divisimu yang ingin kamu apresiasi?","type":"choice","section":"Apresiasi",
     "options":[{"value":"Ya"},{"value":"Tidak"}]},
    {"key":"appreciated_names","label":"Siapa rekan kerja di luar divisimu yang ingin kamu apresiasi?","type":"text","section":"Apresiasi",
     "showIf":{"key":"apresiasi_lintas","in":["Ya"]}},
    {"key":"apresiasi_lintas_alasan","label":"Tindakan atau bantuan apa yang membuatmu ingin mengapresiasi mereka?","type":"text","section":"Apresiasi",
     "showIf":{"key":"apresiasi_lintas","in":["Ya"]}},

    {"key":"saran_bantuan","label":"Adakah yang bisa kami lakukan untuk membantu mengurangi stres atau meningkatkan kebahagiaanmu?","type":"text","section":"Masukan"},
    {"key":"saran_lingkungan","label":"Menurutmu, apa yang bisa membuat lingkungan kerja kita jadi lebih baik?","type":"text","section":"Masukan"}
  ]$q$::jsonb
)
on conflict (tenant_id, key) do update
  set title = excluded.title, description = excluded.description, audience = excluded.audience,
      cadence = excluded.cadence, headline = excluded.headline, segments = excluded.segments,
      source = excluded.source, config = excluded.config, questions = excluded.questions,
      updated_at = now();

select key, title, jsonb_array_length(questions) as jumlah_pertanyaan from public.pi_surveys;
