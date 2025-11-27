//src/app/match/[matchId]/page.tsx — Componente principal (orquesta cronómetro, snapshot, verificación admin, abre modales y orquesta acciones).

// src/app/match/[matchId]/page.tsx
'use client';

import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { doc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import TeamSetupModal from '@/app/components/TeamSetupModal';
import Scoreboard from './components/Scoreboard';
import EventModal from './components/EventModal';
import GoalHistory from './components/GoalHistory';

type Team = { name: string; logo?: string; color?: string; players?: any[] };

type MatchEvent = {
  type: 'goal' | 'save';
  timestamp: number;
  team?: 'team1' | 'team2';
};

type GoalRecord = {
  id: string;
  team: 'team1' | 'team2';
  playerId?: string | null;
  playerName: string;
  number?: string | null;
  quarter: number;
  elapsedInQuarter: number;
  matchMinute: number;
  timestamp: number;
  freeText?: boolean;
};

type MatchData = {
  quarter: number;
  teams: { team1: Team; team2: Team };
  score: { team1: number; team2: number };
  running: boolean;
  status: 'active' | 'paused' | 'finished';
  quarterDuration: number;
  configured: boolean;
  sponsorLogo?: string;
  remaining?: number;
  startTime?: number | null;
  event?: MatchEvent | null;
  adminPinHash?: string | null;
  goals?: GoalRecord[];
};

export default function MatchPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const matchId = params.matchId as string;
  // Mantienes el PIN en la URL por ahora (como pediste)
  const adminParam = searchParams.get('admin') ?? null;

  const [matchData, setMatchData] = useState<MatchData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [displayTime, setDisplayTime] = useState<number>(0);
  const [isAdmin, setIsAdmin] = useState(false);
  const [visibleEvent, setVisibleEvent] = useState<MatchEvent | null>(null);

  // EventModal state (admin flow)
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [eventTeam, setEventTeam] = useState<'team1' | 'team2' | null>(null);

  const matchRef = useRef<any>(null);
  const matchDataRef = useRef<MatchData | null>(null);

  // ---------- Firestore snapshot ----------
  useEffect(() => {
    if (!matchId) return;
    const ref = doc(db, 'matches', matchId);
    matchRef.current = ref;

    const unsubscribe = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          // Si param admin existe y doc no existe, creamos uno inicial (como antes)
          if (adminParam) {
            const initial: MatchData = {
              quarter: 1,
              teams: {
                team1: { name: 'Equipo Local', color: '#FF0000', players: [] },
                team2: { name: 'Equipo Visitante', color: '#0000FF', players: [] }
              },
              score: { team1: 0, team2: 0 },
              running: false,
              status: 'active',
              quarterDuration: 600,
              configured: false,
              remaining: 600,
              startTime: null,
              event: null,
              adminPinHash: null,
              goals: []
            };
            setDoc(ref, initial).catch(console.error);
            setMatchData(initial);
            matchDataRef.current = initial;
            setShowSetupModal(true);
            setLoading(false);
            return;
          } else {
            setMatchData(null);
            setLoading(false);
            return;
          }
        }

        const data = snap.data() as any;
        const remainingFromDoc = data.remaining ?? data.time ?? undefined;

        const mapped: MatchData = {
          quarter: data.quarter ?? 1,
          teams: data.teams ?? { team1: { name: 'Equipo Local', players: [] }, team2: { name: 'Equipo Visitante', players: [] } },
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
        setLoading(false);
      },
      (err) => {
        console.error('Firestore onSnapshot error', err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [matchId, adminParam]);

  // ---------- verify adminParam (compare hash) ----------
  useEffect(() => {
    const verify = async () => {
      if (!matchData) {
        setIsAdmin(false);
        return;
      }
      if (!adminParam) {
        setIsAdmin(false);
        return;
      }
      if (!matchData.adminPinHash) {
        setIsAdmin(false);
        return;
      }
      try {
        const enc = new TextEncoder();
        const buf = await crypto.subtle.digest('SHA-256', enc.encode(adminParam));
        const hash = Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
        setIsAdmin(hash === matchData.adminPinHash);
      } catch {
        setIsAdmin(false);
      }
    };
    verify();
  }, [matchData?.adminPinHash, adminParam, matchData]);

  // ---------- timer tick ----------
  useEffect(() => {
    if (!matchData) return;
    let interval: any = null;

    const tick = () => {
      const md = matchDataRef.current;
      if (!md) return;
      const baseRemaining = md.remaining ?? md.quarterDuration ?? 600;
      if (!md.running || !md.startTime) {
        setDisplayTime(Math.max(0, baseRemaining));
        return;
      }
      const elapsed = Math.floor((Date.now() - md.startTime) / 1000);
      const newTime = Math.max(0, baseRemaining - elapsed);
      setDisplayTime(newTime);
    };

    tick();
    interval = setInterval(tick, 250);
    return () => clearInterval(interval);
  }, [matchData?.running, matchData?.startTime, matchData?.remaining]);

  // ---------- visible event for spectator animation ----------
  useEffect(() => {
    if (!matchData?.event) return;
    // ahora event puede traer team
    setVisibleEvent(matchData.event);
    const t = setTimeout(() => setVisibleEvent(null), 3000);
    return () => clearTimeout(t);
  }, [matchData?.event?.timestamp]);

  // ---------- Helpers para actualizar Firestore (solo admin) ----------
  const updateMatch = async (updates: Partial<MatchData>) => {
    if (!matchRef.current) return;
    if (!isAdmin) {
      console.warn('Try to write but not admin');
      return;
    }
    try {
      await updateDoc(matchRef.current, updates as any);
    } catch (err) {
      console.error('updateMatch error', err);
    }
  };

  // ---------- quarter control ----------
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

  const setQuarter = (q: number) => {
    if (!matchData) return;
    updateMatch({ quarter: q, remaining: matchData.quarterDuration, running: false, startTime: null });
  };

  const setQuarterDuration = (minutes: number) => {
    const seconds = minutes * 60;
    updateMatch({ quarterDuration: seconds, remaining: seconds, startTime: null, running: false });
  };

  // ---------- score + / - handlers ----------
  const handlePlus = (team: 'team1' | 'team2') => {
    if (!isAdmin) return;
    setEventTeam(team);
    setEventModalOpen(true);
  };

  const handleMinus = async (team: 'team1' | 'team2') => {
    if (!isAdmin || !matchData) return;
    const currentGoals = matchData.goals ?? [];
    const idx = [...currentGoals].reverse().findIndex((g) => g.team === team);
    if (idx === -1) return;
    const targetIndex = currentGoals.length - 1 - idx;
    const newGoals = currentGoals.filter((_, i) => i !== targetIndex);
    const newScore = { team1: 0, team2: 0 };
    newGoals.forEach((g) => newScore[g.team]++);
    try {
      await updateDoc(matchRef.current, { goals: newGoals, score: newScore } as any);
    } catch (err) {
      console.error('remove last goal error', err);
    }
  };

  // ---------- confirmar goleador (desde EventModal) ----------
  const confirmScorer = async (payload: { team: 'team1' | 'team2'; player?: any | null; freeText?: { name: string; number?: string } }) => {
    if (!isAdmin || !matchData) return;
    const { team, player, freeText } = payload;

    const qDuration = matchData.quarterDuration ?? 600;
    const remainingInQuarter = displayTime;
    const elapsedInQuarter = Math.max(0, Math.floor(qDuration - remainingInQuarter));
    const secondsBefore = (matchData.quarter - 1) * qDuration;
    const matchMinuteTotalSeconds = secondsBefore + elapsedInQuarter;
    const matchMinute = Math.floor(matchMinuteTotalSeconds / 60);

    const now = Date.now();
    const goal: GoalRecord = {
      id: now.toString(),
      team,
      playerId: player?.id ?? null,
      playerName: player?.name ?? (freeText ? freeText.name : 'Anónimo'),
      number: player?.number ?? freeText?.number ?? null,
      quarter: matchData.quarter,
      elapsedInQuarter,
      matchMinute,
      timestamp: now,
      freeText: !!freeText
    };

    const currentGoals = matchData.goals ?? [];
    const newGoals = [...currentGoals, goal];
    const newScore = { ...matchData.score };
    newScore[team] = (newScore[team] ?? 0) + 1;

    try {
      await updateDoc(matchRef.current, {
        goals: newGoals,
        score: newScore,
        event: { type: 'goal', team, timestamp: now }
      } as any);
    } catch (err) {
      console.error('confirmScorer update error', err);
    } finally {
      setEventModalOpen(false);
      setEventTeam(null);
    }
  };

  // ---------- trigger save (atajada) - admin button in header ----------
  const triggerSave = async () => {
    if (!isAdmin || !matchRef.current) return;
    const now = Date.now();
    try {
      await updateDoc(matchRef.current, { event: { type: 'save', timestamp: now } } as any);
    } catch (err) {
      console.error('triggerSave error', err);
    }
  };

  // ---------- TeamSetup save handler ----------
  const handleTeamSetupSave = async (data: any) => {
    if (!matchRef.current) return;
    const updates: any = {
      teams: {
        team1: { name: data.team1.name, logo: data.team1.logo, color: data.team1.color, players: data.team1.players ?? [] },
        team2: { name: data.team2.name, logo: data.team2.logo, color: data.team2.color, players: data.team2.players ?? [] }
      },
      sponsorLogo: data.team1.sponsorLogo || '',
      configured: true
    };
    if (data.adminPinHash) updates.adminPinHash = data.adminPinHash;
    try {
      await updateDoc(matchRef.current, updates as any);
    } catch (err) {
      try {
        await setDoc(matchRef.current, updates as any, { merge: true });
      } catch (err2) {
        console.error('Error guardando setup', err2);
      }
    }

    setShowSetupModal(false);

    // mantienes PIN en URL por ahora
    if (data.adminPin) {
      router.push(`/match/${matchId}?admin=${encodeURIComponent(data.adminPin)}`);
    } else {
      router.push(`/match/${matchId}`);
    }
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  // helper remove single goal by id (for admin) - used by GoalHistory remove button
  async function removeGoalById(goalId: string) {
    if (!isAdmin || !matchData) return;
    const currentGoals = matchData.goals ?? [];
    const newGoals = currentGoals.filter((g) => g.id !== goalId);
    const scores = { team1: 0, team2: 0 };
    newGoals.forEach((g) => scores[g.team]++);
    try {
      await updateDoc(matchRef.current, { goals: newGoals, score: scores } as any);
    } catch (err) {
      console.error('removeGoalById error', err);
    }
  }

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
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-blue-900 p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-4xl font-bold text-white mb-2">🏑 Partido en Vivo</h1>
          <p className="text-gray-300">Código: <span className="font-mono bg-black/30 px-2 py-1 rounded">{matchId}</span></p>
          {isAdmin ? <p className="text-green-400 font-semibold mt-2">🔧 Modo Administrador</p> : <p className="text-blue-400 font-semibold mt-2">👀 Modo Espectador</p>}
        </div>

        {/* ATAJADA BUTTON (top-right in header) — solo admin */}
        {isAdmin && (
          <div className="ml-4">
            <button
              onClick={triggerSave}
              title="Atajada (mostrar en espectadores)"
              className="w-14 h-14 rounded-full bg-white/6 border border-white/20 flex items-center justify-center hover:scale-105 transition-transform"
            >
              <span role="img" aria-label="atajada" className="text-2xl">🧤</span>
            </button>
          </div>
        )}
      </div>

      {/* Scoreboard */}
      <Scoreboard
        matchData={matchData}
        displayTime={displayTime}
        isAdmin={isAdmin}
        onStart={startMatch}
        onPause={pauseMatch}
        onResetQuarter={resetQuarter}
        onSetQuarter={setQuarter}
        onSetQuarterDuration={setQuarterDuration}
        onPlus={handlePlus}
        onMinus={handleMinus}
      />

      <TeamSetupModal isOpen={showSetupModal} onSave={handleTeamSetupSave} />

      <EventModal
        isOpen={eventModalOpen}
        team={eventTeam}
        players={(eventTeam && matchData.teams[eventTeam].players) ?? []}
        onCancel={() => { setEventModalOpen(false); setEventTeam(null); }}
        onConfirm={(payload) => confirmScorer(payload)}
        dark
      />

      <div className="mt-6">
        <GoalHistory
          goals={matchData.goals ?? []}
          team1Name={matchData.teams.team1.name}
          team2Name={matchData.teams.team2.name}
          isAdmin={isAdmin}
          removeGoal={(id) => { if (isAdmin) removeGoalById(id); }}
        />
      </div>

      {/* ANIMACIONES PARA ESPECTADOR */}
      {/* Gol team1: celebracion (confetti) */}
      {!isAdmin && visibleEvent?.type === 'goal' && visibleEvent?.team === 'team1' && (
        <>
          <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-50">
            <div className="text-7xl font-extrabold text-yellow-400 drop-shadow-xl animate-wiggle">🎉🏑 ¡¡¡GOOOOOL!!! 🏑🎉</div>
          </div>
          {/* confetti pieces */}
          {Array.from({ length: 40 }).map((_, i) => {
            const left = Math.random() * 100;
            const delay = Math.random() * 0.6;
            const hue = Math.random() * 360;
            const size = 6 + Math.random() * 12;
            return (
              <div
                key={`conf-${i}`}
                className="confetti-piece"
                style={{
                  left: `${left}vw`,
                  background: `linear-gradient(45deg, hsl(${hue} 80% 55%), hsl(${(hue + 60) % 360} 80% 55%))`,
                  width: `${size}px`,
                  height: `${size * 1.6}px`,
                  animation: `confetti-fall ${1.4 + Math.random() * 0.8}s linear ${delay}s forwards`
                }}
              />
            );
          })}
        </>
      )}

      {/* Gol team2: animacion triste (opcion A elegida) */}
      {!isAdmin && visibleEvent?.type === 'goal' && visibleEvent?.team === 'team2' && (
        <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-50">
          <div className="text-6xl font-extrabold text-white drop-shadow-xl text-center">
            <div className="text-5xl">😭⚽ ¡Gol del rival! 😭</div>
            <div className="text-xl text-gray-300 mt-2">No se festeja... ánimo chicas!!!</div>
          </div>
          {/* lluvia de gotas azules */}
          {Array.from({ length: 40 }).map((_, i) => {
            const left = Math.random() * 100;
            const delay = Math.random() * 0.6;
            const size = 6 + Math.random() * 8;
            return (
              <div
                key={`drop-${i}`}
                style={{
                  position: 'fixed',
                  left: `${left}vw`,
                  top: '-10px',
                  width: `${size}px`,
                  height: `${size * 2}px`,
                  background: 'linear-gradient(180deg,#7ec8ff,#2b93d6)',
                  borderRadius: '50%',
                  opacity: 0.9,
                  zIndex: 60,
                  pointerEvents: 'none',
                  animation: `confetti-fall ${1.2 + Math.random() * 0.8}s linear ${delay}s forwards`,
                }}
              />
            );
          })}
        </div>
      )}

      {/* ATAJADA (save) visual para espectadores */}
{!isAdmin && visibleEvent?.type === 'save' && (
  <>
    <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-50">
      <div className="text-6xl font-extrabold text-blue-300 drop-shadow-xl animate-wiggle text-center">
        🧤 ¡QUE ATAJADA!<br />🧱✨ ¡Aquí nooooo! ✨🧱
      </div>
    </div>

    {/* confetti pieces */}
    {Array.from({ length: 40 }).map((_, i) => {
      const left = Math.random() * 100;
      const delay = Math.random() * 0.6;
      const hue = Math.random() * 360;
      const size = 6 + Math.random() * 12;
      return (
        <div
          key={`save-conf-${i}`}
          className="confetti-piece"
          style={{
            left: `${left}vw`,
            background: `linear-gradient(45deg, hsl(${hue} 80% 55%), hsl(${(hue + 60) % 360} 80% 55%))`,
            width: `${size}px`,
            height: `${size * 1.6}px`,
            animation: `confetti-fall ${1.4 + Math.random() * 0.8}s linear ${delay}s forwards`
          }}
        />
      );
    })}
  </>
)}


      {/* Global animation styles (confetti etc) */}
      <style jsx global>{`
        .confetti-piece {
          position: fixed;
          top: -10px;
          width: 10px;
          height: 14px;
          opacity: 0.95;
          z-index: 9999;
          pointer-events: none;
          transform-origin: center;
        }
        @keyframes confetti-fall {
          0% { transform: translateY(-10vh) rotate(0deg); opacity: 1; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0.9; }
        }
        @keyframes wiggle {
          0% { transform: translateX(0) rotate(0deg); }
          25% { transform: translateX(-8px) rotate(-6deg); }
          50% { transform: translateX(8px) rotate(6deg); }
          75% { transform: translateX(-4px) rotate(-3deg); }
          100% { transform: translateX(0) rotate(0deg); }
        }
        .animate-wiggle { animation: wiggle 0.9s ease-in-out both; }
      `}</style>
    </div>
  );
}
