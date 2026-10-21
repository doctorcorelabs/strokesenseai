# Planning Detail - StrokeSense AI Lab

Dokumen perencanaan repo baru: versi AI-first dari StrokeSense
Tanggal: 20 Oktober 2026
Status: draf planning untuk persetujuan user sebelum pembangunan dimulai
Bahasa produk: Inggris (seluruh UI, copy, dan konten di dalam web)
Bahasa dokumen ini: Indonesia (dokumen kerja internal)

---

## 1. Ringkasan Eksekutif

StrokeSense di repo lama (doctorcorelabs/strokesense) adalah platform education-first: sebagian besar isinya materi edukasi (Brain Lab, halaman Learn, kuis), sedangkan fitur AI hanya lapisan penjelas tambahan (ToolCoach dan chat Neuro). Repo baru ini membalik rasionya:

- **AI-first**: minimal 70 persen modul di hub adalah tool AI yang bisa dijalankan langsung (vision, speech, motor, reasoning, document). Materi edukasi maksimal 30 persen dan hanya sebagai konteks pendukung singkat per tool.
- **UI meniru StrokeSense lama**: design system, palet, font, dan pola layout yang sama persis (lihat Bagian 5), supaya terasa sebagai keluarga produk yang sama.
- **Semua AI lewat Cloudflare Worker**: browser tidak pernah memegang kunci API. Worker adalah satu-satunya pintu ke OpenRouter dan Workers AI.
- **Deploy**: frontend statis di Netlify dari GitHub repo, dengan deploy preview per pull request dan CI sejak commit pertama.
- **Posisi produk tidak berubah soal keselamatan**: experimental learning lab, bukan alat diagnosis, skrining, atau triase. Yang berubah adalah kedalaman fitur AI-nya, bukan klaim klinisnya.

Satu kalimat intended use yang mengunci seluruh proyek:

> "An experimental learning lab that illustrates how AI techniques measure signals related to stroke education. It does not diagnose, screen for, or rule out stroke."

### Keputusan kunci yang sudah tertanam di planning ini

1. Nama yang direkomendasikan: repo `doctorcorelabs/strokesense-ai-lab`, produk **StrokeSense AI Lab** (opsi lain di Bagian 4).
2. Skor dan keputusan keselamatan selalu deterministik di kode. LLM hanya menjelaskan, berperan dalam simulasi, dan menilai jawaban bebas dengan rubrik tetap.
3. Setiap fitur AI wajib punya state "cannot analyze" yang eksplisit. Kegagalan teknis tidak pernah diganti hasil normal (pelajaran langsung dari temuan kritis Face Lab di repo lama).
4. Mode gambar untuk vision dimatikan secara default. Default-nya mode metrik: yang keluar dari browser hanya angka turunan landmark, bukan foto.
5. Consent ditegakkan di server (token bertanda tangan), bukan hanya state React seperti repo lama.

---

## 2. Konteks: Pelajaran dari Repo Lama

Planning ini sengaja dibangun di atas hasil analisis penuh repo lama (20 Oktober 2026). Yang dipertahankan, yang diperbaiki:

**Dipertahankan (terbukti bagus):**

- Stack React 19 + TypeScript + Vite, hash routing ringan, deploy Netlify.
- Worker sebagai proxy AI tunggal dengan kontrak bersama di folder `shared/`, konten kurasi server-owned, allowlist tool/id.
- Pola mode offline/prewritten guide sebagai fallback jujur saat AI tidak tersedia.
- Emergency guard berjalan sebelum consent, sebelum rate limit, dan sebelum model.
- Prinsip "AI menjelaskan, kode memutuskan": skor Simulator dan ekstraksi Document Lens lama bersifat deterministik.

**Diperbaiki sejak fondasi (bukan tambalan):**

- Face Lab lama memberi skor simetri, klasifikasi pola stroke sentral vs Bell palsy, dan lokalisasi lesi dari satu foto diam, dengan threshold hard-coded tanpa validasi. Lebih buruk lagi, kegagalan detektor diam-diam diganti landmark normal sintetis sehingga user bisa melihat hasil "simetris" karena error teknis. Di repo baru, fitur wajah dirancang ulang total (Face Symmetry Analyzer v2, Bagian 6.2).
- Dokumentasi repo lama menyangkal fitur yang sebenarnya live (README menyebut tidak ada diagnosis wajah). Di repo baru ada feature registry sebagai satu sumber kebenaran; CI gagal bila ada route live yang tidak tercatat di README dan Scope (Bagian 9.3).
- Angka klaim README basi (118 test vs 128 aktual). Di repo baru, semua angka publik harus bisa direproduksi dari test/benchmark di repo.
- CORS diperlakukan seolah autentikasi. Di repo baru anti-abuse memakai Turnstile + rate limit per fitur + consent token server.
- Tidak ada CI, tidak ada LICENSE, CSP absen. Di repo baru semuanya masuk Fase 0.

---

## 3. Positioning dan Target User

**Positioning statement (Inggris, untuk README dan landing):**

> "StrokeSense AI Lab is an experimental, AI-first playground for stroke: multimodal AI tools that let learners and clinicians explore facial symmetry, speech, movement, documents, and emergency decision-making - built for education and research, not for diagnosis."

**Target user:**

1. Mahasiswa kedokteran preklinik: mengenali tanda stroke lewat simulasi interaktif, bukan hafalan teks.
2. Koas: latihan keputusan golden hour, handover, dan membaca dokumen pulang secara terstruktur.
3. Dokter muda dan dokter umum: literasi AI klinis, mencoba dan mengkritisi kemampuan serta batas AI multimodal neurologi.
4. Perawat dan tenaga kesehatan lain: latihan FAST, eskalasi 119, komunikasi handover.
5. Caregiver dan publik yang penasaran AI: demo aman berbasis sampel sintetis.

Di luar target: pasien akut dan keluarga yang sedang menghadapi kejadian nyata. Untuk mereka satu-satunya ajakan di produk adalah telepon 119.

**Prinsip produk AI-first:**

1. Rasio minimal 70 persen AI, maksimal 30 persen edukasi. Halaman teks statis tidak dihitung sebagai modul utama.
2. AI dulu, materi mengikuti. Tiap tool AI ditemani micro-learning maksimal 150 kata dan 1 diagram. Penjelasan panjang ditautkan keluar (CDC, AHA, Kemenkes, NINDS) atau ke repo lama.
3. Tunjukkan cara AI bekerja. Setiap output wajib menampilkan confidence atau ketidakpastian, alasan singkat, dan batasannya.
4. Deterministik untuk skor, AI untuk penjelasan.
5. Label mode jujur di setiap tool: Live AI, Offline Guide, Synthetic Demo, atau Simulation.
6. Privasi sejak desain: pemrosesan gambar, suara, dan pose di browser sebisa mungkin. Yang dikirim ke server hanya teks dan metrik turunan yang disetujui user.
7. Keselamatan mendahului AI: deteksi darurat sebelum consent dan sebelum jaringan.
8. Tidak ada reassurance palsu: kegagalan selalu tampil sebagai kegagalan.

---

## 4. Opsi Nama

**Opsi A (rekomendasi)**: repo `doctorcorelabs/strokesense-ai-lab`, produk **StrokeSense AI Lab**, tagline "Experimental AI for Stroke Learning and Practice."
- Pro: meneruskan brand StrokeSense yang sudah ada; kata "Lab" memberi izin eksplisit untuk fitur eksperimental; mudah ditemukan.
- Kontra: nama panjang; perlu badge pembeda visual agar tidak tertukar repo lama.

**Opsi B**: repo `doctorcorelabs/strokesense-experiments`, produk **StrokeSense Experiments**.
- Pro: paling jujur soal status riset; nada playful untuk komunitas mahasiswa dan developer.
- Kontra: terasa kurang serius untuk dokter dan perawat; lemah bila naik kelas jadi produk publik.

**Opsi C**: repo `doctorcorelabs/strokesense-labx`, produk **StrokeSense LabX**.
- Pro: pendek, modern, mudah jadi logo dan subdomain.
- Kontra: paling jauh dari nama induk, pengenalan dari nol, generik.

Keputusan nama final ada di tangan user (lihat Bagian 14).

---

## 5. Design System UI (Meniru StrokeSense Lama)

Diambil persis dari kode repo lama (`src/styles.css`, `src/App.tsx`, `src/main.tsx`), disalin sebagai gaya, bukan menyalin kode lama apa adanya:

**Token warna:**

- Background utama: `#fafbf8`
- Teks utama: `#243b36`
- Hijau primer: `#126454`
- Hijau gelap (judul, header): `#153e34`
- Teks sekunder: `#4e5b56`
- Garis/pembatas: `#e2e8e2`
- Mint (latar panel lembut): `#eaf3ed`
- Amber (peringatan): `#814c1c`
- Merah (darurat): `#983a27`

**Tipografi:** Manrope Variable untuk display/judul, DM Sans Variable untuk isi. Keduanya self-hosted via Fontsource, tanpa request font eksternal.

**Pola layout yang dipertahankan:**

- Top bar kurus di atas header (status lab + label eksperimental).
- Site header: brand + simbol, navigasi utama berisi lab-lab, tombol Neuro/AI terpisah, tombol darurat `tel:119` selalu terlihat.
- Homepage berbentuk hub: kartu bernomor per lab (01 Brain, 02 Vision, dan seterusnya), grid highlight modul, strip darurat di bawah dengan konteks waktu.
- Halaman lab dua kolom: area kerja interaktif di kiri, panel AI (coach) di kanan.
- Footer: brand, tautan lab, tombol darurat, baris batasan produk.
- Skip link, fokus dipindah ke main saat ganti route, dukungan reduced motion.

**Perubahan dari repo lama:**

- Navigasi utama diisi tool AI (bukan halaman materi). Halaman materi lama (Learn, Quiz, Recovery panjang) tidak dibawa; diganti micro-learning per tool.
- Setiap kartu lab di hub wajib memuat label maturity (Concept / Lab / Validated, lihat Bagian 9.2) dan label mode.
- Komponen baku baru sejak Fase 0: banner darurat global, panel status "cannot analyze", panel uncertainty, badge mode AI, dan modal consent per tool.

---

## 6. Daftar Fitur yang Dikembangkan

Total 28 fitur dalam 7 kelompok: 1 flagship multimodal, 5 Vision AI, 5 Speech and Language AI, 4 Motor AI, 5 Clinical Reasoning AI, 4 Document and Data AI, dan 4 fitur platform riset AI. Ditambah fitur pendukung keselamatan yang diwarisi (FAST manual, halaman Emergency, Scope).

