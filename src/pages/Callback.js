import React, { useEffect } from 'react';

function Callback() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const error = params.get('error');

    if (error) {
      console.error('Spotify error:', error);
      window.location.href = '/';
      return;
    }

    if (code) {
      fetch('http://127.0.0.1:5001/api/auth/callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.access_token) {
            localStorage.setItem('spotify_token', data.access_token);
          }
          window.location.href = '/';
        })
        .catch((err) => {
          console.error('Exchange error:', err);
          window.location.href = '/';
        });
    }
  }, []);

  return <div>Authenticating...</div>;
}

export default Callback;
