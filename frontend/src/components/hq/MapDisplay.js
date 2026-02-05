import React, { useRef, useEffect, useImperativeHandle, forwardRef, useState, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Popup, CircleMarker, useMap, GeoJSON } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.heat';
import { Button } from '@/components/ui/button';
import { Eye, EyeOff, Thermometer, ZoomIn, ZoomOut, Locate, Layers, ChevronLeft, ChevronRight } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { KMLLayerPanel } from './KMLLayerPanel';

// Fix for default marker icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const createCustomIcon = (color, isSelected = false, isFinished = false) => {
  const size = isSelected ? 18 : 14;
  const opacity = isFinished ? 0.5 : 1;
  const border = isSelected ? '3px solid #fff' : '2px solid #fff';
  const glow = isSelected ? `0 0 12px ${color}, 0 0 4px rgba(255,255,255,0.8)` : `0 0 8px ${color}`;
  
  return new L.DivIcon({
    className: 'custom-marker',
    html: `<div style="background-color: ${color}; width: ${size}px; height: ${size}px; border-radius: 50%; border: ${border}; box-shadow: ${glow}; opacity: ${opacity}; transition: all 0.2s ease;"></div>`,
    iconSize: [size, size],
    iconAnchor: [size/2, size/2]
  });
};

const iconColors = {
  // Derived status colors
  sos: '#ef4444',         // Red - SOS alert (flashing)
  completed: '#6b7280',   // Grey - different day session
  stopped: '#3b82f6',     // Blue - tracking stopped today
  active: '#22c55e',      // Green - ≤2 min since last location
  paused: '#f97316',      // Orange - 2-15 min since last location
  offline: '#dc2626',     // Red - >15 min or no location
  // Legacy/fallback
  tracking: '#22c55e',
  inactive: '#71717a',
  assigned: '#eab308',
  approved: '#3b82f6',
  finished: '#6b7280',
  pending: '#f97316'
};

const mapTiles = {
  normal: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  terrain: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
  dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
};

// Map Controller Component
const MapController = forwardRef(({ selectedPatrolId, patrols }, ref) => {
  const map = useMap();
  const markersRef = useRef({});

  useImperativeHandle(ref, () => ({
    flyToPatrol: (patrolId) => {
      const patrol = patrols.find(p => p.id === patrolId);
      if (patrol && patrol.latitude && patrol.longitude) {
        map.flyTo([patrol.latitude, patrol.longitude], 16, { duration: 0.5 });
        if (markersRef.current[patrolId]) {
          markersRef.current[patrolId].openPopup();
        }
      }
    },
    setMarkerRef: (patrolId, markerRef) => {
      markersRef.current[patrolId] = markerRef;
    },
    zoomIn: () => map.zoomIn(),
    zoomOut: () => map.zoomOut(),
    resetView: () => map.setView([21.4272, 92.0058], 10)
  }));

  return null;
});

// Custom Zoom Control Component
const ZoomControl = ({ onZoomIn, onZoomOut, onReset }) => (
  <div className="absolute bottom-20 left-3 z-[1000] flex flex-col gap-1">
    <Button
      size="sm"
      variant="outline"
      className="w-9 h-9 p-0 bg-[#1a2a1a]/90 border-[#3d5a3d]/50 hover:bg-[#2a3a2a] hover:border-[#b4a064]/50"
      onClick={onZoomIn}
      title="Zoom In"
    >
      <ZoomIn className="w-4 h-4 text-white" />
    </Button>
    <Button
      size="sm"
      variant="outline"
      className="w-9 h-9 p-0 bg-[#1a2a1a]/90 border-[#3d5a3d]/50 hover:bg-[#2a3a2a] hover:border-[#b4a064]/50"
      onClick={onZoomOut}
      title="Zoom Out"
    >
      <ZoomOut className="w-4 h-4 text-white" />
    </Button>
    <Button
      size="sm"
      variant="outline"
      className="w-9 h-9 p-0 bg-[#1a2a1a]/90 border-[#3d5a3d]/50 hover:bg-[#2a3a2a] hover:border-[#b4a064]/50 mt-1"
      onClick={onReset}
      title="Reset View"
    >
      <Locate className="w-4 h-4 text-white" />
    </Button>
  </div>
);

