import { unauthorized, forbidden } from '../src/utils/responses';

function makeRes() {
  const r: any = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  return r as any;
}

describe('responses util', () => {
  test('unauthorized default message', () => {
    const res = makeRes();
    unauthorized(res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'Unauthorized' });
  });

  test('unauthorized custom message', () => {
    const res = makeRes();
    unauthorized(res, 'Nope');
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'Nope' });
  });

  test('forbidden default message', () => {
    const res = makeRes();
    forbidden(res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: 'Forbidden' });
  });

  test('forbidden custom message', () => {
    const res = makeRes();
    forbidden(res, 'No way');
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: 'No way' });
  });
});
