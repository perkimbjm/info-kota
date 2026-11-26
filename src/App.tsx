import { useState, useEffect } from 'react';
import WeatherForecast from "./components/WeatherForecast";
import AirQuality from "./components/AirQuality";
import TidalFlood from "./components/TidalFlood";

function App() {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  useEffect(() => {
    const handleLocationChange = () => {
      setCurrentPath(window.location.pathname);
    };

    window.addEventListener('popstate', handleLocationChange);
    
    // Override pushState and replaceState to catch in-app navigation
    const originalPushState = window.history.pushState;
    window.history.pushState = function (...args) {
      originalPushState.apply(this, args);
      handleLocationChange();
    };

    const originalReplaceState = window.history.replaceState;
    window.history.replaceState = function (...args) {
      originalReplaceState.apply(this, args);
      handleLocationChange();
    };

    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
    };
  }, []);

  if (currentPath === '/rob') {
    return <TidalFlood />;
  }

  if (currentPath === '/udara') {
    return <AirQuality />;
  }

  return <WeatherForecast />;
}

export default App;