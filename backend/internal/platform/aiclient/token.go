package aiclient

import (
	"context"
	"time"

	"github.com/foxy-app/backend/internal/platform/reqctx"
	"github.com/golang-jwt/jwt/v5"
)

// El token que viaja al ai-service se emite por petición, no es un secreto fijo.
//
// Antes se mandaba AI_SERVICE_TOKEN tal cual: un bearer que no caducaba, no
// tenía alcance y no decía de quién venía. Filtrado —un log, un volcado de
// entorno, un contenedor comprometido— daba acceso permanente a /v1/extract, que
// lee cualquier objeto del bucket con la service key, y revocarlo obligaba a
// redesplegar los dos servicios.
//
// Ese mismo secreto pasa a ser la clave de firma, así que no hay nada nuevo que
// configurar: cambia lo que se manda, no lo que se despliega.
const (
	tokenIssuer   = "foxy-backend"
	tokenAudience = "foxy-ai-service"

	// Cubre el arranque de la petición, no su duración: el ai-service valida al
	// recibirla y una extracción larga sigue su curso. Con el timeout de 120 s
	// del cliente HTTP, cinco minutos dejan margen de sobra para el desfase de
	// reloj entre las dos máquinas sin alargar la vida útil de una fuga.
	tokenTTL = 5 * time.Minute
)

// Un alcance por endpoint: un token emitido para un mensaje de chat no sirve
// contra /v1/extract, que es el único con acceso de lectura a todo el bucket.
// Estas cadenas están duplicadas en ai-service/app/platform/security.py; cambiar
// una sin la otra rompe la autenticación entre servicios, no la degrada.
const (
	scopeChat     = "chat"
	scopeGenerate = "generate"
	scopeExtract  = "extract"
)

// mint firma el token de esta petición. El usuario y el request-id salen del
// context, así que una petición al ai-service se puede atribuir a quien la
// originó y correlacionar con los logs del backend.
func (c *Client) mint(ctx context.Context, scope string) (string, error) {
	now := time.Now()
	claims := jwt.MapClaims{
		"iss":   tokenIssuer,
		"aud":   tokenAudience,
		"scope": scope,
		"iat":   now.Unix(),
		"exp":   now.Add(tokenTTL).Unix(),
	}
	if u, ok := reqctx.UserFrom(ctx); ok {
		claims["sub"] = u.ID.String()
	}
	if id := reqctx.RequestID(ctx); id != "" {
		claims["jti"] = id
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(c.token))
}
