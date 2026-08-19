from pathlib import Path

from jinja2 import Environment, FileSystemLoader, select_autoescape

TEMPLATES_DIR = Path(__file__).resolve().parent.parent / "templates"

_env = Environment(
    loader=FileSystemLoader(str(TEMPLATES_DIR)),
    autoescape=select_autoescape(["html"]),
)

BRAND = {
    "navy": "#0F172A",
    "gold": "#D97706",
    "teal": "#0D9488",
    "bg": "#F1F5F9",
}


def render(template_path: str, **context) -> str:
    template = _env.get_template(template_path)
    return template.render(brand=BRAND, **context)
