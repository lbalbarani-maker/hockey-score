//src/app/match/[matchId]/components/GoalHistory.tsx — Panel de goles (fijo en la vista espectador y admin; en la vista espectador queda siempre visible debajo).

// src/app/match/[matchId]/components/GoalHistory.tsx
'use client';

import React from 'react';

type GoalRecord = {
  id: string;
  team: 'team1'|'team2';
  playerName: string;
  number?: string|null;
  matchMinute: number;
};

type Props = {
  goals: GoalRecord[];
  team1Name: string;
  team2Name: string;
  isAdmin: boolean;
  removeGoal?: (id:string)=>void;
};

export default function GoalHistory({ goals, team1Name, team2Name, isAdmin, removeGoal }: Props) {
  const team1Goals = goals.filter(g => g.team === 'team1');
  const team2Goals = goals.filter(g => g.team === 'team2');

  return (
    <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-bold text-white">GOLES</h3>
        {isAdmin && <span className="text-sm text-gray-200">Modo Admin</span>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <h4 className="text-sm text-gray-300 mb-2">{team1Name}</h4>
          <ul className="list-none space-y-2 text-sm">
            {team1Goals.map(g => (
              <li key={g.id} className="flex justify-between items-center">
                <span>🏑 {g.playerName} 👕#{g.number ?? ''} ({g.matchMinute}')</span>
                {isAdmin && removeGoal && <button onClick={() => removeGoal(g.id)} className="text-red-400 ml-2">Eliminar</button>}
              </li>
            ))}
            {team1Goals.length === 0 && <li className="text-gray-400">Sin goles</li>}
          </ul>
        </div>

        <div>
          <h4 className="text-sm text-gray-300 mb-2">{team2Name}</h4>
          <ul className="list-none space-y-2 text-sm">
            {team2Goals.map(g => (
              <li key={g.id} className="flex justify-between items-center">
                <span>🏑 {g.playerName} 👕#{g.number ?? ''} ({g.matchMinute}')</span>
                {isAdmin && removeGoal && <button onClick={() => removeGoal(g.id)} className="text-red-400 ml-2">Eliminar</button>}
              </li>
            ))}
            {team2Goals.length === 0 && <li className="text-gray-400">Sin goles</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}