// SOS Alert Marker - Pulsing red marker for emergencies
const SOSAlertMarker = ({ alert }) => {
  if (!alert.latitude || !alert.longitude) return null;
  
  const sosIcon = new L.DivIcon({
    className: 'sos-marker',
    html: `
      <div class="relative">
        <div style="
          position: absolute;
          width: 40px;
          height: 40px;
          top: -20px;
          left: -20px;
          background: rgba(239, 68, 68, 0.3);
          border-radius: 50%;
          animation: pulse-ring 1.5s cubic-bezier(0.215, 0.61, 0.355, 1) infinite;
        "></div>
        <div style="
          width: 24px;
          height: 24px;
          background: #ef4444;
          border: 3px solid white;
          border-radius: 50%;
          box-shadow: 0 0 20px rgba(239, 68, 68, 0.8);
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <span style="color: white; font-weight: bold; font-size: 14px;">!</span>
        </div>
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  });

  return (
    <Marker
      position={[alert.latitude, alert.longitude]}
      icon={sosIcon}
      zIndexOffset={1000}
    >
      <Popup className="sos-popup">
        <div className="p-2 bg-red-50 border-l-4 border-red-500">
          <div className="font-bold text-red-600 mb-1">🚨 SOS ALERT</div>
          <div className="text-sm font-medium">{alert.patrol_name || alert.patrol_id}</div>
          <div className="text-xs text-gray-600 mt-1">{alert.message}</div>
          <div className="text-xs text-gray-500 mt-1">
            {new Date(alert.timestamp).toLocaleString()}
          </div>
          {alert.auto_triggered && (
            <div className="text-xs text-orange-600 mt-1">⚠️ Auto-triggered (inactivity)</div>
          )}
        </div>
      </Popup>
    </Marker>
  );
};


// Patrol Marker Component
const PatrolMarker = ({ patrol, isSelected, isVisible, onPatrolClick, setMarkerRef }) => {
  const markerRef = useRef(null);
  
  useEffect(() => {
    if (markerRef.current && setMarkerRef) {
      setMarkerRef(patrol.id, markerRef.current);
    }
  }, [patrol.id, setMarkerRef]);

  if (!isVisible || patrol.latitude === 0 || patrol.longitude === 0) {
    return null;
  }

  const isFinished = patrol.status === 'finished' || (!patrol.is_tracking && patrol.session_ended);
  const isSOS = patrol.status === 'sos';
  const isTracking = patrol.is_tracking;
  
  // Determine color based on status priority: SOS > Tracking > Finished > Status
  let color;
  if (isSOS) {
    color = iconColors.sos;
  } else if (isFinished) {
    color = iconColors.finished;
  } else if (isTracking) {
    color = iconColors.tracking;
  } else {
    color = iconColors[patrol.status] || iconColors.inactive;
  }

  return (
    <Marker
      ref={markerRef}
      position={[patrol.latitude, patrol.longitude]}
      icon={createCustomIcon(color, isSelected, isFinished)}
      eventHandlers={{
        click: () => onPatrolClick(patrol)
      }}
    >
      <Popup className="tactical-popup">
        <div className="font-mono text-xs p-1">
          <div className="font-bold text-sm mb-1 text-primary">{patrol.name}</div>
          <div className="text-gray-600">ID: {patrol.id}</div>
          <div className="text-gray-600">Area: {patrol.assigned_area}</div>
          <div className="text-gray-600">
            Status: 
            <span className={`ml-1 font-medium ${
              isSOS ? 'text-red-500' : 
              isTracking ? 'text-green-500' : 
              isFinished ? 'text-gray-400' : 
              'text-blue-500'
            }`}>
              {isSOS ? '🚨 SOS' : isTracking ? '📍 TRACKING' : isFinished ? 'Finished' : patrol.status}
            </span>
          </div>
          <div className="text-gray-500 text-xs mt-1">Last: {new Date(patrol.last_update).toLocaleTimeString()}</div>
        </div>
      </Popup>
    </Marker>
  );
};

// Trail Component
const PatrolTrail = ({ trail, color = '#0ea5e9', showMarkers = true }) => {
  if (!trail || trail.length < 2) return null;
  
  const startPoint = trail[0];
  const endPoint = trail[trail.length - 1];
  
  return (
    <>
      <Polyline 
        positions={trail} 
        color={color} 
        weight={3} 
        opacity={0.8}
        dashArray={color === '#6b7280' ? '5,10' : null}
      />
      {showMarkers && (
        <>
          <CircleMarker center={startPoint} radius={8} fillColor="#22c55e" fillOpacity={1} color="#fff" weight={2}>
            <Popup><div className="text-xs font-mono"><strong>START</strong></div></Popup>
          </CircleMarker>
          <CircleMarker center={endPoint} radius={8} fillColor="#ef4444" fillOpacity={1} color="#fff" weight={2}>
            <Popup><div className="text-xs font-mono"><strong>FINISH</strong></div></Popup>
          </CircleMarker>
        </>
      )}
    </>
  );
};

// KML Layer Renderer
const KMLLayerRenderer = ({ layers }) => {
  if (!layers || layers.length === 0) return null;

  const getStyle = (feature, layer) => ({
    color: layer.color || '#3388ff',
    weight: 2,
    opacity: 0.8,
    fillColor: layer.color || '#3388ff',
    fillOpacity: 0.3
  });

  const onEachFeature = (feature, leafletLayer) => {
    if (feature.properties) {
      const name = feature.properties.name || feature.properties.Name || 'Unnamed';
      
      // Parse description to extract useful info (skip raw metadata)
      let description = feature.properties.description || '';
      
      // Check if description contains raw metadata (like ADM codes)
      if (description.includes('ADM') || description.includes('PCODE') || description.includes('Shape_')) {
        // Try to extract just the location name from metadata
        const admMatch = description.match(/ADM4_EN:\s*([^\n<]+)/);
        const districtMatch = description.match(/ADM2_EN:\s*([^\n<]+)/);
        
        if (admMatch || districtMatch) {
          const area = admMatch ? admMatch[1].trim() : '';
          const district = districtMatch ? districtMatch[1].trim() : '';
          description = [area, district].filter(Boolean).join(', ');
        } else {
          description = ''; // Hide raw metadata
        }
      }
      
      // Clean up HTML tags if present
      description = description.replace(/<[^>]*>/g, '').trim();
      
      // Only show popup with clean content
      const popupContent = `
        <div class="font-mono text-xs p-2 min-w-[120px]">
          <div class="font-bold text-sm mb-1 text-emerald-700">${name}</div>
          ${description ? `<div class="text-gray-600 text-xs">${description}</div>` : ''}
        </div>
      `;
      
      leafletLayer.bindPopup(popupContent);
    }
  };

  const pointToLayer = (feature, latlng, layer) => {
    return L.circleMarker(latlng, {
      radius: 6,
      fillColor: layer.color || '#3388ff',
      color: '#fff',
      weight: 2,
      opacity: 1,
      fillOpacity: 0.8
    });
  };

  return (
    <>
      {layers.filter(layer => layer.visible).map((layer) => (
        <GeoJSON
          key={`kml-${layer.id}-${layer.visible}`}
          data={{ type: 'FeatureCollection', features: layer.features }}
          style={(feature) => getStyle(feature, layer)}
          onEachFeature={onEachFeature}
          pointToLayer={(feature, latlng) => pointToLayer(feature, latlng, layer)}
        />
      ))}
    </>
  );
};

// HeatMap Layer Component
const HeatMapLayer = ({ patrols, visible }) => {
  const map = useMap();
  const heatLayerRef = useRef(null);

  useEffect(() => {
    if (!map) return;
    
    if (heatLayerRef.current) {
      map.removeLayer(heatLayerRef.current);
      heatLayerRef.current = null;
    }
    
    if (!visible || !patrols || patrols.length === 0) return;
    
    const heatData = patrols
      .filter(p => p.latitude && p.longitude)
      .map(p => {
        const isActive = p.is_tracking;
        const intensity = isActive ? 1.0 : 0.5;
        return [p.latitude, p.longitude, intensity];
      });
    
    if (heatData.length === 0) return;
    
    heatLayerRef.current = L.heatLayer(heatData, {
      radius: 35,
      blur: 25,
      maxZoom: 17,
      max: 1.0,
      gradient: { 0.0: '#00f', 0.25: '#0ff', 0.5: '#0f0', 0.75: '#ff0', 1.0: '#f00' }
    }).addTo(map);
    
    return () => {
      if (heatLayerRef.current && map) {
        map.removeLayer(heatLayerRef.current);
      }
    };
  }, [map, patrols, visible]);
  
  return null;
};

export const MapDisplay = forwardRef(({ 
  patrols, 
  visiblePatrols,
  mapType, 
  setMapType, 
  showTrails, 
  setShowTrails,
  showHeatMap,
  setShowHeatMap,
  trail,
  allTrails,
  selectedPatrolId,
  onPatrolClick,
  showControls = true,
  hqId,
  sosAlerts = []
}, ref) => {
  const mapCenter = [21.4272, 92.0058];
  const controllerRef = useRef(null);
  const [kmlLayers, setKmlLayers] = useState([]);
  const [showKMLPanel, setShowKMLPanel] = useState(false);
  const [showMapTypePanel, setShowMapTypePanel] = useState(false);

  useImperativeHandle(ref, () => ({
    flyToPatrol: (patrolId) => {
      if (controllerRef.current) {
        controllerRef.current.flyToPatrol(patrolId);
      }
    }
  }));

  const handleMarkerClick = (patrol) => {
    onPatrolClick(patrol);
  };

  const handleKMLLayersUpdate = useCallback((layers) => {
    setKmlLayers(layers);
  }, []);

  const handleZoomIn = () => controllerRef.current?.zoomIn();
  const handleZoomOut = () => controllerRef.current?.zoomOut();
  const handleReset = () => controllerRef.current?.resetView();

  return (
    <div className="absolute inset-0" data-testid="hq-map-container">
      {/* KML Layer Panel - Auto-hide on left */}
      <div 
        className={`absolute top-16 left-0 z-[1000] transition-transform duration-300 ${showKMLPanel ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <KMLLayerPanel onLayersUpdate={handleKMLLayersUpdate} hqId={hqId} />
      </div>
      
      {/* KML Panel Toggle Button */}
      <Button
        size="sm"
        variant="outline"
        className={`absolute top-16 z-[1001] transition-all duration-300 bg-[#1a2a1a]/90 border-[#3d5a3d]/50 hover:bg-[#2a3a2a] hover:border-[#b4a064]/50 h-10 px-2 ${showKMLPanel ? 'left-[260px]' : 'left-0 rounded-l-none'}`}
        onClick={() => setShowKMLPanel(!showKMLPanel)}
        title="Toggle KML Layers"
      >
        <Layers className="w-4 h-4 text-[#b4a064] mr-1" />
        {showKMLPanel ? <ChevronLeft className="w-3 h-3 text-white" /> : <ChevronRight className="w-3 h-3 text-white" />}
      </Button>
      
      {/* Top Control Bar - Compact floating controls */}
      <div className="absolute top-2 left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-2">
        {/* Map Type Selector */}
        <div className="flex gap-1 bg-[#1a2a1a]/90 backdrop-blur-sm p-1 rounded-lg border border-[#3d5a3d]/50">
          {['normal', 'satellite', 'terrain', 'dark'].map((type) => (
            <Button
              key={type}
              size="sm"
              variant={mapType === type ? 'default' : 'ghost'}
              onClick={() => setMapType(type)}
              className={`h-7 px-3 text-xs font-medium ${mapType === type ? 'bg-[#b4a064] text-black' : 'text-gray-300 hover:text-white hover:bg-[#2a3a2a]'}`}
            >
              {type === 'normal' ? 'Map' : type === 'satellite' ? 'Sat' : type === 'terrain' ? 'Topo' : 'Dark'}
            </Button>
          ))}
        </div>
        
        {/* Heat Map & Trails Toggle */}
        <div className="flex items-center gap-3 bg-[#1a2a1a]/90 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-[#3d5a3d]/50">
          {setShowHeatMap && (
            <div className="flex items-center gap-2">
              <Thermometer className={`w-4 h-4 ${showHeatMap ? 'text-orange-400' : 'text-gray-500'}`} />
              <span className="text-[10px] text-gray-400 uppercase">Heat</span>
              <Switch checked={showHeatMap} onCheckedChange={setShowHeatMap} className="scale-75" />
            </div>
          )}
          {setShowTrails && (
            <div className="flex items-center gap-2 border-l border-[#3d5a3d]/50 pl-3">
              <span className="text-[10px] text-gray-400 uppercase">Trails</span>
              <Switch checked={showTrails} onCheckedChange={setShowTrails} className="scale-75" />
            </div>
          )}
        </div>
      </div>

      {/* Custom Zoom Controls - Bottom Left, properly spaced */}
      <ZoomControl onZoomIn={handleZoomIn} onZoomOut={handleZoomOut} onReset={handleReset} />

      {/* Main Map Container - Full screen */}
      <MapContainer 
        center={mapCenter} 
        zoom={10} 
        className="w-full h-full"
        zoomControl={false}
        attributionControl={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url={mapTiles[mapType] || mapTiles.normal}
        />
        
        <MapController 
          ref={controllerRef} 
          selectedPatrolId={selectedPatrolId} 
          patrols={patrols}
        />

        {/* Heat Map Layer */}
        <HeatMapLayer patrols={patrols} visible={showHeatMap} />

        {/* KML Layers */}
        <KMLLayerRenderer layers={kmlLayers} />

        {/* Patrol Markers */}
        {patrols.map(patrol => (
          <PatrolMarker
            key={patrol.id}
            patrol={patrol}
            isSelected={patrol.id === selectedPatrolId}
            isVisible={visiblePatrols instanceof Set ? visiblePatrols.has(patrol.id) : true}
            onPatrolClick={handleMarkerClick}
            setMarkerRef={controllerRef.current?.setMarkerRef}
          />
        ))}

        {/* Trail for selected patrol */}
        {showTrails && trail && trail.length > 0 && (
          <PatrolTrail trail={trail} color="#0ea5e9" />
        )}

        {/* All trails when enabled */}
        {showTrails && allTrails && Array.isArray(allTrails) && allTrails.map((trailData) => {
          if (trailData.patrol_id === selectedPatrolId) return null;
          if (!trailData.points || trailData.points.length === 0) return null;
          const isFinished = trailData.status === 'finished';
          return (
            <PatrolTrail 
              key={trailData.patrol_id} 
              trail={trailData.points} 
              color={isFinished ? '#6b7280' : '#22c55e'} 
              showMarkers={false}
            />
          );
        })}

        {/* SOS Alert Markers */}
        {sosAlerts && sosAlerts.map(alert => (
          <SOSAlertMarker key={`sos-${alert.patrol_id}-${alert.timestamp}`} alert={alert} />
        ))}
      </MapContainer>
    </div>
  );
});

export default MapDisplay;
