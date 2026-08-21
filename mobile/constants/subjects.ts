export const SUBJECT_CATALOG = [
  'Matemáticas',
  'Álgebra',
  'Geometría',
  'Cálculo',
  'Estadística',
  'Física',
  'Química',
  'Química Orgánica',
  'Biología',
  'Anatomía',
  'Ciencias Naturales',
  'Informática',
  'Programación',
  'Bases de datos',
  'Minería de datos',
  'Redes',
  'Inglés',
  'Español',
  'Literatura',
  'Francés',
  'Alemán',
  'Portugués',
  'Historia',
  'Geografía',
  'Cívica',
  'Filosofía',
  'Psicología',
  'Sociología',
  'Economía',
  'Contabilidad',
  'Administración',
  'Derecho',
  'Marketing',
  'Arte',
  'Música',
  'Educación Física',
  'Enfermería',
  'Medicina',
  'Ingeniería',
  'Arquitectura',
];

export function mergeSubjects(saved: string[]) {
  const seen = new Set<string>();
  return [...saved, ...SUBJECT_CATALOG].filter((item) => {
    const key = normalizeSubject(item.trim());
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export const DEFAULT_SUBJECTS = [
  'Matemáticas',
  'Física',
  'Química',
  'Informática',
  'Inglés',
  'Alemán',
  'Español',
  'Francés',
  'Biología',
  'Geografía',
  'Historia',
  'Economía',
  'Filosofía',
  'Psicología',
];

const DIACRITIC_MAP: Record<string, string> = {
  á: 'a',
  à: 'a',
  â: 'a',
  ä: 'a',
  ã: 'a',
  é: 'e',
  è: 'e',
  ê: 'e',
  ë: 'e',
  í: 'i',
  ì: 'i',
  î: 'i',
  ï: 'i',
  ó: 'o',
  ò: 'o',
  ô: 'o',
  ö: 'o',
  õ: 'o',
  ú: 'u',
  ù: 'u',
  û: 'u',
  ü: 'u',
  ñ: 'n',
  ç: 'c',
};

export function normalizeSubject(value: string): string {
  return value
    .toLowerCase()
    .split('')
    .map((char) => DIACRITIC_MAP[char] ?? char)
    .join('');
}

export function searchSubjects(catalog: string[], query: string): string[] {
  const normalizedQuery = normalizeSubject(query.trim());
  if (!normalizedQuery) return catalog;
  return catalog.filter((item) => normalizeSubject(item).includes(normalizedQuery));
}
