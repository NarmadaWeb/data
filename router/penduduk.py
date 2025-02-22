from .routes import router


@router.get("/api")
async def main():
    return "hello world"