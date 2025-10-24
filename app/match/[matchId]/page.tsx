// src/app/match/[matchId]/page.tsx
'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { doc, onSnapshot, updateDoc, setDoc } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import TeamSetupModal from '@/app/components/TeamSetupModal';

// Tipo para los datos del partido
interface Team {
  name: string;
  logo: string; // Base64 o URL
  color: string; // Código hex
}

interface MatchData {
  time: number;
  quarter: number;
  teams: {
    team1: Team;
    team2: Team;
  };
  score: {
    team1: number;
    team2: number;
  };
  running: boolean;
  status: 'active' | 'paused' | 'finished';
  quarterDuration: number;
  configured: boolean; 
  sponsorLogo: string; // ✅ NUEVO: Logo del sponsor
}

export default function MatchPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const matchId = params.matchId as string;
  const isAdmin = searchParams.get('admin') === 'true'; // ✅ Solo admin si tiene el parámetro

  const [matchData, setMatchData] = useState<MatchData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSetupModal, setShowSetupModal] = useState(false);

  // Efecto para el cronómetro en tiempo real
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (matchData?.running && isAdmin) { // ✅ Solo el admin controla el cronómetro
      interval = setInterval(() => {
        setMatchData(prev => {
          if (!prev || prev.time <= 0) {
            clearInterval(interval);
            return prev;
          }
          return { ...prev, time: prev.time - 1 };
        });
        
        // Actualizar en Firebase cada segundo
        if (matchData.time > 0) {
          updateMatch({ time: matchData.time - 1 });
        }
      }, 1000);
    }

    return () => clearInterval(interval);
  }, [matchData?.running, matchData?.time, isAdmin]);

  // Escuchar cambios en tiempo real de Firebase
useEffect(() => {
  const matchRef = doc(db, 'matches', matchId);
  
  const unsubscribe = onSnapshot(matchRef, (docSnapshot) => {
    if (docSnapshot.exists()) {
      const data = docSnapshot.data() as MatchData;
      const matchWithDuration = {
        ...data,
        quarterDuration: data.quarterDuration || 600
      };
      setMatchData(matchWithDuration);
      
      // ✅ NUEVO: Mostrar modal si es admin y el partido no está configurado
      if (isAdmin && (!data.configured || data.configured === false)) {
        setShowSetupModal(true);
      }
    } else {
      // Si el partido no existe, crear uno nuevo SOLO si es admin
      if (isAdmin) {
        const newMatch: MatchData = {
          time: 600,
          quarter: 1,
          teams: { 
            team1: { name: "Equipo Local", logo: "", color: "#FF0000" }, // ✅ CAMBIADO
            team2: { name: "Equipo Visitante", logo: "", color: "#0000FF" } // ✅ CAMBIADO
          },
          score: { team1: 0, team2: 0 },
          running: false,
          status: 'active',
          quarterDuration: 600,
          configured: false, // ✅ NUEVO: No configurado inicialmente
          sponsorLogo: "" // ✅ AÑADE ESTA LÍNEA
        };
        setDoc(matchRef, newMatch);
        setMatchData(newMatch);
        setShowSetupModal(true); // ✅ NUEVO: Mostrar modal inmediatamente
      }
    }
    setLoading(false);
  });

  return () => unsubscribe();
}, [matchId, isAdmin]);

  // Función para actualizar datos en Firebase
  const updateMatch = async (updates: Partial<MatchData>) => {
    if (!isAdmin) return; // ✅ Solo admin puede actualizar
    const matchRef = doc(db, 'matches', matchId);
    await updateDoc(matchRef, updates);
  };

  // Controles del partido (solo para admin)
  const startMatch = () => updateMatch({ running: true, status: 'active' });
  const pauseMatch = () => updateMatch({ running: false, status: 'paused' });
  const setQuarter = (quarter: number) => {
    if (!matchData) return;
    updateMatch({ 
      quarter, 
      time: matchData.quarterDuration,
      running: false 
    });
  };
  
  const addGoal = (team: 'team1' | 'team2') => {
    if (!matchData) return;
    const newScore = matchData.score[team] + 1;
    updateMatch({ 
      score: { ...matchData.score, [team]: newScore } 
    });
  };
  
  const removeGoal = (team: 'team1' | 'team2') => {
    if (!matchData || matchData.score[team] <= 0) return;
    const newScore = Math.max(0, matchData.score[team] - 1);
    updateMatch({ 
      score: { ...matchData.score, [team]: newScore } 
    });
  };
  
  const resetQuarter = () => {
    if (!matchData) return;
    updateMatch({ 
      time: matchData.quarterDuration, 
      running: false 
    });
  };

