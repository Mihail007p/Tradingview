def greet(name: str = "world") -> str:
    """Возвращает приветствие для указанного имени."""
    if not name or not str(name).strip():
        raise ValueError("name must be a non-empty string")
    return f"Hello, {name.strip()}!"


if __name__ == "__main__":
    print(greet())