Tingkatan kesulitan: S (kecil, hitungan hari), M (sedang, 1-3 minggu), L (besar, 3 minggu ke atas atau butuh aset/valider khusus).

### 6.1 Flagship: Digital FAST Multimodal Lab

**Digital FAST Multimodal Lab** - "Face, speech, and arm signals in one guided session"

- **Penjelasan:** Fitur unggulan yang menggabungkan tiga modalitas pemeriksaan FAST dalam satu sesi terpandu 15-20 detik: senyum (wajah), angkat kedua lengan (pose), dan ulangi kalimat baku (bicara). Terinspirasi riset Digital FAST (arXiv 2026) dan M3 Stroke yang membuktikan fusi multimodal mengalahkan analisis satu modalitas, dan tidak ada produk terbuka yang menyediakan playground seperti ini secara transparan.
- **Cara kerja:** MediaPipe Face Landmarker dan Pose Landmarker jalan lokal di browser untuk fitur geometris wajah dan lengan; audio kalimat dikirim ke Worker (setelah consent) untuk transkripsi. Fusi ditampilkan sebagai bobot kontribusi per modalitas yang transparan dan bisa diinspeksi user, bukan vonis gabungan. Tidak ada skor komposit tunggal dan tidak ada lampu merah-kuning-hijau sebagai kesimpulan.
- **Input:** satu sesi kamera + mikrofon opt-in, atau mode demo sampel sintetis/aktor.
- **Output:** lembar observasi per modalitas (metrik, kualitas data, ketidakpastian), penjelasan AI opsional, dan penutup wajib: pemeriksaan ini tidak dapat menyingkirkan stroke.
- **Kesulitan:** L. **Fase:** 2 (setelah komponen wajah, lengan, dan bicara matang sendiri-sendiri).
- **Catatan safety:** quality gate per modalitas; modalitas yang gagal tampil sebagai "cannot analyze" dan tidak diisi modalitas lain. Gate gejala di awal: user yang sedang bergejala tidak memulai sesi, langsung diarahkan ke 119.

### 6.2 Vision AI

**1. Face Symmetry Analyzer v2** - "Measure geometry, never diagnose"

- **Penjelasan:** Redesign total Face Lab lama. Alat belajar geometri wajah yang jujur soal batasnya, bukan skrining terselubung. Dua mode dipisah tegas: Synthetic Lab Mode (default, wajah sintetis prosedural dengan ground truth diketahui, untuk demo dan belajar bagaimana pose/cahaya mengacaukan metrik) dan Photo Mode (opt-in, foto user diproses 100 persen lokal, ada tombol "Delete photo and results").
- **Cara kerja:** MediaPipe Face Landmarker lokal (478 landmark + blendshapes). Sebelum metrik dihitung, foto wajib lolos quality gate: tepat 1 wajah, ukuran wajah cukup besar, pose kepala dalam toleransi (roll dan yaw dibatasi), ketajaman (varians Laplacian), keseimbangan cahaya kiri-kanan, dan visibilitas landmark kunci. Gagal di titik mana pun menghasilkan layar "cannot analyze" dengan alasan awam spesifik dan panduan memperbaiki, tanpa metrik sama sekali. Metrik yang ditampilkan murni geometris (delta vertikal sudut mulut ternormalisasi jarak antarpupil, rasio apertura kelopak, delta tinggi alis), selalu sebagai nilai plus rentang ketidakpastian dari beberapa capture. Confidence hard-coded dilarang. Penjelasan AI opsional via Worker hanya menerima JSON angka metrik, tidak pernah foto atau landmark mentah, dan istilah diagnostik (stroke pattern, Bell palsy, lesion) masuk blocklist output server.
- **Input:** preset sintetis, atau foto/snapshot kamera (Photo Mode).
- **Output:** tiga metrik geometris + rentang, status kualitas (good / low confidence / cannot analyze), overlay landmark yang bisa dimatikan.
- **Kesulitan:** L. **Fase:** 1 (versi aman), dengan catatan keputusan user apakah masuk MVP atau ditunda ke Fase 2 (Bagian 14).
- **Yang secara eksplisit TIDAK ada lagi:** klasifikasi sentral vs perifer, lokalisasi lesi kontralateral, label "Asymmetry Detected", persentase simetri sebagai vonis.

**2. Face Dynamics Lab**

- **Penjelasan:** Perbaikan arah dari foto diam ke gerakan: wajah dinilai dari tugas dinamis (senyum, angkat alis, kerut dahi, tiup pipi) memakai blendshapes MediaPipe dari waktu ke waktu, mirip pendekatan Facial Action Coding System pada riset RMIT.
- **Cara kerja:** client-side murni. Deret waktu 52 koefisien blendshapes per tugas digambar sebagai grafik; user membandingkan kurvanya dengan kurva sintetis berlabel. Sistem tidak memberi label pola pada data user.
- **Input:** webcam opt-in per tugas, atau demo sintetis.
- **Output:** grafik deret waktu per tugas, statistik deskriptif sesi, materi edukasi kenapa penilaian klinis forehead sparing butuh gerakan.
- **Kesulitan:** M. **Fase:** 2.

**3. Eye and Gaze Tracker**

- **Penjelasan:** Laboratorium gerak mata berbasis webcam: mengajarkan apa yang dicari klinisi pada pemeriksaan mata neurologis (pursuit, saccade, gaze holding) lewat latihan terstruktur, tanpa mengklaim mendeteksi kelainan pada user.
- **Cara kerja:** Face Landmarker mode video memakai landmark iris. Kalibrasi 5-9 titik wajib di awal; error kalibrasi terlalu besar menghasilkan state "cannot calibrate" dan tes tidak dimulai. Mode latihan: smooth pursuit (target sinusoidal, ukur lag dan saccade korektif), saccade test (target melompat, ukur latensi kasar), gaze holding (rekam drift iris). Batasan dinyatakan terbuka: webcam 30 fps tidak cukup untuk karakterisasi nistagmus klinis, dan frame rate aktual user ditampilkan di hasil.
- **Input:** webcam dengan kalibrasi, atau demo landmark sintetis.
- **Output:** peta titik pandang, kurva deret waktu gerak iris berdampingan contoh sintetis berlabel, statistik deskriptif dengan penanda kualitas data.
- **Kesulitan:** L. **Fase:** 3 (paling akhir di domain vision, bergantung kematangan pipeline landmark).

**4. Visual Field and Neglect Explorer**

- **Penjelasan:** Tes klinis klasik diubah menjadi simulasi digital interaktif: cancellation test (ketuk semua target di antara distraktor), line bisection (tandai titik tengah garis), dan peripheral awareness (stimulus singkat di empat kuadran). Keunikannya: ada mode simulasi pasien dengan profil respons terprogram (misalnya ilustrasi neglect kiri) sehingga pengalaman belajar terpisah dari pengukuran diri.
- **Cara kerja:** murni frontend, skor 100 persen deterministik dan transparan (target terlewat per sisi, deviasi bisection rata-rata, akurasi per kuadran, latensi median), rubrik ditampilkan di halaman yang sama. Debrief AI opsional via Worker hanya menjelaskan konsep hemianopia vs neglect dari ringkasan skor JSON.
- **Input:** ketukan/klik target, tanda titik tengah, respons tombol kuadran.
- **Output:** peta hasil cancellation, deviasi bisection, akurasi kuadran, jalur strategi pencarian, debrief edukasi. Tidak ada label "neglect" atau "hemianopia" untuk user.
- **Kesulitan:** M. **Fase:** 1-2.

**5. Scan Explainer (Imaging Simulator Lab)**

- **Penjelasan:** Belajar membaca scan ajar lapis demi lapis, dan memahami cara kerja AI imaging komersial (e-ASPECTS Brainomix, core/penumbra/mismatch RapidAI) lewat simulasi yang bisa diutak-atik, termasuk pelajaran bahwa output antar vendor tidak bisa dipertukarkan.
- **Cara kerja:** perpustakaan kasus kurasi saja, TIDAK ada unggahan scan pasien. Kasus berupa scan sintetis prosedural (lanjutan SliceDiagram Brain Lab lama) atau contoh publik berlisensi terbuka dengan manifest lisensi per kasus. Anotasi terstruktur buatan kurator (JSON) adalah sumber kebenaran; overlay anatomi digambar dari anotasi. LLM vision via Worker hanya boleh menjelaskan berdasarkan anotasi yang diberikan dan dilarang menyebut temuan baru di luar metadata kasus. Termasuk kalkulator konsep core/penumbra/mismatch interaktif dengan slider dan kuis titik struktur.
- **Input:** pilihan kasus, lapisan overlay, ketukan kuis, pertanyaan teks tentang kasus yang dibuka.
- **Output:** citra + overlay berlapis, penjelasan per struktur, hasil kuis, label sumber dan lisensi kasus.
- **Kesulitan:** M. **Fase:** 1 (risiko paling rendah di domain vision karena tanpa data user).

### 6.3 Speech and Language AI

Infrastruktur bersama domain ini dibangun sekali: komponen AudioCapture (MediaRecorder + Web Audio, meter level, deteksi kliping), endpoint Worker `POST /api/asr` dan `POST /api/speech-judge`, audio maksimal 30 detik, diproses in-memory, tidak pernah disimpan.

**6. Dysarthria and Slurred Speech Analyzer (Speech Lab)**

- **Penjelasan:** User membacakan kalimat standar, sistem menunjukkan seberapa jelas ujaran terbaca oleh mesin dan telinga metrik akustik, sebagai latihan dan eksplorasi, bukan deteksi disartria. Bukti literatur dipakai jujur: ASR generik (Whisper) terbukti buruk pada bicara pasca-stroke sebelum fine-tuning, dan keterbatasan itu ditampilkan di UI sebagai bagian eksperimen.
- **Cara kerja:** gate gejala dulu (pelo yang sedang terjadi sekarang menghentikan analyzer dan menampilkan banner 119). Kalimat target fonetis seimbang tersedia mode Inggris dan mode Indonesia. Fitur akustik dihitung lokal (laju bicara, rasio jeda, variabilitas pitch dan intensitas). Audio dikirim ke Worker setelah consent untuk transkripsi Whisper (Workers AI sebagai jalur utama); karena kalimat target diketahui, kejelasan diukur deterministik lewat alignment transkrip ke target (word error rate + confidence per kata yang disorot).
- **Input:** rekaman suara membaca kalimat pilihan.
- **Output:** transkrip tersorot per kata, panel akustik deskriptif, perbandingan terhadap baseline rekaman user sendiri (tidak pernah terhadap norma penutur asli, untuk menghindari bias aksen).
- **Kesulitan:** L. **Fase:** 2 (fitur pertama domain ini yang dibangun karena pipa ASR-nya dipanen fitur lain).

