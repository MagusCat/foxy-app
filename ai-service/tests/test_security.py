import time

import pytest

from app.platform.errors import Unauthorized
from app.platform.security import (
    SCOPE_CHAT,
    SCOPE_EXTRACT,
    SCOPE_GENERATE,
    decode,
)
from tests.conftest import mint

KEY = "clave-compartida"


def test_a_well_formed_token_carries_who_and_why():
    token = mint(KEY, scope=SCOPE_CHAT, sub="usuario-1", jti="peticion-9")
    caller = decode(token, KEY, scope=SCOPE_CHAT)
    assert (caller.user_id, caller.request_id) == ("usuario-1", "peticion-9")


def test_the_signature_has_to_be_made_with_our_key():
    token = mint(KEY, sign_with="la-clave-del-atacante")
    with pytest.raises(Unauthorized, match="firma"):
        decode(token, KEY, scope=SCOPE_GENERATE)


def test_a_tampered_payload_invalidates_the_signature():
    token = mint(KEY, scope=SCOPE_CHAT, sub="usuario-1")
    header, payload, signature = token.split(".")
    otro = mint(KEY, scope=SCOPE_EXTRACT, sub="usuario-1").split(".")[1]
    with pytest.raises(Unauthorized, match="firma"):
        decode(f"{header}.{otro}.{signature}", KEY, scope=SCOPE_EXTRACT)


@pytest.mark.parametrize("alg", ["none", "None", "HS512", "RS256"])
def test_the_algorithm_cannot_be_chosen_by_whoever_sends_the_token(alg: str):
    with pytest.raises(Unauthorized, match="algoritmo"):
        decode(mint(KEY, alg=alg), KEY, scope=SCOPE_GENERATE)


def test_an_expired_token_is_refused():
    viejo = mint(KEY, now=time.time() - 3600)
    with pytest.raises(Unauthorized, match="caducado"):
        decode(viejo, KEY, scope=SCOPE_GENERATE)


def test_a_token_without_an_expiry_is_refused():
    with pytest.raises(Unauthorized, match="caducidad"):
        decode(mint(KEY, omit=("exp",)), KEY, scope=SCOPE_GENERATE)


def test_the_clock_skew_between_machines_does_not_reject_a_valid_token():
    apenas = mint(KEY, now=time.time() - 320, expires_in=300)
    assert decode(apenas, KEY, scope=SCOPE_GENERATE)


def test_a_token_minted_for_another_service_is_refused():
    with pytest.raises(Unauthorized, match="destinatario"):
        decode(mint(KEY, audience="otro-servicio"), KEY, scope=SCOPE_GENERATE)


def test_a_token_from_another_issuer_is_refused():
    with pytest.raises(Unauthorized, match="emisor"):
        decode(mint(KEY, issuer="quien-sea"), KEY, scope=SCOPE_GENERATE)


def test_the_scope_is_what_stops_a_leaked_chat_token_from_reading_the_bucket():
    token = mint(KEY, scope=SCOPE_CHAT)
    with pytest.raises(Unauthorized, match=SCOPE_EXTRACT):
        decode(token, KEY, scope=SCOPE_EXTRACT)


@pytest.mark.parametrize(
    "basura",
    ["", "no-es-un-token", "a.b", "a.b.c.d", "...", "@@@.@@@.@@@", "eyJhbGciOiJIUzI1NiJ9..x"],
)
def test_garbage_is_a_clean_rejection_not_a_crash(basura: str):
    with pytest.raises(Unauthorized):
        decode(basura, KEY, scope=SCOPE_GENERATE)


def test_a_token_whose_payload_is_not_an_object_is_refused():
    token = mint(KEY, payload_override="solo-una-cadena")
    with pytest.raises(Unauthorized):
        decode(token, KEY, scope=SCOPE_GENERATE)


GO_TOKEN = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9."
    "eyJhdWQiOiJmb3h5LWFpLXNlcnZpY2UiLCJleHAiOjE3ODgwNjQxODMsImlhdCI6MTc4ODA2Mzg4Mywi"
    "aXNzIjoiZm94eS1iYWNrZW5kIiwianRpIjoicGV0aWNpb24tZGUtb3JvIiwic2NvcGUiOiJleHRyYWN0"
    "Iiwic3ViIjoiMTExMTExMTEtMjIyMi0zMzMzLTQ0NDQtNTU1NTU1NTU1NTU1In0."
    "02XNnQCqM8TqFKRuu0OAnB-VAixGr9s9WS0HsvFLqj4"
)
GO_TOKEN_KEY = "clave-compartida"
GO_TOKEN_MINTED_AT = 1788063883


def test_a_token_minted_by_go_is_accepted_here():
    caller = decode(GO_TOKEN, GO_TOKEN_KEY, scope=SCOPE_EXTRACT, now=GO_TOKEN_MINTED_AT + 10)
    assert caller.user_id == "11111111-2222-3333-4444-555555555555"
    assert caller.request_id == "peticion-de-oro"


def test_the_token_go_mints_does_expire():
    with pytest.raises(Unauthorized, match="caducado"):
        decode(GO_TOKEN, GO_TOKEN_KEY, scope=SCOPE_EXTRACT, now=GO_TOKEN_MINTED_AT + 3600)
