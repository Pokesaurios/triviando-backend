import { jest } from '@jest/globals';

// Mock User model
const mockFindById = jest.fn();

jest.mock('../src/models/user.model', () => ({
  __esModule: true,
  default: {
    findById: (...args: any[]) => mockFindById(...args),
  },
}));

import { resolveUserName } from '../src/utils/userHelpers';

describe('resolveUserName', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('when user.name is provided', () => {
    it('returns the provided name without querying the database', async () => {
      const result = await resolveUserName('user123', 'Alice');

      expect(result).toBe('Alice');
      expect(mockFindById).not.toHaveBeenCalled();
    });

    it('returns the provided name even with whitespace', async () => {
      const result = await resolveUserName('user123', '  Bob  ');

      expect(result).toBe('  Bob  ');
      expect(mockFindById).not.toHaveBeenCalled();
    });
  });

  describe('when user.name is undefined, null, or empty', () => {
    it('fetches name from database when name is undefined', async () => {
      mockFindById.mockReturnValueOnce({
        select: () => ({
          lean: () => Promise.resolve({ _id: 'user123', name: 'DatabaseAlice' }),
        }),
      });

      const result = await resolveUserName('user123', undefined);

      expect(result).toBe('DatabaseAlice');
      expect(mockFindById).toHaveBeenCalledWith('user123');
    });

    it('fetches name from database when name is empty string', async () => {
      mockFindById.mockReturnValueOnce({
        select: () => ({
          lean: () => Promise.resolve({ _id: 'user123', name: 'DatabaseBob' }),
        }),
      });

      const result = await resolveUserName('user123', '');

      expect(result).toBe('DatabaseBob');
      expect(mockFindById).toHaveBeenCalledWith('user123');
    });

    it('fetches name from database when name is whitespace only', async () => {
      mockFindById.mockReturnValueOnce({
        select: () => ({
          lean: () => Promise.resolve({ _id: 'user123', name: 'DatabaseCarol' }),
        }),
      });

      const result = await resolveUserName('user123', '   ');

      expect(result).toBe('DatabaseCarol');
      expect(mockFindById).toHaveBeenCalledWith('user123');
    });

    it('returns "Anonymous" if user is not found in database', async () => {
      mockFindById.mockReturnValueOnce({
        select: () => ({
          lean: () => Promise.resolve(null),
        }),
      });

      const result = await resolveUserName('nonexistent123', undefined);

      expect(result).toBe('Anonymous');
      expect(mockFindById).toHaveBeenCalledWith('nonexistent123');
    });

    it('returns "Anonymous" if user has no name in database', async () => {
      mockFindById.mockReturnValueOnce({
        select: () => ({
          lean: () => Promise.resolve({ _id: 'user123', name: '' }),
        }),
      });

      const result = await resolveUserName('user123', undefined);

      expect(result).toBe('Anonymous');
      expect(mockFindById).toHaveBeenCalledWith('user123');
    });
  });

  describe('when database fetch fails', () => {
    it('returns "Anonymous" on database error', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      mockFindById.mockImplementationOnce(() => {
        throw new Error('Database connection failed');
      });

      const result = await resolveUserName('user123', undefined);

      expect(result).toBe('Anonymous');
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[resolveUserName] Error fetching user:',
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });

    it('returns "Anonymous" when lean() rejects', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      mockFindById.mockReturnValueOnce({
        select: () => ({
          lean: () => Promise.reject(new Error('Query timeout')),
        }),
      });

      const result = await resolveUserName('user123', undefined);

      expect(result).toBe('Anonymous');
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[resolveUserName] Error fetching user:',
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });
  });
});
