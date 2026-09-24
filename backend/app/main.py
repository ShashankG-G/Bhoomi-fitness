"""
Bhoomi Fitness backend — FastAPI application entrypoint.

Run locally with:  uvicorn app.main:app --reload
See README.md for full local setup instructions.
"""
import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse

from app.admin.routes import router as admin_router
from app.admin.session import AdminAuthRequired
from app.config import settings
from app.database import Base, engine
from app.routers import auth, cafeteria, entry, staff, workouts

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)

app = FastAPI(
    title="Bhoomi Fitness API",
    version="1.0.0",
    description="Backend for Bhoomi Fitness — Kengeri, Bengaluru.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(AdminAuthRequired)
def _admin_auth_required_handler(request: Request, exc: AdminAuthRequired):
    return RedirectResponse(url="/admin", status_code=303)


@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)
    logging.getLogger("bhoomi").info(
        "Bhoomi Fitness backend started. BACKEND_ENV=%s DATABASE_URL=%s",
        settings.BACKEND_ENV,
        settings.DATABASE_URL.split("://")[0] + "://***",
    )


# --- JSON API routers ------------------------------------------------------
app.include_router(auth.router)
app.include_router(entry.router)
app.include_router(workouts.router)
app.include_router(cafeteria.router)
app.include_router(staff.router)

# --- Hidden server-rendered master admin panel -----------------------------
# Deliberately excluded from the OpenAPI schema (include_in_schema=False on
# the router) and never linked from any JSON response.
app.include_router(admin_router)


@app.get("/", tags=["health"])
def root():
    return {"status": "ok", "service": "bhoomi-fitness-backend"}


@app.get("/health", tags=["health"])
def health():
    return {"status": "ok"}
