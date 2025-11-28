import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import { recordVisit } from '../services/visitService';
import { GEOFENCE_TASK } from './constants';

type ActiveVisitMap = Record<string, string>;

const activeVisits: ActiveVisitMap = {};

type GeofenceEventPayload = {
  eventType: Location.GeofencingEventType;
  region: Location.LocationRegion;
};

TaskManager.defineTask(GEOFENCE_TASK, async ({ data, error }) => {
  if (error) {
    console.warn('Geofence task error', error.message);
    return;
  }
  const { eventType, region } = (data ?? {}) as GeofenceEventPayload;
  const placeId = region?.identifier;
  if (!placeId) {
    return;
  }

  const event = eventType as Location.GeofencingEventType;
  if (event === Location.GeofencingEventType.Enter) {
    activeVisits[placeId] = new Date().toISOString();
    return;
  }

  if (event === Location.GeofencingEventType.Exit) {
    const enterTime = activeVisits[placeId];
    delete activeVisits[placeId];
    if (!enterTime) {
      return;
    }
    const exitTime = new Date().toISOString();
    await recordVisit({
      placeId,
      enterTime,
      exitTime,
    });
  }
});

