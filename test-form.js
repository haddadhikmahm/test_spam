/**
 * ============================================================================
 * High-Performance Form Load & Anti-Spam Tester (Node.js Native)
 * ============================================================================
 * 
 * Keunggulan:
 * - 100% Native Node.js (v18+) menggunakan global fetch & performance API.
 * - Tanpa dependensi pihak ketiga (k6, axios, npm install TIDAK diperlukan).
 * - Worker Pool / Concurrency Control: Sangat cepat, hemat RAM, tidak bikin crash/freeze.
 * - Akurat: Menghitung status 200/201 (sukses), 429/403 (anti-spam), 5xx, RPS & latensi.
 * 
 * Cara Menjalankan:
 *   node test-form.js
 *   node test-form.js [URL] [TOTAL_REQUEST] [CONCURRENCY]
 * 
 * Contoh:
 *   node test-form.js http://localhost:3000/api/contact 1000 25
 *   node test-form.js http://localhost/test_spam/proses.php 1000 30
 */

// Konfigurasi Utama (Bisa diubah langsung di sini atau lewat argumen terminal)
const TARGET_URL = process.argv[2] || process.env.URL || 'http://localhost:3000/api/contact';
const TOTAL_REQUEST = parseInt(process.argv[3] || process.env.TOTAL || '1000', 10);
const CONCURRENCY = parseInt(process.argv[4] || process.env.CONCURRENCY || '25', 10);

// Metrik & Statistik
const stats = {
  success: 0,       // 200, 201
  rateLimited: 0,   // 429 (Too Many Requests), 403 (Forbidden / Anti-Spam)
  serverError: 0,   // 500, 502, 503, dll.
  clientError: 0,   // 400, 404, 422, dll.
  networkError: 0,  // Koneksi putus, server mati, timeout
  latencies: [],    // Rekam waktu respon per request (ms)
};

const serviceOptions = [
  'Pembuatan Website / Web App',
  'Aplikasi Mobile (Android/iOS)',
  'Desain UI/UX',
  'SEO & Digital Marketing',
  'Maintenance & Support',
  'Lainnya'
];

const budgetOptions = [
  '< Rp 5 Juta',
  'Rp 5 Juta - Rp 15 Juta',
  'Rp 15 Juta - Rp 30 Juta',
  '> Rp 30 Juta',
  'Belum ditentukan / Fleksibel'
];

/**
 * Generator data realistis dan dinamis per request
 */
function createPayload(index) {
  const service = serviceOptions[index % serviceOptions.length];
  const budget = budgetOptions[index % budgetOptions.length];

  return JSON.stringify({
    nama: `Penguji Otomatis ${index}`,
    email: `penguji${index}@example.com`,
    whatsapp: `0812${String(index).padStart(8, '0')}`,
    perusahaan: `PT Simulasi Beban ${index}`,
    layanan: service,
    budget: budget,
    proyek: `Pengujian performa & proteksi spam request ke-${index} dari total ${TOTAL_REQUEST}.`,
    pesan: `Pengujian performa & proteksi spam request ke-${index} dari total ${TOTAL_REQUEST}.`
  });
}

/**
 * Kirim 1 HTTP request
 */
async function sendSingleRequest(index) {
  const payload = createPayload(index);
  const start = performance.now();

  try {
    const response = await fetch(TARGET_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'FormTester/1.0'
      },
      body: payload
    });

    const duration = performance.now() - start;
    stats.latencies.push(duration);

    if (response.status === 200 || response.status === 201) {
      stats.success++;
    } else if (response.status === 429 || response.status === 403) {
      stats.rateLimited++;
    } else if (response.status >= 500) {
      stats.serverError++;
    } else {
      stats.clientError++;
    }

    return response.status;
  } catch (err) {
    const duration = performance.now() - start;
    stats.latencies.push(duration);
    stats.networkError++;
    return 'ERR';
  }
}

/**
 * Jalankan pengujian dengan Worker Pool (hemat CPU, cepat & stabil)
 */
