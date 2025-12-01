import { z } from 'zod';
import { validateBody, validateParams } from '../src/middleware/validate';

describe('validate middleware', () => {
  it('validateBody calls next and sets parsed body on success', () => {
    const schema = z.object({ name: z.string().min(1), age: z.number().int().positive() });
    const req: any = { body: { name: 'Alice', age: 30 } };
    const res: any = {};
    const next = jest.fn();

    const mw = validateBody(schema);
    mw(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.body).toEqual({ name: 'Alice', age: 30 });
  });

  it('validateBody responds 400 with zod errors on invalid body', () => {
    const schema = z.object({ name: z.string().min(1), age: z.number().int().positive() });
    const req: any = { body: { name: '', age: 'not-number' } };
    const json = jest.fn();
    const status = jest.fn(() => ({ json }));
    const res: any = { status };
    const next = jest.fn();

    const mw = validateBody(schema);
    mw(req, res, next);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Invalid request body', details: expect.any(Array) }));
    expect(next).not.toHaveBeenCalled();
  });

  it('validateParams calls next and sets parsed params on success', () => {
    const schema = z.object({ id: z.string().min(1) });
    const req: any = { params: { id: 'abc123' } };
    const res: any = {};
    const next = jest.fn();

    const mw = validateParams(schema);
    mw(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.params).toEqual({ id: 'abc123' });
  });

  it('validateParams responds 400 with zod errors on invalid params', () => {
    const schema = z.object({ id: z.string().min(1) });
    const req: any = { params: { id: '' } };
    const json = jest.fn();
    const status = jest.fn(() => ({ json }));
    const res: any = { status };
    const next = jest.fn();

    const mw = validateParams(schema);
    mw(req, res, next);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Invalid request params', details: expect.any(Array) }));
    expect(next).not.toHaveBeenCalled();
  });

  it('validateBody handles non-Zod errors and includes message', () => {
    const fakeSchema: any = { parse: () => { throw new Error('boom'); } };
    const req: any = { body: {} };
    const json = jest.fn();
    const status = jest.fn(() => ({ json }));
    const res: any = { status };
    const next = jest.fn();

    const mw = validateBody(fakeSchema);
    mw(req, res, next);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Invalid request body', details: [{ message: 'boom' }] }));
    expect(next).not.toHaveBeenCalled();
  });
});
