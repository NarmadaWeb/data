from fastapi import FastAPI, Request
from router import routes
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates



app = FastAPI()


app.include_router(router=routes.router)


app.mount("/static", StaticFiles(directory="static"), name="static")

templates = Jinja2Templates(directory="templates")


@app.get("/")
async def home(requests: Request):
    return templates.TemplateResponse("index.html", {"request": requests, "message": "Halo ini uji coba"})
