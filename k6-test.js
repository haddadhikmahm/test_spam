import http from 'k6/http';
import { check } from 'k6';
import { Counter, Rate } from 'k6/metrics';

// Konfigurasi dari Environment Variable (dapat diatur lewat CLI)
const TOTAL_REQUEST = __ENV.TOTAL ? parseInt(__ENV.TOTAL) : 10000;
const TARGET_URL = __ENV.URL || 'https://testspam-tjgz.vercel.app/';
const VUS = __ENV.VUS ? parseInt(__ENV.VUS) : 25; // 25 Virtual Users paralel

// Metrik Kustom Akurat
const counterBerhasil = new Counter('http_berhasil_200');
const counterDiblokir = new Counter('http_diblokir_429_403');
const counterServerError = new Counter('http_server_error_5xx');
const counterErrorLain = new Counter('http_error_lain');
const tingkatKeberhasilan = new Rate('rate_keberhasilan');

// Opsi Pengujian k6 (Dioptimalkan agar ringan & cepat)
export const options = {
  discardResponseBodies: true, // Menghemat RAM dengan tidak menyimpan body respon
  scenarios: {
    pengujian_massal: {
      executor: 'shared-iterations',
      vus: VUS,                    // Jumlah koneksi paralel simultan
      iterations: TOTAL_REQUEST,   // Total tepat 1000 request terbagi rata
      maxDuration: '3m',           // Batas waktu maksimal
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<1500'], // 95% request sebaiknya di bawah 1.5 detik
  },
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)'],
};

// Data variasi untuk formulir
const layananList = [
  'Pembuatan Website / Web App',
  'Aplikasi Mobile (Android/iOS)',
  'Desain UI/UX',
  'SEO & Digital Marketing',
  'Maintenance & Support',
  'Lainnya'
];

const budgetList = [
  '< Rp 5 Juta',
  'Rp 5 Juta - Rp 15 Juta',
  'Rp 15 Juta - Rp 30 Juta',
  '> Rp 30 Juta',
  'Belum ditentukan / Fleksibel'
];

export default function () {
  const urutan = __ITER + 1;

  // Payload data formulir kontak yang dinamis
  const payload = JSON.stringify({
    nama: `Penguji k6 ke-${urutan}`,
    email: `tester${urutan}@example.com`,
    whatsapp: '081234567890',
    perusahaan: 'PT Beban Sistem',
    layanan: layananList[urutan % layananList.length],
    budget: budgetList[urutan % budgetList.length],
    proyek: `Pengujian beban k6 nomor urut ${urutan} dari ${TOTAL_REQUEST}.`,
    pesan: `Pengujian beban k6 nomor urut ${urutan} dari ${TOTAL_REQUEST}.`
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'k6-load-tester/1.0',
    },
    timeout: '10s',
  };

  const res = http.post(TARGET_URL, payload, params);

  // Klasifikasi dan hitung hasil respons
  const isSukses = res.status === 200 || res.status === 201;
  const isBlocked = res.status === 429 || res.status === 403;
  const isServerErr = res.status >= 500;

  tingkatKeberhasilan.add(isSukses);

  if (isSukses) {
    counterBerhasil.add(1);
  } else if (isBlocked) {
    counterDiblokir.add(1);
  } else if (isServerErr) {
    counterServerError.add(1);
  } else {
    counterErrorLain.add(1);
  }

  // Log berkala setiap kelipatan 100 agar terminal tidak lambat
  if (urutan % 100 === 0 || urutan === 1 || urutan === TOTAL_REQUEST) {
    console.log(`[PROGRES] Iterasi ke-${urutan}/${TOTAL_REQUEST} | Status HTTP: ${res.status}`);
  }

  // Validasi k6
  check(res, {
    'Berhasil (200/201)': () => isSukses,
    'Diblokir Anti-Spam (429/403)': () => isBlocked,
  });
}
