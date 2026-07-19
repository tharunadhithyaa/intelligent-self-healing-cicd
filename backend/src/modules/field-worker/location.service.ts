export interface IGpsCoordinates {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp: Date;
}

export interface IGpsLocationService {
  getCurrentPosition(workerId: string): Promise<IGpsCoordinates>;
  updateWorkerLocation(workerId: string, location: IGpsCoordinates): Promise<void>;
}

export class MockGpsLocationService implements IGpsLocationService {
  async getCurrentPosition(_workerId: string): Promise<IGpsCoordinates> {
    // Standard city center mock coordinate offsets
    return {
      latitude: 12.971598,
      longitude: 77.594562,
      accuracy: 10, // 10 meters precision
      timestamp: new Date()
    };
  }

  async updateWorkerLocation(workerId: string, location: IGpsCoordinates): Promise<void> {
    // Placeholder log for future MongoDB geospacial coordinates mapping
    console.log(`[GEOLOCATION] Geolocation trace for Field Worker: ${workerId} at coords: (${location.latitude}, ${location.longitude})`);
  }
}
export const gpsLocationService = new MockGpsLocationService();
