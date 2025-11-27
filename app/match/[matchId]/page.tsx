// src/app/match/[matchId]/page.tsx
'use client';

import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { doc, onSnapshot, updateDoc, setDoc } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import TeamSetupModal from '@/app/components/TeamSetupModal';

// Tipos
interface Team {
  name: string;
  logo: string;
  color: string;
  players?: any[]; // opcional, si viene desde modal
}

interface MatchEvent {
  type: 'goal' | 'save';
  timestamp: number;
}

interface GoalRecord {
  id: string;
  team: 'team1' | 'team2';
  playerId: string;
  playerName: string;
  number: string;
  quarter: number;
  elapsedInQuarter: number; // secs
  matchMinute: number; // minutes from start
  timestamp: number;
}

interface MatchData {
  quarter: number;
  teams: { team1: Team; team2: Team };
  score: { team1: number; team2: number };
  running: boolean;
  status: 'active' | 'paused' | 'finished';
  quarterDuration: number;
  configured: boolean;
  sponsorLogo: string;

  remaining?: number;
  startTime?: number | null;

  event?: MatchEvent | null;

  adminPinHash?: string | null;

  goals?: GoalRecord[];
}

export default function MatchPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const matchId = params.matchId as string;
  const adminParam = searchParams.get('admin') ?? null;

  const [matchData, setMatchData] = useState<MatchData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const [displayTime, setDisplayTime] = useState<number>(0);
  const [visibleEvent, setVisibleEvent] = useState<'goal' | 'save' | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);

  // Scorer modal state (admin)
  const [showScorerModal, setShowScorerModal] = useState(false);
  const [scorerTeam, setScorerTeam] = useState<'team1' | 'team2' | null>(null);
  const [scorerCandidates, setScorerCandidates] = useState<any[]>([]);

  // Goals viewer for spectators
  const [showGoalsModal, setShowGoalsModal] = useState(false);

  const matchDataRef = useRef<MatchData | null>(null);
  const prevGoalsCountRef = useRef<number>(0);

  // SHA-256 helper
  const hashSha256Hex = async (text: string) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
  };

  // ---------- Wake Lock ----------
  useEffect(() => {
    let wakeLock: any = null;
    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLock = await (navigator as any).wakeLock.request('screen');
          setWakeLockActive(true);
        }
      } catch (err) {
        setWakeLockActive(false);
      }
    };

    const handleVisibilityChange = () => {
      if (wakeLock !== null && document.visibilityState === 'visible') requestWakeLock();
    };

    if (!isAdmin) {
      requestWakeLock();
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    return () => {
      if (wakeLock !== null) {
        wakeLock.release().then(() => {
          wakeLock = null;
          setWakeLockActive(false);
        });
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      setWakeLockActive(false);
    };
  }, [isAdmin]);

  // ---------- Snapshot ----------
  useEffect(() => {
    const matchRef = doc(db, 'matches', matchId);

    const unsubscribe = onSnapshot(matchRef, (docSnapshot) => {
      if (docSnapshot.exists()) {
        const data = docSnapshot.data() as any;

        const remainingFromDoc =
          data.remaining !== undefined && data.remaining !== null
            ? data.remaining
            : data.time !== undefined
            ? data.time
            : undefined;

        const mapped: MatchData = {
          quarter: data.quarter ?? 1,
          teams: data.teams ?? {
            team1: { name: 'Equipo Local', logo: '', color: '#FF0000', players: [] },
            team2: { name: 'Equipo Visitante', logo: '', color: '#0000FF', players: [] }
          },
          score: data.score ?? { team1: 0, team2: 0 },
          running: data.running ?? false,
          status: data.status ?? 'active',
          quarterDuration: data.quarterDuration ?? (remainingFromDoc ?? 600),
          configured: data.configured ?? false,
          sponsorLogo: data.sponsorLogo ?? '',
          remaining: remainingFromDoc ?? (data.quarterDuration ?? 600),
          startTime: data.startTime ?? null,
          event: data.event ?? null,
          adminPinHash: data.adminPinHash ?? null,
          goals: data.goals ?? []
        };

        matchDataRef.current = mapped;
        setMatchData(mapped);
      } else {
        // Si no existe y viene adminParam (creación inicial permitida), crear doc
        if (adminParam) {
          const newMatch: MatchData = {
            quarter: 1,
            teams: {
              team1: { name: 'Equipo Local', logo: '', color: '#FF0000', players: [] },
              team2: { name: 'Equipo Visitante', logo: '', color: '#0000FF', players: [] }
            },
            score: { team1: 0, team2: 0 },
            running: false,
            status: 'active',
            quarterDuration: 600,
            configured: false,
            sponsorLogo: '',
            remaining: 600,
            startTime: null,
            event: null,
            adminPinHash: null,
            goals: []
          };
          setDoc(matchRef, newMatch);
          setMatchData(newMatch);
          matchDataRef.current = newMatch;
          setShowSetupModal(true);
        } else {
          setMatchData(null);
        }
      }

      setLoading(false);
    }, (error) => {
      console.error('Snapshot listener error:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [matchId, adminParam]);

  // ---------- Verify adminParam vs stored hash ----------
  useEffect(() => {
    const verify = async () => {
      if (!matchData || !adminParam) {
        setIsAdmin(false);
        return;
      }
      if (!matchData.adminPinHash) {
        setIsAdmin(false);
        return;
      }
      try {
        const hashed = await hashSha256Hex(adminParam);
        setIsAdmin(hashed === matchData.adminPinHash);
      } catch (err) {
        setIsAdmin(false);
      }
    };
    verify();
  }, [matchData?.adminPinHash, adminParam, matchData]);

  // ---------- Time tick ----------
  useEffect(() => {
    if (!matchData) return;

    let intervalId: NodeJS.Timeout | null = null;

    const computeAndSet = () => {
      const md = matchDataRef.current;
      if (!md) return;
      const remainingBase = md.remaining ?? md.quarterDuration ?? 600;

      if (!md.running || !md.startTime) {
        setDisplayTime(Math.max(0, remainingBase));
        return;
      }

      const now = Date.now();
      const elapsed = Math.floor((now - md.startTime) / 1000);
      const newTime = Math.max(0, remainingBase - elapsed);
      setDisplayTime(newTime);

      if (newTime === 0) handleQuarterEnd(md);
    };

    computeAndSet();
    intervalId = setInterval(computeAndSet, 250);

    return () => {
      if (intervalId) clearInterval(intervalId as NodeJS.Timeout);
    };
  }, [matchData?.running, matchData?.startTime, matchData?.remaining]);

  // ---------- Show visible event animations ----------
  useEffect(() => {
    if (!matchData?.event) return;
    setVisibleEvent(matchData.event.type);
    const t = setTimeout(() => setVisibleEvent(null), 3000);
    return () => clearTimeout(t);
  }, [matchData?.event?.timestamp]);

  // ---------- Detect new goals to show GOLES modal to spectators ----------
  useEffect(() => {
    const goals = matchData?.goals ?? [];
    const prev = prevGoalsCountRef.current;
    if (!isAdmin && goals.length > prev) {
      // new goal added, show GOLES modal a espectadores
      setShowGoalsModal(true);
      // auto hide after 8s
      const t = setTimeout(() => setShowGoalsModal(false), 8000);
      return () => clearTimeout(t);
    }
    prevGoalsCountRef.current = goals.length;
  }, [matchData?.goals, isAdmin]);

  // ---------- Helpers to update Firestore (only if isAdmin true) ----------
  const updateMatch = async (updates: Partial<MatchData>) => {
    if (!isAdmin) {
      console.warn('Es necesario admin válido para escribir datos.');
      return;
    }
    const matchRef = doc(db, 'matches', matchId);
    try {
      await updateDoc(matchRef, updates as any);
    } catch (err) {
      console.error('Error actualizando match:', err);
    }
  };

  // ---------- Quarter end ----------
  const handleQuarterEnd = async (current: MatchData) => {
    await updateMatch({ running: false, status: 'paused', remaining: 0, startTime: null });

    if (current.quarter < 4) {
      const nextQuarter = current.quarter + 1;
      await updateMatch({
        quarter: nextQuarter,
        remaining: current.quarterDuration,
        running: false,
        startTime: null
      });

      if (isAdmin) setTimeout(() => alert(`🏑 Cuarto ${current.quarter} finalizado! Avanzando al cuarto ${nextQuarter}`), 100);
    } else {
      await updateMatch({ status: 'finished', running: false, startTime: null });
      if (isAdmin) setTimeout(() => alert('🏁 Partido finalizado!'), 100);
    }
  };

  // ---------- Controls ----------
  const startMatch = () => {
    if (!matchData) return;
    if (matchData.running) return;
    updateMatch({ running: true, startTime: Date.now(), status: 'active' });
  };

  const pauseMatch = () => {
    if (!matchData || !matchData.running) return;
    const now = Date.now();
    const elapsed = matchData.startTime ? Math.floor((now - matchData.startTime) / 1000) : 0;
    const newRemaining = Math.max(0, (matchData.remaining ?? matchData.quarterDuration ?? 600) - elapsed);
    updateMatch({ running: false, remaining: newRemaining, startTime: null, status: 'paused' });
  };

  const resetQuarter = () => {
    if (!matchData) return;
    updateMatch({ remaining: matchData.quarterDuration, running: false, startTime: null });
  };

  const setQuarter = (quarter: number) => {
    if (!matchData) return;
    updateMatch({ quarter, remaining: matchData.quarterDuration, running: false, startTime: null });
  };

  // ---------- Goal flow ----------
  // When admin clicks +, open scorer modal showing selected players for that team
  const openScorerModal = (team: 'team1' | 'team2') => {
    if (!matchData) return;
    const players = (matchData.teams[team].players ?? []).filter((p: any) => p.selected !== false);
    setScorerCandidates(players);
    setScorerTeam(team);
    setShowScorerModal(true);
  };

  // Confirm scorer selection (admin chooses player)
  const confirmScorer = async (player: any) => {
    if (!matchData || !scorerTeam || !player) return;

    // compute elapsedInQuarter and matchMinute
    const qDuration = matchData.quarterDuration ?? 600;
    // Use displayTime (remaining seconds in current quarter) as source of truth
    const remainingInQuarter = displayTime;
    const elapsedInQuarter = Math.max(0, (qDuration - remainingInQuarter));
    const minutesBefore = (matchData.quarter - 1) * qDuration;
    const matchMinuteTotalSeconds = minutesBefore + elapsedInQuarter;
    const matchMinute = Math.floor(matchMinuteTotalSeconds / 60);

    // create goal object
    const goal: GoalRecord = {
      id: Date.now().toString(),
      team: scorerTeam,
      playerId: player.id,
      playerName: player.name,
      number: player.number,
      quarter: matchData.quarter,
      elapsedInQuarter: Math.floor(elapsedInQuarter),
      matchMinute: matchMinute,
      timestamp: Date.now()
    };

    // update DB: push goal and update score and event
    try {
      // read current goals safely from matchDataRef
      const currentGoals = matchDataRef.current?.goals ?? [];
      const newGoals = [...currentGoals, goal];

      // compute new score
      const newScore = { ...matchData.score };
      newScore[scorerTeam] = (newScore[scorerTeam] ?? 0) + 1;

      // perform update (requires admin)
      if (isAdmin) {
        const matchRef = doc(db, 'matches', matchId);
        await updateDoc(matchRef, {
          goals: newGoals,
          score: newScore,
          event: { type: 'goal', timestamp: Date.now() }
        } as any);
      }
    } catch (err) {
      console.error('Error guardando gol:', err);
    } finally {
      setShowScorerModal(false);
      setScorerTeam(null);
      setScorerCandidates([]);
    }
  };

  // Remove goal - admin only (simple by id)
  const removeGoalById = async (goalId: string) => {
    if (!matchData) return;
    const currentGoals = matchData.goals ?? [];
    const newGoals = currentGoals.filter(g => g.id !== goalId);
    // recalc scores from goals
    const scores = { team1: 0, team2: 0 };
    newGoals.forEach(g => scores[g.team]++);
    if (isAdmin) {
      const matchRef = doc(db, 'matches', matchId);
      await updateDoc(matchRef, { goals: newGoals, score: scores } as any);
    }
  };

  // ---------- Trigger animations (admin) ----------
  const triggerEvent = async (type: 'goal' | 'save') => {
    if (!isAdmin) return;
    await updateMatch({
      event: {
        type,
        timestamp: Date.now()
      }
    });
  };

  // ---------- TeamSetup Save ----------
  const handleTeamSetupSave = async (data: { team1: any; team2: any; adminPinHash?: string; adminPin?: string }) => {
    // Guardar equipos + hash
    const updates: Partial<MatchData> = {
      teams: {
        team1: { name: data.team1.name, logo: data.team1.logo, color: data.team1.color, players: data.team1.players ?? [] },
        team2: { name: data.team2.name, logo: data.team2.logo, color: data.team2.color, players: data.team2.players ?? [] }
      },
      sponsorLogo: data.team1.sponsorLogo || '',
      configured: true
    };

    if (data.adminPinHash) updates.adminPinHash = data.adminPinHash;

    try {
      // write as admin if already verified; otherwise try update (initial create case)
      const matchRef = doc(db, 'matches', matchId);
      await updateDoc(matchRef, updates as any);
    } catch (err) {
      // fallback: try setDoc/updateDoc (best-effort)
      try {
        const matchRef = doc(db, 'matches', matchId);
        await updateDoc(matchRef, updates as any);
      } catch (err2) {
        console.error('No se pudo escribir configuración del partido:', err2);
      }
    }

    setShowSetupModal(false);

    // Redirigir al admin con PIN original (si nos dieron adminPin)
    if (data.adminPin) {
      // construir URL con admin PIN
      router.push(`/match/${matchId}?admin=${encodeURIComponent(data.adminPin)}`);
    } else if (adminParam) {
      // si no hay pin (por ejemplo reconfiguración), mantener adminParam
      router.push(`/match/${matchId}?admin=${encodeURIComponent(adminParam)}`);
    } else {
      router.push(`/match/${matchId}`);
    }
  };

  const setQuarterDuration = (minutes: number) => {
    const seconds = minutes * 60;
    updateMatch({ quarterDuration: seconds, remaining: seconds, startTime: null, running: false });
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // ---------- Render ----------
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-blue-900 flex items-center justify-center">
        <div className="text-white text-xl">Cargando partido...</div>
      </div>
    );
  }

  if (!matchData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-blue-900 flex items-center justify-center">
        <div className="text-white text-xl text-center">
          <p>Partido no encontrado</p>
          <p className="text-sm text-gray-400 mt-2">Código: {matchId}</p>
          {!isAdmin && <p className="text-yellow-400 mt-4">Solo el administrador puede crear partidos</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-blue-900 p-8">
      {/* Global animation styles */}
      <style jsx global>{`
        .confetti-piece { position: fixed; top: -10px; width: 10px; height: 14px; opacity: 0.95; z-index: 9999; pointer-events: none; transform-origin: center; }
        @keyframes confetti-fall { 0% { transform: translateY(-10vh) rotate(0deg); opacity: 1; } 100% { transform: translateY(110vh) rotate(720deg); opacity: 0.9; } }
        @keyframes wiggle { 0% { transform: translateX(0) rotate(0deg); } 25% { transform: translateX(-8px) rotate(-6deg); } 50% { transform: translateX(8px) rotate(6deg); } 75% { transform: translateX(-4px) rotate(-3deg); } 100% { transform: translateX(0) rotate(0deg); } }
        .animate-wiggle { animation: wiggle 0.9s ease-in-out both; }
      `}</style>

      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-white mb-2">🏑 Partido en Vivo</h1>
        <p className="text-gray-300">Código: <span className="font-mono bg-black/30 px-2 py-1 rounded">{matchId}</span></p>
        {isAdmin ? <p className="text-green-400 font-semibold mt-2">🔧 Modo Administrador</p> : <p className="text-blue-400 font-semibold mt-2">👀 Modo Espectador</p>}
      </div>

      {/* Scoreboard */}
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 mb-6 border border-white/20">
        <div className="grid grid-cols-3 items-center text-center">
          {/* Team 1 */}
          <div className="text-center">
            <div className="flex items-center justify-center gap-3 mb-2">
              {matchData.teams.team1.logo && (
                <img src={matchData.teams.team1.logo} alt={`Logo ${matchData.teams.team1.name}`} className="w-20 h-20 object-contain rounded-full border-2" style={{ borderColor: matchData.teams.team1.color }} />
              )}
              <div className="text-2xl font-bold px-3 py-1 rounded-lg" style={{ backgroundColor: matchData.teams.team1.color, color: 'white' }}>{matchData.teams.team1.name}</div>
            </div>

            <div className="text-6xl font-bold text-green-400">{matchData.score.team1}</div>
            {isAdmin && (
              <div className="flex justify-center gap-2 mt-2">
                <button onClick={() => removeGoalById(/* not wired to specific goal here */ '')} className="bg-blue-500 hover:bg-blue-600 text-white w-8 h-8 rounded-full" title="Eliminar último gol">-</button>
                <button onClick={() => openScorerModal('team1')} className="bg-green-500 hover:bg-green-600 text-white w-8 h-8 rounded-full">+</button>
              </div>
            )}
          </div>

          {/* Timer */}
          <div className="text-center">
            <div className={`font-mono font-bold text-white mb-2 ${!isAdmin ? 'text-6xl' : 'text-4xl'}`}>{formatTime(displayTime)}</div>
            <div className={`${!isAdmin ? 'text-2xl' : 'text-xl'} text-gray-300`}>Cuarto {matchData.quarter}</div>
            {matchData.running && <div className="text-blue-400 text-sm">▶ EN VIVO</div>}
            {matchData.status === 'paused' && <div className="text-yellow-400 text-sm">⏸ PAUSADO</div>}

            {isAdmin && (
              <div className="mt-2 flex justify-center gap-2">
                <button onClick={() => setQuarterDuration(10)} className={`text-xs px-2 py-1 rounded ${matchData.quarterDuration === 600 ? 'bg-white text-black' : 'bg-gray-600 text-white'}`}>10min</button>
                <button onClick={() => setQuarterDuration(15)} className={`text-xs px-2 py-1 rounded ${matchData.quarterDuration === 900 ? 'bg-white text-black' : 'bg-gray-600 text-white'}`}>15min</button>
                <button onClick={() => setQuarterDuration(20)} className={`text-xs px-2 py-1 rounded ${matchData.quarterDuration === 1200 ? 'bg-white text-black' : 'bg-gray-600 text-white'}`}>20min</button>
              </div>
            )}
          </div>

          {/* Team 2 */}
          <div className="text-center">
            <div className="flex items-center justify-center gap-3 mb-2">
              {matchData.teams.team2.logo && (
                <img src={matchData.teams.team2.logo} alt={`Logo ${matchData.teams.team2.name}`} className="w-20 h-20 object-contain rounded-full border-2" style={{ borderColor: matchData.teams.team2.color }} />
              )}
              <div className="text-2xl font-bold px-3 py-1 rounded-lg" style={{ backgroundColor: matchData.teams.team2.color, color: 'white' }}>{matchData.teams.team2.name}</div>
            </div>

            <div className="text-6xl font-bold text-blue-400">{matchData.score.team2}</div>
            {isAdmin && (
              <div className="flex justify-center gap-2 mt-2">
                <button onClick={() => removeGoalById('')} className="bg-blue-500 hover:bg-blue-600 text-white w-8 h-8 rounded-full">-</button>
                <button onClick={() => openScorerModal('team2')} className="bg-green-500 hover:bg-green-600 text-white w-8 h-8 rounded-full">+</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Admin controls */}
      {isAdmin && (
        <div className="bg-blue-600/90 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
          <h3 className="text-xl font-bold text-white text-center mb-4">Controles del Partido</h3>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <button onClick={startMatch} disabled={matchData.running} className="bg-green-500 hover:bg-green-600 disabled:bg-green-800 text-white font-bold py-3 rounded-lg transition-all">▶ Iniciar</button>
            <button onClick={pauseMatch} disabled={!matchData.running} className="bg-yellow-500 hover:bg-yellow-600 disabled:bg-yellow-800 text-white font-bold py-3 rounded-lg transition-all">⏸ Pausar</button>
          </div>

          <div className="grid grid-cols-4 gap-2 mb-4">
            {[1,2,3,4].map(q => (
              <button key={q} onClick={() => setQuarter(q)} className={`py-2 rounded-lg font-bold ${matchData.quarter === q ? 'bg-white text-blue-600' : 'bg-gray-700 text-white hover:bg-gray-600'}`}>Q{q}</button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <button onClick={resetQuarter} className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-3 rounded-lg transition-all">Reiniciar Cuarto</button>
            <button onClick={() => {
              const url = new URL(window.location.href);
              url.searchParams.delete('admin');
              navigator.clipboard.writeText(url.toString());
            }} className="bg-purple-500 hover:bg-purple-600 text-white font-bold py-3 rounded-lg transition-all">📋 Copiar Enlace</button>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-6">
            <button onClick={() => triggerEvent('goal')} className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-lg">🎉 GOL</button>
            <button onClick={() => triggerEvent('save')} className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-3 rounded-lg">🧤 ATAJADA</button>
          </div>
        </div>
      )}

      {/* Spectator sponsor / wake lock */}
      {!isAdmin && (
        <div className="text-center text-gray-400 mt-8">
          {matchData.sponsorLogo && matchData.sponsorLogo !== '' && (
            <div className="mt-6 p-4 bg-white/5 rounded-lg">
              <p className="text-sm text-gray-400 mb-2">Patrocinador:</p>
              <img src={matchData.sponsorLogo} alt="Sponsor" className="h-30 object-contain mx-auto opacity-80" />
            </div>
          )}
          <div className="mt-4 flex items-center justify-center gap-2">
            <div className={`w-3 h-3 rounded-full ${wakeLockActive ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`}></div>
            <span className="text-xs text-gray-500">{wakeLockActive ? 'Pantalla activa' : 'Pantalla normal'}</span>
          </div>
        </div>
      )}

      {/* Visible animations for spectator */}
      {!isAdmin && visibleEvent === 'goal' && (
        <>
          <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-50">
            <div className="text-7xl font-extrabold text-yellow-400 drop-shadow-xl animate-wiggle">🎉🏑 ¡¡¡GOOOOOL!!! 🏑🎉</div>
          </div>
          {Array.from({ length: 40 }).map((_, i) => {
            const left = Math.random() * 100;
            const delay = Math.random() * 0.6;
            const hue = Math.random() * 360;
            const size = 6 + Math.random() * 12;
            return <div key={`conf-${i}`} className="confetti-piece" style={{ left: `${left}vw`, background: `linear-gradient(45deg, hsl(${hue} 80% 55%), hsl(${(hue+60)%360} 80% 55%))`, width: `${size}px`, height: `${size*1.6}px`, animation: `confetti-fall ${1.4 + Math.random()*0.8}s linear ${delay}s forwards` }} />;
          })}
        </>
      )}

      {!isAdmin && visibleEvent === 'save' && (
        <>
          <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
            <div className="text-7xl font-extrabold text-yellow-400 drop-shadow-xl animate-wiggle">🧤🥅🏑 ¡QUE ATAJADAAAAAA!<br/>✨ ¡Aquí nooooo! ✨</div>
          </div>
        </>
      )}

      {/* SCORER MODAL (ADMIN) */}
      {showScorerModal && scorerTeam && (
        <div className="fixed inset-0 bg-black/60 z-60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg">
            <h3 className="text-xl font-bold mb-4">Seleccionar autora del gol - {scorerTeam === 'team1' ? matchData.teams.team1.name : matchData.teams.team2.name}</h3>

            <div className="max-h-72 overflow-y-auto space-y-2">
              {scorerCandidates.length === 0 && <p className="text-gray-500">No hay jugadoras seleccionadas para este partido.</p>}
              {scorerCandidates.map((p: any) => (
                <div key={p.id} className="p-2 border rounded flex items-center justify-between">
                  <div>
                    <div className="font-semibold">{p.name}</div>
                    <div className="text-sm text-gray-500">#{p.number} • {p.position}</div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => confirmScorer(p)} className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded">Marcar gol</button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => { setShowScorerModal(false); setScorerTeam(null); }} className="px-4 py-2 bg-gray-300 rounded">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* GOALS MODAL (Spectators) */}
      {!isAdmin && showGoalsModal && (
        <div className="fixed inset-0 z-70 flex items-center justify-center p-4">
          <div className="bg-white/95 rounded-2xl p-6 max-w-4xl w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-2xl font-bold">GOLES</h3>
              <button onClick={() => setShowGoalsModal(false)} className="text-sm text-gray-600">Cerrar</button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="font-semibold mb-2">{matchData.teams.team1.name}</h4>
                <ul className="list-disc pl-5 space-y-1 text-sm">
                  {(matchData.goals ?? []).filter(g => g.team === 'team1').map(g => (
                    <li key={g.id}>🏑 {g.playerName} 👕#{g.number} ({g.matchMinute}')</li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="font-semibold mb-2">{matchData.teams.team2.name}</h4>
                <ul className="list-disc pl-5 space-y-1 text-sm">
                  {(matchData.goals ?? []).filter(g => g.team === 'team2').map(g => (
                    <li key={g.id}>🏑 {g.playerName} 👕#{g.number} ({g.matchMinute}')</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      <TeamSetupModal isOpen={showSetupModal} onSave={handleTeamSetupSave} />
    </div>
  );
}
