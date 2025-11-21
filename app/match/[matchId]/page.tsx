'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { doc, onSnapshot, updateDoc, setDoc } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import TeamSetupModal from '@/app/components/TeamSetupModal';

// Tipos
interface Team {
  name: string;
  logo: string;
  color: string;
}

interface MatchData {
  // Estado del partido en la base de datos
  quarter: number;
  teams: { team1: Team; team2: Team };
  
  score: { team1: number; team2: number };
  running: boolean;
  status: 'active' | 'paused' | 'finished';
  quarterDuration: number;
  configured: boolean;
  sponsorLogo: string;

  // NUEVOS CAMPOS para un cronómetro sólido
  // remaining: segundos que quedan en el cuarto en el momento en que se PRESASIONÓ start o pause
  remaining?: number; // en segundos
  // startTime: timestamp (ms epoch) que indica cuando el admin empezó el conteo. Null si no está corriendo.
  startTime?: number | null; // ms
}

export default function MatchPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const matchId = params.matchId as string;
  const isAdmin = searchParams.get('admin') === 'true';

  const [matchData, setMatchData] = useState<MatchData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [wakeLockActive, setWakeLockActive] = useState(false);

  // Estado local para mostrar el tiempo calculado (no proviene directamente de Firestore)
  const [displayTime, setDisplayTime] = useState<number>(0);

  // Ref para almacenar el último snapshot recibido y evitar dependencias problemáticas
  const matchDataRef = useRef<MatchData | null>(null);

  // ---------- Función para finalizar segmento/quarter ----------
  const handleQuarterEnd = async (current: MatchData) => {
    // Parar el partido y poner time a 0
    await updateMatch({ running: false, status: 'paused', remaining: 0, startTime: null });

    if (current.quarter < 4) {
      const nextQuarter = current.quarter + 1;
      await updateMatch({
        quarter: nextQuarter,
        remaining: current.quarterDuration,
        running: false,
        startTime: null
      });

      if (isAdmin) {
        setTimeout(() => alert(`🏑 Cuarto ${current.quarter} finalizado! Avanzando al cuarto ${nextQuarter}`), 100);
      }
    } else {
      await updateMatch({ status: 'finished', running: false, startTime: null });
      if (isAdmin) setTimeout(() => alert('🏁 Partido finalizado!'), 100);
    }
  };

  // ---------- Wake Lock para espectadores ----------
  useEffect(() => {
    let wakeLock: any = null;
    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLock = await (navigator as any).wakeLock.request('screen');
          setWakeLockActive(true);
          console.log('Pantalla mantenida activa');
        }
      } catch (err) {
        console.log('Wake Lock no soportado:', err);
        setWakeLockActive(false);
      }
    };

    const handleVisibilityChange = () => {
      if (wakeLock !== null && document.visibilityState === 'visible') {
        requestWakeLock();
      }
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

  // ---------- Snapshot de Firestore (sin conflictos) ----------
  useEffect(() => {
    const matchRef = doc(db, 'matches', matchId);

    const unsubscribe = onSnapshot(matchRef, (docSnapshot) => {
      if (docSnapshot.exists()) {
        const data = docSnapshot.data() as any;

        // Mapeo para mantener compatibilidad con estructuras antiguas (si existía `time`)
        const remainingFromDoc =
          data.remaining !== undefined && data.remaining !== null
            ? data.remaining
            : data.time !== undefined
            ? data.time
            : undefined;

        const mapped: MatchData = {
          quarter: data.quarter ?? 1,
          teams: data.teams ?? { team1: { name: 'Equipo Local', logo: '', color: '#FF0000' }, team2: { name: 'Equipo Visitante', logo: '', color: '#0000FF' } },
          score: data.score ?? { team1: 0, team2: 0 },
          running: data.running ?? false,
          status: data.status ?? 'active',
          quarterDuration: data.quarterDuration ?? (remainingFromDoc ?? 600),
          configured: data.configured ?? false,
          sponsorLogo: data.sponsorLogo ?? '',
          remaining: remainingFromDoc ?? (data.quarterDuration ?? 600),
          startTime: data.startTime ?? null
        };

        matchDataRef.current = mapped;
        setMatchData(mapped);

        // Mostrar modal de setup si es admin y no está configurado
        if (isAdmin && !mapped.configured) setShowSetupModal(true);
      } else {
        // Si no existe el partido: crear uno si es admin
        if (isAdmin) {
          const newMatch: MatchData = {
            quarter: 1,
            teams: {
              team1: { name: 'Equipo Local', logo: '', color: '#FF0000' },
              team2: { name: 'Equipo Visitante', logo: '', color: '#0000FF' }
            },
            score: { team1: 0, team2: 0 },
            running: false,
            status: 'active',
            quarterDuration: 600,
            configured: false,
            sponsorLogo: '',
            remaining: 600,
            startTime: null
          };

          setDoc(matchRef, newMatch);
          setMatchData(newMatch);
          matchDataRef.current = newMatch;
          setShowSetupModal(true);
        }
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, [matchId, isAdmin]);

  // ---------- Efecto de tick: calcula displayTime exactamente ----------
  useEffect(() => {
    if (!matchData) return;

    let rafId: number | null = null;
    let intervalId: NodeJS.Timeout | null = null;

    const computeAndSet = () => {
      const md = matchDataRef.current;
      if (!md) return;

      // Si no hay campo remaining usar quarterDuration como fallback
      const remainingBase = md.remaining ?? md.quarterDuration ?? 600;

      if (!md.running || !md.startTime) {
        // No está corriendo: mostrar remaining como está
        setDisplayTime(Math.max(0, remainingBase));
        return;
      }

      const now = Date.now();
      const elapsed = Math.floor((now - md.startTime) / 1000);
      const newTime = Math.max(0, remainingBase - elapsed);

      setDisplayTime(newTime);

      if (newTime === 0) {
        // Evitar llamadas repetidas a handleQuarterEnd: ejecutar sólo una vez
        handleQuarterEnd(md);
      }
    };

    // Ejecutar inmediatamente
    computeAndSet();

    // Usamos setInterval con 250ms para suavidad.
    intervalId = setInterval(computeAndSet, 250);

    return () => {
      if (intervalId) clearInterval(intervalId as NodeJS.Timeout);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [matchData?.running, matchData?.startTime, matchData?.remaining]);

  // ---------- Helpers para actualizar Firestore (solo admin) ----------
  const updateMatch = async (updates: Partial<MatchData>) => {
    if (!isAdmin) return;
    const matchRef = doc(db, 'matches', matchId);
    try {
      await updateDoc(matchRef, updates as any);
    } catch (err) {
      console.error('Error actualizando match:', err);
    }
  };

  // ---------- Controles ADMIN: iniciar / pausar / reiniciar ----------
  const startMatch = () => {
    if (!matchData) return;

    // Si ya está corriendo no hacemos nada
    if (matchData.running) return;

    // Guardamos startTime y mantenemos remaining tal cual
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

  // ---------- Goles (actualiza score) ----------
  const addGoal = (team: 'team1' | 'team2') => {
    if (!matchData) return;
    const newScore = matchData.score[team] + 1;

    setMatchData(prev => prev ? { ...prev, score: { ...prev.score, [team]: newScore } } : prev);
    updateMatch({ score: { ...matchData.score, [team]: newScore } });
  };

  const removeGoal = (team: 'team1' | 'team2') => {
    if (!matchData || matchData.score[team] <= 0) return;
    const newScore = Math.max(0, matchData.score[team] - 1);

    setMatchData(prev => prev ? { ...prev, score: { ...prev.score, [team]: newScore } } : prev);
    updateMatch({ score: { ...matchData.score, [team]: newScore } });
  };

  const copySpectatorLink = () => {
    const currentUrl = window.location.href;
    const url = new URL(currentUrl);
    url.searchParams.delete('admin');
    navigator.clipboard.writeText(url.toString());
  };

  const handleTeamSetupSave = async (teams: { team1: any; team2: any }) => {
    await updateMatch({
      teams: {
        team1: { name: teams.team1.name, logo: teams.team1.logo, color: teams.team1.color },
        team2: { name: teams.team2.name, logo: teams.team2.logo, color: teams.team2.color }
      },
      sponsorLogo: teams.team1.sponsorLogo || '',
      configured: true
    });

    setShowSetupModal(false);
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

  // ---------- Renderizado ----------
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
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-white mb-2">🏑 Partido en Vivo</h1>
        <p className="text-gray-300">Código: <span className="font-mono bg-black/30 px-2 py-1 rounded">{matchId}</span></p>
        {isAdmin ? <p className="text-green-400 font-semibold mt-2">🔧 Modo Administrador</p> : <p className="text-blue-400 font-semibold mt-2">👀 Modo Espectador</p>}
      </div>

      {/* Marcador Principal */}
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 mb-6 border border-white/20">
        <div className="grid grid-cols-3 items-center text-center">
          {/* Equipo 1 */}
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
                <button onClick={() => removeGoal('team1')} className="bg-blue-500 hover:bg-blue-600 text-white w-8 h-8 rounded-full">-</button>
                <button onClick={() => addGoal('team1')} className="bg-green-500 hover:bg-green-600 text-white w-8 h-8 rounded-full">+</button>
              </div>
            )}
          </div>

          {/* Tiempo y Cuarto */}
          <div className="text-center">
            <div className={`font-mono font-bold text-white mb-2 ${!isAdmin ? 'text-6xl' : 'text-4xl'}`}>{formatTime(displayTime)}</div>
            <div className={`${!isAdmin ? 'text-2xl' : 'text-xl'} text-gray-300`}>Cuarto {matchData.quarter}</div>
            {matchData.running && <div className="text-blue-400 text-sm">▶ EN VIVO</div>}
            {matchData.status === 'paused' && <div className="text-yellow-400 text-sm">⏸ PAUSADO</div>}

            {/* Configuración de tiempo (solo admin) */}
            {isAdmin && (
              <div className="mt-2 flex justify-center gap-2">
                <button onClick={() => setQuarterDuration(10)} className={`text-xs px-2 py-1 rounded ${matchData.quarterDuration === 600 ? 'bg-white text-black' : 'bg-gray-600 text-white'}`}>10min</button>
                <button onClick={() => setQuarterDuration(15)} className={`text-xs px-2 py-1 rounded ${matchData.quarterDuration === 900 ? 'bg-white text-black' : 'bg-gray-600 text-white'}`}>15min</button>
                <button onClick={() => setQuarterDuration(20)} className={`text-xs px-2 py-1 rounded ${matchData.quarterDuration === 1200 ? 'bg-white text-black' : 'bg-gray-600 text-white'}`}>20min</button>
              </div>
            )}
          </div>

          {/* Equipo 2 */}
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
                <button onClick={() => removeGoal('team2')} className="bg-blue-500 hover:bg-blue-600 text-white w-8 h-8 rounded-full">-</button>
                <button onClick={() => addGoal('team2')} className="bg-green-500 hover:bg-green-600 text-white w-8 h-8 rounded-full">+</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Controles (solo para admin) */}
      {isAdmin && (
        <div className="bg-blue-600/90 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
          <h3 className="text-xl font-bold text-white text-center mb-4">Controles del Partido</h3>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <button onClick={startMatch} disabled={matchData.running} className="bg-green-500 hover:bg-green-600 disabled:bg-green-800 text-white font-bold py-3 rounded-lg transition-all">▶ Iniciar</button>
            <button onClick={pauseMatch} disabled={!matchData.running} className="bg-yellow-500 hover:bg-yellow-600 disabled:bg-yellow-800 text-white font-bold py-3 rounded-lg transition-all">⏸ Pausar</button>
          </div>

          <div className="grid grid-cols-4 gap-2 mb-4">
            {[1, 2, 3, 4].map((q) => (
              <button key={q} onClick={() => setQuarter(q)} className={`py-2 rounded-lg font-bold ${matchData.quarter === q ? 'bg-white text-blue-600' : 'bg-gray-700 text-white hover:bg-gray-600'}`}>Q{q}</button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <button onClick={resetQuarter} className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-3 rounded-lg transition-all">Reiniciar Cuarto</button>
            <button onClick={copySpectatorLink} className="bg-purple-500 hover:bg-purple-600 text-white font-bold py-3 rounded-lg transition-all">📋 Copiar Enlace</button>
          </div>
        </div>
      )}

      {/* Mensaje para espectadores */}
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

      <TeamSetupModal isOpen={showSetupModal} onSave={handleTeamSetupSave} />
    </div>
  );
}
