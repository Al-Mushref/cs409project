import React, { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import axios from "axios";
import Searcher from "./components/Searcher";
import Callback from "./pages/Callback";
import "./App.css";

function App() {
  const CLIENT_ID = process.env.REACT_APP_SPOTIFY_CLIENT_ID || "";
  const REDIRECT_URI = process.env.REACT_APP_SPOTIFY_REDIRECT_URI || "http://127.0.0.1:5002/callback";
  const AUTH_ENDPOINT = "https://accounts.spotify.com/authorize";

  const [token, setToken] = useState(() => localStorage.getItem("spotify_token") || "");

  const logout = () => {
    setToken("");
    localStorage.removeItem("spotify_token");
  };

  const handleLogin = () => {
    const scopes = [
      "user-read-private",
      "user-read-email",
      "playlist-modify-public",
      "playlist-modify-private"
    ].join(" ");
    const authorizeUrl = `${AUTH_ENDPOINT}?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(
      REDIRECT_URI
    )}&scope=${encodeURIComponent(scopes)}`;
    window.location.href = authorizeUrl;
  };

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/callback" element={<Callback />} />
        <Route
          path="/"
          element={
            <div className="App">
              <header className="App-header">
                {!token ? (
                  <div className="login-shell">
                    <div className="login-background">
                      <div className="login-orb login-orb--1" />
                      <div className="login-orb login-orb--2" />
                      <div className="login-orb login-orb--3" />
                    </div>
                    <div className="login-container">
                      <div className="cadence-logo">
                        <img src="/logo-bg-removed.png" alt="Cadence" className="cadence-logo-img" />
                      </div>
                      <button className="login-btn" onClick={handleLogin}>
                        Login with Spotify
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="search-shell">
                    <div className="search-background">
                      <div className="search-orb search-orb--1" />
                      <div className="search-orb search-orb--2" />
                      <div className="search-orb search-orb--3" />
                    </div>
                    <div className="search-container">
                      <button className="logOut" onClick={logout}>
                        Logout
                      </button>
                      <Searcher token={token} />
                    </div>
                  </div>
                )}
              </header>
            </div>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
