import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import all_routers

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s - %(message)s",
)

app = FastAPI(title="SciAssist RAG API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # port ของ Vite dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

for router in all_routers:
    app.include_router(router)


@app.get("/health")
def health_check():
    return {"status": "connected"}
