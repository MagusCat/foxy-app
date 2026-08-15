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
    const key = item.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
