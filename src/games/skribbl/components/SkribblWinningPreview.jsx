import React, { useState } from 'react'
import FinalScores from './FinalScores.jsx'
import DrawingTopBar from './DrawingTopBar.jsx'
import PlayerStrip from './PlayerStrip.jsx'
import ChatBox from './ChatBox.jsx'
import SettingsPanel from './SettingsPanel.jsx'
import { getRandomAvatar } from '../utils/skribblAvatarData.js'
import { usePageBackground } from '../../../shared/hooks/usePageBackground.js'

const MOCK_NAMES = [
  'Dhruv', 'Sophia', 'Alex', 'Liam', 'Emma', 'Lucas', 'Olivia', 'Noah',
  'Ava', 'Ethan', 'Mia', 'Mason', 'Isabella', 'James', 'Harper',
  'Benjamin', 'Charlotte', 'Oliver', 'Amelia', 'Elijah'
]

export function generateCustomPlayers(count) {
  const clamped = Math.max(3, Math.min(Number(count) || 3, 20))
  return Array.from({ length: clamped }, (_, i) => ({
    id: `p${i + 1}`,
    name: MOCK_NAMES[i] || `Player ${i + 1}`,
    score: Math.max(30, 780 - i * 45),
    isConnected: i !== 7,
    playAgain: i % 2 === 0,
    avatar: {
      color: (i * 2 + 1) % 18,
      eyes: (i % 16) + 1,
      mouth: (i % 19) + 1,
    }
  }))
}

