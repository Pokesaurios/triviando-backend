import { buildRoomCacheData, buildSanitizedRoom } from '../src/utils/roomHelpers';

describe('Room Builders', () => {
  const mockRoom = {
    code: 'ABC123',
    status: 'WAITING',
    maxPlayers: 5,
    hostId: 'host-1',
    players: [
      {
        userId: 100,
        name: 'Juan',
      },
      {
        userId: 200,
        name: 'Ana',
      },
    ],
  };

  describe('buildRoomCacheData', () => {
    it('should correctly build cache room data', () => {
      const result = buildRoomCacheData(mockRoom);

      expect(result).toEqual({
        code: 'ABC123',
        status: 'WAITING',
        maxPlayers: 5,
        hostId: 'host-1',
        players: [
          { userId: 100, name: 'Juan' },
          { userId: 200, name: 'Ana' },
        ],
      });
    });

    it('should return empty players array if room has no players', () => {
      const roomWithoutPlayers = {
        ...mockRoom,
        players: [],
      };

      const result = buildRoomCacheData(roomWithoutPlayers);

      expect(result.players).toEqual([]);
    });
  });

  describe('buildSanitizedRoom', () => {
        it('should fallback to raw userId when toString does not exist', () => {
      const room = {
        code: 'XYZ',
        status: 'WAITING',
        maxPlayers: 4,
        hostId: 'host',
        players: [
          { userId: null, name: 'NoID' },      // no tiene toString
          { userId: undefined, name: 'UndefinedID' }, // no tiene toString
        ],
      };

      const result = buildSanitizedRoom(room);

      expect(result.players).toEqual([
        { userId: null, name: 'NoID' },
        { userId: undefined, name: 'UndefinedID' },
      ]);
    });

    it('should fallback to raw userId when toString is not a function', () => {
      const room = {
        code: 'XYZ',
        status: 'WAITING',
        maxPlayers: 4,
        hostId: 'host',
        players: [
          { userId: { toString: null }, name: 'InvalidToString' },
        ],
      };

      const result = buildSanitizedRoom(room);

      expect(result.players).toEqual([
        { userId: { toString: null }, name: 'InvalidToString' },
      ]);
    });
    });
});