async function runLoadTest() {
  console.log('='.repeat(65));
  console.log('       TEST PENGIRIMAN DATA MASSAL & CEK ANTI-SPAM');
  console.log('='.repeat(65));
  console.log(` Target URL   : ${TARGET_URL}`);
  console.log(` Total Data   : ${TOTAL_REQUEST.toLocaleString()} request`);
  console.log(` Concurrency  : ${CONCURRENCY} request simultan`);
  console.log('='.repeat(65));
  console.log('Memulai pengiriman data...\n');

  const startTime = performance.now();
  let currentIndex = 0;
  let completedCount = 0;
  const isTTY = process.stdout.isTTY;

  function updateProgress() {
    const percent = ((completedCount / TOTAL_REQUEST) * 100).toFixed(1);
    const barLength = 20;
    const filled = Math.round((completedCount / TOTAL_REQUEST) * barLength);
    const bar = '█'.repeat(filled) + '-'.repeat(barLength - filled);

    const logLine = `[${bar}] ${percent}% | Selesai: ${completedCount}/${TOTAL_REQUEST} | Sukses: ${stats.success} | Diblokir: ${stats.rateLimited} | Err: ${stats.networkError + stats.serverError}`;

    if (isTTY) {
      process.stdout.write(`\r${logLine.padEnd(80)}`);
    } else if (completedCount % 100 === 0 || completedCount === TOTAL_REQUEST) {
      console.log(logLine);
    }
  }

  // Worker generator loop
  async function worker() {
    while (true) {
      const idx = ++currentIndex;
      if (idx > TOTAL_REQUEST) break;

      await sendSingleRequest(idx);
      completedCount++;

      // Update progress setiap kelipatan 10 atau saat selesai
      if (completedCount % 10 === 0 || completedCount === TOTAL_REQUEST) {
        updateProgress();
      }
    }
  }

  // Spawn pool worker
  const workers = Array.from({ length: Math.min(CONCURRENCY, TOTAL_REQUEST) }, () => worker());
  await Promise.all(workers);

  const totalTimeSeconds = (performance.now() - startTime) / 1000;
  const rps = (TOTAL_REQUEST / totalTimeSeconds).toFixed(2);

  // Perhitungan statistik latensi
  stats.latencies.sort((a, b) => a - b);
  const avgLatency = (stats.latencies.reduce((a, b) => a + b, 0) / (stats.latencies.length || 1)).toFixed(2);
  const minLatency = (stats.latencies[0] || 0).toFixed(2);
  const maxLatency = (stats.latencies[stats.latencies.length - 1] || 0).toFixed(2);
  const p95Latency = (stats.latencies[Math.floor(stats.latencies.length * 0.95)] || 0).toFixed(2);

  console.log('\n\n' + '='.repeat(65));
  console.log('                    HASIL RINGKASAN AKHIR');
  console.log('='.repeat(65));
  console.log(` Durasi Total          : ${totalTimeSeconds.toFixed(2)} detik`);
  console.log(` Kecepatan (RPS)       : ${rps} request / detik`);
  console.log(` Rata-rata Respon      : ${avgLatency} ms`);
  console.log(` Respon Min / Max      : ${minLatency} ms / ${maxLatency} ms`);
  console.log(` 95% Respon di bawah   : ${p95Latency} ms`);
  console.log('-'.repeat(65));
  console.log(` [✓] Berhasil (HTTP 200/201)       : ${stats.success.toLocaleString()}`);
  console.log(` [!] Diblokir Spam (HTTP 429/403) : ${stats.rateLimited.toLocaleString()}`);
  console.log(` [x] Server Error (HTTP 5xx)      : ${stats.serverError.toLocaleString()}`);
  console.log(` [?] Client Error (HTTP 4xx lain) : ${stats.clientError.toLocaleString()}`);
  console.log(` [!] Gagal Koneksi / Timeout      : ${stats.networkError.toLocaleString()}`);
  console.log('='.repeat(65));

  if (stats.rateLimited > 0) {
    console.log(`\n Catatan: Proteksi Anti-Spam / Rate Limiter berhasil menghadang ${stats.rateLimited} request.`);
  } else if (stats.networkError === TOTAL_REQUEST) {
    console.log(`\n Perhatian: Semua request gagal koneksi. Pastikan server target (${TARGET_URL}) sedang berjalan.`);
  }
}

runLoadTest();
