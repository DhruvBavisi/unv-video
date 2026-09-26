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

  if (eliminatedPlayer.specialRole === 'duelists') {
    if (!eliminatedPlayer.specialRoleData.resolved) {
      const partner = room.players.find(p => p.id === eliminatedPlayer.specialRoleData.partnerId);
      if (partner) {
        eliminatedPlayer.points = (eliminatedPlayer.points || 0) - 2;
        partner.points = (partner.points || 0) + 2;
        
        eliminatedPlayer.specialRoleData.resolved = true;
        partner.specialRoleData.resolved = true;
        
        if (!room.specialRoleOutcomes) room.specialRoleOutcomes = [];
        room.specialRoleOutcomes.push({
          role: 'duelists',
          duelId: eliminatedPlayer.specialRoleData.duelId,
          eliminatedName: eliminatedPlayer.name,
          survivingName: partner.name,
          message: `Duelists\n${eliminatedPlayer.name} — eliminated — −2 pts\n${partner.name} — survived the duel — +2 pts`
        });
      }
    }
  }
}

export function onGameEnd(room, result) {
  // Hook for future special-role phase mechanics
}
