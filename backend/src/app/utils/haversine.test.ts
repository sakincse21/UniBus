import { haversine } from './haversine';

describe('Haversine Formula', () => {
  it('should correctly calculate the distance between identical points as 0 meters', () => {
    const lat = 23.8103;
    const lon = 90.4125;
    expect(haversine(lat, lon, lat, lon)).toBe(0);
  });

  it('should estimate distance correctly between Dhaka and Chittagong (~215km)', () => {
    const dhakaLat = 23.8103, dhakaLon = 90.4125;
    const ctgLat = 22.3569, ctgLon = 91.7832;
    const distanceInMeters = haversine(dhakaLat, dhakaLon, ctgLat, ctgLon);
    
    // Distance should be roughly between 210km and 220km.
    const distanceInKm = distanceInMeters / 1000;
    expect(distanceInKm).toBeGreaterThan(210);
    expect(distanceInKm).toBeLessThan(220);
  });
});
