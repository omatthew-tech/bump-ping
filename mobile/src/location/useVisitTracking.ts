import { useCallback, useEffect, useState } from 'react';
import * as Location from 'expo-location';
import { fetchActivePlaces, Place } from '../services/placeService';
import { GEOFENCE_RADIUS_METERS, GEOFENCE_TASK, MAX_PLACES } from './constants';

const distanceInMeters = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const toRegion = (place: Place): Location.LocationRegion => ({
  identifier: place.id,
  latitude: place.lat,
  longitude: place.lng,
  radius: GEOFENCE_RADIUS_METERS,
  notifyOnEnter: true,
  notifyOnExit: true,
});

const ensurePermissions = async () => {
  let fg = await Location.getForegroundPermissionsAsync();
  if (!fg.granted) {
    fg = await Location.requestForegroundPermissionsAsync();
  }
  if (!fg.granted) return false;

  let bg = await Location.getBackgroundPermissionsAsync();
  if (!bg.granted) {
    bg = await Location.requestBackgroundPermissionsAsync();
  }
  return bg.granted;
};

export const useVisitTracking = () => {
  const [status, setStatus] = useState<'idle' | 'tracking' | 'denied'>('idle');

  const registerGeofences = useCallback(async () => {
    const permitted = await ensurePermissions();
    if (!permitted) {
      setStatus('denied');
      return;
    }

    const currentLocation = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    const places = await fetchActivePlaces();
    if (!places.length) {
      return;
    }

    const nearest = places
      .map((place) => ({
        place,
        distance: distanceInMeters(
          currentLocation.coords.latitude,
          currentLocation.coords.longitude,
          place.lat,
          place.lng,
        ),
      }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, MAX_PLACES)
      .map(({ place }) => toRegion(place));

    const alreadyRunning = await Location.hasStartedGeofencingAsync(GEOFENCE_TASK);
    if (alreadyRunning) {
      await Location.stopGeofencingAsync(GEOFENCE_TASK);
    }

    await Location.startGeofencingAsync(GEOFENCE_TASK, nearest);
    setStatus('tracking');
  }, []);

  useEffect(() => {
    registerGeofences();
  }, [registerGeofences]);

  return status;
};

