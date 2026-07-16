from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import (
    auth,
    chat,
    conversations,
    documents,
    exam_profile,
    listening,
    mocks,
    progress,
    quizzes,
    reading,
    speaking,
    users,
    vocab,
    writing,
)
from app.core.config import settings

app = FastAPI(title="RAG Chatbot API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/v1")
app.include_router(users.router, prefix="/api/v1")
app.include_router(documents.router, prefix="/api/v1")
app.include_router(chat.router, prefix="/api/v1")
app.include_router(conversations.router, prefix="/api/v1")
app.include_router(quizzes.router, prefix="/api/v1")
app.include_router(exam_profile.router, prefix="/api/v1")
app.include_router(writing.router, prefix="/api/v1")
app.include_router(speaking.router, prefix="/api/v1")
app.include_router(reading.router, prefix="/api/v1")
app.include_router(listening.router, prefix="/api/v1")
app.include_router(vocab.router, prefix="/api/v1")
app.include_router(progress.router, prefix="/api/v1")
app.include_router(mocks.router, prefix="/api/v1")


@app.get("/health")
def health_check():
    return {"status": "ok"}
