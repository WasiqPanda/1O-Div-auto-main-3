import React from 'react';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

export const TestMap = () => {
  const center = [21.4272, 92.0058]; // Cox's Bazar, Bangladesh
  
  return (
    <div style={{ height: '100vh', width: '100%' }}>
      <h1 style={{ color: 'white', padding: '20px' }}>Map Test Page</h1>
      <div style={{ height: '80%', width: '100%' }}>
        <MapContainer 
          center={center} 
          zoom={13} 
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://carto.com/">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />
          <Marker position={center} />
        </MapContainer>
      </div>
    </div>
  );
};
