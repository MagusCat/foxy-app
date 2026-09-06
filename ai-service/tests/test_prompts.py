import pytest

from app.feature.chat.service import _retrieval_query
from app.prompts import DEFAULT_PATH, Prompts
from app.schemas import ChatContext, Message


def test_the_base_persona_is_always_there(prompts: Prompts):
    assert prompts.system_for(ChatContext()) == prompts.persona_base


@pytest.mark.parametrize("kind", ["student", "teacher", "professional"])
def test_each_user_kind_adds_its_own_persona(prompts: Prompts, kind: str):
    got = prompts.system_for(ChatContext(user_kind=kind))
    assert got.startswith(prompts.persona_base)
    assert prompts.persona_kind[kind] in got


def test_an_unknown_kind_falls_back_to_the_base_alone(prompts: Prompts):
    assert prompts.system_for(ChatContext(user_kind="robot")) == prompts.persona_base


def test_every_profile_field_reaches_the_prompt(prompts: Prompts):
    got = prompts.system_for(
        ChatContext(
            user_kind="student",
            academic_level="universidad",
            main_goal="aprobar cálculo",
            custom_instructions="responde corto",
            objectives=["Derivadas", "Integrales"],
        )
    )
    for want in ["universidad", "aprobar cálculo", "responde corto", "Derivadas"]:
        assert want in got
    assert "Derivadas; Integrales" in got


def test_a_field_without_data_leaves_no_trace(prompts: Prompts):
    got = prompts.system_for(ChatContext(user_kind="student", main_goal="aprobar cálculo"))
    assert "aprobar cálculo" in got
    assert "{value}" not in got
    for field in ["academic_level", "objectives", "custom_instructions"]:
        head = prompts.context[field].split("{value}")[0]
        assert head not in got


@pytest.mark.parametrize("mode", ["respuesta", "pasos", "quiz"])
def test_each_answer_mode_reaches_the_prompt(prompts: Prompts, mode: str):
    got = prompts.system_for(ChatContext(mode=mode))
    assert prompts.mode[mode] in got


def test_the_order_is_stable(prompts: Prompts):
    ctx = ChatContext(user_kind="teacher", academic_level="secundaria", main_goal="X")
    assert prompts.system_for(ctx) == prompts.system_for(ctx)
    got = prompts.system_for(ctx)
    assert got.index("secundaria") < got.index("X")


def test_the_prompt_carries_no_document_text(prompts: Prompts):
    got = prompts.system_for(ChatContext(custom_instructions="responde corto"))
    assert prompts.cite not in got


def test_every_material_type_declares_its_key_and_shape(prompts: Prompts):
    assert set(prompts.material_types) == {
        "summary",
        "notes",
        "flashcards",
        "exam",
        "assignment",
        "lesson_text",
        "true_false",
        "exercise",
        "weak_areas",
    }
    for name, spec in prompts.material_types.items():
        assert spec.key and spec.shape, name
        assert f'"{spec.key}"' in spec.shape

    assert "json" in prompts.material_system.lower()


def msgs(*pairs: tuple[str, str]) -> list[Message]:
    return [Message(role=role, content=content) for role, content in pairs]


def test_the_query_is_only_what_the_user_said():
    got = _retrieval_query(
        msgs(
            ("user", "¿qué es una derivada?"),
            ("assistant", "x" * 400),
            ("user", "¿y para qué sirve?"),
        )
    )
    assert "x" * 400 not in got
    assert got == "¿qué es una derivada?\n¿y para qué sirve?"


def test_only_the_last_turns_travel():
    got = _retrieval_query(msgs(*[("user", f"pregunta {i}") for i in range(10)]), turns=3)
    assert got == "pregunta 7\npregunta 8\npregunta 9"


def test_the_budget_drops_the_oldest_not_the_newest():
    got = _retrieval_query(
        msgs(("user", "a" * 300), ("user", "b" * 300), ("user", "reciente")),
        turns=3,
        max_chars=400,
    )
    assert got.endswith("reciente")
    assert "a" * 300 not in got


def test_the_newest_turn_survives_even_alone_over_budget():
    got = _retrieval_query(msgs(("user", "z" * 5000)), max_chars=400)
    assert got == "z" * 400


def test_a_conversation_without_questions_has_nothing_to_search():
    assert _retrieval_query(msgs(("assistant", "hola"))) == ""
    assert _retrieval_query(msgs(("user", "   "))) == ""
    assert _retrieval_query([]) == ""


def test_a_template_with_an_unknown_key_fails_at_load(tmp_path):
    roto = tmp_path / "roto.toml"
    roto.write_text(
        DEFAULT_PATH.read_text().replace(
            'main_goal = "Su objetivo principal es: {value}."',
            'main_goal = "Su objetivo es {value} y su nivel {nivel}."',
        ),
        encoding="utf-8",
    )
    with pytest.raises(ValueError, match="nivel"):
        Prompts.load(roto)


def test_the_material_template_is_validated_too(tmp_path):
    roto = tmp_path / "roto.toml"
    roto.write_text(
        DEFAULT_PATH.read_text().replace("Exact structure:", "Exact {inventada} structure:"),
        encoding="utf-8",
    )
    with pytest.raises(ValueError, match="inventada"):
        Prompts.load(roto)


def test_the_shipped_file_loads(prompts: Prompts):
    assert prompts.persona_base and prompts.material_types
