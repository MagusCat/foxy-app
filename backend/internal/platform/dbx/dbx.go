// Package dbx holds the row-collection helpers shared by every repository, so the
// ErrNoRows->NotFound and error->Internal mapping lives in one place.
package dbx

import (
	"errors"

	"github.com/foxy-app/backend/internal/platform/apperr"
	"github.com/jackc/pgx/v5"
)

// One collects exactly one row into *T. No rows maps to NotFound; any other
// failure to Internal.
func One[T any](rows pgx.Rows) (*T, error) {
	v, err := pgx.CollectExactlyOneRow(rows, pgx.RowToAddrOfStructByName[T])
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, apperr.ErrNotFound
	}
	if err != nil {
		return nil, apperr.Internal(err)
	}
	return v, nil
}

// Many collects every row into []T, mapping any failure to Internal.
func Many[T any](rows pgx.Rows) ([]T, error) {
	list, err := pgx.CollectRows(rows, pgx.RowToStructByName[T])
	if err != nil {
		return nil, apperr.Internal(err)
	}
	return list, nil
}
