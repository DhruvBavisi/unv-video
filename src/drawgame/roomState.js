export function getInitialRoomState() {
  return {
    id: null,
    hostId: null,
    status: 'LOBBY',
    phase: 'LOBBY',
    players: [],
    configuration: {
      maxPlayers: 8,
      drawTimeSec: 80,
      rounds: 3,
      wordCount: 3,
      hints: 2,
      gameMode: 'NORMAL',
      customWords: '',
      useCustomOnly: false
    }
  };
}