const SCENARIOS = {
  three: {
    label: '3 Players (Podium Only)',
    players: [
      { id: 'p1', name: 'Dhruv', score: 540, isConnected: true, playAgain: true, avatar: { color: 15, eyes: 1, mouth: 1 } },
      { id: 'p2', name: 'Sophia', score: 420, isConnected: true, playAgain: true, avatar: { color: 10, eyes: 12, mouth: 12 } },
      { id: 'p3', name: 'Alex', score: 290, isConnected: true, playAgain: false, avatar: { color: 3, eyes: 16, mouth: 14 } },
    ]
  },
  five: {
    label: '5 Players (Standard + Runners)',
    players: [
      { id: 'p1', name: 'Dhruv', score: 540, isConnected: true, playAgain: true, avatar: { color: 15, eyes: 1, mouth: 1 } },
      { id: 'p2', name: 'Sophia', score: 420, isConnected: true, playAgain: true, avatar: { color: 10, eyes: 12, mouth: 12 } },
      { id: 'p3', name: 'Alex', score: 290, isConnected: true, playAgain: false, avatar: { color: 3, eyes: 16, mouth: 14 } },
      { id: 'p4', name: 'Liam', score: 210, isConnected: true, playAgain: true, avatar: { color: 6, eyes: 6, mouth: 3 } },
      { id: 'p5', name: 'Emma', score: 140, isConnected: true, playAgain: false, avatar: { color: 7, eyes: 10, mouth: 6 } },
    ]
  },
  eight: {
    label: '8 Players (Full Room / Scroll)',
    players: [
      { id: 'p1', name: 'Dhruv', score: 680, isConnected: true, playAgain: true, avatar: { color: 15, eyes: 1, mouth: 1 } },
      { id: 'p2', name: 'Sophia', score: 530, isConnected: true, playAgain: true, avatar: { color: 10, eyes: 12, mouth: 12 } },
      { id: 'p3', name: 'Alex', score: 410, isConnected: true, playAgain: false, avatar: { color: 3, eyes: 16, mouth: 14 } },
      { id: 'p4', name: 'Liam', score: 330, isConnected: true, playAgain: true, avatar: { color: 6, eyes: 6, mouth: 3 } },
      { id: 'p5', name: 'Emma', score: 260, isConnected: true, playAgain: false, avatar: { color: 7, eyes: 10, mouth: 6 } },
      { id: 'p6', name: 'Lucas', score: 190, isConnected: true, playAgain: true, avatar: { color: 1, eyes: 8, mouth: 8 } },
      { id: 'p7', name: 'Olivia', score: 130, isConnected: true, playAgain: false, avatar: { color: 11, eyes: 11, mouth: 10 } },
      { id: 'p8', name: 'Noah', score: 70, isConnected: false, playAgain: false, avatar: { color: 9, eyes: 7, mouth: 7 } },
    ]
  },
  tie: {
    label: 'Tie for 1st Place',
    players: [
      { id: 'p1', name: 'Dhruv', score: 500, isConnected: true, playAgain: true, avatar: { color: 15, eyes: 1, mouth: 1 } },
      { id: 'p2', name: 'Sophia', score: 500, isConnected: true, playAgain: true, avatar: { color: 10, eyes: 12, mouth: 12 } },
      { id: 'p3', name: 'Alex', score: 340, isConnected: true, playAgain: false, avatar: { color: 3, eyes: 16, mouth: 14 } },
      { id: 'p4', name: 'Liam', score: 210, isConnected: true, playAgain: true, avatar: { color: 6, eyes: 6, mouth: 3 } },
      { id: 'p5', name: 'Emma', score: 140, isConnected: true, playAgain: false, avatar: { color: 7, eyes: 10, mouth: 6 } },
    ]
  },
  nine: {
    label: '9 Players (Stage Moves Up, 2 Balanced Rows of 3)',
    players: [
      { id: 'p1', name: 'Dhruv', score: 720, isConnected: true, playAgain: true, avatar: { color: 15, eyes: 1, mouth: 1 } },
      { id: 'p2', name: 'Sophia', score: 590, isConnected: true, playAgain: true, avatar: { color: 10, eyes: 12, mouth: 12 } },
      { id: 'p3', name: 'Alex', score: 480, isConnected: true, playAgain: false, avatar: { color: 3, eyes: 16, mouth: 14 } },
      { id: 'p4', name: 'Liam', score: 410, isConnected: true, playAgain: true, avatar: { color: 6, eyes: 6, mouth: 3 } },
      { id: 'p5', name: 'Emma', score: 360, isConnected: true, playAgain: false, avatar: { color: 7, eyes: 10, mouth: 6 } },
      { id: 'p6', name: 'Lucas', score: 310, isConnected: true, playAgain: true, avatar: { color: 1, eyes: 8, mouth: 8 } },
      { id: 'p7', name: 'Olivia', score: 270, isConnected: true, playAgain: false, avatar: { color: 11, eyes: 11, mouth: 10 } },
      { id: 'p8', name: 'Noah', score: 230, isConnected: true, playAgain: true, avatar: { color: 9, eyes: 7, mouth: 7 } },
      { id: 'p9', name: 'Ava', score: 190, isConnected: true, playAgain: false, avatar: { color: 4, eyes: 4, mouth: 4 } },
    ]
  },
  fourteen: {
    label: '14 Players (3 Rows: 5-4-2)',
    players: generateCustomPlayers(14)
  },
  fifteen: {
    label: '15 Players (3 Rows: 5-4-3)',
    players: generateCustomPlayers(15)
  }
}

const WIDTH_PRESETS = [
  { label: 'Auto (100%)', width: '100%' },
  { label: 'iPhone SE (375px)', width: '375px' },
  { label: 'iPhone 15 Pro (393px)', width: '393px' },
  { label: 'Tablet (768px)', width: '768px' },
]

