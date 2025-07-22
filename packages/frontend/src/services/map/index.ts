import { MapService } from './mapService.interface';
import { mapboxService } from './mapbox.service';
import { mockMapService } from './mock.service';

// Use mock service if no Mapbox token or if using mock services
const useMockService = process.env.NEXT_PUBLIC_USE_MOCK_SERVICES === 'true' || 
                      !process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

// Export the appropriate map service
export const mapService: MapService = useMockService ? mockMapService : mapboxService;

// Export types
export type { MapService, MapSearchResult } from './mapService.interface';