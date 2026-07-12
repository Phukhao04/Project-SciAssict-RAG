from fastapi import FastAPI

app = FastAPI(title="SciAssist RAG API")


@app.get("/health")
def health_check():
    return {"status": "connected"}