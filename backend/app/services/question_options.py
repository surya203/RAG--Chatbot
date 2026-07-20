"""Normalize question options from LLM/admin input into list[str]."""

from __future__ import annotations


def normalize_options(raw: object) -> list[str] | None:
    if not isinstance(raw, list) or not raw:
        return None
    out: list[str] = []
    for item in raw:
        if isinstance(item, str):
            text = item.strip()
            if text:
                out.append(text)
        elif isinstance(item, dict):
            if "term" in item and "definition" in item:
                out.append(f"{item.get('term')}: {item.get('definition')}")
            elif "label" in item:
                out.append(str(item.get("label")))
            elif "text" in item:
                out.append(str(item.get("text")))
            else:
                out.append(", ".join(f"{k}: {v}" for k, v in item.items()))
        else:
            out.append(str(item))
    return out or None


def normalize_answer(raw: object) -> str:
    if isinstance(raw, dict):
        return ", ".join(f"{k}: {v}" for k, v in raw.items())
    return str(raw or "").strip()