**7. Aphasia Expression Lab**

- **Penjelasan:** Latihan menamai gambar (naming) dengan penilaian dua lapis dan tangga petunjuk, meniru praktik terapi wicara tanpa mengklaim sebagai terapi.
- **Cara kerja:** user melihat stimulus gambar, menjawab dengan suara (pipa ASR fitur 6) atau mengetik (status setara). Lapis deterministik menghitung jarak fonetis dan kedekatan semantik dari daftar relasi kurasi. Lapis LLM via Worker mengklasifikasikan jenis kesalahan secara eksperimental (parafasia semantik, parafasia fonemik, neologisme, sirkumlokusi) dengan rubrik tetap, temperature 0, dan konteks hasil lapis deterministik agar tidak mengarang. Transkrip selalu bisa dikoreksi user sebelum penilaian akhir. Bila meleset, cue bertingkat: semantik, bunyi awal, lalu pilihan ganda.
- **Input:** stimulus gambar, jawaban suara/teks.
- **Output:** penilaian benar/dekat/meleset, label jenis kesalahan berlabel "experimental", petunjuk, jawaban model via TTS lokal, statistik latihan.
- **Kesulitan:** M. **Fase:** 2.

**8. Aphasia Communication Mode**

- **Penjelasan:** Fitur riset paling bernilai guna di domain ini, berbasis bukti R-SPEAK (JMIR 2026) dan studi La Trobe (GPT-4o merekonstruksi benar 80 persen ujaran afasia dari AphasiaBank): user mengetik atau mengucapkan fragmen, LLM menawarkan 2-3 rekonstruksi kalimat, user memilih atau mengoreksi, lalu hasil dibacakan TTS.
- **Cara kerja:** Worker memanggil LLM dengan prompt terbatas pada rekonstruksi; tidak ada rekonstruksi yang dianggap benar sebelum user mengonfirmasi (konfirmasi user adalah ground truth-nya). Riwayat koreksi menjadi data evaluasi faithfulness internal.
- **Input:** fragmen teks atau suara.
- **Output:** kandidat rekonstruksi yang bisa dipilih/diedit, tombol putar TTS.
- **Kesulitan:** M. **Fase:** 2.

**9. Interactive Comprehension Check**

- **Penjelasan:** Latihan memahami perintah lisan bergaya token test: dengar perintah audio, respons dengan sentuhan (tunjuk objek, jalankan perintah satu langkah lalu dua langkah, jawab ya/tidak dari cerita pendek).
- **Cara kerja:** audio perintah memakai speechSynthesis lokal (nol unggahan, nol server). Skoring 100 persen deterministik di client. Generator perintah AI bersifat opsional dan dibatasi allowlist objek/aksi yang bisa dieksekusi di layar, divalidasi skema sebelum dipakai. Sesi dimulai volume check dan tugas familiarisasi agar kegagalan teknis tidak terbaca sebagai kegagalan memahami.
- **Input:** respons sentuh.
- **Output:** ringkasan per jenis tugas dan waktu respons, dinyatakan sebagai observasi latihan.
- **Kesulitan:** S (M bila generator AI aktif). **Fase:** 1 (fitur termurah dan teraman di domain speech, kandidat rilis awal).

**10. Speech-to-NIHSS Language Item Assistant**

- **Penjelasan:** Alat latihan mahasiswa untuk item bahasa NIHSS versi training, bukan alat pakai klinis. Melengkapi NIHSS Co-Pilot Trainer (Bagian 6.5) dari sisi bicara.
- **Cara kerja:** user memilih kasus simulasi dengan profil keparahan bahasa yang ditulis penulis kasus; kunci skor referensi (0-3) tetap milik penulis kasus, tidak pernah ditentukan AI. LLM hanya boleh memparafrasekan respons dari bank respons kasus dalam batas profil keparahan. Mahasiswa membaca kartu kalimat lewat mikrofon (ASR mentranskripsikan, bisa dikoreksi), menulis skor dan justifikasi, lalu LLM memberi umpan balik atas justifikasi dengan rubrik jangkar NIHSS sebelum kunci dibuka.
- **Input:** pilihan kasus, bacaan lisan, skor + justifikasi tertulis.
- **Output:** perbandingan skor vs referensi, penjelasan selisih, draf kalimat dokumentasi yang bisa diedit.
- **Kesulitan:** M. **Fase:** 2. Catatan lisensi: kartu latihan diparafrasekan, bukan reproduksi verbatim materi NIHSS berlisensi.

### 6.4 Motor AI

Infrastruktur bersama: quality gate pra-sesi (visibilitas landmark, kecerahan, subjek penuh dalam frame), smoothing anti-jitter (One Euro filter), normalisasi ke proporsi tubuh user sendiri, sampling 15-30 fps dengan frame gagal dicatat sebagai gap (bukan interpolasi), gate gejala di awal, dan bahasa output yang dikunci ke kata observasi (dilarang: normal, sehat, aman, lulus).

**11. Arm Drift Quantifier**

- **Penjelasan:** Pengembangan langsung Movement Lab lama (yang metriknya cuma tinggi wrist relatif bahu) menjadi pengukuran drift lengan terkuantifikasi.
- **Cara kerja:** MediaPipe PoseLandmarker lokal, protokol terpandu: kedua lengan diangkat ke depan setinggi bahu, tahan 10 detik, timer visual memandu. Metrik per sisi: sudut elevasi lengan terhadap horizontal bahu, penurunan drift (derajat dan derajat per detik), deviasi lateral ternormalisasi lebar bahu, dan indeks asimetri deskriptif. Dinyatakan eksplisit: pose tracking tidak mengukur pronasi secara andal, jadi pronation drift tidak diklaim, dan tidak ada skor NIHSS.
- **Input:** video kamera opt-in (duduk/berdiri), atau demo sintetis pola simetris vs drift satu sisi.
- **Output:** grafik deret waktu dua sisi dengan area gap dan pita variabilitas, angka drift per sisi, indeks asimetri, indikator kualitas sesi (persen frame valid).
- **Kesulitan:** M. **Fase:** 1 (paling banyak mewarisi Movement Lab lama).

**12. Finger Tapping and Hand Dexterity Test**

- **Penjelasan:** Mengukur kecepatan, ritme, dan konsistensi ketukan ibu jari ke telunjuk, tugas motorik halus klasik yang selama ini hanya diamati mata.
- **Cara kerja:** MediaPipe HandLandmarker lokal, satu tangan per giliran, 10 detik per tangan. Sinyal jarak ujung ibu jari ke telunjuk dinormalisasi ukuran tangan; ketukan dideteksi dengan ambang ganda (hysteresis) agar jitter tidak terhitung ganda. Metrik: frekuensi (Hz), koefisien variasi interval antar ketukan, amplitudo, kemiringan kelelahan paruh pertama vs kedua, jumlah jeda ragu, indeks asimetri kiri-kanan. Keputusan desain keras: tidak ada tabel nilai normal populasi, angka tidak pernah dibandingkan ke norma.
- **Input:** video kamera opt-in satu tangan, atau demo sintetis.
- **Output:** grafik jarak jari dengan penanda ketukan (bisa diputar ulang dan diaudit user), angka per tangan, panel banding kiri-kanan.
- **Kesulitan:** M. **Fase:** 2.
- **Yang tidak diklaim:** bukan tes bradikinesia, bukan skor UPDRS; kelambatan bisa berasal dari nyeri sendi, kelelahan, artritis, dan itu tertulis di hasil.

**13. Sit-to-Stand and Balance Lab**

- **Penjelasan:** Dua tugas motorik kasar: bangkit dari kursi berulang (protokol edukasi mirip 30-second chair stand) dan berdiri diam untuk analisis goyangan tubuh (sway).
- **Cara kerja:** PoseLandmarker seluruh tubuh dalam frame. Repetisi dihitung dari transisi sudut pinggul; metrik: jumlah repetisi 30 detik, waktu bangkit rata-rata, condong batang tubuh maksimum. Sway memakai proksi titik tengah kedua pinggul: panjang lintasan, RMS, kecepatan sway. Batasan wajib dinyatakan: kamera 2D tidak mengukur pusat tekanan kaki dan proksi pinggul bukan pusat massa sesungguhnya; bukan skor Berg Balance atau Romberg, bukan penilaian risiko jatuh.
- **Input:** video kamera opt-in seluruh tubuh dari jarak 2-3 meter, atau demo sintetis.
- **Output:** grafik sudut pinggul dengan penanda repetisi, plot sebaran sway, angka deskriptif + catatan kualitas.
- **Kesulitan:** L. **Fase:** 3 (terakhir, karena risiko fisiknya).
- **Safety fisik khusus:** instruksi wajib kursi/dinding dalam jangkauan tangan, larangan melakukan sub-tugas keseimbangan tanpa pendamping bagi yang tidak stabil, tombol stop besar, sesi berhenti otomatis bila landmark tubuh hilang total (tanpa menyimpulkan penyebabnya).

**14. FAST Vision Check (Experimental Guided Flow)**

- **Penjelasan:** Alur pemeriksaan kamera terpandu satu sesi yang merangkai langkah wajah (dari fitur 1/2), lengan (fitur 11), dan opsional tangan (fitur 12), ditutup panduan tindakan (Time). Ini orkestrasi sesi, bukan model baru, dan merupakan versi alur dari flagship untuk user yang mau format FAST terpandu langkah demi langkah.
- **Cara kerja:** tiga model MediaPipe dijalankan bergantian (bukan bersamaan, terlalu berat untuk HP kelas menengah), model ditutup tiap ganti langkah. Langkah bicara hanya prompt membaca yang diputar ulang untuk didengar user sendiri dan dilabeli "tidak dianalisis". Aturan terpenting: tidak ada skor gabungan. Hasil akhir adalah lembar observasi per langkah.
- **Input:** satu sesi kamera berkelanjutan 2-3 langkah, persetujuan singkat tiap ganti model, atau demo sintetis penuh.
- **Output:** ringkasan sesi satu halaman per langkah (metrik, kualitas data, timestamp), hanya hidup di memori dan bisa diunduh user dari perangkatnya sendiri.
- **Kesulitan:** L. **Fase:** 2 (versi dua langkah wajah + lengan lebih dulu).

---

### 6.5 Clinical Reasoning AI

Prinsip bersama domain ini: semua kasus pasien fiktif sintetis; kunci jawaban dan rubrik disimpan di server, bukan dihasilkan bebas oleh LLM; setiap vignette lolos validasi klinis terhadap guideline (AHA/ASA, materi NIHSS, StatPearls) dan dibekukan versinya sebelum masuk bank kasus; LLM tidak boleh mengubah fakta kunci kasus (onset, last known well, gula darah, temuan defisit) di tengah sesi.

