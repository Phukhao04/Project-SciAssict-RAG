from fastapi import FastAPI
from app.api.auth import router as auth_router
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="SciAssist RAG API")
app.include_router(auth_router)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # port ของ Vite dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



@app.get("/health")
def health_check():
    return {"status": "connected"}