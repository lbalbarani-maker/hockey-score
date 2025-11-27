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

type Team = {
  name: string;
  logo?: string;
  color?: string;
  players?: any[]; // player objects from TeamSetupModal
};

type MatchEvent = { type: 'goal' | 'save'; timestamp: number };

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
  const adminParam = searchParams.get('admin') ?? null;

  const [matchData, setMatchData] = useState<MatchData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [displayTime, setDisplayTime] = useState<number>(0);
  const [isAdmin, setIsAdmin] = useState(false);
  const [visibleEvent, setVisibleEvent] = useState< 'goal' | 'save' | null >(null);

  // EventModal state (admin flow)
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [eventTeam, setEventTeam] = useState<'team1' | 'team2' | null>(null);

  const matchRef = useRef<any>(null);
  const matchDataRef = useRef<MatchData | null>(null);
  const prevGoalsCountRef = useRef<number>(0);

  // helper: SHA-256 used to compare adminParam with hash in DB
  const hashSha256 = async (text: string) => {
    const enc = new TextEncoder();
    const data = enc.encode(text);
    const buf = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
  };

  // ---------- Firestore snapshot ----------
  useEffect(() => {
    if (!matchId) return;
    const ref = doc(db, 'matches', matchId);
    matchRef.current = ref;

    const unsubscribe = onSnapshot(ref, (snap) => {
      if (!snap.exists()) {
        // if adminParam present, create initial doc
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
    }, (err) => {
      console.error('Firestore onSnapshot error', err);
      setLoading(false);
    });

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
        const hashed = await hashSha256(adminParam);
        setIsAdmin(hashed === matchData.adminPinHash);
      } catch (err) {
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
    setVisibleEvent(matchData.event.type);
    const t = setTimeout(() => setVisibleEvent(null), 3000);
    return () => clearTimeout(t);
  }, [matchData?.event?.timestamp]);

  // ---------- handle new goals to keep prevGoalsCountRef ----------
  useEffect(() => {
    prevGoalsCountRef.current = (matchData?.goals ?? []).length;
  }, [matchData?.goals]);

  // ---------- helpers to update Firestore (must be admin) ----------
  const updateMatch = async (updates: Partial<MatchData>) => {
    if (!matchRef.current) return;
    // only allow if admin verified
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
  // open event modal on + so admin can choose player (or free-text)
  const handlePlus = (team: 'team1' | 'team2') => {
    if (!isAdmin) return;
    setEventTeam(team);
    setEventModalOpen(true);
  };

  // handle negative: remove last goal by team (admin)
  const handleMinus = async (team: 'team1' | 'team2') => {
    if (!isAdmin || !matchData) return;
    const currentGoals = matchData.goals ?? [];
    // find last goal for team
    const idx = [...currentGoals].reverse().findIndex(g => g.team === team);
    if (idx === -1) {
      // nothing to remove, but still decrement score? user wanted rectify: if no goal, do nothing
      return;
    }
    // index from start:
    const targetIndex = currentGoals.length - 1 - idx;
    const newGoals = currentGoals.filter((_, i) => i !== targetIndex);
    // recalc score
    const newScore = { team1: 0, team2: 0 };
    newGoals.forEach(g => newScore[g.team]++);
    try {
      await updateDoc(matchRef.current, { goals: newGoals, score: newScore } as any);
    } catch (err) {
      console.error('remove last goal error', err);
    }
  };

  // called from EventModal when admin confirms scorer (player object or free text)
  const confirmScorer = async (payload: { team: 'team1' | 'team2'; player?: any | null; freeText?: { name: string; number?: string } }) => {
    if (!isAdmin || !matchData) return;

    const { team, player, freeText } = payload;

    // compute elapsedInQuarter and matchMinute
    const qDuration = matchData.quarterDuration ?? 600;
    const remainingInQuarter = displayTime;
    const elapsedInQuarter = Math.max(0, Math.floor(qDuration - remainingInQuarter)); // seconds since quarter started
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

    // append goal and update score + event
    const currentGoals = matchData.goals ?? [];
    const newGoals = [...currentGoals, goal];
    const newScore = { ...matchData.score };
    newScore[team] = (newScore[team] ?? 0) + 1;

    try {
      await updateDoc(matchRef.current, {
        goals: newGoals,
        score: newScore,
        event: { type: 'goal', timestamp: now }
      } as any);
    } catch (err) {
      console.error('confirmScorer update error', err);
    } finally {
      setEventModalOpen(false);
      setEventTeam(null);
    }
  };

  // ---------- small util ----------
  const formatTime = (s: number) => {
    const m = Math.floor(s/60);
    const sec = s%60;
    return `${m}:${sec.toString().padStart(2,'0')}`;
  };

  // ---------- TeamSetup save handler (from TeamSetupModal) ----------
  // TeamSetupModal must call onSave({ team1, team2, adminPin, adminPinHash })
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
      // if update fails, try setDoc as fallback
      try {
        await setDoc(matchRef.current, updates as any, { merge: true });
      } catch (err2) {
        console.error('Error guardando setup', err2);
      }
    }

    setShowSetupModal(false);

    // redirect to admin=PIN to make user admin immediately (only client side)
    if (data.adminPin) {
      router.push(`/match/${matchId}?admin=${encodeURIComponent(data.adminPin)}`);
    } else {
      router.push(`/match/${matchId}`);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-gradient-to-br from-gray-900 to-blue-900 flex items-center justify-center"><div className="text-white text-xl">Cargando partido...</div></div>;
  }

  if (!matchData) {
    return <div className="min-h-screen bg-gradient-to-br from-gray-900 to-blue-900 flex items-center justify-center"><div className="text-white text-xl text-center">Partido no encontrado<br/><span className="text-sm text-gray-400 mt-2">Código: {matchId}</span></div></div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-blue-900 p-6">
      <div className="text-center mb-6">
        <h1 className="text-4xl font-bold text-white mb-2">🏑 Partido en Vivo</h1>
        <p className="text-gray-300">Código: <span className="font-mono bg-black/30 px-2 py-1 rounded">{matchId}</span></p>
        {isAdmin ? <p className="text-green-400 font-semibold mt-2">🔧 Modo Administrador</p> : <p className="text-blue-400 font-semibold mt-2">👀 Modo Espectador</p>}
      </div>

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

      {/* If admin open TeamSetupModal */}
      <TeamSetupModal isOpen={showSetupModal} onSave={handleTeamSetupSave} />

      {/* Event modal: admin selects scorer or free-text */}
      <EventModal
        isOpen={eventModalOpen}
        team={eventTeam}
        players={(eventTeam && matchData.teams[eventTeam].players) ?? []}
        onCancel={() => { setEventModalOpen(false); setEventTeam(null); }}
        onConfirm={(payload) => confirmScorer(payload)}
        dark // use dark background to match main
      />

      {/* Goal history (always visible for spectator; admin also can view) */}
      <div className="mt-6">
        <GoalHistory
          goals={matchData.goals ?? []}
          team1Name={matchData.teams.team1.name}
          team2Name={matchData.teams.team2.name}
          isAdmin={isAdmin}
          removeGoal={(id) => { if (isAdmin) removeGoalById(id); }}
        />
      </div>

      {/* Animations for spectator */}
      {!isAdmin && visibleEvent === 'goal' && (
        <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-50">
          <div className="text-7xl font-extrabold text-yellow-400 drop-shadow-xl animate-bounce">🎉🏑 ¡¡¡GOOOOOL!!! 🏑🎉</div>
        </div>
      )}
      {!isAdmin && visibleEvent === 'save' && (
        <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-50">
          <div className="text-6xl font-extrabold text-blue-300 drop-shadow-xl animate-pulse">🧤 ¡Atajada! Aquí nooooo!</div>
        </div>
      )}
    </div>
  );

  // helper remove single goal by id (for admin) - used by GoalHistory remove button
  async function removeGoalById(goalId: string) {
    if (!isAdmin || !matchData) return;
    const currentGoals = matchData.goals ?? [];
    const newGoals = currentGoals.filter(g => g.id !== goalId);
    const scores = { team1: 0, team2: 0 };
    newGoals.forEach(g => scores[g.team]++);
    try {
      await updateDoc(matchRef.current, { goals: newGoals, score: scores } as any);
    } catch (err) {
      console.error('removeGoalById error', err);
    }
  }
}
