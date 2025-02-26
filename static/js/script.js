// Inisialisasi peta
const map = L.map('map').setView([-2.5, 118], 5);

// Tambahkan layer peta dasar
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap contributors'
}).addTo(map);

// Fungsi untuk mendapatkan warna berdasarkan jumlah populasi
function getColor(d) {
  return d > 40000000 ? '#b71c1c' :
         d > 20000000 ? '#e53935' :
         d > 10000000 ? '#ef5350' :
         d > 5000000  ? '#673ab7' :
         d > 2000000  ? '#3f51b5' :
         d > 1000000  ? '#2196f3' :
         d > 500000   ? '#4fc3f7' :
                       '#b3e5fc';
}

// Variabel global
let provincesData = [];
let geojson;
let currentYear = "2020";
let years = [];
let indonesiaGeoJSON = null;

// Fungsi untuk mengatur style untuk layer geoJSON
function style(feature) {
  const provinceData = provincesData.find(p => p.id === feature.properties.id);
  const population = provinceData ? provinceData.population : 0;
  
  return {
    fillColor: getColor(population),
    weight: 2,
    opacity: 1,
    color: 'white',
    dashArray: '3',
    fillOpacity: 0.7
  };
}

// Kontrol informasi
const info = L.control();

info.onAdd = function (map) {
  this._div = L.DomUtil.create('div', 'info');
  this.update();
  return this._div;
};

info.update = function (props) {
  const provinceData = props ? provincesData.find(p => p.id === props.id) : null;
  const population = provinceData ? provinceData.population.toLocaleString('id-ID') : '';
  
  this._div.innerHTML = '<h4>Populasi Provinsi Indonesia</h4>' +  
      (props ? '<b>' + props.name + '</b><br />' + population + ' jiwa'
      : 'Arahkan kursor pada provinsi');
};

info.addTo(map);

// Interaksi dengan layer
function highlightFeature(e) {
  const layer = e.target;
  layer.setStyle({
    weight: 5,
    color: '#666',
    dashArray: '',
    fillOpacity: 0.7
  });
  if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
    layer.bringToFront();
  }
  info.update(layer.feature.properties);
}

function resetHighlight(e) {
  geojson.resetStyle(e.target);
  info.update();
}

function zoomToFeature(e) {
  map.fitBounds(e.target.getBounds());
}

function onEachFeature(feature, layer) {
  layer.on({
    mouseover: highlightFeature,
    mouseout: resetHighlight,
    click: zoomToFeature
  });
}

// Legenda
const legend = L.control({position: 'bottomright'});

legend.onAdd = function (map) {
  const div = L.DomUtil.create('div', 'legend');
  const grades = [0, 500000, 1000000, 2000000, 5000000, 10000000, 20000000, 40000000];
  div.innerHTML = '<h4>Penduduk</h4>';
  for (let i = 0; i < grades.length; i++) {
    div.innerHTML +=
      '<i style="background:' + getColor(grades[i] + 1) + '"></i> ' +
      grades[i].toLocaleString('id-ID') + (grades[i + 1] ? '–' + grades[i + 1].toLocaleString('id-ID') + '<br>' : '+');
  }
  return div;
};

legend.addTo(map);

// Mendapatkan daftar tahun
fetch('/api/years')
  .then(response => response.json())
  .then(data => {
    years = data;
    setupYearButtons(years);
    
    fetch('/static/data/indonesia.geojson')
      .then(response => response.json())
      .then(data => {
        indonesiaGeoJSON = data;
        loadProvinceData(currentYear);
      });
  });

// Setup tombol tahun
function setupYearButtons(years) {
  const yearButtonsContainer = document.getElementById('year-buttons');
  yearButtonsContainer.innerHTML = '';
  
  years.forEach(year => {
    const button = document.createElement('button');
    button.className = 'year-btn' + (year === currentYear ? ' active' : '');
    button.innerText = year;
    button.addEventListener('click', () => {
      currentYear = year;
      document.querySelectorAll('.year-btn').forEach(btn => {
        btn.classList.remove('active');
      });
      button.classList.add('active');
      document.getElementById('year-display').innerText = year;
      loadProvinceData(year);
    });
    yearButtonsContainer.appendChild(button);
  });
}

// Load data provinsi
function loadProvinceData(year) {
  fetch(`/api/provinces/${year}`)
    .then(response => response.json())
    .then(data => {
      provincesData = data;
      updateProvinceList(data);
      updateTotalPopulation(data);
      updateMap();
    });
}

// Update peta
function updateMap() {
  if (geojson) {
    map.removeLayer(geojson);
  }
  if (indonesiaGeoJSON) {
    geojson = L.geoJson(indonesiaGeoJSON, {
      style: style,
      onEachFeature: onEachFeature
    }).addTo(map);
  }
}

// Update daftar provinsi
function updateProvinceList(data) {
  const provinceList = document.getElementById('province-list');
  provinceList.innerHTML = '';
  const sortedData = [...data].sort((a, b) => b.population - a.population);
  sortedData.forEach(province => {
    const li = document.createElement('li');
    li.innerHTML = `
      <span class="province-name">${province.name}</span>
      <span class="population">${province.population.toLocaleString('id-ID')}</span>
    `;
    li.addEventListener('click', () => {
      if (geojson) {
        const provinceFeature = geojson.getLayers().find(layer => 
          layer.feature.properties.id === province.id
        );
        if (provinceFeature) {
          map.fitBounds(provinceFeature.getBounds());
          highlightFeature({target: provinceFeature});
          setTimeout(() => {
            resetHighlight({target: provinceFeature});
          }, 2000);
        }
      }
    });
    provinceList.appendChild(li);
  });
}

// Update total populasi
function updateTotalPopulation(data) {
  const totalPopulationElement = document.getElementById('total-population');
  const totalPopulation = data.reduce((sum, province) => sum + province.population, 0);
  totalPopulationElement.innerText = `Total Populasi Indonesia (${currentYear}): ${totalPopulation.toLocaleString('id-ID')} jiwa`;
}

// Interaksi saat kursor bergerak
map.on('mousemove', function(e) {
  const point = [e.latlng.lng, e.latlng.lat];
  let currentProvince = null;
  geojson.getLayers().forEach(layer => {
    if (turf.booleanPointInPolygon(point, layer.feature.geometry)) {
      currentProvince = layer.feature.properties;
    }
  });
  info.update(currentProvince);
});

// Fitur pencarian
document.getElementById('search').addEventListener('input', function(e) {
  const searchTerm = e.target.value.toLowerCase();
  const filteredData = provincesData.filter(province => 
    province.name.toLowerCase().includes(searchTerm)
  );
  updateProvinceList(filteredData);
});