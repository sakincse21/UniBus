import request from 'supertest';
import app from './app';
// Mock dependencies to prevent actual database connections
jest.mock('./app/db/data-source', () => ({
  ensureDataSourceInitialized: jest.fn().mockResolvedValue(true),
  AppDataSource: {
    isInitialized: true,
    getRepository: jest.fn(),
  },
}));

describe('Express API Base Configuration (Supertest)', () => {
  it('should handle unhandled routes and respond with 404/error format', async () => {
    const res = await request(app).get('/api/v1/some-random-route-that-does-not-exist');
    expect(res.status).toBe(404);
  });
});
