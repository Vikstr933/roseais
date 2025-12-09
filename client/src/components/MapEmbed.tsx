import { useEffect, useRef, useState } from 'react';
import { MapPin, Navigation, Loader2 } from 'lucide-react';
import { Card } from './ui/card';
import { Button } from './ui/button';

interface MapEmbedProps {
  query: string; // Address or place name
  center?: { lat: number; lng: number };
  zoom?: number;
  height?: number;
  showSearch?: boolean;
}

declare global {
  interface Window {
    google: any;
  }
}

export function MapEmbed({
  query,
  center,
  zoom = 15,
  height = 300,
  showSearch = false
}: MapEmbedProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [placeInfo, setPlaceInfo] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const markersRef = useRef<any[]>([]); // Track markers for cleanup

  useEffect(() => {
    // Wait for Google Maps to load (including marker library)
    const checkGoogleMaps = setInterval(() => {
      if (window.google && window.google.maps && window.google.maps.marker) {
        clearInterval(checkGoogleMaps);
        initializeMap();
      }
    }, 100);

    return () => {
      clearInterval(checkGoogleMaps);
      // Cleanup markers
      markersRef.current.forEach(marker => {
        if (marker && typeof marker.map === 'object') {
          marker.map = null;
        }
      });
      markersRef.current = [];
    };
  }, [query]);

  const parseQuery = (rawQuery: string): string => {
    // Extract the actual search query from complex phrases
    let cleanQuery = rawQuery.toLowerCase();

    // Remove direction-related phrases but keep location
    cleanQuery = cleanQuery
      .replace(/^(directions to|show me|find|search for|where is|locate)\s+/i, '')
      .replace(/\s+from\s+.+$/i, ''); // Remove "from X" part

    // If query has "near me" or "nearby", keep the location context
    if (cleanQuery.includes('near me') || cleanQuery.includes('nearby')) {
      cleanQuery = cleanQuery.replace(/\s+(near me|nearby)/i, ' nearby');
    }

    return cleanQuery.trim();
  };

  const initializeMap = async () => {
    if (!mapRef.current || !window.google) return;

    try {
      // Initialize the map - default to Sweden/Skåne region
      const initialCenter = center || { lat: 55.6, lng: 13.0 };
      const mapInstance = new window.google.maps.Map(mapRef.current, {
        center: initialCenter,
        zoom,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        zoomControl: true,
      });

      setMap(mapInstance);

      // If we have a query, search for it
      if (query) {
        const service = new window.google.maps.places.PlacesService(mapInstance);
        const cleanedQuery = parseQuery(query);

        console.log('Map query:', { original: query, cleaned: cleanedQuery });

        // Constrain search to Sweden/Skåne region to prevent false matches
        const swedenBounds = new window.google.maps.LatLngBounds(
          new window.google.maps.LatLng(55.0, 12.5), // Southwest corner of Skåne
          new window.google.maps.LatLng(57.0, 15.0)  // Northeast corner covering southern Sweden
        );

        const request = {
          query: cleanedQuery,
          fields: ['name', 'formatted_address', 'geometry', 'place_id', 'rating', 'user_ratings_total', 'photos'],
          locationBias: swedenBounds // Bias results towards Sweden
        };

        service.findPlaceFromQuery(request, (results: any, status: any) => {
          if (status === window.google.maps.places.PlacesServiceStatus.OK && results?.[0]) {
            const place = results[0];
            const location = place.geometry.location;

            // Center map on the place
            mapInstance.setCenter(location);
            mapInstance.setZoom(zoom);

            // Add marker using AdvancedMarkerElement (new API)
            try {
              // Check if AdvancedMarkerElement is available
              if (window.google.maps.marker && window.google.maps.marker.AdvancedMarkerElement) {
                const marker = new window.google.maps.marker.AdvancedMarkerElement({
                  map: mapInstance,
                  position: location,
                  title: place.name,
                });
                markersRef.current.push(marker);
              } else {
                // Fallback to classic Marker if AdvancedMarkerElement not available
                console.warn('AdvancedMarkerElement not available, using classic Marker');
                const marker = new window.google.maps.Marker({
                  map: mapInstance,
                  position: location,
                  title: place.name,
                  animation: window.google.maps.Animation.DROP,
                });
                markersRef.current.push(marker);
              }
            } catch (markerError) {
              console.error('Error creating marker:', markerError);
              // Continue without marker if there's an error
            }

            // Get detailed place information
            service.getDetails({ placeId: place.place_id }, (placeDetails: any, detailsStatus: any) => {
              if (detailsStatus === window.google.maps.places.PlacesServiceStatus.OK) {
                setPlaceInfo(placeDetails);
              }
            });

            setLoading(false);
          } else {
            setError('Place not found');
            setLoading(false);
          }
        });
      } else if (center) {
        // Just show the center point
        try {
          // Use AdvancedMarkerElement if available
          if (window.google.maps.marker && window.google.maps.marker.AdvancedMarkerElement) {
            const marker = new window.google.maps.marker.AdvancedMarkerElement({
              map: mapInstance,
              position: center,
            });
            markersRef.current.push(marker);
          } else {
            // Fallback to classic Marker
            const marker = new window.google.maps.Marker({
              map: mapInstance,
              position: center,
              animation: window.google.maps.Animation.DROP,
            });
            markersRef.current.push(marker);
          }
        } catch (markerError) {
          console.error('Error creating center marker:', markerError);
        }
        setLoading(false);
      } else {
        setLoading(false);
      }
    } catch (err: any) {
      console.error('Error initializing map:', err);
      
      // Handle specific Google Maps API errors
      if (err?.message?.includes('ApiProjectMapError') || err?.message?.includes('NoApiKeys')) {
        setError('Google Maps API configuration error. Please check API key settings.');
      } else {
        setError('Failed to load map. Please try again later.');
      }
      
      setLoading(false);
    }
  };

  const openInGoogleMaps = () => {
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
    window.open(url, '_blank');
  };

  const getDirections = () => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(query)}`;
    window.open(url, '_blank');
  };

  if (error) {
    return (
      <Card className="p-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <MapPin className="w-4 h-4" />
          <span className="text-sm">{error}</span>
        </div>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      {/* Map Container */}
      <div className="relative">
        <div
          ref={mapRef}
          style={{ height: `${height}px`, width: '100%' }}
          className="bg-gray-100"
        />
        {loading && (
          <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        )}
      </div>

      {/* Place Info */}
      {placeInfo && (
        <div className="p-3 border-t">
          <div className="space-y-2">
            <div>
              <h4 className="font-semibold text-sm">{placeInfo.name}</h4>
              {placeInfo.rating && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <span className="text-yellow-500">★</span>
                  <span>{placeInfo.rating}</span>
                  {placeInfo.user_ratings_total && (
                    <span>({placeInfo.user_ratings_total} reviews)</span>
                  )}
                </div>
              )}
            </div>

            {placeInfo.formatted_address && (
              <p className="text-xs text-muted-foreground">
                {placeInfo.formatted_address}
              </p>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 text-xs"
                onClick={openInGoogleMaps}
              >
                <MapPin className="w-3 h-3 mr-1" />
                View in Maps
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 text-xs"
                onClick={getDirections}
              >
                <Navigation className="w-3 h-3 mr-1" />
                Directions
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