**15. NIHSS Co-Pilot Trainer**

- **Penjelasan:** Melatih penilaian NIHSS item per item pada pasien simulasi, tanpa pernah menskor pasien asli. Terinspirasi arah riset NIHSS Plus (animasi menggantikan video pasien lama) dan pelatihan NIHSS berbasis video.
- **Cara kerja:** Mode latihan per item atau ujian penuh 15 item. Sistem menampilkan vignette terstruktur plus transkrip respons pasien dan, bila tersedia, klip aktor terlatih atau avatar animasi yang memerankan defisit dari bank rekaman tervalidasi (bukan generate AI per sesi). User memilih skor per item dan menulis alasan. Perbandingan skor dengan kunci bersifat deterministik; LLM via Worker hanya menjelaskan selisih (temuan yang terlewat, jebakan klasik per item, misalnya membedakan skor 1 dan 2 pada Motor Arm) dengan mengutip definisi resmi item yang disuntikkan server. Hasil akhir berupa peta selisih per item, bukan hanya total, agar pola kesalahan user terlihat.
- **Input:** pilihan skor per item, alasan singkat.
- **Output:** skor user vs kunci per item, total, peta selisih, penjelasan AI, rekomendasi item untuk diulang.
- **Kesulitan:** L (bank video/avatar per defisit adalah aset termahal di seluruh proyek). **Fase:** 2.

**16. Stroke Code Simulator**

- **Penjelasan:** Penerus Simulator repo lama yang statis, kini generatif tapi terkendali: melatih alur keputusan akut (kenali onset, tetapkan last known well, aktivasi stroke code, nalar jendela reperfusi) dalam skenario yang dirakit dari templat tervalidasi. Di literatur, pola agen multi-peran seperti ini dipakai Viz Assist untuk koordinasi; di sini dipakai untuk latihan.
- **Cara kerja:** Mesin kasus merakit vignette dari templat dengan parameter acak terkendali (tingkat kesulitan: klasik, wake-up stroke, penyulit seperti antikoagulan atau operasi baru). Yang acak adalah kombinasi parameter, bukan fakta karangan LLM. Keputusan user bertahap dan terstruktur; kalkulator deterministik menghitung semua interval waktu (onset ke tiba, last known well ke needle hipotetis) dan keberadaan kontraindikasi yang ditanam. LLM berperan ganda secara terbatas: narator yang menyajikan templat tanpa menambah fakta baru (Worker memvalidasi tidak ada entitas klinis baru di narasi) dan examiner yang menilai alasan serta kualitas handoff user berdasarkan rubrik. Keputusan kritis dinilai deterministik lebih dulu dan AI tidak bisa membalikkannya.
- **Input:** pilihan keputusan per langkah, alasan, draf handoff opsional.
- **Output:** skor per langkah, linimasa kasus dengan interval terhitung, kunci keputusan ideal, transkrip penilaian examiner, ringkasan jebakan kasus.
- **Kesulitan:** L. **Fase:** 1-2 (versi dasar templat tetap di akhir Fase 1, examiner penuh di Fase 2).

**17. Stroke Mimic Detective**

- **Penjelasan:** Melatih membedakan stroke asli dari penirunya, keterampilan yang menentukan ketepatan aktivasi jalur stroke. Empat mimic inti rilis pertama: hipoglikemia, Todd paresis, migrain dengan aura, dan gangguan neurologis fungsional.
- **Cara kerja:** User menerima kasus defisit fokal akut dari bank kasus (campuran stroke asli dan mimic), mengumpulkan petunjuk lewat pertanyaan pilihan terbatas (misalnya "periksa gula darah", "tanya riwayat kejang"), lalu mengklasifikasikan. Penilaian deterministik: kebenaran klasifikasi, mimic spesifik, dan petunjuk penentu yang wajib ditemukan (dengan penalti bila melewatkan pemeriksaan keselamatan dasar seperti gula darah). Sebagian kasus sengaja dirancang berjawaban benar "belum dapat dipastikan tanpa pencitraan", dan rubrik memberi nilai penuh pada eskalasi yang aman, bukan hanya label diagnosis. AI berperan tutor Socrates: bertanya petunjuk apa yang mengubah keputusan user dan menunjukkan jebakan kognitif (anchoring, premature closure) berdasarkan tabel petunjuk server.
- **Input:** pilihan petunjuk, klasifikasi akhir, alasan.
- **Output:** diagnosis kunci, tabel perbandingan petunjuk pendukung vs penentu, skor proses, refleksi AI.
- **Kesulitan:** M (mesinnya satu pola berulang; pekerjaan beratnya menulis dan meninjau bank kasus). **Fase:** 1.

**18. Localization Challenge**

- **Penjelasan:** Permainan lokalisasi lesi vaskular: dari pola defisit, tebak sisi, tingkat, dan teritori arteri, lalu periksa jawaban di peta otak 3D.
- **Cara kerja:** Kasus dari bank tervalidasi dalam format temuan terstruktur (distribusi defisit motorik, bahasa, visual, tanda kortikal, tanda batang otak/serebelum). Jawaban dua lapis: sisi + tingkat (kortikal, subkortikal, batang otak, serebelum), lalu teritori spesifik (divisi MCA, ACA, PCA, lenticulostriate, basilar, dan seterusnya). Skor parsial deterministik per lapis dari tabel temuan-ke-teritori server. Peta otak 3D menyorot teritori kunci dan memutar ulang tiap temuan untuk menunjukkan konsistensinya. AI menjadi tutor neuroanatomi yang hanya boleh menjelaskan dari tabel server dan memilih kasus remedial dari bank berdasarkan pola kesalahan. Mode lanjutan: sindrom lakuner klasik dan kasus jebakan (lesi subkortikal menyerupai kortikal, crossed signs).
- **Input:** pilihan sisi/tingkat/teritori, penjelasan opsional, tingkat keyakinan.
- **Output:** teritori kunci tersorot di 3D, skor parsial, matriks konsistensi temuan, penjelasan AI, kasus remedial.
- **Kesulitan:** M (aset 3D dan data teritori dipakai ulang dari Brain Lab). **Fase:** 1.

**19. Virtual Patient OSCE**

- **Penjelasan:** Pasien virtual LLM multi-giliran untuk latihan anamnesis dan komunikasi bergaya OSCE, mengikuti pola yang terbukti di literatur (MedSimAI di 3 sekolah kedokteran dengan 410 mahasiswa, OSCEai McMaster): termasuk pasien afasia dan caregiver sebagai lawan bicara.
- **Cara kerja:** Kasus fiktif terkurasi di server. User mewawancarai pasien lewat teks (mode suara via ASR/TTS opsional). Penilaian dua lapis: checklist history-taking deterministik (apakah user menanyakan onset, last known well, obat antikoagulan, riwayat relevan) dan LLM-as-judge untuk kualitas komunikasi dengan rubrik tetap. Pasien virtual dilarang keluar dari fakta kasus; pertanyaan di luar kasus dijawab templat "tidak tersedia dalam kasus ini".
- **Input:** pertanyaan user per giliran, ringkasan/diagnosis kerja di akhir sesi.
- **Output:** skor checklist, feedback komunikasi terstruktur, transkrip beranotasi (pertanyaan kunci yang terlewat ditandai).
- **Kesulitan:** M-L. **Fase:** 2.

### 6.6 Document and Data AI

Prinsip bersama domain ini: komponen bersama dibangun sekali (consent per pengiriman, PiiGuard lokal, validasi verbatim/substring, pemeriksa sitasi pasca-generasi); tidak ada penyimpanan dokumen/teks/hasil di server atau localStorage; tanggal relatif tidak pernah dikonversi menjadi tanggal kalender; guard darurat 119 berjalan sebelum semua pipa.

**20. Discharge Lens AI**

- **Penjelasan:** Versi AI beneran dari Document Lens lama yang ekstraksinya masih kurasi manual atas 2 sampel. Kali ini model yang mengekstrak, tetapi setiap fakta wajib menunjuk baris sumbernya.
- **Cara kerja:** Pipeline 6 tahap. (1) Intake dengan consent per dokumen; pilihan sampel sintetis bawaan atau dokumen user. (2) Pre-processing lokal: resize, grayscale, kontras, dan tool crop/redaction manual yang membakar kotak hitam ke piksel. (3) OCR dua jalur: default lokal dengan Tesseract.js (WASM, eng+ind) sehingga foto tidak keluar perangkat dan yang dikirim ke Worker hanya teks bernomor baris; jalur vision LLM via Worker hanya sebagai opt-in eksplisit bila confidence OCR rendah atau tulisan tangan. (4) Ekstraksi LLM dengan JSON schema ketat (obat, jadwal kontrol, tanda bahaya, catatan aktivitas), field tidak ada wajib null, setiap fakta wajib membawa `source_line_ids`. (5) Validasi deterministik: nama obat dan jadwal harus lolos cek verbatim terhadap baris yang disitir, gagal berarti status `unverified` tampil berpenanda, bukan dibuang diam-diam; dosis disimpan sebagai teks asli dan hanya diparse bila cocok pola standar. (6) Render sitasi per baris: klik fakta menyorot baris sumber.
- **Input:** 1 foto/PDF dokumen (sintetis atau milik user sesudah redaksi), pilihan bahasa dokumen.
- **Output:** kartu fakta terstruktur bersitasi, penanda `uncertain` dan `unverified`, daftar baris tak terbaca, pertanyaan siap pakai untuk tim perawatan (template statis), tombol "Clear document".
- **Kesulitan:** L. **Fase:** 1 untuk sampel sintetis + upload 1 halaman via jalur vision; OCR lokal menyusul Fase 2.
- **Risiko tertinggi di domain ini:** dokumen pulang asli adalah rekam medis. Mitigasi berlapisnya: default lokal, detektor pola PII lokal yang memperingatkan sebelum upload, Worker stateless total (tanpa log payload), tanpa retry otomatis, banner permanen "Extraction can be wrong - always check against the original paper".

**21. Risk Factor Extractor**

