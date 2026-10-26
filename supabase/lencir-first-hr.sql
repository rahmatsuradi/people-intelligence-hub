-- ============================================================
-- People Intelligence — AKUN HR PERTAMA (instance baru)
--
-- Tanpa baris di pi_user_roles, akun yang sudah login tetap melihat 0 baris
-- (RLS). Akun HR pertama harus diberi peran dari SQL Editor; akun berikutnya
-- dibuat dari aplikasi di /pengaturan/akses.
--
-- Langkah:
--   1. Supabase -> Authentication -> Users -> Add user -> Create new user.
--      Isi email + sandi, centang "Auto Confirm User".
--   2. Ganti dua nilai di bawah (email + nama tampilan), lalu Run.
--
-- Hasil yang benar: satu baris dengan role = hr. Kalau kosong, email salah
-- ketik atau akunnya belum dibuat di langkah 1.
-- ============================================================

insert into public.pi_user_roles (user_id, role, display_name)
select id, 'hr', 'GANTI-NAMA-TAMPILAN'
from auth.users
where email = 'GANTI-DENGAN-EMAIL-HR'
on conflict (user_id) do update set role = 'hr', display_name = excluded.display_name;

select u.email, r.role, r.display_name
from public.pi_user_roles r
join auth.users u on u.id = r.user_id;
