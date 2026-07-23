from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from bulk_upload import router as bulk_router
from settings_route import router as settings_router

app = FastAPI(title="WooCommerce Bulk Uploader")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(bulk_router)
app.include_router(settings_router)


@app.get("/")
def root():
    return {"status": "ok", "app": "WooCommerce Bulk Uploader"}
