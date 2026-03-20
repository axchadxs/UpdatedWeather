import React, { useEffect, useState } from "react";

const apiKey = import.meta.env.VITE_OWM_API_KEY || "7408bf298a7b96211051fc6d8e4efc79";

function getCustomIconPath(iconCode) {
  const iconMap = {
    "01d": "clear-day",
    "01n": "clear-night",
    "02d": "partly-cloudy-day",
    "02n": "partly-cloudy-night",
    "03d": "cloudy",
    "03n": "cloudy",
    "04d": "cloudy",
    "04n": "cloudy",
    "09d": "rain-day",
    "09n": "rain",
    "10d": "rain",
    "10n": "rain",
    "11d": "storm",
    "11n": "storm",
    "13d": "snow",
    "13n": "snow",
    "50d": "fog",
    "50n": "fog"
  };

  const iconName = iconMap[iconCode] || "clear-day";
  return `/icons/${iconName}.gif`;
}

function getWindDirection(degrees = 0) {
  const directions = [
    "N",
    "NNE",
    "NE",
    "ENE",
    "E",
    "ESE",
    "SE",
    "SSE",
    "S",
    "SSW",
    "SW",
    "WSW",
    "W",
    "WNW",
    "NW",
    "NNW"
  ];
  const index = Math.round(degrees / 22.5) % 16;
  return directions[index];
}

