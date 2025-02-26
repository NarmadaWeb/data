from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
import uvicorn
import json
from typing import List, Dict
from pathlib import Path

# Inisialisasi aplikasi FastAPI
app = FastAPI(
    title="Peta Populasi Indonesia",
    description="API untuk menampilkan data populasi provinsi Indonesia",
    version="1.0.0"
)

# Path ke file data
DATA_PATH = Path("static/data/data_penduduk.json")

# Fungsi untuk memuat data awal dari file JSON
def load_population_data() -> Dict[str, List[Dict]]:
    try:
        with open(DATA_PATH, 'r', encoding='utf-8') as f:
            data = json.load(f)
        if not isinstance(data, dict):
            raise ValueError("Format data tidak valid, harus berupa dictionary")
        return data
    except FileNotFoundError:
        raise HTTPException(status_code=500, detail="File data_penduduk.json tidak ditemukan")
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="Gagal memparsing file JSON")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Kesalahan saat memuat data: {str(e)}")

# Memuat data dan menghasilkan data untuk tahun berikutnya
provinces_data = load_population_data()

# Menghasilkan data untuk tahun 2021-2024 berdasarkan pertumbuhan
for year in range(2021, 2025):
    previous_year = str(year - 1)
    current_year = str(year)
    
    if previous_year not in provinces_data:
        continue
    
    provinces_data[current_year] = []
    
    for province in provinces_data[previous_year]:
        # Pastikan data memiliki field yang diperlukan
        if not all(key in province for key in ["id", "name", "population"]):
            continue
        
        # Variasi pertumbuhan penduduk antara 0.5% - 2.5% per tahun
        # Menggunakan hash untuk konsistensi pertumbuhan antar eksekusi
        growth_factor = 1.0 + (0.005 + (hash(f"{province['id']}{year}") % 100) / 5000)
        
        new_province = {
            "id": province["id"],
            "name": province["name"],
            "population": int(province["population"] * growth_factor)
        }
        
        provinces_data[current_year].append(new_province)

# Mount file statis
app.mount("/static", StaticFiles(directory="static"), name="static")

# Inisialisasi template Jinja2
templates = Jinja2Templates(directory="templates")

# Endpoint untuk halaman utama
@app.get("/", response_class=HTMLResponse)
async def read_root(request: Request):
    """
    Menampilkan halaman utama peta populasi Indonesia.
    """
    return templates.TemplateResponse("penduduk/index.html", {"request": request})

# Endpoint untuk mendapatkan data provinsi berdasarkan tahun
@app.get("/api/provinces/{year}", response_model=List[Dict[str, str | int]])
async def get_provinces(year: str):
    """
    Mengembalikan data populasi provinsi untuk tahun tertentu.
    
    Args:
        year (str): Tahun yang diinginkan (contoh: "2020")
    
    Returns:
        List[Dict]: Daftar provinsi dengan id, name, dan population
    
    Raises:
        HTTPException: Jika tahun tidak ditemukan
    """
    if year in provinces_data:
        return provinces_data[year]
    raise HTTPException(status_code=404, detail=f"Tahun {year} tidak ditemukan")

# Endpoint untuk mendapatkan daftar tahun yang tersedia
@app.get("/api/years", response_model=List[str])
async def get_years():
    """
    Mengembalikan daftar tahun yang tersedia dalam data.
    
    Returns:
        List[str]: Daftar tahun
    """
    return sorted(provinces_data.keys())

# Menjalankan aplikasi
if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")