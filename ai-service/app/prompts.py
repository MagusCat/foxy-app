import tomllib
from dataclasses import dataclass
from pathlib import Path

from app.schemas import ChatContext

DEFAULT_PATH = Path(__file__).resolve().parent / "prompts.toml"

OBJECTIVES_SEP = "; "

BLOCK_SEP = "\n\n"


@dataclass(frozen=True)
class MaterialSpec:
    key: str
    shape: str


@dataclass(frozen=True)
class Prompts:
    persona_base: str
    persona_kind: dict[str, str]
    context: dict[str, str]
    mode: dict[str, str]
    cite: str
    material_system: str
    material_types: dict[str, MaterialSpec]

    @classmethod
    def load(cls, path: str | Path = "") -> "Prompts":
        source = Path(path or DEFAULT_PATH)
        with source.open("rb") as f:
            raw = tomllib.load(f)
        prompts = cls(
            persona_base=raw["persona"]["base"].strip(),
            persona_kind={k: v.strip() for k, v in raw["persona"]["kind"].items()},
            context={k: v.strip() for k, v in raw["context"].items()},
            mode={k: v.strip() for k, v in raw["mode"].items()},
            cite=raw["chat"]["cite"].strip(),
            material_system=raw["materials"]["system"].strip(),
            material_types={
                name: MaterialSpec(spec["key"], spec["shape"])
                for name, spec in raw["materials"]["types"].items()
            },
        )
        prompts._check_templates(source)
        return prompts

    def _check_templates(self, source: Path) -> None:
        probes: list[tuple[str, str, dict]] = [
            *((f"[context].{k}", v, {"value": "x"}) for k, v in self.context.items()),
            ("[materials].system", self.material_system, {"shape": "{}"}),
        ]
        for label, template, values in probes:
            try:
                template.format(**values)
            except (KeyError, IndexError) as e:
                raise ValueError(
                    f"{source}: la plantilla {label} usa {e} y ahí solo existe "
                    f"{{{', '.join(values)}}}"
                ) from e

    def system_for(self, c: ChatContext) -> str:
        parts = [self.persona_base]
        if kind := self.persona_kind.get(c.user_kind):
            parts.append(kind)
        if c.academic_level:
            parts.append(self.context["academic_level"].format(value=c.academic_level))
        if c.main_goal:
            parts.append(self.context["main_goal"].format(value=c.main_goal))
        if c.objectives:
            value = OBJECTIVES_SEP.join(c.objectives)
            parts.append(self.context["objectives"].format(value=value))
        if c.custom_instructions:
            parts.append(self.context["custom_instructions"].format(value=c.custom_instructions))
        if mode := self.mode.get(c.mode or ""):
            parts.append(mode)
        return BLOCK_SEP.join(parts)
