import { useCallback, useEffect, useState } from 'react';
import type { Coordinate, DeliveryPreset } from '../types/tracknow';

interface CurrentLocationState {
  location: Coordinate | null;
  address: string | null;
  locating: boolean;
  error: string | null;
}

export function useCurrentLocation(
  onResolved?: (preset: DeliveryPreset) => void,
) {
  const [state, setState] = useState<CurrentLocationState>({
    location: null,
    address: null,
    locating: false,
    error: null,
  });

  const resolveCoords = useCallback(
    async (coords: Coordinate): Promise<DeliveryPreset> => {
      let resolvedAddress = `Current Location (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)})`;

      try {
        const res = await fetch(
          `/api/reverse-geocode?lat=${encodeURIComponent(coords.lat)}&lng=${encodeURIComponent(coords.lng)}`,
        );
        if (res.ok) {
          const data = (await res.json()) as { address?: string };
          if (data.address) {
            resolvedAddress = data.address;
          }
        }
      } catch {
        // Fallback to coordinate label
      }

      // Anchor local traffic corridors around the user's current coordinates
      try {
        await fetch('/api/traffic/anchor', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(coords),
        });
      } catch {
        // Non-fatal if offline
      }

      const preset: DeliveryPreset = {
        id: 'dest-current',
        label: 'Current Location',
        address: resolvedAddress,
        location: coords,
      };

      setState({
        location: coords,
        address: resolvedAddress,
        locating: false,
        error: null,
      });

      onResolved?.(preset);
      return preset;
    },
    [onResolved],
  );

  const requestCurrentLocation = useCallback(async (): Promise<DeliveryPreset | null> => {
    if (!('geolocation' in navigator)) {
      setState((prev) => ({
        ...prev,
        locating: false,
        error: 'Geolocation is not supported in this browser.',
      }));
      return null;
    }

    setState((prev) => ({ ...prev, locating: true, error: null }));

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const coords: Coordinate = {
            lat: Number(pos.coords.latitude.toFixed(6)),
            lng: Number(pos.coords.longitude.toFixed(6)),
          };
          const preset = await resolveCoords(coords);
          resolve(preset);
        },
        (err) => {
          let message = 'Unable to retrieve your current location.';
          if (err.code === err.PERMISSION_DENIED) {
            message =
              'Location permission was denied. Allow location access in your browser settings to use current location.';
          } else if (err.code === err.TIMEOUT) {
            message = 'Location request timed out. Please try again.';
          }
          setState((prev) => ({
            ...prev,
            locating: false,
            error: message,
          }));
          resolve(null);
        },
        {
          enableHighAccuracy: true,
          timeout: 8000,
          maximumAge: 30000,
        },
      );
    });
  }, [resolveCoords]);

  // If browser geolocation permission is already granted, detect silently on mount
  useEffect(() => {
    if (!('permissions' in navigator) || !('geolocation' in navigator)) return;
    let active = true;
    navigator.permissions
      .query({ name: 'geolocation' })
      .then((perm) => {
        if (active && perm.state === 'granted') {
          requestCurrentLocation();
        }
      })
      .catch(() => {
        // Ignore browsers without permissions query support
      });
    return () => {
      active = false;
    };
  }, [requestCurrentLocation]);

  return {
    ...state,
    requestCurrentLocation,
  };
}
