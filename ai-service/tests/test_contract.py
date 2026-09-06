import re
from pathlib import Path

import pytest

from app.platform import security

REPO = Path(__file__).resolve().parents[2]
TOKEN_GO = REPO / "backend/internal/platform/aiclient/token.go"
MIGRATION = REPO / "supabase/migrations/20260904140000_schema_v3.sql"


def _v1_routes(app):
    return [r for r in app.routes if getattr(r, "path", "").startswith("/v1")]


def test_no_route_under_v1_is_mounted_without_a_scope(make_client):
    client, _, _ = make_client()
    routes = _v1_routes(client.app)
    assert routes, "no /v1 route found: the test stopped looking where it should"
    for route in routes:
        scopes = {getattr(d.call, "required_scope", None) for d in route.dependant.dependencies}
        assert scopes - {None}, f"{route.path} is mounted without require_scope: open"


def test_every_v1_route_answers_401_without_a_token(make_client):
    client, _, _ = make_client(ai_service_token="clave-compartida", allow_insecure=False)
    with client:
        for route in _v1_routes(client.app):
            resp = client.post(route.path, json={})
            assert resp.status_code == 401, (
                f"{route.path} answered {resp.status_code} with no token, not 401"
            )


def test_the_scope_names_match_the_backend_that_mints_them():
    if not TOKEN_GO.exists():
        pytest.skip("without the Go backend alongside there is nothing to compare against")
    src = TOKEN_GO.read_text()
    for go_name, expected in (
        ("scopeChat", security.SCOPE_CHAT),
        ("scopeGenerate", security.SCOPE_GENERATE),
        ("scopeExtract", security.SCOPE_EXTRACT),
        ("tokenIssuer", security.ISSUER),
        ("tokenAudience", security.AUDIENCE),
    ):
        m = re.search(rf'^\s*{go_name}\s*=\s*"([^"]*)"', src, re.M)
        assert m, f"{go_name} no longer exists in token.go: the backend stopped issuing it"
        assert m.group(1) == expected, (
            f"{go_name}: Go issues {m.group(1)!r} and here {expected!r} is expected — "
            "cross-service auth is broken"
        )


def test_the_material_types_match_the_column_that_stores_them(prompts):
    if not MIGRATION.exists():
        pytest.skip("without the migrations alongside there is nothing to compare against")
    check = re.search(r"CHECK \(type IN \(([^)]*)\)\)", MIGRATION.read_text())
    assert check, "the materials.type CHECK was not found in the migration"
    in_db = set(re.findall(r"'([^']+)'", check.group(1)))
    assert set(prompts.material_types) == in_db, (
        f"prompts.toml defines {sorted(prompts.material_types)} and the DB accepts {sorted(in_db)}"
    )