- **Penjelasan:** Mengubah teks riwayat bebas menjadi profil faktor risiko terstruktur yang bisa diverifikasi, tanpa pernah menghitung risiko.
- **Cara kerja:** User mengetik/menempel riwayat (tersedia 3 contoh fiktif). Pra-cek PII lokal memblokir pengiriman bila ada pola nama, NIK, telepon, atau tanggal lahir, dengan tombol redaksi di sisi klien. LLM di Worker mengisi profil tetap 10 faktor (hipertensi, diabetes, fibrilasi atrium, merokok, dislipidemia, stroke/TIA sebelumnya, obesitas, inaktivitas, alkohol, riwayat keluarga); setiap faktor wajib berstatus (`present`, `absent_stated`, `not_mentioned`) plus `evidence_span` yang harus substring persis dari teks user, divalidasi deterministik. Perlakuan negasi adalah inti klinisnya: "no history of diabetes" harus jadi `absent_stated`, "father had a stroke" masuk riwayat keluarga, bukan pasien. Tanpa skor, tanpa persentase, tanpa stratifikasi: panel bawah hanya kartu edukasi statis per faktor terdeteksi.
- **Input:** teks riwayat maksimal 2.000 karakter (EN/ID) atau contoh fiktif.
- **Output:** tabel profil 10 faktor dengan kutipan bukti yang bisa diklik untuk menyorot kalimat asal, daftar eksplisit faktor yang tidak disebut.
- **Kesulitan:** M (butuh golden set minimal 30 riwayat sintetis dwibahasa dengan target akurasi status per faktor di atas 90 persen). **Fase:** 2.

**22. Guideline Navigator**

- **Penjelasan:** Tanya jawab guideline dengan jawaban terikat sitasi: satu-satunya fitur RAG di produk ini, dan kesengajaannya dibatasi keras.
- **Cara kerja:** Korpus bukan unggahan guideline utuh (hak cipta AHA/ESO), melainkan 150-300 "kartu bukti" berisi satu klaim yang diparafrasekan dengan kata sendiri plus metadata sitasi lengkap (penerbit, dokumen, seksi, tahun versi, tanggal akses). Retrieval di MVP tanpa vector database: skor kata kunci terstruktur + BM25 sederhana di memori Worker atas kartu, deterministik dan mudah diaudit. LLM hanya menerima 3-5 kartu hasil retrieval dan wajib: memakai hanya isi kartu, mengakhiri setiap kalimat faktual dengan penanda kartu, dan menjawab dengan template penolakan tetap bila kartu tidak menjawab. Pemeriksaan sitasi pasca-generasi di Worker: bila penanda valid terlalu sedikit, jawaban model dibuang dan diganti daftar kartu mentahnya (degradasi aman). Mode offline menampilkan kartu yang sama tanpa parafrase AI.
- **Input:** 1 pertanyaan edukasi (EN; ID diterima, jawaban EN) atau pilihan topik.
- **Output:** jawaban 1-3 paragraf bersitasi per klaim yang bisa diklik ke kartu sumber, label tanggal review terakhir korpus.
- **Kesulitan:** L, dan leher botolnya konten: sekitar 60 persen pekerjaan adalah menulis dan meninjau kartu bukti, 40 persen kode. Jalur konten bisa dimulai paralel sejak Fase 1. **Fase:** 2.

**23. Plain-Language Translator**

- **Penjelasan:** Menyederhanakan teks medis menjadi Plain English tingkat baca kelas 6-8, dengan opsi Bahasa Indonesia awam sebagai satu-satunya pengecualian berbahasa Indonesia di produk ini (dinyatakan eksplisit di UI).
- **Cara kerja:** Sebelum parafrase, Worker menjalankan pass ekstraksi untuk mengunci elemen yang tidak boleh berubah: angka, dosis, satuan, tanggal, nama obat, istilah glosarium. LLM menulis ulang memakai padanan awam dari glosarium istilah stroke dwibahasa terkurasi, menjaga urutan paragraf, dilarang menambah fakta atau saran. Verifikasi deterministik sesudah generasi: himpunan angka + satuan dan nama obat di output harus identik dengan daftar terkunci; selisih apa pun membuat hasil ditolak dan user ditawari tampilan berdampingan dengan sorotan perubahan, bukan teks yang sudah bergeser angkanya. Output selalu side-by-side dengan teks asli yang tidak pernah disembunyikan.
- **Input:** teks maksimal 3.000 karakter atau contoh sintetis, pilihan bahasa target.
- **Output:** teks sederhana berdampingan, daftar istilah yang disederhanakan, lencana hasil verifikasi ("All numbers and medicine names checked unchanged" atau peringatan selisih).
- **Kesulitan:** S-M (fitur termudah di domain ini; dibangun pertama untuk memvalidasi pipa PII dan verifikasi angka). **Fase:** 1.

### 6.7 Platform Riset AI

**24. Model Experiment Bench**

- **Penjelasan:** Pembeda riset yang tidak ditawarkan produk komersial mana pun: bangku uji publik untuk menjalankan kasus sintetis yang sama ke 2-3 model atau prompt berbeda, membandingkan jawaban, dan menandai halusinasi serta pelanggaran guardrail secara terbuka.
- **Cara kerja:** Worker menjalankan kasus dari bank uji tetap ke model terpilih (lewat OpenRouter, `allow_fallbacks: false`), menampilkan jawaban berdampingan dengan sorotan otomatis untuk pola terlarang (dosis, nomor darurat asing, klaim diagnosis) dan skor rubrik. Log evaluasi disimpan sebagai artefak riset anonim (tanpa data user).
- **Input:** pilihan kasus uji, pilihan model/prompt.
- **Output:** perbandingan jawaban, daftar pelanggaran per model, skor rubrik, catatan evaluasi yang bisa diterbitkan.
- **Kesulitan:** M. **Fase:** 2-3.

**25. Privacy Shield**

- **Penjelasan:** Demo sekaligus kebijakan default privasi visual: sebelum data visual apa pun dibagikan atau ditampilkan, wajah diganti mesh landmark/blur, dan user bisa melihat perbandingan persis data apa yang keluar perangkat pada tiap mode pemrosesan. Terinspirasi pendekatan de-identifikasi video SafeTriage (2025).
- **Cara kerja:** client-side. Panel "What leaves your device" per fitur: frame mentah (tidak pernah, kecuali mode dokumen yang di-consent), landmark (lokal), metrik angka (hanya dengan consent AI). Menjadi fondasi yang dipakai semua fitur kamera.
- **Input:** mode demo dengan kamera atau sampel.
- **Output:** visualisasi perbandingan data per mode.
- **Kesulitan:** S. **Fase:** 0-1 (dibangun sebagai fondasi, ditampilkan sebagai fitur edukasi privasi).

**26. Adaptive AI Tutor**

- **Penjelasan:** Tutor yang menyesuaikan latihan dengan pola kesalahan user di simulator, kuis, dan challenge: pertanyaan lanjutan dan kasus remedial dipilih berdasarkan kesalahan yang tercatat deterministik, bukan dari profil yang disimpan di server.
- **Cara kerja:** riwayat hanya di memori sesi. Mesin rekomendasi memilih dari bank kasus berdasarkan tag kesalahan (misalnya selalu over-score item bahasa, selalu melewatkan gula darah pada mimic); LLM hanya menyusun narasi umpan balik dan rencana latihan sesi itu.
- **Input:** riwayat sesi berjalan.
- **Output:** rekomendasi latihan berikutnya, ringkasan pola kesalahan sesi.
- **Kesulitan:** M. **Fase:** 2.

**27. Evaluation and Transparency Dashboard**

- **Penjelasan:** Halaman transparansi publik berisi hasil benchmark internal yang bisa direproduksi: recall guard darurat pada set parafrase, tingkat penolakan pertanyaan berbahaya, latensi AI, dan tingkat cannot-analyze per fitur.
- **Cara kerja:** angka dibangkitkan dari artefak evaluation harness di repo (Bagian 9.4), bukan diketik manual, untuk menghindari angka basi seperti di repo lama.
- **Input:** artefak benchmark repo.
- **Output:** halaman publik + ringkasan per rilis fase.
- **Kesulitan:** S-M. **Fase:** 2-3.

### 6.8 Fitur Pendukung yang Diwarisi (Bukan Fitur AI Utama)

- **Manual FAST Check**: wizard FAST manual pola repo lama (satu jawaban yes/unsure langsung eskalasi 119, hasil negatif tidak pernah menenangkan).
- **Emergency page**: hero 119, checklist serah terima, lokasi opt-in, direktori fasilitas terbatas yang disajikan jujur (bukan klaim live/terdekat).
- **Scope and Privacy page**: ditulis sejak Fase 0 dan dibangkitkan/diverifikasi dari feature registry, mencantumkan semua fitur yang benar-benar ada.
- **Brain Lab 3D**: dibawa sebagai konteks pendukung (dipakai ulang Localization Challenge) dengan perbaikan dari analisis lama: hapus meter penumbra persen dan label jendela tPA yang menyerupai eligibilitas, dan samakan klaim render dengan implementasi.

---

## 7. Arsitektur Sistem

### 7.1 Diagram teks

```
[ Browser - Netlify static ]
  React 19 + Vite SPA (hash routing)
  |
  |-- ML lokal di browser (tanpa server):
  |     MediaPipe Face / Pose / Hand Landmarker (WASM lokal, model self-hosted)
  |     Tesseract.js OCR (jalur default Discharge Lens)
  |     Fitur akustik Web Audio, overlay landmark, metrik geometri lokal
  |
  |-- Semua AI generatif lewat satu pintu:
  v
[ Cloudflare Worker - strokesense-ai-api ]
  1. Turnstile verify
  2. CORS check (lapisan browser saja, BUKAN auth)
  3. Consent token check (JWT pendek bertanda tangan server)
  4. Rate limiter per fitur + per IP (Durable Object per fitur)
  5. Validasi skema ketat (allowlist field, batas ukuran)
  6. Emergency guard (regex EN/ID diperluas, normalisasi whitespace)
  7. Redaksi PII (email, telepon, NIK, tanggal lahir, pola RM)
  8. Router model per fitur
  |
  |----> [ OpenRouter ] model teks dan vision (utama)
  |----> [ Cloudflare Workers AI ] tugas sempit: Whisper, tools, klasifikasi
  |
  |-- Penyimpanan minimal:
  |     KV    : cache jawaban edukasi statis, flag fitur/kill switch, sesi (TTL 24 jam)
  |     D1    : log audit anonim (hash sesi, fitur, token, tanpa isi pesan), catatan consent
  |     R2    : HANYA aset (model .task, sampel sintetis). Bukan data user.
  |     Durable Objects: token bucket per fitur
  v
[ Respons: JSON, atau streaming SSE khusus chat/penjelasan panjang ]
```

Pembagian tanggung jawab yang tegas: browser ML boleh menghitung landmark dan metrik, tidak boleh menyimpulkan diagnosis dan tidak mengirim frame mentah secara default. Worker boleh memvalidasi, menjaga, meredaksi, memilih model, dan mensanitasi output; tidak boleh menyimpan isi percakapan mentah dan tidak mempercayai history dari klien. Riwayat chat dikelola server per sesi (maksimal 6 giliran, TTL 24 jam) sehingga celah history poisoning repo lama tertutup.

