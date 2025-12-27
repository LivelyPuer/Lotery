import { useState, useEffect, useRef } from 'react'
import io from 'socket.io-client'
import confetti from 'canvas-confetti'
import { QRCodeSVG } from 'qrcode.react'
import './App.css'

const socket = io(import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' ? 'http://localhost:3001' : '/'))

function App() {
  const [view, setView] = useState('home') // home, creator, participant
  const [roomCode, setRoomCode] = useState('')
  const [maxTickets, setMaxTickets] = useState(100)
  const [ticketNumber, setTicketNumber] = useState(null)
  const [participantCount, setParticipantCount] = useState(0)
  const [winner, setWinner] = useState(null)
  const [pastWinners, setPastWinners] = useState([])
  const [isSpinning, setIsSpinning] = useState(false)
  const [error, setError] = useState('')
  const [rouletteItems, setRouletteItems] = useState([])
  const [rouletteOffset, setRouletteOffset] = useState(0)
  const [isInstant, setIsInstant] = useState(true)

  // Refs to avoid stale closures in socket listeners
  const pastWinnersRef = useRef([])
  const maxTicketsRef = useRef(100)

  useEffect(() => {
    maxTicketsRef.current = maxTickets
  }, [maxTickets])

  useEffect(() => {
    pastWinnersRef.current = pastWinners
  }, [pastWinners])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const roomParam = params.get('room')
    if (roomParam) {
      const upperCode = roomParam.toUpperCase()
      setRoomCode(upperCode)
      // Auto-join
      socket.emit('joinRoom', { roomCode: upperCode }, ({ ticketNumber, error }) => {
        if (!error) {
          setTicketNumber(ticketNumber)
          setView('participant')
        }
      })
    }

    socket.on('updateParticipants', ({ count }) => {
      setParticipantCount(count)
    })

    socket.on('winnerResult', ({ winner, allWinners }) => {
      setIsSpinning(true)
      setIsInstant(true) // Disable transition for reset
      setRouletteOffset(0)

      const currentMax = maxTicketsRef.current || 100
      const currentPast = pastWinnersRef.current || []

      // Generate random sequence for the roulette
      const items = Array.from({ length: 70 }, () => {
        const all = Array.from({ length: currentMax }, (_, i) => i + 1);
        const rem = all.filter(n => !currentPast.includes(n) && n !== winner);
        return rem[Math.floor(Math.random() * rem.length)] || Math.floor(Math.random() * currentMax) + 1;
      });

      // Target position
      const targetIndex = 60;
      items[targetIndex] = winner;

      setRouletteItems(items);

      // Trigger animation with a small delay to let the reset settle
      setTimeout(() => {
        setIsInstant(false) // Enable transition
        const itemWidth = 80;
        const gap = 10;
        const offset = targetIndex * (itemWidth + gap) + (itemWidth / 2);
        setRouletteOffset(offset);

        setTimeout(() => {
          setWinner(winner);
          if (allWinners && Array.isArray(allWinners)) {
            setPastWinners(allWinners);
          }
          setIsSpinning(false);
          confetti({
            particleCount: 250,
            spread: 100,
            origin: { y: 0.5 },
            colors: ['#d42426', '#ffd700', '#165b33', '#ffffff']
          });
        }, 5100);
      }, 100);
    })

    return () => {
      socket.off('updateParticipants')
      socket.off('winnerResult')
    }
  }, []) // Removed maxTickets dependency to avoid listener re-attachment, use refs instead

  const createRoom = () => {
    socket.emit('createRoom', { maxTickets }, ({ roomCode }) => {
      setRoomCode(roomCode)
      setView('lobby')
    })
  }

  const joinRoom = () => {
    if (!roomCode) {
      setError('Введите код комнаты')
      return
    }
    socket.emit('joinRoom', { roomCode }, ({ ticketNumber, error }) => {
      if (error) {
        setError(error)
      } else {
        setTicketNumber(ticketNumber)
        setView('participant')
        setError('')
      }
    })
  }

  const handleSpin = () => {
    socket.emit('spin', { roomCode })
  }

  const renderHome = () => (
    <div className="content home-card">
      <h1 style={{ fontSize: '3.5rem', margin: '0 0 40px 0', textAlign: 'center', lineHeight: 1.2 }}>❄️ Лотерея<br />Деда Мороза</h1>

      <div style={{ width: '100%', background: 'rgba(255,255,255,0.07)', padding: '40px', borderRadius: '30px', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)' }}>
        <div style={{ textAlign: 'left', marginBottom: '30px' }}>
          <label style={{ color: 'var(--text-grey)', fontSize: '0.9rem', fontWeight: 800 }}>КОЛИЧЕСТВО БИЛЕТОВ (N)</label>
          <input
            className="input-game"
            type="number"
            value={maxTickets}
            onChange={(e) => setMaxTickets(parseInt(e.target.value) || 0)}
          />
          <button className="btn-game" style={{ width: '100%', marginTop: '20px', fontSize: '1.2rem' }} onClick={createRoom}>СОЗДАТЬ КОМНАТУ</button>
        </div>

        <div style={{ position: 'relative', textAlign: 'center', margin: '40px 0' }}>
          <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', position: 'absolute', top: '50%', left: 0, right: 0 }}></div>
          <span style={{ position: 'relative', background: '#012b1d', padding: '0 20px', color: 'rgba(255,255,255,0.3)', fontWeight: 800 }}>ИЛИ ВОЙТИ</span>
        </div>

        <div style={{ textAlign: 'left' }}>
          <label style={{ color: 'var(--text-grey)', fontSize: '0.9rem', fontWeight: 800 }}>КОД КОМНАТЫ</label>
          <input
            className="input-game"
            type="text"
            placeholder="Введите код..."
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
          />
          {error && <p style={{ color: 'var(--card-red)', marginTop: '10px', fontSize: '0.9rem', fontWeight: 700 }}>{error}</p>}
          <button className="btn-game" style={{ width: '100%', marginTop: '20px', background: 'var(--card-green)', boxShadow: '0 8px 0 #072a18', fontSize: '1.2rem' }} onClick={joinRoom}>ПРИСОЕДИНИТЬСЯ</button>
        </div>
      </div>
    </div>
  )

  const renderLobby = () => {
    const joinLink = `${window.location.origin}/?room=${roomCode}`
    return (
      <div className="lobby-view">
        <h1 style={{ fontSize: '2.5rem', marginBottom: '0' }}>ПРИСОЕДИНЯЙТЕСЬ!</h1>
        <p style={{ opacity: 0.7 }}>Сканируйте QR-код или введите код вручную</p>

        <div className="lobby-qr-wrapper">
          <QRCodeSVG value={joinLink} size={250} level="H" />
        </div>

        <div className="lobby-info">
          <div style={{ fontSize: '0.9rem', fontWeight: 800, opacity: 0.6 }}>КОД КОМНАТЫ:</div>
          <div style={{ fontSize: '3rem', fontWeight: 900, color: 'var(--festive-gold)', letterSpacing: '5px' }}>{roomCode}</div>

          <div className="lobby-link">{joinLink}</div>

          <div style={{ fontSize: '1.2rem', margin: '20px 0' }}>УЧАСТНИКОВ: <strong style={{ color: 'var(--festive-gold)' }}>{participantCount}</strong></div>
        </div>

        <button className="btn-game" style={{ padding: '20px 80px' }} onClick={() => setView('creator')}>НАЧАТЬ РОЗЫГРЫШ</button>
      </div>
    )
  }

  const renderDashboard = (isCreator) => {
    const progress = Math.min((participantCount / maxTickets) * 100, 100)

    return (
      <>
        <div className="header">
          <span>❄️ Лотерея Деда Мороза</span>
          {!isCreator && ticketNumber && (
            <div className="user-ticket-badge">ВАШ БИЛЕТ: <span>{ticketNumber}</span></div>
          )}
          <button className="exit-btn" onClick={() => setView('home')}>ВЫЙТИ ИЗ КОМНАТЫ</button>
        </div>

        <div className="content">
          <div className="stats-card">
            <div className="stats-card-main">
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '10px' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 800, opacity: 0.9 }}>КОД КОМНАТЫ:</span>
                <span className="room-info-badge">{roomCode}</span>
              </div>
              <div style={{ fontSize: '1.3rem', fontWeight: 900 }}>РАЗЫГРЫВАЕМ {maxTickets} БИЛЕТОВ</div>

              <div className="progress-container">
                <div className="progress-bar" style={{ width: `${progress}%` }}></div>
                <div className="progress-text">УЧАСТНИКОВ: {participantCount} / {maxTickets}</div>
              </div>

              {!isCreator && ticketNumber && (
                <div className="stats-ticket-info">
                  ВАШ СЧАСТЛИВЫЙ НОМЕР: <strong>{ticketNumber}</strong>
                </div>
              )}
            </div>
          </div>

          {(isSpinning || rouletteItems.length > 0) && (
            <div className="roulette-container">
              <div
                className={`roulette-strip ${isInstant ? 'instant' : ''}`}
                style={{ transform: `translateX(-${rouletteOffset}px)` }}
              >
                {rouletteItems.map((num, i) => (
                  <div key={i} className={`roulette-item ${!isSpinning && num === winner ? 'winner-glow' : ''}`}>
                    {num}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="santa-section">
            <img src="/santa.png" className="santa-avatar" alt="Santa" />
            <div className="dialogue-bubble">
              {isCreator ? (
                winner ? `УХ ТЫ! ПОБЕДИТЕЛЬ — БИЛЕТ №${winner}! КТО ЖЕ БУДЕТ СЛЕДУЮЩИМ?` : "ХО-ХО-ХО! ПРИВЕТСТВУЮ, МОЙ ЮНЫЙ ПОМОЩНИК! ЖМИ НА КНОПКУ, И ДАВАЙ УЗНАЕМ ИМЯ ПОБЕДИТЕЛЯ!"
              ) : (
                winner === null ? `ТВОЙ СЧАСТЛИВЫЙ НОМЕР — ${ticketNumber}. СКОРО НАЧНЕМ!` :
                  winner === ticketNumber ? "ООО! ТЫ НАСТОЯЩИЙ ВЕЗУНЧИК! ТВОЙ БИЛЕТ ВЫИГРАЛ! 🎄🥳" :
                    `СЕЙЧАС ПОВЕЗЛО НОМЕРУ ${winner}. НЕ ГРУСТИ, ТВОЯ УДАЧА ЕЩЕ ВПЕРЕДИ!`
              )}
            </div>
          </div>

          {pastWinners.length > 0 && (
            <div className="winners-history">
              <div className="winners-history-label">ВЫИГРАЛИ:</div>
              <div className="winners-list">
                {pastWinners.map((num, i) => (
                  <div key={i} className={`winner-tag ${num === winner ? 'current' : ''}`}>
                    {num}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="ticket-grid">
            {Array.from({ length: maxTickets }, (_, i) => i + 1).map(num => (
              <div
                key={num}
                className={`ticket-slot ${num === winner ? 'winner' : ''} ${(pastWinners || []).includes(num) && num !== winner ? 'played' : ''} ${num <= participantCount ? 'active' : ''}`}
              >
                {num}
              </div>
            ))}
          </div>
        </div>

        <div className="controls-panel">
          {!isCreator && ticketNumber && (
            <div style={{ fontSize: '1.4rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '20px' }}>
              ВАШ БИЛЕТ: <span style={{ color: 'var(--festive-gold)', fontSize: '2.5rem', background: 'rgba(0,0,0,0.3)', padding: '0 20px', borderRadius: '10px' }}>{ticketNumber}</span>
            </div>
          )}

          {isCreator && (
            <button className="btn-game" onClick={handleSpin} disabled={isSpinning}>
              {isSpinning ? '🎄 МАГИЯ В ПРОЦЕССЕ...' : winner === null ? 'НАЧАТЬ РОЗЫГРЫШ' : 'СЛЕДУЮЩИЙ ПОБЕДИТЕЛЬ!'}
            </button>
          )}
        </div>
      </>
    )
  }

  return (
    <div className="app-container">
      <div className="tinsel-top"></div>
      <Garland />
      <Decorations />
      {view === 'home' ? renderHome() :
        view === 'lobby' ? renderLobby() :
          renderDashboard(view === 'creator')}
    </div>
  )
}

function Garland() {
  return (
    <div className="garland">
      {Array.from({ length: 25 }).map((_, i) => (
        <div key={i} className="light"></div>
      ))}
    </div>
  )
}

function Decorations() {
  return (
    <>
      <div className="star-container">
        {Array.from({ length: 15 }).map((_, i) => (
          <div
            key={i}
            className="falling-star"
            style={{
              left: `${Math.random() * 100}%`,
              animationDuration: `${Math.random() * 5 + 5}s`,
              animationDelay: `${Math.random() * 5}s`
            }}
          >
            ★
          </div>
        ))}
      </div>
      <div className="tree-decor tree-left">🎄</div>
      <div className="tree-decor tree-right">🎄</div>
    </>
  )
}

export default App
