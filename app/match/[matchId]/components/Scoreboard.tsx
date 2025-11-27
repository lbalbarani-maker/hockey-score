//src/app/match/[matchId]/components/Scoreboard.tsx — Marcador: muestra equipos, tiempo y botones + / - (llama handlers que recibe por props).

// src/app/match/[matchId]/components/Scoreboard.tsx
'use client';

import React from 'react';

type Team = any;
type MatchData = {
  teams: { team1: Team; team2: Team };
  score: { team1: number; team2: number };
  quarter: number;
  running: boolean;
  status: string;
  quarterDuration: number;
};

type Props = {
  matchData: MatchData;
  displayTime: number;
  isAdmin: boolean;
  onStart: () => void;
  onPause: () => void;
  onResetQuarter: () => void;
  onSetQuarter: (q: number) => void;
  onSetQuarterDuration: (min: number) => void;
  onPlus: (team: 'team1' | 'team2') => void;
  onMinus: (team: 'team1' | 'team2') => void;
};

export default function Scoreboard({ matchData, displayTime, isAdmin, onStart, onPause, onResetQuarter, onSetQuarter, onSetQuarterDuration, onPlus, onMinus }: Props) {
  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 mb-6 border border-white/20">
      <div className="grid grid-cols-3 items-center text-center">
        {/* Team 1 */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-3 mb-2">
            {matchData.teams.team1.logo && <img src={matchData.teams.team1.logo} className="w-20 h-20 rounded-full border-2" style={{ borderColor: matchData.teams.team1.color }} />}
            <div className="text-2xl font-bold px-3 py-1 rounded-lg" style={{ backgroundColor: matchData.teams.team1.color, color: 'white' }}>{matchData.teams.team1.name}</div>
          </div>

          <div className="text-6xl font-bold text-green-400">{matchData.score.team1}</div>

          {isAdmin && (
            <div className="flex justify-center gap-2 mt-2">
              <button onClick={() => onMinus('team1')} className="bg-blue-500 hover:bg-blue-600 text-white w-8 h-8 rounded-full">-</button>
              <button onClick={() => onPlus('team1')} className="bg-green-500 hover:bg-green-600 text-white w-8 h-8 rounded-full">+</button>
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
              <button onClick={() => onSetQuarterDuration(10)} className={`text-xs px-2 py-1 rounded ${matchData.quarterDuration === 600 ? 'bg-white text-black' : 'bg-gray-600 text-white'}`}>10min</button>
              <button onClick={() => onSetQuarterDuration(15)} className={`text-xs px-2 py-1 rounded ${matchData.quarterDuration === 900 ? 'bg-white text-black' : 'bg-gray-600 text-white'}`}>15min</button>
              <button onClick={() => onSetQuarterDuration(20)} className={`text-xs px-2 py-1 rounded ${matchData.quarterDuration === 1200 ? 'bg-white text-black' : 'bg-gray-600 text-white'}`}>20min</button>
            </div>
          )}
        </div>

        {/* Team 2 */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-3 mb-2">
            {matchData.teams.team2.logo && <img src={matchData.teams.team2.logo} className="w-20 h-20 rounded-full border-2" style={{ borderColor: matchData.teams.team2.color }} />}
            <div className="text-2xl font-bold px-3 py-1 rounded-lg" style={{ backgroundColor: matchData.teams.team2.color, color: 'white' }}>{matchData.teams.team2.name}</div>
          </div>

          <div className="text-6xl font-bold text-blue-400">{matchData.score.team2}</div>

          {isAdmin && (
            <div className="flex justify-center gap-2 mt-2">
              <button onClick={() => onMinus('team2')} className="bg-blue-500 hover:bg-blue-600 text-white w-8 h-8 rounded-full">-</button>
              <button onClick={() => onPlus('team2')} className="bg-green-500 hover:bg-green-600 text-white w-8 h-8 rounded-full">+</button>
            </div>
          )}
        </div>
      </div>

      {/* admin controls */}
      {isAdmin && (
        <div className="mt-4 bg-blue-600/90 p-4 rounded-lg">
          <div className="grid grid-cols-2 gap-4">
            <button onClick={onStart} className="bg-green-500 hover:bg-green-600 text-white py-2 rounded">▶ Iniciar</button>
            <button onClick={onPause} className="bg-yellow-500 hover:bg-yellow-600 text-white py-2 rounded">⏸ Pausar</button>
          </div>

          <div className="grid grid-cols-4 gap-2 mt-3">
            {[1, 2, 3, 4].map(q => (
              <button
                key={q}
                onClick={() => onSetQuarter(q)}
                className={`py-2 rounded font-bold ${q === matchData.quarter ? 'bg-red-500 text-white' : 'bg-gray-700 text-white hover:bg-gray-600'}`}>
                Q{q}
              </button>
            ))}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button onClick={onResetQuarter} className="py-2 bg-gray-500 text-white rounded">Reiniciar Cuarto</button>
            <button onClick={() => {
              const url = new URL(window.location.href);
              url.searchParams.delete('admin');
              navigator.clipboard.writeText(url.toString());
            }} className="py-2 bg-purple-500 text-white rounded">📋 Copiar enlace</button>
          </div>
        </div>
      )}
    </div>
  );
}
