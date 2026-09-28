export function onRoundStart(room) {
  // Hook for future special-role phase mechanics
}

export function onVoteTallied(room, tally) {
  // Hook for future special-role phase mechanics
}

function addScore(player, amount, reason) {
  if (!player.scoreBreakdown) player.scoreBreakdown = [];
  player.points = (player.points || 0) + amount;
  player.scoreBreakdown.push({ reason, amount });
}

export function onElimination(room, eliminatedPlayerId) {
  const eliminatedCount = room.players.filter(p => p.eliminated).length;
  const isFirstElimination = eliminatedCount === 1;

  const eliminatedPlayer = room.players.find(p => p.id === eliminatedPlayerId);
  if (!eliminatedPlayer) return [];
  
  const cascadedEliminations = [];

  if (eliminatedPlayer.specialRole === 'joyFool' && isFirstElimination) {
    if (!eliminatedPlayer.specialRoleData.joyFoolResolved) {
      addScore(eliminatedPlayer, 4, 'Joy Fool');
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
        addScore(eliminatedPlayer, -2, 'Duelist');
        addScore(partner, 2, 'Duelist');
        
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

  if (eliminatedPlayer.specialRole === 'lovers') {
    if (!eliminatedPlayer.specialRoleData.resolved) {
      const partner = room.players.find(p => p.id === eliminatedPlayer.specialRoleData.partnerId);
      if (partner && !partner.eliminated) {
        partner.eliminated = true;
        partner.spectator = true;
        
        eliminatedPlayer.specialRoleData.resolved = true;
        partner.specialRoleData.resolved = true;
        
        if (!room.specialRoleOutcomes) room.specialRoleOutcomes = [];
        room.specialRoleOutcomes.push({
          role: 'lovers',
          loverId: eliminatedPlayer.specialRoleData.loverId,
          firstEliminatedId: eliminatedPlayer.id,
          firstEliminatedName: eliminatedPlayer.name,
          secondEliminatedId: partner.id,
          secondEliminatedName: partner.name,
          message: `LOVERS REVEALED\n${eliminatedPlayer.name} ❤️ ${partner.name}`
        });
        
        cascadedEliminations.push(partner);
      }
    }
  }

  return cascadedEliminations;
}

export function onGameEnd(room, result) {
  if (room.baseScoringResolved) return;
  room.baseScoringResolved = true;

  const { winner } = result;

  room.players.forEach(p => {
    if (p.spectator) return;
    
    if (winner === 'CIVILIAN' && p.role === 'CIVILIAN') {
      addScore(p, 2, 'Victory');
    } else if (winner === 'UNDERCOVER' && p.role === 'UNDERCOVER') {
      addScore(p, 10, 'Victory');
    } else if (winner === 'MR_WHITE' && p.role === 'MR_WHITE') {
      addScore(p, 6, 'Victory');
    } else if (winner === 'BOTH_IMPOSTERS') {
      if (p.role === 'UNDERCOVER') addScore(p, 10, 'Victory');
      if (p.role === 'MR_WHITE') addScore(p, 6, 'Victory');
    }
  });
}