export default function SkribblWinningPreview({ onExit }) {
  const [scenarioKey, setScenarioKey] = useState('five')
  const [customCount, setCustomCount] = useState(10)
  const [sessionId, setSessionId] = useState('p1')
  const [viewMode, setViewMode] = useState('in-game') // 'in-game' | 'canvas-only'
  const [deviceWidth, setDeviceWidth] = useState('100%')
  const [showToolbar, setShowToolbar] = useState(true)
  const [showSettings, setShowSettings] = useState(false)
  const [settingsRect, setSettingsRect] = useState(null)
  const [jumpSpeed, setJumpSpeed] = useState('normal') // 'normal' | 'slow' | 'paused'
  const [simulateSafeArea, setSimulateSafeArea] = useState(false)

  // Synchronize transparent safe area status bar with top view background
  usePageBackground(viewMode === 'in-game' ? '#ffffff' : '#131722')

  // Local overrides for testing interactive "Play Again" and avatar customization
  const [playerOverrides, setPlayerOverrides] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const activePlayers = scenarioKey === 'custom'
    ? generateCustomPlayers(customCount)
    : (SCENARIOS[scenarioKey]?.players || SCENARIOS.five.players)

  const players = activePlayers.map(p => ({
    ...p,
    ...(playerOverrides[p.id] || {})
  }))

  const handleCustomCountChange = (newCount) => {
    const val = Math.max(3, Math.min(Number(newCount) || 3, 20))
    setCustomCount(val)
    setScenarioKey('custom')
    setPlayerOverrides({})
  }

  const myPlayer = players.find(p => p.id === sessionId)
  const hasOptedIn = Boolean(myPlayer?.playAgain)

  const handlePlayAgain = () => {
    setIsSubmitting(true)
    setTimeout(() => {
      setIsSubmitting(false)
      setPlayerOverrides(prev => ({
        ...prev,
        [sessionId]: {
          ...prev[sessionId],
          playAgain: !hasOptedIn
        }
      }))
    }, 400)
  }

  const handleRandomizeWinnerAvatar = () => {
    const winnerId = players[0]?.id || 'p1'
    const newAvatar = getRandomAvatar()
    setPlayerOverrides(prev => ({
      ...prev,
      [winnerId]: {
        ...prev[winnerId],
        avatar: newAvatar
      }
    }))
  }

  const handleResetScenario = (key) => {
    setScenarioKey(key)
    setPlayerOverrides({})
    setIsSubmitting(false)
  }

  const mockRoom = {
    id: 'WIN-DEMO',
    phase: 'GAME_RESULT',
    round: 3,
    totalRounds: 3,
    configuration: {
      drawTimeSec: 80,
      rounds: 3
    },
    currentDrawerId: 'p1',
    currentWord: 'CHAMPION',
    selectedWord: 'CHAMPION',
    players,
    guessedPlayerIds: ['p1', 'p2', 'p3', 'p4'],
    chatMessages: [
      { id: 'm1', playerName: 'Sophia', message: 'What a game! GG!', type: 'CHAT', createdAt: Date.now() - 6000 },
      { id: 'm2', playerName: 'Alex', message: 'That last drawing was so good haha', type: 'CHAT', createdAt: Date.now() - 4000 },
      { id: 'm3', playerName: 'Dhruv', message: 'Thanks for playing everyone!', type: 'CHAT', createdAt: Date.now() - 2500 },
      { id: 'm4', playerName: 'System', message: `${players[0]?.name} is the winner!`, type: 'SYSTEM', createdAt: Date.now() - 1000 },
    ],
    reactions: {}
  }

  const handleOpenSettings = (rect) => {
    setSettingsRect(rect)
    setShowSettings(true)
  }

  return (
    <div style={{
      width: '100%',
      minHeight: '100dvh',
      background: '#090d16',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'flex-start',
      position: 'relative',
      fontFamily: 'var(--sk-font-body, system-ui, sans-serif)',
      overflow: 'hidden',
      paddingTop: 'env(safe-area-inset-top, 0px)',
      paddingLeft: 'env(safe-area-inset-left, 0px)',
      paddingRight: 'env(safe-area-inset-right, 0px)',
      paddingBottom: 'env(safe-area-inset-bottom, 0px)',
    }}>
      {/* Dev Control Bar */}
      <div style={{
        width: '100%',
        background: '#131929',
        borderBottom: '1px solid rgba(255,255,255,0.12)',
        padding: showToolbar ? '8px 14px' : '4px 14px',
        color: '#ffffff',
        zIndex: 99999,
        boxSizing: 'border-box',
        fontSize: '0.82rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              background: '#FFC857',
              color: '#000',
              fontWeight: 800,
              fontSize: '0.72rem',
              padding: '2px 6px',
              borderRadius: '4px',
              letterSpacing: '0.04em'
            }}>
              DEV PREVIEW
            </span>
            <span style={{ fontWeight: 700, color: '#F8FAFC' }}>
              Skribbl Winning Page Inspector
            </span>
            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem' }}>
              <code>?preview=skribbl-winning</code>
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              onClick={() => setShowToolbar(prev => !prev)}
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.15)',
                color: '#CBD5E1',
                padding: '3px 8px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.75rem'
              }}
            >
              {showToolbar ? 'Hide Controls' : 'Show Controls'}
            </button>
            <button
              onClick={() => {
                if (onExit) onExit()
                else {
                  window.history.replaceState({}, '', '/')
                  window.location.reload()
                }
              }}
              style={{
                background: '#EF4444',
                border: 'none',
                color: '#fff',
                padding: '3px 10px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.75rem',
                fontWeight: 700
              }}
            >
              Exit Preview
            </button>
          </div>
        </div>

        {showToolbar && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', paddingTop: '4px' }}>
            {/* Scenarios */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem', fontWeight: 600 }}>Scenarios:</span>
              {Object.entries(SCENARIOS).map(([key, item]) => (
                <button
                  key={key}
                  onClick={() => handleResetScenario(key)}
                  style={{
                    background: scenarioKey === key ? 'var(--sk-primary, #3366cc)' : 'rgba(255,255,255,0.06)',
                    color: scenarioKey === key ? '#ffffff' : '#CBD5E1',
                    border: '1px solid ' + (scenarioKey === key ? 'var(--sk-primary, #3366cc)' : 'rgba(255,255,255,0.12)'),
                    padding: '3px 8px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                    fontWeight: scenarioKey === key ? 700 : 500
                  }}
                >
                  {item.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => handleCustomCountChange(customCount)}
                style={{
                  background: scenarioKey === 'custom' ? 'var(--sk-primary, #3366cc)' : 'rgba(255,255,255,0.06)',
                  color: scenarioKey === 'custom' ? '#ffffff' : '#CBD5E1',
                  border: '1px solid ' + (scenarioKey === 'custom' ? 'var(--sk-primary, #3366cc)' : 'rgba(255,255,255,0.12)'),
                  padding: '3px 8px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  fontWeight: scenarioKey === 'custom' ? 700 : 500
                }}
              >
                Custom ({customCount}P)
              </button>
            </div>

            {/* Custom Player Count Controls */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              background: scenarioKey === 'custom' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255, 255, 255, 0.05)',
              border: '1px solid ' + (scenarioKey === 'custom' ? '#3B82F6' : 'rgba(255, 255, 255, 0.15)'),
              borderRadius: '6px',
              padding: '2px 6px'
            }}>
              <span style={{ color: scenarioKey === 'custom' ? '#60A5FA' : 'rgba(255,255,255,0.7)', fontSize: '0.75rem', fontWeight: 700 }}>
                Custom Count:
              </span>
              <button
                type="button"
                onClick={() => handleCustomCountChange(customCount - 1)}
                disabled={customCount <= 3}
                style={{
                  background: 'rgba(255,255,255,0.12)',
                  border: 'none',
                  color: '#fff',
                  width: '20px',
                  height: '20px',
                  borderRadius: '3px',
                  cursor: customCount <= 3 ? 'not-allowed' : 'pointer',
                  fontWeight: 800,
                  fontSize: '0.8rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: customCount <= 3 ? 0.35 : 1
                }}
                title="Decrease players"
              >
                −
              </button>
              <input
                type="number"
                min={3}
                max={20}
                value={customCount}
                onChange={(e) => handleCustomCountChange(parseInt(e.target.value, 10))}
                style={{
                  width: '38px',
                  background: 'rgba(0,0,0,0.5)',
                  border: '1px solid rgba(255,255,255,0.25)',
                  color: '#FFC857',
                  borderRadius: '4px',
                  textAlign: 'center',
                  fontWeight: 800,
                  fontSize: '0.78rem',
                  padding: '2px 0'
                }}
                title="Custom player count (3–20)"
              />
              <button
                type="button"
                onClick={() => handleCustomCountChange(customCount + 1)}
                disabled={customCount >= 20}
                style={{
                  background: 'rgba(255,255,255,0.12)',
                  border: 'none',
                  color: '#fff',
                  width: '20px',
                  height: '20px',
                  borderRadius: '3px',
                  cursor: customCount >= 20 ? 'not-allowed' : 'pointer',
                  fontWeight: 800,
                  fontSize: '0.8rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: customCount >= 20 ? 0.35 : 1
                }}
                title="Increase players"
              >
                +
              </button>
            </div>

            {/* Jump Animation Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ color: '#FFC857', fontSize: '0.75rem', fontWeight: 700 }}>Jump:</span>
              <button
                onClick={() => setJumpSpeed('normal')}
                style={{
                  background: jumpSpeed === 'normal' ? '#10B981' : 'rgba(255,255,255,0.06)',
                  color: '#ffffff',
                  border: '1px solid rgba(255,255,255,0.15)',
                  padding: '3px 6px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.72rem',
                  fontWeight: jumpSpeed === 'normal' ? 700 : 500
                }}
              >
                Normal
              </button>
              <button
                onClick={() => setJumpSpeed('slow')}
                style={{
                  background: jumpSpeed === 'slow' ? '#F59E0B' : 'rgba(255,255,255,0.06)',
                  color: '#ffffff',
                  border: '1px solid rgba(255,255,255,0.15)',
                  padding: '3px 6px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.72rem',
                  fontWeight: jumpSpeed === 'slow' ? 700 : 500
                }}
              >
                Slow (0.5x)
              </button>
              <button
                onClick={() => setJumpSpeed('paused')}
                style={{
                  background: jumpSpeed === 'paused' ? '#EF4444' : 'rgba(255,255,255,0.06)',
                  color: '#ffffff',
                  border: '1px solid rgba(255,255,255,0.15)',
                  padding: '3px 6px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.72rem',
                  fontWeight: jumpSpeed === 'paused' ? 700 : 500
                }}
              >
                Pause
              </button>
            </div>

            {/* Randomize Winner Avatar */}
            <button
              onClick={handleRandomizeWinnerAvatar}
              title="Randomize Winner Avatar expression and color"
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.2)',
                color: '#F8FAFC',
                padding: '3px 8px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.74rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              🎲 Random Winner Avatar
            </button>

            {/* Simulate Safe Area / Notch */}
            <button
              onClick={() => setSimulateSafeArea(prev => !prev)}
              style={{
                background: simulateSafeArea ? '#8b5cf6' : 'rgba(255,255,255,0.06)',
                color: '#ffffff',
                border: '1px solid rgba(255,255,255,0.15)',
                padding: '3px 8px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.72rem',
                fontWeight: simulateSafeArea ? 700 : 500
              }}
            >
              📱 {simulateSafeArea ? 'Notch Sim ON' : 'Simulate Notch'}
            </button>

            {/* Local Player Switcher */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem', fontWeight: 600 }}>You:</span>
              <select
                value={sessionId}
                onChange={(e) => setSessionId(e.target.value)}
                style={{
                  background: '#1e2436',
                  color: '#ffffff',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '4px',
                  padding: '2px 6px',
                  fontSize: '0.75rem'
                }}
              >
                {players.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.score} pts)
                  </option>
                ))}
              </select>
            </div>

            {/* View Mode Toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem', fontWeight: 600 }}>View:</span>
              <button
                onClick={() => setViewMode('in-game')}
                style={{
                  background: viewMode === 'in-game' ? 'var(--sk-primary, #3366cc)' : 'rgba(255,255,255,0.06)',
                  color: '#ffffff',
                  border: '1px solid rgba(255,255,255,0.15)',
                  padding: '3px 8px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  fontWeight: viewMode === 'in-game' ? 700 : 500
                }}
              >
                In-Game
              </button>
              <button
                onClick={() => setViewMode('canvas-only')}
                style={{
                  background: viewMode === 'canvas-only' ? 'var(--sk-primary, #3366cc)' : 'rgba(255,255,255,0.06)',
                  color: '#ffffff',
                  border: '1px solid rgba(255,255,255,0.15)',
                  padding: '3px 8px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  fontWeight: viewMode === 'canvas-only' ? 700 : 500
                }}
              >
                Stage Only
              </button>
            </div>

            {/* Device Width Presets */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem', fontWeight: 600 }}>Width:</span>
              {WIDTH_PRESETS.map((p) => (
                <button
                  key={p.width}
                  onClick={() => setDeviceWidth(p.width)}
                  style={{
                    background: deviceWidth === p.width ? '#38bdf8' : 'rgba(255,255,255,0.06)',
                    color: deviceWidth === p.width ? '#000000' : '#CBD5E1',
                    border: '1px solid rgba(255,255,255,0.15)',
                    padding: '3px 6px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.72rem',
                    fontWeight: deviceWidth === p.width ? 700 : 500
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Dynamic Jump Speed Override Style */}
      {jumpSpeed === 'slow' && (
        <style>{`
          .sk-final-winner-avatar-wrap {
            animation-duration: 4.2s !important;
          }
          .sk-final-trophy-wrap {
            animation-duration: 4.2s !important;
          }
        `}</style>
      )}
      {jumpSpeed === 'paused' && (
        <style>{`
          .sk-final-winner-avatar-wrap {
            animation-play-state: paused !important;
          }
          .sk-final-trophy-wrap {
            animation-play-state: paused !important;
          }
        `}</style>
      )}

      {/* Main Preview Container */}
      <div style={{
        flex: 1,
        width: deviceWidth,
        maxWidth: '100%',
        height: 'calc(100dvh - 70px)',
        position: 'relative',
        boxShadow: deviceWidth !== '100%' ? '0 0 40px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.1)' : 'none',
        transition: 'width 250ms cubic-bezier(0.16, 1, 0.3, 1)',
        overflow: 'hidden',
        background: 'var(--sk-surface, #ffffff)',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Optional Simulated Notch Overlay for testing transparent safe area */}
        {simulateSafeArea && (
          <div style={{
            width: '100%',
            height: '44px',
            background: 'transparent',
            position: 'absolute',
            top: 0,
            left: 0,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none'
          }}>
            <div style={{
              width: '124px',
              height: '30px',
              background: '#000000',
              borderRadius: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              fontSize: '0.65rem',
              fontWeight: 700,
              opacity: 0.95
            }}>
              Dynamic Island
            </div>
          </div>
        )}

        {viewMode === 'in-game' ? (
          /* EXACT IN-GAME SHELL */
          <div className="sk-view sk-view--game is-game-result" style={{ position: 'relative', height: '100%', minHeight: 0, inset: 0 }}>
            {/* Background shapes */}
            <div className="sk-bg-shapes">
              <div className="sk-bg-shape sk-bg-shape-1" />
              <div className="sk-bg-shape sk-bg-shape-2" />
              <div className="sk-bg-shape sk-bg-shape-3" />
            </div>

            {/* In-game layout scoped CSS */}
            <style>{`
              .sk-view--game.is-game-result .sk-game-body {
                overflow-y: hidden !important;
                overscroll-behavior: none !important;
              }
              .sk-view--game.is-game-result .sk-drawing-surface-wrapper {
                flex: 74;
                touch-action: none;
                position: relative;
                min-height: 0;
                background: var(--sk-canvas);
                z-index: 5;
                overflow: hidden;
              }
              .sk-view--game.is-game-result .sk-drawing-surface {
                position: absolute;
                inset: 0;
                overflow: hidden;
              }
              .sk-view--game.is-game-result .sk-lower-info-section {
                flex: 26;
                min-height: 120px;
                display: flex;
                background: #ffffff;
                z-index: 10;
                box-sizing: border-box;
              }
              @media (max-width: 768px) {
                .sk-view--game.is-game-result .sk-drawing-surface-wrapper {
                  flex: none !important;
                  width: 100% !important;
                  height: clamp(340px, 92vw, min(420px, calc(100dvh - 160px))) !important;
                  max-height: none !important;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  overflow: hidden !important;
                }
                .sk-view--game.is-game-result .sk-drawing-surface {
                  position: absolute !important;
                  inset: 0 !important;
                  aspect-ratio: auto !important;
                  width: 100% !important;
                  height: 100% !important;
                  max-width: 100% !important;
                  box-sizing: border-box !important;
                }
                .sk-view--game.is-game-result .sk-lower-info-section {
                  flex: 1 1 0% !important;
                  min-height: 120px !important;
                }
              }
            `}</style>

            <div className="sk-game-body" data-sk-scroll>
              <DrawingTopBar 
                room={mockRoom}
                timeRemaining={0}
                isDrawer={false}
                hasGuessed={true}
                onOpenSettings={handleOpenSettings}
              />

              <div className="sk-drawing-surface-wrapper">
                <div className="sk-drawing-surface">
                  <FinalScores
                    players={players}
                    sessionId={sessionId}
                    isSubmitting={isSubmitting}
                    hasOptedIn={hasOptedIn}
                    error={null}
                    onPlayAgain={handlePlayAgain}
                    onOpenSettings={handleOpenSettings}
                  />
                </div>
              </div>

              <div className="sk-lower-info-section">
                <div style={{ flex: '0 0 45%', borderRight: '1px solid rgba(0,0,0,0.05)', minWidth: 0 }}>
                  <PlayerStrip 
                    room={mockRoom} 
                    currentDrawerId="p1" 
                    sessionId={sessionId}
                    onKickPlayer={() => {}}
                    onVoteKickPlayer={() => {}}
                    isKicking={false}
                    onTargetLeft={() => {}}
                  />
                </div>
                <div style={{ flex: '0 0 55%', minWidth: 0 }}>
                  <ChatBox room={mockRoom} />
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* CANVAS ONLY VIEW */
          <div style={{
            flex: 1,
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#131722',
            padding: '16px',
            boxSizing: 'border-box'
          }}>
            <div style={{
              width: '100%',
              maxWidth: '520px',
              height: 'clamp(340px, 92vw, 420px)',
              position: 'relative',
              borderRadius: '12px',
              overflow: 'hidden',
              boxShadow: '0 12px 36px rgba(0,0,0,0.45)'
            }}>
              <FinalScores
                players={players}
                sessionId={sessionId}
                isSubmitting={isSubmitting}
                hasOptedIn={hasOptedIn}
                error={null}
                onPlayAgain={handlePlayAgain}
                onOpenSettings={handleOpenSettings}
              />
            </div>
          </div>
        )}
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <SettingsPanel 
          room={mockRoom} 
          sessionId={sessionId} 
          onClose={() => setShowSettings(false)} 
          anchorRect={settingsRect}
          onUpdateConfig={() => {}}
          onLeave={() => setShowSettings(false)}
        />
      )}
    </div>
  )
}
