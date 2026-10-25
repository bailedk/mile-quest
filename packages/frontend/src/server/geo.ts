export interface LatLng {
  lat: number;
  lng: number;
}

export interface RouteSegment {
  from: number;
  to: number;
  distance: number;
  duration?: number;
}

export interface MeasuredRoute {
  meters: number;
  polyline: string;
  segments: RouteSegment[];
  totalDuration: number;
}

const EARTH_RADIUS_METERS = 6_371_000;
const METERS_PER_MILE = 1609.344;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function haversineMeters(from: LatLng, to: LatLng): number {
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function walkingSeconds(meters: number): number {
  const miles = meters / METERS_PER_MILE;
  return (miles / 3) * 3600;
}

export function haversineRoute(points: LatLng[]): MeasuredRoute {
  const segments: RouteSegment[] = [];
  let meters = 0;
  for (let index = 0; index < points.length - 1; index += 1) {
    const distance = haversineMeters(points[index], points[index + 1]);
    meters += distance;
    segments.push({
      from: index,
      to: index + 1,
      distance,
      duration: walkingSeconds(distance),
    });
  }
  return {
    meters,
    polyline: '',
    segments,
    totalDuration: segments.reduce((sum, segment) => sum + (segment.duration || 0), 0),
  };
}

interface MapboxLeg {
  distance?: number;
  duration?: number;
}

interface MapboxRoute {
  distance?: number;
  duration?: number;
  geometry?: string;
  legs?: MapboxLeg[];
}

export async function measureRoute(points: LatLng[]): Promise<MeasuredRoute> {
  const token = process.env.MAPBOX_ACCESS_TOKEN;
  if (token && points.length >= 2) {
    try {
      const coordinates = points.map((point) => `${point.lng},${point.lat}`).join(';');
      const url = new URL(`https://api.mapbox.com/directions/v5/mapbox/walking/${coordinates}`);
      url.searchParams.set('geometries', 'polyline');
      url.searchParams.set('overview', 'full');
      url.searchParams.set('access_token', token);
      const response = await fetch(url);
      if (response.ok) {
        const body = (await response.json()) as { routes?: MapboxRoute[] };
        const route = body.routes?.[0];
        if (route && typeof route.distance === 'number') {
          const legs = Array.isArray(route.legs) ? route.legs : [];
          const segments = legs.length
            ? legs.map((leg, index) => ({
                from: index,
                to: index + 1,
                distance: leg.distance ?? 0,
                duration: leg.duration,
              }))
            : [{
                from: 0,
                to: points.length - 1,
                distance: route.distance,
                duration: route.duration,
              }];
          return {
            meters: route.distance,
            polyline: route.geometry || '',
            segments,
            totalDuration: route.duration ?? segments.reduce((sum, segment) => sum + (segment.duration || 0), 0),
          };
        }
      }
    } catch (error) {
      console.warn('Mapbox directions unavailable, using great-circle distance');
      console.warn(error instanceof Error ? error.message : error);
    }
  }
  return haversineRoute(points);
}
