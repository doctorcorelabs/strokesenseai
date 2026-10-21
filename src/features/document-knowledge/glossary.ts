// Curated bilingual glossary of stroke terms for the Plain-Language
// Translator. Every entry maps a medical term to an everyday English
// wording and an everyday Indonesian wording. The glossary is the local
// fallback engine: it rewrites text without any model, and it is also the
// vocabulary the AI mode is expected to prefer. Replacements never change
// numbers, doses, units, or medicine names.

export interface GlossaryEntry {
  /** Medical term as it appears in source text (lowercase match). */
  term: string;
  plainEn: string;
  plainId: string;
}

export const GLOSSARY: GlossaryEntry[] = [
  { term: 'ischemic stroke', plainEn: 'a stroke caused by a blocked blood vessel', plainId: 'stroke karena pembuluh darah tersumbat' },
  { term: 'hemorrhagic stroke', plainEn: 'a stroke caused by bleeding in the brain', plainId: 'stroke karena perdarahan di otak' },
  { term: 'transient ischemic attack', plainEn: 'a short warning episode where stroke symptoms go away', plainId: 'serangan peringatan singkat dengan gejala stroke yang hilang sendiri' },
  { term: 'thrombolysis', plainEn: 'clot-busting medicine given through a vein', plainId: 'obat penghancur bekuan darah yang diberikan lewat infus' },
  { term: 'thrombectomy', plainEn: 'a procedure to pull a clot out of a blood vessel', plainId: 'prosedur untuk mengambil bekuan darah dari pembuluh darah' },
  { term: 'antiplatelet', plainEn: 'medicine that helps stop blood cells from sticking together', plainId: 'obat yang membantu mencegah sel darah saling menempel' },
  { term: 'anticoagulant', plainEn: 'blood-thinning medicine', plainId: 'obat pengencer darah' },
  { term: 'atrial fibrillation', plainEn: 'an irregular heartbeat that can form clots', plainId: 'detak jantung tidak teratur yang dapat membentuk bekuan darah' },
  { term: 'hypertension', plainEn: 'high blood pressure', plainId: 'tekanan darah tinggi' },
  { term: 'blood pressure', plainEn: 'the force of blood against vessel walls', plainId: 'kekuatan dorongan darah pada dinding pembuluh' },
  { term: 'cholesterol', plainEn: 'a fatty substance in the blood', plainId: 'zat lemak di dalam darah' },
  { term: 'statin', plainEn: 'cholesterol-lowering medicine', plainId: 'obat penurun kolesterol' },
  { term: 'diabetes', plainEn: 'a condition where blood sugar stays too high', plainId: 'penyakit gula, yaitu gula darah yang selalu tinggi' },
  { term: 'blood glucose', plainEn: 'blood sugar', plainId: 'gula darah' },
  { term: 'blood clot', plainEn: 'a lump of thickened blood', plainId: 'gumpalan darah yang membeku' },
  { term: 'artery', plainEn: 'a blood vessel that carries blood from the heart', plainId: 'pembuluh darah yang membawa darah dari jantung' },
  { term: 'vein', plainEn: 'a blood vessel that carries blood back to the heart', plainId: 'pembuluh darah yang membawa darah kembali ke jantung' },
  { term: 'ct scan', plainEn: 'a detailed X-ray picture of the brain', plainId: 'foto rontgen otak yang rinci dengan komputer' },
  { term: 'mri scan', plainEn: 'a detailed picture of the brain made with magnets', plainId: 'foto otak yang rinci memakai magnet' },
  { term: 'dysphagia', plainEn: 'trouble swallowing', plainId: 'kesulitan menelan' },
  { term: 'aspiration', plainEn: 'food or drink going into the airway', plainId: 'makanan atau minuman masuk ke saluran napas' },
  { term: 'rehabilitation', plainEn: 'therapy and training to recover skills after stroke', plainId: 'terapi dan latihan untuk memulihkan kemampuan setelah stroke' },
  { term: 'physiotherapy', plainEn: 'movement and exercise therapy', plainId: 'terapi gerak dan latihan fisik' },
  { term: 'speech therapy', plainEn: 'therapy for speaking and swallowing', plainId: 'terapi wicara dan menelan' },
  { term: 'prognosis', plainEn: 'the likely course of recovery', plainId: 'perkiraan perjalanan pemulihan ke depan' },
  { term: 'diagnosis', plainEn: 'the medical name for what is wrong', plainId: 'nama medis untuk penyakit yang ditemukan' },
  { term: 'symptom', plainEn: 'a sign or feeling caused by an illness', plainId: 'tanda atau keluhan yang disebabkan penyakit' },
  { term: 'risk factor', plainEn: 'something that raises the chance of illness', plainId: 'hal yang menaikkan kemungkinan terkena penyakit' },
  { term: 'secondary prevention', plainEn: 'treatment to lower the chance of another stroke', plainId: 'pengobatan untuk menurunkan kemungkinan stroke berulang' },
  { term: 'carotid', plainEn: 'the large neck artery that feeds the brain', plainId: 'pembuluh darah besar di leher yang memberi makan otak' },
  { term: 'stenosis', plainEn: 'narrowing of a blood vessel', plainId: 'penyempitan pembuluh darah' },
  { term: 'infarct', plainEn: 'an area of tissue damaged by loss of blood flow', plainId: 'daerah jaringan yang rusak karena aliran darah berhenti' },
  { term: 'hemorrhage', plainEn: 'bleeding', plainId: 'perdarahan' },
  { term: 'edema', plainEn: 'swelling from extra fluid', plainId: 'bengkak karena cairan berlebih' },
  { term: 'paralysis', plainEn: 'loss of movement', plainId: 'kelumpuhan, tidak bisa bergerak' },
  { term: 'weakness', plainEn: 'loss of strength', plainId: 'kelemahan otot' },
  { term: 'numbness', plainEn: 'loss of feeling', plainId: 'baal atau mati rasa' },
  { term: 'aphasia', plainEn: 'trouble speaking or understanding words', plainId: 'kesulitan berbicara atau memahami kata-kata' },
  { term: 'dysarthria', plainEn: 'slurred speech from weak speech muscles', plainId: 'bicara pelo karena otot bicara lemah' },
  { term: 'negligence', plainEn: 'ignoring one side of space', plainId: 'mengabaikan satu sisi ruangan' },
  { term: 'nil by mouth', plainEn: 'nothing to eat or drink', plainId: 'puasa, tidak boleh makan atau minum' },
  { term: 'intravenous', plainEn: 'given through a vein', plainId: 'diberikan lewat infus atau pembuluh darah' },
  { term: 'oral medication', plainEn: 'medicine taken by mouth', plainId: 'obat yang diminum' },
  { term: 'dose', plainEn: 'the amount of medicine given at one time', plainId: 'jumlah obat yang diberikan dalam satu kali pakai' },
  { term: 'monitoring', plainEn: 'regular checking', plainId: 'pemeriksaan berkala' },
  { term: 'discharge', plainEn: 'leaving the hospital', plainId: 'pulang dari rumah sakit' },
  { term: 'follow-up', plainEn: 'the next check-up visit', plainId: 'kunjungan kontrol berikutnya' },
];

/** Case-insensitive lookup of one term in the glossary. */
export function lookupTerm(term: string): GlossaryEntry | undefined {
  const wanted = term.trim().toLowerCase();
  return GLOSSARY.find((entry) => entry.term === wanted);
}