### 7.2 Kontrak API per jenis fitur

Basis semua endpoint: POST, error seragam `{ "error": { "code", "message" } }` yang aman untuk user, `Cache-Control: no-store`, header `X-Consent-Token` dan `X-Turnstile-Token` wajib.

| Endpoint | Isi | Batas kunci | Model utama | Fallback |
|---|---|---|---|---|
| `POST /api/chat` (SSE) | `{ sessionId, message }`, history TIDAK dikirim klien | pesan maks 2.000 karakter; stream dipotong di 6.000 karakter atau 20 detik; timeout delta pertama 8 detik | OpenRouter mini (teks) | Workers AI chat kecil, lalu panduan prewritten lokal berlabel offline |
| `POST /api/vision` | `{ featureId, metrics }` (default) atau gambar (mode eksplisit per fitur) | gambar maks 2 MB, lebar maks 1024 px, JPEG/WebP, magic bytes diverifikasi, EXIF dibuang di klien; metrik maks 8 KB | OpenRouter vision mini | Penjelasan berbasis metrik saja |
| `POST /api/audio` | audio MediaRecorder (WebM/Opus/WAV) | durasi maks 30 detik, maks 1,5 MB, dinormalisasi 16 kHz, diproses lalu dibuang | Workers AI Whisper | Mode latihan tanpa skor (rekam, putar ulang, checklist manual) |
| `POST /api/tools` | `{ tool, id, context?, question? }` allowlist `shared/` | context dan question masing-masing maks 1.000 karakter; field asing ditolak | Workers AI instruksi kecil; eskalasi OpenRouter hanya untuk fitur bertanda `depth: "full"` | Panduan prewritten lokal per modul |
| `POST /api/asr`, `POST /api/speech-judge` | pipa domain speech (Bagian 6.3) | audio 30 detik; judge output JSON terstruktur, temperature 0 | Whisper + LLM judge | Transkrip bisa dikoreksi user sebelum penilaian |
| `GET /health` | liveness saja | tanpa info konfigurasi | - | - |
| `POST /api/consent`, `POST /api/session` | penerbitan consent token (JWT 2 jam, cakupan per fitur, versi teks pemberitahuan) dan sessionId server | teks pemberitahuan berubah berarti token lama gugur; `DELETE /api/consent` menghapus catatan dan riwayat sesi seketika | - | - |

Strategi model: model dipin persis (tidak ada alias melayang); OpenRouter selalu `allow_fallbacks: false` dan `data_collection: "deny"`; tidak ada retry berantai dan tidak ada ganti model diam-diam; respons darurat statis tidak pernah bergantung pada limiter, provider, atau billing. Streaming SSE hanya untuk chat/penjelasan panjang (event `meta`, `delta`, `done`, `error`); vision, audio, dan tools tetap request-response agar hasil terstruktur bisa divalidasi utuh sebelum ditampilkan.

### 7.3 Keamanan (perbaikan atas repo lama)

1. **Anti-abuse sungguhan**: Turnstile diverifikasi server-side sebelum endpoint AI mana pun. CORS tetap ketat tetapi didokumentasikan eksplisit sebagai batas browser, bukan autentikasi.
2. **Rate limit per fitur, tanpa bucket global tunggal**: satu instance Durable Object per pasangan (fitur, hash IP); kuota mengikuti mahalnya fitur (vision paling ketat, tools paling longgar); penghitung agregat hanya rem darurat biaya dengan ambang jauh lebih tinggi; token dikembalikan (refund) bila upstream gagal agar user sah tidak terpenalti ganda; hash IP memakai SHA-256 dengan salt rahasia; panggilan DO diberi timeout dan gagal tertutup untuk vision/audio, tetapi endpoint darurat dan health tidak pernah bergantung pada DO. WAF rate limiting per path diaktifkan di dashboard sebagai rem pertama.
3. **Consent server-side**: consent adalah catatan D1 + JWT bercakupan (consent chat tidak berlaku untuk pengiriman gambar), bukan state React.
4. **Redaksi PII di Worker** sebelum prompt disusun: email, telepon, NIK 16 digit, pola nomor rekam medis, tanggal lahir, URL. Nilai diganti penanda netral; yang dicatat hanya hitungan redaksi, bukan nilainya.
5. **Guard darurat diperluas**: sinonim Indonesia ditambah (bibir/mulut miring, kesemutan, baal, limbung, vertigo, pelo), sinonim Inggris ditambah (cannot smile, mouth droop, aphasia, BE-FAST), dan teks dinormalisasi dulu (newline dan spasi ganda menjadi satu spasi) agar pola multi-baris tidak lolos seperti di repo lama.
6. **Sanitasi output diperkuat**: pola repo lama (link/HTML model dibuang, sumber hanya allowlist server) ditambah saringan pola dosis obat dan nomor darurat asing.
7. **Header Netlify lengkap sejak Fase 0**: CSP (dengan pengecualian eksplisit dan minimal untuk Turnstile dan WASM MediaPipe), HSTS, nosniff, Referrer-Policy, Permissions-Policy kamera/mikrofon hanya self, dan cache immutable untuk aset ber-hash dan folder vision agar WASM tidak diunduh ulang tiap kunjungan.

### 7.4 Pipeline GitHub ke Netlify dan CI

- GitHub Actions wajib hijau sebagai syarat merge ke `main` (branch protection): job frontend (typecheck, Vitest, build), job worker (tsc, test, wrangler dry-run), job e2e (Playwright desktop + mobile melawan build lokal, termasuk axe WCAG A/AA untuk SEMUA route termasuk route vision, dan smoke WebGL nyata yang di repo lama hanya skrip manual), job audit + Dependabot.
- Netlify: `main` ke production, branch lain ke branch deploy, pull request ke deploy preview dengan URL unik. Variabel `VITE_API_BASE_URL` berbeda per konteks (Worker preview vs production) dan tidak ada rahasia selain URL publik yang boleh masuk variabel `VITE_*`.
- Lingkungan Worker terpisah (development, preview, production) dengan KV/D1 dan kunci OpenRouter terpisah per lingkungan, kunci preview dibatasi belanja rendah. Production memakai `workers_dev = false` bila sudah ada route domain khusus.
- Smoke test pasca-deploy: panggil `/health` dan satu request uji per fitur ke Worker staging sebelum promosi.

---

## 8. Struktur Repo

```
strokesense-ai-lab/
  index.html
  package.json                 # frontend saja
  vite.config.ts
  tsconfig.json
  netlify.toml
  playwright.config.ts
  LICENSE
  README.md
  .github/
    workflows/ci.yml
    dependabot.yml
  shared/
    lab.ts                     # allowlist tool/id dan sumber (pola repo lama)
    contracts.ts               # tipe request/respons chat, vision, audio, tools
    limits.ts                  # satu sumber kebenaran semua batas dan kuota
    registry.ts                # feature registry (Bagian 9.3)
  src/
    main.tsx
    App.tsx                    # hash routing
    pages/                     # pendukung ringkas: Emergency, Scope, FAST manual
    labs/
      brain/                   # Brain Lab (dipakai ulang Localization Challenge)
      face/                    # Face Symmetry Analyzer v2, Face Dynamics
      gaze/                    # Eye and Gaze Tracker, Neglect Explorer
      speech/                  # Speech Lab, Aphasia Lab, Comprehension
      movement/                # Arm Drift, Finger Tapping, Balance, FAST Vision
      reasoning/               # NIHSS Trainer, Stroke Code, Mimic, Localization, OSCE
      documents/               # Discharge Lens, Risk Extractor, Translator
      research/                # Model Bench, Privacy Shield, Dashboard
    ai/
      client.ts                # satu klien API: consent token, Turnstile, SSE
      ToolCoach.tsx
      offline.ts               # panduan prewritten lokal per fitur
    safety.ts                  # guard darurat sisi klien (cermin Worker)
  worker/
    package.json
    wrangler.toml              # binding RATE_LIMITER, KV, D1; env dev/preview/prod
    src/
      index.ts                 # routing dan komposisi handler
      auth.ts                  # Turnstile verify dan consent JWT
      ratelimit.ts             # kelas Durable Object RateLimiter
      guard.ts                 # deteksi gejala akut EN/ID
      redact.ts                # redaksi PII
      sanitize.ts              # sanitasi output model
      providers.ts             # OpenRouter dan Workers AI
      handlers/
        chat.ts
        vision.ts
        audio.ts
        tools.ts
        consent.ts
        session.ts
    test/
  e2e/
    site.spec.ts
    labs.spec.ts
  eval/
    golden/                    # dataset sintetis + datasheet per fitur
    redteam/                   # bank soal red-team
    reports/                   # laporan benchmark per rilis
  scripts/
    copy-vision-assets.mjs
  public/
    vision/                    # hasil generate WASM MediaPipe (gitignored)
    models/                    # model .task self-hosted (atau diarahkan ke R2)
```

Catatan: handler Worker dipisah per fitur (menggantikan satu file monolit 397 baris di repo lama) agar batas, model, dan uji tiap fitur bisa berubah sendiri-sendiri. Model MediaPipe di-self-host (bukan lagi diunduh dari Google tanpa pin seperti repo lama), dengan versi paket dan WASM dipin agar selalu cocok.

---

## 9. Safety, Evaluasi, dan Governance

Bagian ini adalah pagar pengaman seluruh proyek. Tiga kegagalan repo lama menjadi aturan yang tidak bisa ditawar: fallback senyap, threshold tanpa validasi, dan dokumentasi yang menyangkal fitur live.

### 9.1 Prinsip safety per fitur

1. **Cannot-analyze adalah state kelas satu.** Empat state keluaran eksplisit per fitur: `result`, `cannot-analyze` (dengan reason code: wajah tidak ditemukan, banyak wajah, cahaya kurang, oklusi, audio bising, kualitas pose rendah), `emergency`, dan `offline`. Pola catch-block yang mengembalikan data yang tampak masuk akal adalah bug kritis, bukan fallback.
2. **Uncertainty wajib tampil di samping hasil**, bukan di footer: kualitas input, confidence terkalibrasi atau label verbalnya, versi model, dan status maturity. Confidence tidak boleh konstan hard-coded.
3. **Larangan skor yang menyerupai diagnosis**: label biner abnormal/normal bergaya klinis, klasifikasi pola penyakit, lokalisasi lesi, skor NIHSS untuk pasien, probabilitas stroke personal, dan kelayakan terapi. Yang boleh: deskriptor geometris/akustik netral dengan satuan jelas plus kalimat batas.
4. **Emergency 119 selalu di depan**: banner persisten, tombol stop-and-call di dalam sesi analisis apa pun, deteksi darurat sebelum consent/limiter/model, respons statis. Asimetri harm berlaku: false negative jauh lebih berbahaya daripada false positive, semua ambang eskalasi dibias ke arah menyuruh telepon.
5. **Inti deterministik, AI hanya penjelas** (lihat prinsip produk, Bagian 3).
6. **Quality gate sebelum inferensi**: input di bawah ambang kualitas tidak dianalisis sama sekali. Ambang berasal dari laporan evaluasi, bukan angka kira-kira. Setiap threshold di kode wajib merujuk ID laporan evaluasi di threshold registry; angka tanpa rujukan gagal di review.
7. **Kill switch per fitur** dari konfigurasi Worker (flag KV) tanpa redeploy frontend. Wajib ada sebelum go-live dan diuji berkala.

