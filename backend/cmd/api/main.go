// Command api is Foxy's backend entry point. All wiring lives in internal/app.
package main

import (
	"log/slog"
	"os"

	"github.com/foxy-app/backend/internal/app"
)

func main() {
	if err := app.Run(); err != nil {
		slog.Error("server exited with error", "error", err)
		os.Exit(1)
	}
}