function toTime(unixTime) {
  return new Date(unixTime * 1000).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function toDateTime(unixTime) {
  return new Date(unixTime * 1000).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function toDayLabel(dateKey) {
  return new Date(`${dateKey}T00:00:00`).toLocaleDateString("en-US", { weekday: "short" });
}

export default function App() {
  const [unit, setUnit] = useState(() => localStorage.getItem("weather-unit") || "imperial");
  const [theme, setTheme] = useState(() => localStorage.getItem("weather-theme") || "light");
  const [cityInput, setCityInput] = useState("");
  const [message, setMessage] = useState("");
  const [cities, setCities] = useState([]);
  const [forecasts, setForecasts] = useState({});
  const [alertsByCity, setAlertsByCity] = useState({});
  const [dismissedAlerts, setDismissedAlerts] = useState(() => {
    try {
      const saved = localStorage.getItem("weather-dismissed-alerts");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [favorites, setFavorites] = useState(() => {
    try {
      const saved = localStorage.getItem("weather-favorites");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isLocating, setIsLocating] = useState(false);

  const isImperial = unit === "imperial";
  const isDarkTheme = theme === "dark";
  const tempUnitLabel = isImperial ? "°F" : "°C";
  const windUnitLabel = isImperial ? "mph" : "m/s";

  function buildWeatherItem(data) {
    return {
      id: `${data.name}-${data.sys.country}`,
      queryKey: `${data.name},${data.sys.country}`,
      cityName: data.name,
      country: data.sys.country,
      temp: Math.round(data.main.temp),
      description: data.weather[0].description,
      iconPath: getCustomIconPath(data.weather[0].icon),
      iconAlt: data.weather[0].main,
      humidity: data.main.humidity,
      windSpeed: Math.round(data.wind?.speed || 0),
      windDirection: getWindDirection(data.wind?.deg || 0),
      tempMax: Math.round(data.main.temp_max),
      tempMin: Math.round(data.main.temp_min),
      sunriseTime: toTime(data.sys.sunrise),
      sunsetTime: toTime(data.sys.sunset),
      lat: data.coord?.lat,
      lon: data.coord?.lon
    };
  }

  function buildForecastItems(data) {
    const daily = new Map();

    for (const item of data.list || []) {
      const dateKey = item.dt_txt?.split(" ")[0];
      if (!dateKey) {
        continue;
      }

      const hour = Number(item.dt_txt.slice(11, 13));
      const score = Math.abs(hour - 12);
      const existing = daily.get(dateKey);

      if (!existing || score < existing.score) {
        daily.set(dateKey, { item, score });
      }
    }

    return [...daily.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(0, 5)
      .map(([dateKey, entry]) => ({
        dateKey,
        dayLabel: toDayLabel(dateKey),
        tempMin: Math.round(entry.item.main.temp_min),
        tempMax: Math.round(entry.item.main.temp_max),
        description: entry.item.weather?.[0]?.description || "",
        iconPath: getCustomIconPath(entry.item.weather?.[0]?.icon),
        iconAlt: entry.item.weather?.[0]?.main || "Weather"
      }));
  }

  function buildAlertItems(data) {
    if (!Array.isArray(data?.alerts)) {
      return [];
    }

    return data.alerts.slice(0, 3).map((alert) => ({
      id: `${alert.event || "Alert"}-${alert.start || 0}`,
      event: alert.event || "Weather Alert",
      sender: alert.sender_name || "Weather Service",
      start: alert.start ? toDateTime(alert.start) : "",
      end: alert.end ? toDateTime(alert.end) : "",
      description: (alert.description || "").trim().slice(0, 180)
    }));
  }

  async function fetchWeatherByUrl(url) {
    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok || !data?.weather?.length || !data?.main || !data?.sys) {
      throw new Error("Invalid city");
    }

    return buildWeatherItem(data);
  }

  async function fetchWeatherByQuery(query) {
    return fetchWeatherByUrl(
      `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(query)}&appid=${apiKey}&units=${unit}`
    );
  }

  async function fetchWeatherByCoords(lat, lon) {
    return fetchWeatherByUrl(
      `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=${unit}`
    );
  }

  async function fetchForecastByQuery(query) {
    const response = await fetch(
      `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(query)}&appid=${apiKey}&units=${unit}`
    );
    const data = await response.json();

    if (!response.ok || !Array.isArray(data?.list)) {
      throw new Error("Invalid forecast data");
    }

    return buildForecastItems(data);
  }

  async function fetchAlertsByCoords(lat, lon) {
    const response = await fetch(
      `https://api.openweathermap.org/data/3.0/onecall?lat=${lat}&lon=${lon}&appid=${apiKey}&exclude=current,minutely,hourly,daily`
    );

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    return buildAlertItems(data);
  }

  function upsertCity(weatherItem) {
    setCities((prev) => [weatherItem, ...prev.filter((item) => item.id !== weatherItem.id)]);
  }

  async function upsertCityWithForecast(weatherItem) {
    upsertCity(weatherItem);

    const [forecastResult, alertResult] = await Promise.allSettled([
      fetchForecastByQuery(weatherItem.queryKey),
      fetchAlertsByCoords(weatherItem.lat, weatherItem.lon)
    ]);

    setForecasts((prev) => ({
      ...prev,
      [weatherItem.id]: forecastResult.status === "fulfilled" ? forecastResult.value : []
    }));
    setAlertsByCity((prev) => ({
      ...prev,
      [weatherItem.id]: alertResult.status === "fulfilled" ? alertResult.value : []
    }));
  }

  function dismissAlert(cityId, alertId) {
    setDismissedAlerts((prev) => ({
      ...prev,
      [cityId]: [...(prev[cityId] || []), alertId]
    }));
  }

  async function detectLocation(silent = false) {
    if (!navigator.geolocation) {
      if (!silent) {
        setMessage("Geolocation is not supported in this browser.");
      }
      return;
    }

    setIsLocating(true);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const weatherItem = await fetchWeatherByCoords(position.coords.latitude, position.coords.longitude);
          await upsertCityWithForecast(weatherItem);
          setMessage("");
        } catch {
          if (!silent) {
            setMessage("Could not get weather for your current location.");
          }
        } finally {
          setIsLocating(false);
        }
      },
      () => {
        if (!silent) {
          setMessage("Location access was denied. You can still search by city.");
        }
        setIsLocating(false);
      },
      { timeout: 10000 }
    );
  }

  function toggleFavorite(queryKey) {
    setFavorites((prev) => {
      const exists = prev.includes(queryKey);
      return exists ? prev.filter((item) => item !== queryKey) : [queryKey, ...prev];
    });
  }

  async function handleFavoriteClick(queryKey) {
    try {
      const weatherItem = await fetchWeatherByQuery(queryKey);
      await upsertCityWithForecast(weatherItem);
      setMessage("");
    } catch {
      setMessage("Could not load that favorite city right now.");
    }
  }

  useEffect(() => {
    localStorage.setItem("weather-unit", unit);
  }, [unit]);

  useEffect(() => {
    localStorage.setItem("weather-theme", theme);
  }, [theme]);

  useEffect(() => {
    document.body.classList.toggle("theme-dark", isDarkTheme);

    return () => {
      document.body.classList.remove("theme-dark");
    };
  }, [isDarkTheme]);

  useEffect(() => {
    localStorage.setItem("weather-favorites", JSON.stringify(favorites));
  }, [favorites]);

  useEffect(() => {
    localStorage.setItem("weather-dismissed-alerts", JSON.stringify(dismissedAlerts));
  }, [dismissedAlerts]);

  useEffect(() => {
    detectLocation(true);
  }, []);

  useEffect(() => {
    if (!cities.length) {
      return;
    }

    let isCancelled = false;

    async function refreshForUnit() {
      const refreshed = await Promise.all(
        cities.map(async (city) => {
          try {
            const weatherItem = await fetchWeatherByQuery(city.queryKey);
            const forecastItems = await fetchForecastByQuery(weatherItem.queryKey);
            return { weatherItem, forecastItems };
          } catch {
            return null;
          }
        })
      );

      if (isCancelled) {
        return;
      }

      const valid = refreshed.filter(Boolean);
      if (valid.length) {
        const nextForecasts = {};
        const nextAlerts = {};
        valid.forEach(({ weatherItem, forecastItems }) => {
          nextForecasts[weatherItem.id] = forecastItems;
        });

        const alertResults = await Promise.all(
          valid.map(async ({ weatherItem }) => {
            const alerts = await fetchAlertsByCoords(weatherItem.lat, weatherItem.lon).catch(() => []);
            return { cityId: weatherItem.id, alerts };
          })
        );

        alertResults.forEach(({ cityId, alerts }) => {
          nextAlerts[cityId] = alerts;
        });

        setCities(valid.map(({ weatherItem }) => weatherItem));
        setForecasts(nextForecasts);
        setAlertsByCity(nextAlerts);
      }
    }

    refreshForUnit();

    return () => {
      isCancelled = true;
    };
  }, [unit]);

  async function handleSubmit(event) {
    event.preventDefault();

    const query = cityInput.trim();
    if (!query) {
      setMessage("Please search for a valid city using the format below");
      return;
    }

    try {
      const weatherItem = await fetchWeatherByQuery(query);
      await upsertCityWithForecast(weatherItem);
      setMessage("");
      setCityInput("");
    } catch {
      setMessage("Please search for a valid city using the format below");
    }
  }

  return (
    <>
      <section className="top-banner">
        <div className="container">
          <h1 className="heading">Weather App</h1>
          <form onSubmit={handleSubmit}>
            <span className="search-help" aria-label="Search format help" tabIndex={0}>
              ?
              <span className="search-help-tip">e.g. New York, US</span>
            </span>
            <input
              type="text"
              placeholder="Search for a city"
              value={cityInput}
              onChange={(event) => setCityInput(event.target.value)}
              autoFocus
            />
            <button type="submit">SUBMIT</button>
            <span className="msg">{message}</span>
          </form>
          <div className="controls-row">
            <button type="button" className="control-btn" onClick={() => setUnit(isImperial ? "metric" : "imperial")}>
              Switch to {isImperial ? "°C" : "°F"}
            </button>
            <button type="button" className="control-btn" onClick={() => setTheme(isDarkTheme ? "light" : "dark")}>
              {isDarkTheme ? "Light Mode" : "Dark Mode"}
            </button>
            <button type="button" className="control-btn" onClick={() => detectLocation(false)} disabled={isLocating}>
              {isLocating ? "Locating..." : "Use My Location"}
            </button>
          </div>
          {!!favorites.length && (
            <div className="favorite-row">
              {favorites.map((favoriteCity) => (
                <button
                  key={favoriteCity}
                  type="button"
                  className="favorite-chip"
                  onClick={() => handleFavoriteClick(favoriteCity)}
                >
                  {favoriteCity}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="ajax-section">
        <div className="container">
          <ul className="cities">
            {cities.map((city) => {
              const cityForecast = forecasts[city.id] || [];
              const hiddenAlertIds = dismissedAlerts[city.id] || [];
              const visibleAlerts = (alertsByCity[city.id] || []).filter((alert) => !hiddenAlertIds.includes(alert.id));

              return (
                <li className="city" key={city.id}>
                  {!!visibleAlerts.length && (
                    <div className="alert-stack">
                      {visibleAlerts.map((alert) => (
                        <div className="alert-banner" key={alert.id}>
                          <div>
                            <p className="alert-title">⚠ {alert.event}</p>
                            <p className="alert-meta">
                              {alert.sender}
                              {alert.start ? ` • ${alert.start}` : ""}
                              {alert.end ? ` to ${alert.end}` : ""}
                            </p>
                            {!!alert.description && <p className="alert-desc">{alert.description}</p>}
                          </div>
                          <button
                            type="button"
                            className="alert-dismiss"
                            onClick={() => dismissAlert(city.id, alert.id)}
                            aria-label="Dismiss weather alert"
                          >
                            Dismiss
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="city-layout">
                    <div className="city-main">
                      <div className="weather-card">
                        <div className="left-content">
                          <h2 className="city-name" data-name={`${city.cityName},${city.country}`}>
                            <span>{city.cityName}</span>
                            <sup>{city.country}</sup>
                          </h2>
                          <button
                            type="button"
                            className="favorite-toggle"
                            onClick={() => toggleFavorite(city.queryKey)}
                            aria-label="Toggle favorite city"
                          >
                            {favorites.includes(city.queryKey) ? "★ Favorited" : "☆ Favorite"}
                          </button>
                          <div className="city-temp">
                            {city.temp}
                            <sup>{tempUnitLabel}</sup>
                          </div>
                          <div className="weather-details">
                            <span className="details">{city.description}</span>
                          </div>
                        </div>
                        <figure className="weather-icon">
                          <img className="city-icon" src={city.iconPath} alt={city.iconAlt} />
                        </figure>
                      </div>
                      <span className="detail">Humidity: {city.humidity}%</span>
                      <div className="detail-item">
                        <span className="detail-label">Wind: </span>
                        <span className="detail-value">
                          {city.windSpeed} {windUnitLabel} {city.windDirection}
                        </span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-value">
                          High: {city.tempMax}
                          {tempUnitLabel} Low: {city.tempMin}
                          {tempUnitLabel}
                        </span>
                      </div>
                      <div className="sun-times">
                        <div className="sunrise">
                          <span className="sun-label">Sunrise: </span>
                          <span className="sun-value">{city.sunriseTime}</span>
                        </div>
                        <div className="sunset">
                          <span className="sun-label">Sunset: </span>
                          <span className="sun-value">{city.sunsetTime}</span>
                        </div>
                      </div>
                    </div>
                    {!!cityForecast.length && (
                      <div className="forecast-section">
                        <p className="forecast-title">5-Day Forecast</p>
                        <ul className="forecast-list">
                          {cityForecast.map((day) => (
                            <li className="forecast-item" key={`${city.id}-${day.dateKey}`}>
                              <span className="forecast-day">{day.dayLabel}</span>
                              <img className="forecast-icon" src={day.iconPath} alt={day.iconAlt} />
                              <span className="forecast-temp">
                                {day.tempMax}
                                {tempUnitLabel}/{day.tempMin}
                                {tempUnitLabel}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <footer className="page-footer">
        <div className="container">
          <p>Created by Alex</p>
        </div>
      </footer>
    </>
  );
}