Aturan per kategori: vision wajah hanya deskripsi geometris dan ketidakpastian sisi kiri-kanan (cermin) wajib dinyatakan; suara hanya metrik akustik relatif terhadap baseline bacaan yang sama dengan variasi aksen dinyatakan sebagai sumber error; gerak hanya visualisasi koordinat/lintasan dengan landmark hilang sebagai celah data; chat/coach memakai prompt terkunci server dan saringan output; dokumen hanya sintetis atau tempelan ber-consent dengan fakta terikat baris sumber; simulasi hanya skenario fiktif berlabel.

### 9.2 Label maturity per fitur

- `concept`: hanya mock/data contoh bawaan, watermark "Concept demo", tidak menerima input user asli.
- `lab`: eksperimental, boleh menerima input user dengan consent, tanpa klaim klinis, selalu disertai status evaluasi sintetisnya.
- `validated`: hanya setelah validasi klinis prospektif, persetujuan etik, dan kejelasan regulasi. Tidak ada fitur berstatus ini saat peluncuran.

Label tampil di kartu hub, header halaman fitur, dan di samping setiap output.

### 9.3 Feature registry sebagai satu-satunya sumber kebenaran

Satu file `shared/registry.ts` mencatat tiap fitur: id, route, maturity, model dan versi, jenis input, retensi, keterbatasan yang diketahui, dan tautan laporan evaluasi. README, halaman Scope, dan UI diverifikasi terhadap registry ini; CI gagal bila ada route live tanpa entri registry atau fitur di kode yang tidak disebut dokumentasi. Ini penawar langsung kegagalan repo lama.

### 9.4 Evaluation harness

- **Golden dataset sintetis** dengan ground truth diketahui persis per domain: wajah (landmark parametrik/avatar dengan magnitudo asimetri bertingkat; variasi pose, cahaya, warna kulit Fitzpatrick I-VI, usia, kacamata, oklusi, efek cermin), suara (naskah tetap dari TTS multi-suara dan relawan terkontrol dengan degradasi terukur), gerak (lintasan sendi sintetis dengan frame drop dan oklusi), dokumen (surat pulang sintetis dengan fakta tertanam, ambiguitas sengaja, kontradiksi, data hilang, anotasi emas per baris), LLM (bank soal berjawaban emas dan terlarang; skenario darurat EN/ID/campur kode, parafrase, typo, multi-baris, negasi, penyamaran fiksi). Setiap dataset punya datasheet: cara generate, distribusi subgrup, keterbatasan, dan larangan klaim. Angka performa sintetis tidak pernah disebut performa klinis.
- **Metrik dan gerbang contoh**: sensitivitas/spesifisitas gaya skrining per magnitudo (dilaporkan apa adanya), MAE geometris, kalibrasi confidence (ECE di bawah 0,05, Brier, reliability diagram), tingkat abstain total dan per subgrup (selisih antar subgrup di bawah 5 poin persen), recall eskalasi darurat 100 persen pada set uji, jawaban dosis/diagnosis 0, fakta dokumen terkarang 0. Penurunan metrik safety apa pun memblokir rilis.
- **Red-teaming wajib tiap rilis**: injeksi lewat semua field bebas dan teks dokumen, history poisoning, penyamaran darurat sebagai fiksi, bypass yang diketahui dari repo lama (gejala multi-baris, sinonim Indonesia di luar pola, karakter BiDi), permintaan kepastian menenangkan, permintaan dosis, peniruan identitas klinisi, dan pancingan PII.
- **Regresi saat ganti model**: model dipin; setiap ganti model/prompt/threshold menjalankan seluruh harness di CI dan dibandingkan dengan baseline. Rilis Worker lewat staging, smoke test live terbatas, promosi dengan rollback teruji.
- **Evaluasi manusia**: panel klinisi meninjau sampel output sebelum label maturity naik; uji salah tafsir pengguna awam (apakah mengira ini diagnosis) harus di bawah 5 persen; uji keterbacaan disclaimer Inggris sederhana, karena pengguna akhir mayoritas penutur Indonesia.

### 9.5 Regulasi dan batas klaim

- **Indonesia**: perangkat lunak yang ditujukan untuk diagnosis/skrining/pemantauan dapat dikategorikan alat kesehatan Kemenkes dan butuh izin edar; penentunya adalah intended use yang terbaca dari fungsi dan promosi, bukan disclaimer. UU Kesehatan 17/2023 mengatur teknologi kesehatan; UU PDP 27/2022 menggolongkan data kesehatan dan biometrik sebagai data spesifik (wajib DPIA untuk pemrosesan risiko tinggi, notifikasi kebocoran paling lambat 3x24 jam).
- **Global**: pengecualian Non-Device CDS FDA mensyaratkan perangkat lunak tidak memproses citra/sinyal medis, sehingga analisis foto wajah hampir pasti berpotensi device software function; EU MDR Rule 11 menempatkan perangkat lunak pemberi informasi diagnostik minimal kelas IIa; EU AI Act menggolongkan AI medis sebagai risiko tinggi.
- **Peta klaim**: Hijau (aman) = edukasi, ilustrasi geometris pada sampel sintetis, penjelasan cara pengukuran bekerja, latihan respons darurat fiktif, ringkasan dokumen sintetis. Kuning (hanya dengan label `lab`, consent, copy teraudit) = pengukuran geometris/akustik pada input user sendiri tanpa label penyakit. Merah (dilarang sampai ada validasi klinis dan kejelasan regulasi) = deteksi stroke, membedakan sentral vs perifer, lokalisasi lesi, skor NIHSS pasien, risiko personal persen, kelayakan trombolisis, pernyataan hasil normal yang menenangkan.
- **Strategi risiko terendah**: rilis awal hanya input sintetis dan contoh bawaan. Mengaktifkan unggahan biometrik user asli ke publik adalah keputusan regulasi, bukan keputusan teknis, dan didahului konsultasi regulasi.
- **Audit klaim sebagai langkah rilis**: daftar kata terlarang untuk semua copy termasuk kartu homepage dan materi promosi: diagnose, detect stroke, rule out, screen, clinical grade, accurate, dan padanannya. Disclaimer berlapis empat: banner global, peringatan sebelum input, kalimat batas menempel pada output, halaman Scope lengkap.
- **Retensi data nol**: inferensi di klien, Worker stateless, log hanya reason code dan metrik kualitas teragregasi tanpa konten, tanpa gambar/audio/transkrip/koordinat mentah di server. Uji e2e wajib menangkap lalu lintas jaringan dan membuktikan tidak ada payload biometrik keluar browser. Consent biometrik terpisah per modalitas dan per tujuan (pemrosesan di perangkat; pengiriman metrik turunan ke LLM; retensi riset yang default mati dan tidak ditawarkan di rilis awal), dengan tombol hapus sesi yang nyata dan larangan mengunggah data orang lain, pasien, atau anak tanpa hak.

---

## 10. Roadmap Fase

### Fase 0 - Fondasi (minggu 1-2)

Tujuan: kerangka repo baru siap diisi fitur AI tanpa mengulang kesalahan repo lama.

- Repo baru dibuat manual oleh user di GitHub (aplikasi GitHub Muse tidak punya izin membuat repo baru, pelajaran dari proyek sebelumnya), lalu dihubungkan ke Netlify dan dipilih untuk akses Muse.
- Struktur monorepo ringan frontend + Worker sesuai Bagian 8; CI aktif sejak commit pertama; branch protection di `main`.
- Design system disalin sebagai gaya (Bagian 5); komponen baku: banner darurat, panel cannot-analyze, panel uncertainty, badge mode/maturity, modal consent.
- Kontrak `shared/` (lab, contracts, limits, registry) dan kerangka Worker dengan Turnstile, consent token, rate limiter per fitur, guard darurat versi luas, redaksi PII.
- Scope, Privacy, LICENSE, dan file atribusi pihak ketiga ditulis sejak awal.
- Privacy Shield (fitur 25) dibangun sebagai fondasi visual kebijakan data.

Definisi selesai: CI hijau di `main`, Netlify preview jalan, Worker staging lolos health check dan smoke test satu request per endpoint, tidak ada fitur yang bisa diakses tanpa label mode dan Scope yang akurat.

### Fase 1 - MVP AI (minggu 3-6)

Tujuan: inti AI bisa dipakai end-to-end dan aman untuk demo publik terbatas (mode sintetis diutamakan).

- Face Symmetry Analyzer v2 (fitur 1, versi aman; lihat keputusan di Bagian 14).
- Arm Drift Quantifier (fitur 11).
- Scan Explainer (fitur 5).
- Visual Field and Neglect Explorer (fitur 4, inti deterministik).
- Interactive Comprehension Check (fitur 9).
- Stroke Mimic Detective (fitur 17) dan Localization Challenge (fitur 18) di atas mesin bank kasus yang sama.
- Discharge Lens AI (fitur 20, sampel sintetis + upload 1 halaman jalur vision).
- Plain-Language Translator (fitur 23).
- Stroke Code Simulator versi dasar (fitur 16, templat tetap).
- Emergency guard dwibahasa versi luas teruji dengan set parafrase; evaluation harness versi pertama untuk fitur-fitur di atas.

Definisi selesai: semua tool Fase 1 lolos unit + e2e termasuk skenario gagal teknis (cannot-analyze tampil, bukan hasil normal), tidak ada output yang menyatakan aman atau menyingkirkan stroke, README dan Scope cocok 100 persen dengan registry, dan angka benchmark awal terbit di repo.

### Fase 2 - Multimodal dan Kedalaman AI (minggu 7-12)

