import React from 'react'
import Button from '../../components/Button.jsx'
import { ensureIdentity } from '../../game/identity.js'

export default function Lobby({ room, onLeave, onUpdateConfig }) {
  const { sessionId } = ensureIdentity()
  const isHost = room.hostId === sessionId

  const handleConfigChange = (key, value) => {
    if (!isHost) return
    onUpdateConfig({ [key]: value })
  }

  return (
    <div className="skribbl-lobby">
      <div className="section-inner" style={{ paddingTop: '80px', paddingBottom: '40px' }}>
        <h1 className="mode-select__title" style={{ fontSize: '2rem' }}>SKRIBBL LOBBY</h1>
        <p style={{ textAlign: 'center', marginBottom: '20px', letterSpacing: '2px' }}>ROOM ID: <strong>{room.id}</strong></p>

        <div className="mode-select__cards" style={{ flexDirection: 'column' }}>
          
          <div className="mode-select__card" style={{ width: '100%' }}>
            <h2>PLAYERS ({room.players.length}/{room.configuration.maxPlayers})</h2>
            <ul style={{ listStyle: 'none', padding: 0, margin: '15px 0' }}>
              {room.players.map(p => (
                <li key={p.id} style={{ padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                  {p.name} {p.isHost && '(HOST)'} {!p.isConnected && '(OFFLINE)'}
                </li>
              ))}
            </ul>
          </div>

          <div className="mode-select__card" style={{ width: '100%' }}>
            <h2>GAME SETTINGS</h2>
            <div className="skribbl-settings">
              <label>
                DRAW TIME: 
                <select 
                  value={room.configuration.drawTimeSec} 
                  disabled={!isHost}
                  onChange={(e) => handleConfigChange('drawTimeSec', parseInt(e.target.value))}
                  className="skribbl-select"
                >
                  <option value={45}>45s</option>
                  <option value={60}>60s</option>
                  <option value={80}>80s</option>
                  <option value={100}>100s</option>
                </select>
              </label>

              <label>
                ROUNDS: 
                <select 
                  value={room.configuration.rounds} 
                  disabled={!isHost}
                  onChange={(e) => handleConfigChange('rounds', parseInt(e.target.value))}
                  className="skribbl-select"
                >
                  <option value={2}>2</option>
                  <option value={3}>3</option>
                  <option value={4}>4</option>
                  <option value={5}>5</option>
                </select>
              </label>
              
              <label>
                WORD CHOICES:
                <select 
                  value={room.configuration.wordCount} 
                  disabled={!isHost}
                  onChange={(e) => handleConfigChange('wordCount', parseInt(e.target.value))}
                  className="skribbl-select"
                >
                  <option value={2}>2</option>
                  <option value={3}>3</option>
                  <option value={4}>4</option>
                </select>
              </label>

              <label>
                HINTS:
                <select 
                  value={room.configuration.hints} 
                  disabled={!isHost}
                  onChange={(e) => handleConfigChange('hints', parseInt(e.target.value))}
                  className="skribbl-select"
                >
                  <option value={0}>0</option>
                  <option value={1}>1</option>
                  <option value={2}>2</option>
                </select>
              </label>
            </div>
          </div>

          <div className="mode-select__card" style={{ width: '100%' }}>
            <h2>WORD SETTINGS</h2>
            <div className="skribbl-settings">
              <label>
                WORD MODE:
                <select 
                  value={room.configuration.gameMode} 
                  disabled={!isHost}
                  onChange={(e) => handleConfigChange('gameMode', e.target.value)}
                  className="skribbl-select"
                >
                  <option value="NORMAL">NORMAL</option>
                  <option value="HIDDEN">HIDDEN</option>
                  <option value="COMBINATION">COMBINATION</option>
                </select>
              </label>
              
              <label style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                CUSTOM WORDS (comma separated):
                <textarea 
                  value={room.configuration.customWords} 
                  disabled={!isHost}
                  onChange={(e) => handleConfigChange('customWords', e.target.value)}
                  className="skribbl-input"
                  style={{ minHeight: '60px', marginTop: '10px' }}
                />
              </label>

              <label style={{ justifyContent: 'flex-start', gap: '10px' }}>
                <input 
                  type="checkbox" 
                  checked={room.configuration.useCustomOnly} 
                  disabled={!isHost}
                  onChange={(e) => handleConfigChange('useCustomOnly', e.target.checked)}
                />
                USE CUSTOM WORDS ONLY
              </label>
            </div>
          </div>

        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '30px' }}>
          {isHost && (
            <Button variant="primary" style={{ width: '100%' }} disabled>
              START GAME (Coming Soon)
            </Button>
          )}
          <Button variant="ghost" onClick={onLeave} style={{ width: '100%' }}>
            LEAVE ROOM
          </Button>
        </div>
      </div>
    </div>
  )
}
