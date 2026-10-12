const GEO_URL = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";

const form = document.getElementById("search-form");
const input = document.getElementById("city-input");
const button = document.getElementById("search-btn");
const loadingEl = document.getElementById("loading");
const errorEl = document.getElementById("error");
const weatherEl = document.getElementById("weather");


const WMO = {
  0: ["Clear sky", "☀️", "🌙"], 1: ["Mainly clear", "🌤️", "🌙"], 2: ["Partly cloudy", "⛅", "☁️"],
  3: ["Overcast", "☁️", "☁️"], 45: ["Fog", "🌫️", "🌫️"], 48: ["Rime fog", "🌫️", "🌫️"],
  51: ["Light drizzle", "🌦️", "🌦️"], 53: ["Drizzle", "🌦️", "🌦️"], 55: ["Dense drizzle", "🌧️", "🌧️"],
  56: ["Freezing drizzle", "🌧️", "🌧️"], 57: ["Freezing drizzle", "🌧️", "🌧️"],
  61: ["Light rain", "🌦️", "🌧️"], 63: ["Rain", "🌧️", "🌧️"], 65: ["Heavy rain", "🌧️", "🌧️"],
  66: ["Freezing rain", "🌧️", "🌧️"], 67: ["Freezing rain", "🌧️", "🌧️"],
  71: ["Light snow", "🌨️", "🌨️"], 73: ["Snow", "❄️", "❄️"], 75: ["Heavy snow", "❄️", "❄️"],
  77: ["Snow grains", "❄️", "❄️"], 80: ["Rain showers", "🌦️", "🌧️"], 81: ["Rain showers", "🌧️", "🌧️"],
  82: ["Violent rain showers", "⛈️", "⛈️"], 85: ["Snow showers", "🌨️", "🌨️"], 86: ["Snow showers", "🌨️", "🌨️"],
  95: ["Thunderstorm", "⛈️", "⛈️"], 96: ["Thunderstorm with hail", "⛈️", "⛈️"], 99: ["Thunderstorm with hail", "⛈️", "⛈️"],
};

class WeatherError extends Error {}


async function getJson(url) {
  let response;
  try {
    response = await fetch(url);
  } catch (err) {
    throw new WeatherError("Network error. Check your internet connection and try again.");
  }
  if (!response.ok) {
    if (response.status === 404) throw new WeatherError("City not found. Check the spelling and try again.");
    if (response.status === 429) throw new WeatherError("Too many requests. Please wait a minute and try again.");
    if (response.status >= 500) throw new WeatherError("The weather service is having problems. Try again later.");
    throw new WeatherError(`Request failed (HTTP ${response.status}).`);
  }
  try {
    return await response.json();
  } catch (err) {
    throw new WeatherError("Received an unreadable response from the weather service.");
  }
}

async function fetchWeather(city) {
  const geo = await getJson(`${GEO_URL}?name=${encodeURIComponent(city)}&count=1&language=en&format=json`);
  if (!geo.results || geo.results.length === 0) {
    throw new WeatherError(`No city found matching "${city}". Check the spelling and try again.`);
  }
  const place = geo.results[0];

  const params = new URLSearchParams({
    latitude: place.latitude,
    longitude: place.longitude,
    timezone: "auto",
    wind_speed_unit: "kmh",
    current: "temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,pressure_msl,is_day",
  });
  const data = await getJson(`${FORECAST_URL}?${params}`);
  if (!data.current) throw new WeatherError("Weather data was missing from the response.");

  const c = data.current;
  const [description, dayIcon, nightIcon] = WMO[c.weather_code] || ["Unknown conditions", "🌡️", "🌡️"];
  return {
    name: [place.name, place.admin1, place.country].filter(Boolean).join(", "),
    time: c.time,
    temperature: c.temperature_2m,
    feelsLike: c.apparent_temperature,
    humidity: c.relative_humidity_2m,
    wind: c.wind_speed_10m,
    pressure: c.pressure_msl,
    description,
    icon: c.is_day ? dayIcon : nightIcon,
  };
}


function render(w) {
  document.getElementById("place").textContent = w.name;
  document.getElementById("updated").textContent =
    "Updated " + new Date(w.time).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
  document.getElementById("icon").textContent = w.icon;
  document.getElementById("temp").textContent = Math.round(w.temperature) + "°C";
  document.getElementById("conditions").textContent = w.description;

  const rows = [
    ["Feels like", Math.round(w.feelsLike) + "°C"],
    ["Humidity", Math.round(w.humidity) + "%"],
    ["Wind", Math.round(w.wind) + " km/h"],
    ["Pressure", Math.round(w.pressure) + " hPa"],
  ];
  const list = document.getElementById("details");
  list.innerHTML = "";
  for (const [label, value] of rows) {
    const box = document.createElement("div");
    const dt = document.createElement("dt");
    const dd = document.createElement("dd");
    dt.textContent = label;
    dd.textContent = value;
    box.append(dt, dd);
    list.appendChild(box);
  }
  weatherEl.hidden = false;
}

function showError(message) {
  weatherEl.hidden = true;
  errorEl.textContent = message;
  errorEl.hidden = false;
}

let latest = 0; 

async function search(city) {
  const id = ++latest;
  errorEl.hidden = true;
  weatherEl.hidden = true;
  loadingEl.hidden = false;
  button.disabled = true;
  input.disabled = true;
  try {
    const weather = await fetchWeather(city);
    if (id === latest) render(weather);
  } catch (err) {
    if (id === latest) showError(err instanceof WeatherError ? err.message : "Something went wrong. Please try again.");
  } finally {
    if (id === latest) {
      loadingEl.hidden = true;
      button.disabled = false;
      input.disabled = false;
      input.focus();
    }
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const city = input.value.trim();
  if (!city) return showError("Please enter a city name.");
  search(city);
});