- Speech suite: Dysarthria and Slurred Speech Analyzer (fitur 6) membangun pipa ASR, lalu Aphasia Expression Lab (fitur 7) dan Aphasia Communication Mode (fitur 8) memanennya; Speech-to-NIHSS Language Item Assistant (fitur 10).
- Face Dynamics Lab (fitur 2); FAST Vision Check dua langkah (fitur 14); Digital FAST Multimodal Lab (flagship, 6.1) merangkai wajah + lengan + bicara.
- Finger Tapping (fitur 12).
- Clinical reasoning lanjutan: NIHSS Co-Pilot Trainer (fitur 15), Stroke Code Simulator examiner penuh (fitur 16), Virtual Patient OSCE (fitur 19).
- Document lanjutan: Risk Factor Extractor (fitur 21), Guideline Navigator (fitur 22, jalur konten korpus dimulai paralel sejak Fase 1), Discharge Lens jalur OCR lokal.
- Adaptive AI Tutor (fitur 26); Model Experiment Bench versi pertama (fitur 24); Evaluation and Transparency Dashboard (fitur 27).
- Glosarium istilah stroke Inggris-Indonesia di dalam tool (UI tetap Inggris sebagai bahasa utama).

Definisi selesai: minimal 8 tool AI aktif di hub (rasio AI-first tercapai penuh), benchmark guard dan kualitas jawaban terbit di dashboard transparansi, uji kegunaan minimal 10 user target selesai dengan temuan terdokumentasi.

### Fase 3 - Riset Terbuka dan Kesiapan Validasi (minggu 13-24)

- Eye and Gaze Tracker (fitur 3); Sit-to-Stand and Balance Lab (fitur 13); FAST Vision Check versi penuh tiga langkah.
- Dataset sintetis terbuka (wajah, suara, dokumen) lengkap dengan kartu dataset: asal, batasan, lisensi.
- Evaluation harness otomatis penuh di CI sebagai gerbang regresi.
- Mode kolaborasi pengajar: pembimbing membuat set skenario kelas dan tautan sesi latihan tanpa akun dan tanpa data mahasiswa di server.
- Audit aksesibilitas penuh WCAG AA semua route tool AI plus uji screen reader manual.
- Paket telaah institusi (tujuan, risiko, mitigasi, batas klaim) siap diserahkan untuk review etik dan klinis internal.
- Keputusan go/no-go tertulis untuk studi validasi formal.

Definisi selesai: semua artefak riset terpublikasi di repo dan ada keputusan tertulis apakah lab tetap sebagai alat edukasi riset atau dihentikan di situ.

---

## 11. Fitur yang Sengaja Tidak Dibangun

1. Diagnosis stroke dari foto, video, suara, atau scan user. Tidak ada validasi klinis; risiko false reassurance menunda pertolongan; berpotensi kategori perangkat medis.
2. Klasifikasi pola sentral vs Bell palsy dan lokalisasi lesi dari foto wajah. Forehead sparing klinis dinilai dari gerakan dan pemeriksaan langsung, bukan satu foto diam.
3. Fallback hasil normal saat detektor gagal. Kegagalan teknis yang tampil normal adalah bahaya keselamatan paling langsung.
4. Skor NIHSS klinis untuk pasien, kalkulator risiko stroke personal, estimasi prognosis. Memerlukan data terverifikasi dan validasi.
5. Rekomendasi obat, dosis, trombolisis, dan keputusan eligibilitas terapi. Wilayah tim gawat darurat dengan pencitraan, bukan AI edukasi.
6. Analisis scan pasien asli (DICOM CT/MRI, ASPECTS klinis, deteksi LVO/ICH, peta perfusi nyata) dan skrining retina. Butuh pipeline DICOM, model tervalidasi, dan jalur regulasi; menirunya dengan LLM vision pada foto scan mengulang kesalahan Face Lab dalam skala lebih besar.
7. Penyimpanan akun user, riwayat pasien, dan database medis di server. Memperbesar permukaan risiko privasi tanpa nilai belajar sepadan.
8. Integrasi rumah sakit live: ketersediaan tempat tidur, antrean IGD, routing ambulans. Data tidak tersedia andal; klaim live yang basi lebih berbahaya daripada tidak ada.
9. Chat AI bebas tanpa guard dan tanpa allowlist topik. Permukaan halusinasi terlalu besar; AI hanya bekerja di dalam tool berkonteks terkunci.
10. Klaim pemasaran berbau deteksi atau skrining, dalam copy apa pun.

---

## 12. Metrik Sukses

**Keselamatan (gerbang, harus nol pelanggaran):** nol output yang menyatakan user aman/menyingkirkan stroke pada regresi berkala; 100 persen skenario gagal teknis menampilkan status gagal eksplisit; recall guard darurat pada set parafrase EN/ID minimal 95 persen (target harness internal 100 persen pada set uji inti) dengan semua kegagalan tercatat dan ditinjau; nol kebocoran data pada audit privasi berkala.

**Kualitas AI:** minimal 90 persen jawaban AI lolos rubrik peninjauan internal pada benchmark tetap; penolakan/pengalihan aman untuk pertanyaan di luar scope 100 persen pada set uji; latensi AI median di bawah 5 detik di jaringan normal, mode offline selalu tersedia.

**Belajar dan keterlibatan:** minimal 70 persen sesi hub membuka sedikitnya satu tool AI; kenaikan skor pre/post skenario simulator yang sama minimal 20 persen pada kohort uji kegunaan; minimal 10 user target per fase uji, tugas selesai tanpa bantuan minimal 80 persen.

**Riset dan reproduksibilitas:** 100 persen angka di README dan halaman transparansi bisa direproduksi dari test/benchmark repo; setiap rilis fase punya catatan evaluasi tertulis; dataset sintetis dan harness bisa dijalankan ulang pihak luar hanya dari instruksi repo; uji pemahaman: minimal 85 persen user uji menyatakan kembali dengan benar bahwa produk ini bukan alat diagnosis setelah memakai satu tool; uji salah tafsir di bawah 5 persen.

---

## 13. Risiko Utama dan Mitigasi

| Risiko | Mitigasi utama |
|---|---|
| False reassurance dari fitur kamera (wajah/lengan/bicara) | Cannot-analyze state, tanpa skor gabungan, tanpa label normal, penutup 119 yang tidak bisa dilewati |
| Bias aksen Indonesia pada ASR dan bias demografi pada deteksi wajah | Mode baseline diri, mode kalimat Indonesia setara, metrik per subgrup di harness, batasan dinyatakan di UI |
| Halusinasi LLM pada penjelasan dan simulasi | Kunci/rubrik server, validasi narasi tanpa entitas baru, pemeriksa sitasi, saringan output, degradasi aman ke bukti mentah |
| Kebocoran data kesehatan/biometrik | Pemrosesan lokal default, redaksi PII dua lapis (klien + Worker), retensi nol, consent server bercakupan |
| Pembakaran biaya API oleh penyalahgunaan | Turnstile, rate limit per fitur, rem agregat, kunci per lingkungan dengan alert belanja, mode gambar mati secara default |
| Klasifikasi regulasi sebagai alat kesehatan | Intended use terkunci, peta klaim hijau/kuning/merah, audit kata terlarang, rilis awal mode sintetis, konsultasi regulasi sebelum biometrik publik |
| Angka dan dokumentasi basi seperti repo lama | Feature registry + dashboard dari artefak, CI membuktikan konsistensi route/README/Scope |
| Cedera fisik pada tugas motorik (jatuh) | Protokol pendamping dan pegangan wajib, tombol stop besar, auto-stop saat landmark hilang, sub-tugas keseimbangan bisa dilewati |

---

## 14. Keputusan yang Perlu Diputuskan User

1. **Nama final**: Opsi A `strokesense-ai-lab` (rekomendasi), B, atau C (Bagian 4).
2. **Face Symmetry Analyzer v2 di MVP atau Fase 2**: rekomendasi safety adalah menundanya ke Fase 2 setelah guard, quality gate, dan cannot-analyze terbukti di fitur lain; rekomendasi produk adalah tetap di Fase 1 versi sintetis saja (Photo Mode dinonaktifkan sampai keputusan regulasi). Dokumen ini menulisnya di Fase 1 dengan asumsi versi sintetis lebih dulu.
3. **Mode gambar vision**: planning ini menguncinya mati secara default (mode metrik saja). Mengaktifkannya per fitur butuh keputusan terpisah.
4. **Bahasa teks keselamatan**: UI full Inggris sesuai permintaan, tetapi teks darurat, consent, dan pemberitahuan pengiriman gambar direkomendasikan dwibahasa Inggris-Indonesia karena menyangkut keselamatan dan persetujuan. Perlu persetujuan user.
5. **Pembuatan repo**: repo dibuat manual oleh user di github.com/new (aplikasi GitHub Muse tidak bisa membuat repo), lalu user menghubungkan Netlify dan memilih repo itu untuk akses Muse agar pembangunan bisa dibantu dari sini.

---

## 15. Langkah Berikutnya

1. User memutuskan 5 hal di Bagian 14.
2. User membuat repo GitHub baru dan menghubungkannya ke Netlify (deploy kosong dulu tidak masalah).
3. Pembangunan Fase 0 dimulai: struktur repo, CI, design system, kontrak shared, kerangka Worker.
4. Setiap fitur masuk lewat alur tetap: entri registry, golden set sintetis, implementasi, red-team, laporan evaluasi, baru label maturity naik.
5. Dokumen planning ini disalin ke repo baru sebagai `PLANNING.md` agar menjadi artefak proyek, dan diperbarui tiap perubahan keputusan.

---

Lampiran - Rujukan riset utama yang mendasari daftar fitur:

- Digital FAST, framework skrining multimodal wajah + bicara + pose: https://arxiv.org/html/2601.11896v1
- Tinjauan studi multimodal stroke 2024-2025 (M3 Stroke, DeepStroke): https://pmc.ncbi.nlm.nih.gov/articles/PMC12354809/
- RMIT smartphone face screening berbasis FACS: https://www.mobihealthnews.com/news/anz/mobile-face-screening-tool-detects-stroke-seconds
- Whisper untuk asesmen bicara pasca-stroke: https://arxiv.org/html/2507.17326v1
- R-SPEAK, LLM untuk interpretasi ujaran afasia: https://preprints.jmir.org/preprint/93518
- Scoping review generative LLM di stroke care (JMIR Medical Informatics 2025): https://medinform.jmir.org/2025/1/e76636
- Meta-analisis performa AI LVO (AAN 2026): https://pubmed.ncbi.nlm.nih.gov/41901663/
- Viz.ai Neuro: https://www.viz.ai/neuro
- Brainomix e-ASPECTS FDA clearance: https://www.appliedradiology.com/news/fda-clears-stroke-ai-imaging-software
- MedSimAI, pasien virtual LLM untuk pendidikan: https://ui.adsabs.harvard.edu/abs/2025arXiv250305793H/abstract
- NIHSS Plus (Stroke, 2025): https://www.ahajournals.org/doi/10.1161/STROKEAHA.124.048924