// Función para guardar la configuración de equipos
const handleTeamSetupSave = async (teams: { team1: any; team2: any }) => {
  await updateMatch({
    teams: {
      team1: { name: teams.team1.name, logo: teams.team1.logo, color: teams.team1.color },
      team2: { name: teams.team2.name, logo: teams.team2.logo, color: teams.team2.color }
    },
    sponsorLogo: teams.team1.sponsorLogo || "", // ✅ Guardar logo de sponsor
    configured: true
  });
  setShowSetupModal(false);
};

  // Configurar duración del cuarto
  const setQuarterDuration = (minutes: number) => {
    const seconds = minutes * 60;
    updateMatch({ 
      quarterDuration: seconds,
      time: seconds
    });
  };

  // Formatear tiempo para display
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

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
          {!isAdmin && (
            <p className="text-yellow-400 mt-4">Solo el administrador puede crear partidos</p>
          )}
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
        {isAdmin ? (
          <p className="text-green-400 font-semibold mt-2">🔧 Modo Administrador</p>
        ) : (
          <p className="text-blue-400 font-semibold mt-2">👀 Modo Espectador</p>
        )}
      </div>

      {/* Marcador Principal */}
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 mb-6 border border-white/20">
        <div className="grid grid-cols-3 items-center text-center">
          {/* Equipo 1 */}
          <div className="text-center">
            {/* Logo y nombre */}
            <div className="flex items-center justify-center gap-3 mb-2">
              {matchData.teams.team1.logo && (
                <img 
                  src={matchData.teams.team1.logo} 
                  alt={`Logo ${matchData.teams.team1.name}`}
                  className="w-20 h-20 object-contain rounded-full border-2"
                  style={{ borderColor: matchData.teams.team1.color }}
                />
              )}
              <div 
                className="text-2xl font-bold px-3 py-1 rounded-lg"
                style={{ backgroundColor: matchData.teams.team1.color, color: 'white' }}
              >
                {matchData.teams.team1.name}
              </div>
            </div>
            
            <div className="text-6xl font-bold text-green-400">{matchData.score.team1}</div>
            {isAdmin && (
              <div className="flex justify-center gap-2 mt-2">
                <button 
                  onClick={() => removeGoal('team1')}
                  className="bg-blue-500 hover:bg-blue-600 text-white w-8 h-8 rounded-full"
                >
                  -
                </button>
                <button 
                  onClick={() => addGoal('team1')}
                  className="bg-green-500 hover:bg-green-600 text-white w-8 h-8 rounded-full"
                >
                  +
                </button>
              </div>
            )}
          </div>

          {/* Tiempo y Cuarto */}
          <div className="text-center">
            <div className="text-4xl font-mono font-bold text-white mb-2">
              {formatTime(matchData.time)}
            </div>
            <div className="text-xl text-gray-300">Cuarto {matchData.quarter}</div>
            {matchData.running && <div className="text-blue-400 text-sm">▶ EN VIVO</div>}
            {matchData.status === 'paused' && <div className="text-yellow-400 text-sm">⏸ PAUSADO</div>}
            
            {/* Configuración de tiempo (solo admin) */}
            {isAdmin && (
              <div className="mt-2 flex justify-center gap-2">
                <button 
                  onClick={() => setQuarterDuration(10)}
                  className={`text-xs px-2 py-1 rounded ${
                    matchData.quarterDuration === 600 
                      ? 'bg-white text-black' 
                      : 'bg-gray-600 text-white'
                  }`}
                >
                  10min
                </button>
                <button 
                  onClick={() => setQuarterDuration(15)}
                  className={`text-xs px-2 py-1 rounded ${
                    matchData.quarterDuration === 900 
                      ? 'bg-white text-black' 
                      : 'bg-gray-600 text-white'
                  }`}
                >
                  15min
                </button>
                <button 
                  onClick={() => setQuarterDuration(20)}
                  className={`text-xs px-2 py-1 rounded ${
                    matchData.quarterDuration === 1200 
                      ? 'bg-white text-black' 
                      : 'bg-gray-600 text-white'
                  }`}
                >
                  20min
                </button>
              </div>
            )}
          </div>

          {/* Equipo 2 */}
          <div className="text-center">
            {/* Logo y nombre */}
            <div className="flex items-center justify-center gap-3 mb-2">
              {matchData.teams.team2.logo && (
                <img 
                  src={matchData.teams.team2.logo} 
                  alt={`Logo ${matchData.teams.team2.name}`}
                  className="w-20 h-20 object-contain rounded-full border-2"
                  style={{ borderColor: matchData.teams.team2.color }}
                />
              )}
              <div 
                className="text-2xl font-bold px-3 py-1 rounded-lg"
                style={{ backgroundColor: matchData.teams.team2.color, color: 'white' }}
              >
                {matchData.teams.team2.name}
              </div>
            </div>
            
            <div className="text-6xl font-bold text-blue-400">{matchData.score.team2}</div>
            {isAdmin && (
              <div className="flex justify-center gap-2 mt-2">
                <button 
                  onClick={() => removeGoal('team2')}
                  className="bg-blue-500 hover:bg-blue-600 text-white w-8 h-8 rounded-full"
                >
                  -
                </button>
                <button 
                  onClick={() => addGoal('team2')}
                  className="bg-green-500 hover:bg-green-600 text-white w-8 h-8 rounded-full"
                >
                  +
                </button>
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
            <button 
              onClick={startMatch}
              disabled={matchData.running}
              className="bg-green-500 hover:bg-green-600 disabled:bg-green-800 text-white font-bold py-3 rounded-lg transition-all"
            >
              ▶ Iniciar
            </button>
            <button 
              onClick={pauseMatch}
              disabled={!matchData.running}
              className="bg-yellow-500 hover:bg-yellow-600 disabled:bg-yellow-800 text-white font-bold py-3 rounded-lg transition-all"
            >
              ⏸ Pausar
            </button>
          </div>

          <div className="grid grid-cols-4 gap-2 mb-4">
            {[1, 2, 3, 4].map((quarter) => (
              <button 
                key={quarter}
                onClick={() => setQuarter(quarter)}
                className={`py-2 rounded-lg font-bold ${
                  matchData.quarter === quarter 
                    ? 'bg-white text-blue-600' 
                    : 'bg-gray-700 text-white hover:bg-gray-600'
                }`}
              >
                Q{quarter}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <button 
              onClick={resetQuarter}
              className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-3 rounded-lg transition-all"
            >
              Reiniciar Cuarto
            </button>
            <button 
              onClick={() => navigator.clipboard.writeText(window.location.href.replace('?admin=true', ''))}
              className="bg-purple-500 hover:bg-purple-600 text-white font-bold py-3 rounded-lg transition-all"
            >
              📋 Copiar Enlace
            </button>
          </div>
        </div>
      )}

      {/* Mensaje para espectadores */}
      {!isAdmin && (
        <div className="text-center text-gray-400 mt-8">
         
          
          
          {/* Logo de Sponsor */}
{matchData.sponsorLogo && matchData.sponsorLogo !== "" && (
                <div className="mt-6 p-4 bg-white/5 rounded-lg">
              <p className="text-sm text-gray-400 mb-2">Partido patrocinado por:</p>
              <img 
                src={matchData.sponsorLogo} 
                alt="Sponsor" 
                className="h-30 object-contain mx-auto opacity-80"
              />
            </div>
          )}
        </div>
      )}

      {/* Modal de configuración de equipos */}
      <TeamSetupModal
        isOpen={showSetupModal}
        onSave={handleTeamSetupSave}
      />
    </div>
  );
}