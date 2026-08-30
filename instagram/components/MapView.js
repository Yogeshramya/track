"use client";

import { useEffect, useRef } from 'react';
import L from 'leaflet';

export default function MapView({ locations }) {
  const mapRef = useRef(null);
  const leafletMapObj = useRef(null);
  const markersRef = useRef(new Map());

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (!leafletMapObj.current && mapRef.current) {
      const map = L.map(mapRef.current).setView([20.5937, 78.9629], 5);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap'
      }).addTo(map);

      leafletMapObj.current = map;
    }
  }, []);

  useEffect(() => {
    if (!leafletMapObj.current || typeof window === 'undefined') return;
    const map = leafletMapObj.current;

    locations.forEach((loc) => {
      const { id, name, latitude, longitude, accuracy, ip } = loc;
      const latLng = [latitude, longitude];

      if (!markersRef.current.has(id)) {
        const customIcon = L.divIcon({
          className: 'custom-map-pin',
          html: `<div style="background:#10B981; width:18px; height:18px; border-radius:50%; border:3px solid white; box-shadow:0 0 15px #10B981;"></div>`,
          iconSize: [18, 18],
          iconAnchor: [9, 9]
        });

        const marker = L.marker(latLng, { icon: customIcon }).addTo(map);
        marker.bindPopup(`<b>${name}</b><br>IP: ${ip || 'Unknown'}<br>Lat: ${latitude.toFixed(4)}, Lng: ${longitude.toFixed(4)}`).openPopup();

        const circle = L.circle(latLng, {
          radius: accuracy || 15,
          color: '#10B981',
          fillColor: '#10B981',
          fillOpacity: 0.15,
          weight: 1
        }).addTo(map);

        const polyline = L.polyline([latLng], {
          color: '#6366F1',
          weight: 4,
          opacity: 0.8,
          dashArray: '6, 8'
        }).addTo(map);

        markersRef.current.set(id, { marker, circle, polyline, pathCoords: [latLng] });
        map.setView(latLng, 16);
      } else {
        const mObj = markersRef.current.get(id);
        mObj.marker.setLatLng(latLng);
        mObj.circle.setLatLng(latLng);
        if (accuracy) mObj.circle.setRadius(accuracy);

        mObj.pathCoords.push(latLng);
        mObj.polyline.setLatLngs(mObj.pathCoords);
      }
    });
  }, [locations]);

  return (
    <div className="map-container-wrapper">
      <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}
