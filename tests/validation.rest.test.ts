import request from 'supertest';
import express from 'express';
import bodyParser from 'body-parser';

// Mock jwt.verify used by authMiddleware so routes requiring auth pass in tests
jest.mock('jsonwebtoken', () => ({ verify: () => ({ id: 'test-user-id', name: 'Test' }) }));

import authRoutes from '../src/routes/auth.routes';
import triviaRoutes from '../src/routes/trivia.routes';
import roomRoutes from '../src/routes/room.routes';

const app = express();
app.use(bodyParser.json());

// Mount routers as in real app
app.use('/api/v1/auth', authRoutes);
app.use('/trivia', triviaRoutes);
app.use('/rooms', roomRoutes);

describe('Validation middleware - REST', () => {
  it('should return 400 for invalid register payload', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({ name: '', email: 'not-an-email', password: '123' });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('message');
  });

  it('should return 400 for invalid login payload', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ email: 'nope', password: '' });
    expect(res.status).toBe(400);
  });

  it('should return 400 for invalid trivia generate payload', async () => {
    const res = await request(app).post('/trivia/generate').set('Authorization', 'Bearer faketoken').send({ topic: '', quantity: 2 });
    expect(res.status).toBe(400);
  });

  it('should return 400 for invalid room join payload', async () => {
    const res = await request(app).post('/rooms/join').set('Authorization', 'Bearer faketoken').send({ code: 'BAD$' });
    expect(res.status).toBe(400);
  });
});
