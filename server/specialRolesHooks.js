export function onRoundStart(room) {
  // Hook for future special-role phase mechanics
}

export function onVoteTallied(room, tally) {
  // Hook for future special-role phase mechanics
}

export function onElimination(room, eliminatedPlayerId) {
  const eliminatedCount = room.players.filter(p => p.eliminated).length;
  const isFirstElimination = eliminatedCount === 1;

  const eliminatedPlayer = room.players.find(p => p.id === eliminatedPlayerId);
  if (!eliminatedPlayer) return;

  if (eliminatedPlayer.specialRole === 'joyFool' && isFirstElimination) {
    if (!eliminatedPlayer.specialRoleData.joyFoolResolved) {
      eliminatedPlayer.points = (eliminatedPlayer.points || 0) + 4;
      eliminatedPlayer.specialRoleData.joyFoolResolved = true;
      
      if (!room.specialRoleOutcomes) room.specialRoleOutcomes = [];
      room.specialRoleOutcomes.push({
        role: 'joyFool',
        message: `Joy Fool bonus — +4 pts — ${eliminatedPlayer.name}`
      });
    }
  }
}

export function onGameEnd(room, result) {
  // Hook for future special-role phase mechanics
}
