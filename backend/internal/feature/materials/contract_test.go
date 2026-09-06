package materials

import (
	"os"
	"regexp"
	"testing"
)

// validTypes es lo que decide si una petición se acepta; el CHECK de la columna
// es lo que decide si se puede guardar. Si divergen, el desajuste no sale hasta
// el INSERT: el usuario paga la generación de IA entera y recibe un 500 al final.
// En el sentido contrario, un tipo que la base acepta y este mapa no queda
// inalcanzable sin que nada lo diga.
func TestTheAcceptedTypesAreExactlyWhatTheColumnAllows(t *testing.T) {
	const migration = "../../../../supabase/migrations/20260904140000_schema_v3.sql"
	src, err := os.ReadFile(migration)
	if err != nil {
		t.Skipf("sin las migraciones al lado no hay contra qué comparar: %v", err)
	}
	m := regexp.MustCompile(`CHECK \(type IN \(([^)]*)\)\)`).FindSubmatch(src)
	if m == nil {
		t.Fatalf("no se encontró el CHECK de materials.type en %s", migration)
	}

	inDB := map[string]bool{}
	for _, q := range regexp.MustCompile(`'([^']+)'`).FindAllStringSubmatch(string(m[1]), -1) {
		inDB[q[1]] = true
		if !validTypes[q[1]] {
			t.Errorf("la base acepta %q pero validTypes lo rechaza: tipo inalcanzable", q[1])
		}
	}
	for materialType := range validTypes {
		if !inDB[materialType] {
			t.Errorf("validTypes acepta %q pero el CHECK lo rechaza: fallará al guardar, "+
				"después de haber pagado la generación", materialType)
		}
	}
}
