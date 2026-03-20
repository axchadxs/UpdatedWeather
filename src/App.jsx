import { useState } from "react";

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

export default function App() {
  const [cityInput, setCityInput] = useState("");
  const [message, setMessage] = useState("");
  const [cities, setCities] = useState([]);

  async function handleSubmit(event) {
    event.preventDefault();

    const query = cityInput.trim();
    if (!query) {
      setMessage("Please search for a valid city using the format below");
      return;
    }

    try {
      const response = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(query)}&appid=${apiKey}&units=imperial`
      );
      const data = await response.json();

      if (!response.ok || !data?.weather?.length || !data?.main || !data?.sys) {
        throw new Error("Invalid city");
      }

      const weatherItem = {
        id: `${data.name}-${data.sys.country}`,
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
        sunsetTime: toTime(data.sys.sunset)
      };

      setCities((prev) => [weatherItem, ...prev.filter((item) => item.id !== weatherItem.id)]);
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
        </div>
        <div>
          <p className="suggestion">e.g. New York, US</p>
        </div>
      </section>

      <section className="ajax-section">
        <div className="container">
          <ul className="cities">
            {cities.map((city) => (
              <li className="city" key={city.id}>
                <div className="weather-card">
                  <div className="left-content">
                    <h2 className="city-name" data-name={`${city.cityName},${city.country}`}>
                      <span>{city.cityName}</span>
                      <sup>{city.country}</sup>
                    </h2>
                    <div className="city-temp">
                      {city.temp}
                      <sup>°F</sup>
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
                  <span className="detail-label">Wind:</span>
                  <span className="detail-value">
                    {city.windSpeed} mph {city.windDirection}
                  </span>
                </div>
                <div className="detail-item">
                  <span className="detail-value">
                    High: {city.tempMax}°F Low: {city.tempMin}°F
                  </span>
                </div>
                <div className="sun-times">
                  <div className="sunrise">
                    <span className="sun-label">Sunrise</span>
                    <span className="sun-value">{city.sunriseTime}</span>
                  </div>
                  <div className="sunset">
                    <span className="sun-label">Sunset</span>
                    <span className="sun-value">{city.sunsetTime}</span>
                  </div>
                </div>
              </li>
            ))}
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
