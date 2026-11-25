from fastapi import FastAPI

app = FastAPI(title="AI Coding LMS API")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
