import request from 'supertest';

// Prevent DB connect during app import
jest.mock('../src/config/db', () => ({ connectDB: jest.fn() }));

// Prevent redis from attempting real connection during app import
jest.mock('../src/config/redis', () => ({ __esModule: true, default: { setex: jest.fn(), del: jest.fn(), get: jest.fn() } }));

// Mock GameResult model used by controller
jest.mock('../src/models/gameResult.model', () => ({
  GameResult: {
    find: jest.fn(),
    findOne: jest.fn(),
  },
}));

// Mock jwt.verify to simulate token validation
jest.mock('jsonwebtoken', () => ({
  verify: jest.fn(),
}));

import app from '../src/app';
import { GameResult } from '../src/models/gameResult.model';
import jwt from 'jsonwebtoken';

describe('GameResult routes (integration)', () => {
  const mockResults = [
    { roomCode: 'ROOM123', triviaId: { _id: 't1', topic: 'Science' }, finishedAt: new Date(), scores: {}, players: [], winner: {} },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'test-secret';
  });

  it('returns 401 when no token provided', async () => {
    const res = await request(app).get('/api/v1/game-results');
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('message');
  });

  it('allows access with valid token', async () => {
    // Mock jwt.verify to return a payload
    (jwt.verify as jest.Mock).mockReturnValue({ id: 'u1', name: 'Tester' });

    // Mock GameResult.find chain
    const mockSort = jest.fn().mockReturnThis();
    const mockLimit = jest.fn().mockReturnThis();
    const mockPopulate = jest.fn().mockResolvedValue(mockResults);
    (GameResult.find as any) = jest.fn(() => ({ sort: mockSort, limit: mockLimit, populate: mockPopulate }));

    const res = await request(app).get('/api/v1/game-results').set('Authorization', 'Bearer validtoken');
    expect(res.status).toBe(200);
    // returned JSON serializes Date to ISO string; assert key fields instead of deep equality
    expect(res.body[0]).toHaveProperty('roomCode', 'ROOM123');
  });
});
