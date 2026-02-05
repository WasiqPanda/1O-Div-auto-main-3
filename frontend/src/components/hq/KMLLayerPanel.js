import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Layers, MapPin, Route, Square, RefreshCw, Eye, EyeOff, ChevronLeft, Upload, Trash2, FileUp, X } from 'lucide-react';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

// Google Maps KML URL from the uploaded KMZ file
const KML_SOURCE_URL = 'https://www.google.com/maps/d/kml?mid=1aQqIVEKSDv4m631OQJyIzDBtJsdf5U0';

// Helper to fetch GeoJSON directly from backend (server-side KML parsing)
const fetchGeoJSONFromBackend = async (url) => {
  try {
    const apiUrl = `${API}/api/kml/geojson?url=${encodeURIComponent(url)}`;
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || `HTTP ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching GeoJSON from backend:', error);
    throw error;
  }
};

// Fetch uploaded KML files for HQ
const fetchUploadedKMLFiles = async (hqId) => {
  try {
    const response = await fetch(`${API}/api/kml/files?hq_id=${hqId}`);
    if (!response.ok) throw new Error('Failed to fetch files');
    return await response.json();
  } catch (error) {
    console.error('Error fetching uploaded KML files:', error);
    return [];
  }
};

// Fetch GeoJSON for uploaded file
const fetchUploadedFileGeoJSON = async (fileId) => {
  try {
    const response = await fetch(`${API}/api/kml/files/${fileId}`);
    if (!response.ok) throw new Error('Failed to fetch file');
    return await response.json();
  } catch (error) {
    console.error('Error fetching file GeoJSON:', error);
    return null;
  }
};

// Extract layer groups from GeoJSON features
const extractLayers = (geojson) => {
  if (!geojson || !geojson.features) {
    console.log('No features in GeoJSON');
    return [];
  }
  
  console.log(`Extracting layers from ${geojson.features.length} features`);
  
  const layerMap = new Map();
  
  geojson.features.forEach((feature, index) => {
    // Get folder/layer name from properties - handle various KML exports
    const folderName = feature.properties?.folder || 
                       feature.properties?.styleUrl?.replace('#', '') || 
                       feature.properties?.name?.substring(0, 30) || 
                       `Layer ${Math.floor(index / 50)}`;
    
    // Group by first part of name (e.g., "(1 EB) Name" -> "1 EB")
    const nameMatch = feature.properties?.name?.match(/^\(([^)]+)\)/);
    const groupKey = nameMatch ? nameMatch[1] : folderName;
    
    if (!layerMap.has(groupKey)) {
      layerMap.set(groupKey, {
        id: `layer_${layerMap.size}`,
        name: groupKey,
        visible: false,  // OFF by default - user must toggle ON
        features: [],
        color: getColorFromStyle(groupKey),
        type: 'mixed'
      });
    }
    
    layerMap.get(groupKey).features.push(feature);
  });
  
  // Update layer types based on majority geometry
  layerMap.forEach(layer => {
    const types = layer.features.map(f => f.geometry?.type).filter(Boolean);
    const pointCount = types.filter(t => t === 'Point').length;
    const polyCount = types.filter(t => t === 'Polygon').length;
    const lineCount = types.filter(t => t === 'LineString').length;
    
    if (pointCount > polyCount && pointCount > lineCount) {
      layer.type = 'point';
    } else if (polyCount > pointCount && polyCount > lineCount) {
      layer.type = 'polygon';
    } else if (lineCount > pointCount && lineCount > polyCount) {
      layer.type = 'line';
    }
  });
  
  const layers = Array.from(layerMap.values());
  console.log(`Created ${layers.length} layer groups`);
  return layers;
};

// Get color from KML style
const getColorFromStyle = (styleUrl) => {
  // Default colors based on common KML styles
  const colors = ['#FF5733', '#33FF57', '#3357FF', '#FF33F5', '#F5FF33', '#33FFF5'];
  const hash = styleUrl?.split('').reduce((a, b) => a + b.charCodeAt(0), 0) || 0;
  return colors[hash % colors.length];
};

// Get layer type icon based on geometry
const getLayerType = (geometryType) => {
  switch (geometryType) {
    case 'Point':
    case 'MultiPoint':
      return 'point';
    case 'LineString':
    case 'MultiLineString':
      return 'line';
    case 'Polygon':
    case 'MultiPolygon':
      return 'polygon';
    default:
      return 'mixed';
  }
};

// Layer type icon component
const LayerTypeIcon = ({ type }) => {
  switch (type) {
    case 'point':
      return <MapPin className="w-3 h-3" />;
    case 'line':
      return <Route className="w-3 h-3" />;
    case 'polygon':
      return <Square className="w-3 h-3" />;
    default:
      return <Layers className="w-3 h-3" />;
  }
};

export const KMLLayerPanel = ({ onLayersUpdate, mapRef, hqId }) => {
  const [isOpen, setIsOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [layers, setLayers] = useState([]);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [uploadedLayers, setUploadedLayers] = useState([]);
  const [error, setError] = useState(null);
  const [lastSync, setLastSync] = useState(null);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadName, setUploadName] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);
  const inactivityTimerRef = useRef(null);
  const panelRef = useRef(null);

  // Auto-hide on inactivity
  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }
    if (isOpen) {
      inactivityTimerRef.current = setTimeout(() => {
        setIsOpen(false);
      }, 8000); // Hide after 8 seconds of inactivity
    }
  }, [isOpen]);

  // Handle file upload
  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    if (!uploadName.trim()) {
      toast.error('Please enter a name for the layer');
      return;
    }
    
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('hq_id', hqId || 'default');
      formData.append('name', uploadName);
      
      const response = await fetch(`${API}/api/kml/upload`, {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Upload failed');
      }
      
      const result = await response.json();
      toast.success(`Uploaded: ${result.name} (${result.feature_count} features)`);
      
      // Refresh uploaded files list
      await loadUploadedFiles();
      
      // Reset upload form
      setUploadName('');
      setShowUpload(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      
    } catch (error) {
      toast.error(`Upload failed: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  // Delete uploaded file
  const handleDeleteFile = async (fileId, fileName) => {
    if (!confirm(`Delete "${fileName}"?`)) return;
    
    try {
      const response = await fetch(`${API}/api/kml/files/${fileId}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) throw new Error('Delete failed');
      
      toast.success(`Deleted: ${fileName}`);
      await loadUploadedFiles();
      
    } catch (error) {
      toast.error(`Delete failed: ${error.message}`);
    }
  };

  // Load uploaded KML files
  const loadUploadedFiles = useCallback(async () => {
    if (!hqId) return;
    
    try {
      const files = await fetchUploadedKMLFiles(hqId);
      setUploadedFiles(files);
      
      // Load GeoJSON for each file
      const layersPromises = files.map(async (file) => {
        const geojson = await fetchUploadedFileGeoJSON(file.id);
        if (geojson) {
          return {
            id: `uploaded_${file.id}`,
            name: `📁 ${file.name}`,
            visible: false,  // OFF by default - user must toggle ON
            features: geojson.features || [],
            color: '#FF9800',
            type: 'mixed',
            isUploaded: true,
            fileId: file.id
          };
        }
        return null;
      });
      
      const uploadedLayerResults = (await Promise.all(layersPromises)).filter(Boolean);
      setUploadedLayers(uploadedLayerResults);
      
    } catch (error) {
      console.error('Error loading uploaded files:', error);
    }
  }, [hqId]);

  // Load KML data via backend GeoJSON endpoint
  const loadKMLData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Use server-side KML to GeoJSON conversion
      const geojson = await fetchGeoJSONFromBackend(KML_SOURCE_URL);
      
      console.log(`Received ${geojson.features?.length || 0} features from backend`);
      
      const extractedLayers = extractLayers(geojson);
      console.log(`Extracted ${extractedLayers.length} layer groups`);
      setLayers(extractedLayers);
      setLastSync(new Date());
      
      // Also load uploaded files
      await loadUploadedFiles();
      
    } catch (err) {
      setError(`Failed to load KML: ${err.message}`);
      console.error('KML Load Error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [loadUploadedFiles]);

  // Combine and notify parent about all layers
  useEffect(() => {
    if (onLayersUpdate) {
      const allLayers = [...layers, ...uploadedLayers];
      onLayersUpdate(allLayers);
    }
  }, [layers, uploadedLayers, onLayersUpdate]);

  // Initial load
  useEffect(() => {
    loadKMLData();
  }, [loadKMLData]);

  // Inactivity timer management
  useEffect(() => {
    const handleMouseMove = () => resetInactivityTimer();
    const handleClick = () => resetInactivityTimer();
    
    if (panelRef.current) {
      panelRef.current.addEventListener('mousemove', handleMouseMove);
      panelRef.current.addEventListener('click', handleClick);
    }
    
    resetInactivityTimer();
    
    return () => {
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
      if (panelRef.current) {
        panelRef.current.removeEventListener('mousemove', handleMouseMove);
        panelRef.current.removeEventListener('click', handleClick);
      }
    };
  }, [resetInactivityTimer]);

  // Toggle layer visibility
  const toggleLayer = (layerId, isUploaded = false) => {
    if (isUploaded) {
      const updatedLayers = uploadedLayers.map(layer =>
        layer.id === layerId ? { ...layer, visible: !layer.visible } : layer
      );
      setUploadedLayers(updatedLayers);
    } else {
      const updatedLayers = layers.map(layer =>
        layer.id === layerId ? { ...layer, visible: !layer.visible } : layer
      );
      setLayers(updatedLayers);
    }
  };

  // Show/hide all layers
  const toggleAllLayers = (visible) => {
    setLayers(layers.map(layer => ({ ...layer, visible })));
    setUploadedLayers(uploadedLayers.map(layer => ({ ...layer, visible })));
  };

  // Calculate total layers
  const totalLayers = layers.length + uploadedLayers.length;

  // Collapsed state - just show toggle button
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="absolute left-4 top-16 z-[1000] bg-tactical-panel border border-tactical-border rounded-lg p-2 hover:bg-tactical-surface transition-colors shadow-lg"
        data-testid="kml-panel-toggle"
      >
        <Layers className="w-5 h-5 text-primary" />
      </button>
    );
  }

  return (
    <div
      ref={panelRef}
      className="absolute left-4 top-16 z-[1000] w-72 bg-tactical-panel/95 backdrop-blur-sm border border-tactical-border rounded-lg shadow-xl overflow-hidden"
      data-testid="kml-layer-panel"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-tactical-surface border-b border-tactical-border">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-primary" />
          <span className="text-xs font-heading uppercase text-white">Map Layers</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0"
            onClick={() => setShowUpload(!showUpload)}
            title="Upload KML/KMZ"
          >
            <Upload className={`w-3 h-3 ${showUpload ? 'text-primary' : ''}`} />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0"
            onClick={loadKMLData}
            disabled={isLoading}
            title="Sync with Google Maps"
          >
            <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0"
            onClick={() => setIsOpen(false)}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Upload Form */}
      {showUpload && (
        <div className="px-3 py-3 bg-tactical-surface/50 border-b border-tactical-border space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-white font-medium">Upload KML/KMZ</span>
            <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={() => setShowUpload(false)}>
              <X className="w-3 h-3" />
            </Button>
          </div>
          <Input
            placeholder="Layer name..."
            value={uploadName}
            onChange={(e) => setUploadName(e.target.value)}
            className="h-8 text-xs bg-tactical-surface"
          />
          <input
            ref={fileInputRef}
            type="file"
            accept=".kml,.kmz"
            onChange={handleFileUpload}
            className="hidden"
          />
          <Button
            size="sm"
            className="w-full h-8 text-xs"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading || !uploadName.trim()}
          >
            {isUploading ? (
              <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
            ) : (
              <FileUp className="w-3 h-3 mr-1" />
            )}
            {isUploading ? 'Uploading...' : 'Select File'}
          </Button>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="px-3 py-2 bg-red-500/10 text-red-400 text-xs">
          {error}
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="px-3 py-4 text-center">
          <RefreshCw className="w-5 h-5 animate-spin mx-auto text-primary mb-2" />
          <span className="text-xs text-gray-400">Loading layers...</span>
        </div>
      )}

      {/* Layer list */}
      {!isLoading && totalLayers > 0 && (
        <>
          {/* Quick controls */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-tactical-border/50">
            <span className="text-xs text-gray-400">{totalLayers} layers</span>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-xs"
                onClick={() => toggleAllLayers(true)}
              >
                <Eye className="w-3 h-3 mr-1" /> All
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-xs"
                onClick={() => toggleAllLayers(false)}
              >
                <EyeOff className="w-3 h-3 mr-1" /> None
              </Button>
            </div>
          </div>

          {/* Uploaded layers section */}
          {uploadedLayers.length > 0 && (
            <div className="border-b border-tactical-border/50">
              <div className="px-3 py-1 bg-orange-500/10 text-orange-400 text-xs font-medium">
                Custom Layers ({uploadedLayers.length})
              </div>
              {uploadedLayers.map((layer) => (
                <div
                  key={layer.id}
                  className="flex items-center gap-2 px-3 py-2 hover:bg-tactical-surface/50 border-b border-tactical-border/30 last:border-0"
                >
                  <Switch
                    checked={layer.visible}
                    onCheckedChange={() => toggleLayer(layer.id, true)}
                    className="scale-75"
                  />
                  <div className="w-3 h-3 rounded-sm bg-orange-500" />
                  <LayerTypeIcon type={layer.type} />
                  <span className="text-xs text-white truncate flex-1" title={layer.name}>
                    {layer.name}
                  </span>
                  <span className="text-xs text-gray-500">{layer.features.length}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-5 w-5 p-0 text-red-400 hover:text-red-300"
                    onClick={() => handleDeleteFile(layer.fileId, layer.name)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Base layers section */}
          {layers.length > 0 && (
            <>
              <div className="px-3 py-1 bg-blue-500/10 text-blue-400 text-xs font-medium">
                Base Layers ({layers.length})
              </div>
              <div className="max-h-60 overflow-y-auto">
                {layers.map((layer) => (
                  <div
                    key={layer.id}
                    className="flex items-center gap-2 px-3 py-2 hover:bg-tactical-surface/50 border-b border-tactical-border/30 last:border-0"
                  >
                    <Switch
                      checked={layer.visible}
                      onCheckedChange={() => toggleLayer(layer.id, false)}
                      className="scale-75"
                    />
                    <div
                      className="w-3 h-3 rounded-sm"
                      style={{ backgroundColor: layer.color }}
                    />
                    <LayerTypeIcon type={layer.type} />
                    <span className="text-xs text-white truncate flex-1" title={layer.name}>
                      {layer.name}
                    </span>
                    <span className="text-xs text-gray-500">{layer.features.length}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {/* No layers */}
      {!isLoading && totalLayers === 0 && !error && (
        <div className="px-3 py-4 text-center text-xs text-gray-400">
          No layers loaded
        </div>
      )}

      {/* Footer with sync info */}
      {lastSync && (
        <div className="px-3 py-1 bg-tactical-surface/50 text-xs text-gray-500 text-center">
          Last sync: {lastSync.toLocaleTimeString()}
        </div>
      )}
    </div>
  );
};

export default KMLLayerPanel;
