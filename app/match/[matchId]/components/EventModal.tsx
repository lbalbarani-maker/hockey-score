//src/app/match/[matchId]/components/EventModal.tsx — Modal reutilizable para seleccionar jugadora autora del gol o introducir nombre/dorsal libre si no hay jugadoras; oscuro (no blanco).

// src/app/match/[matchId]/components/EventModal.tsx
'use client';

import React, { useEffect, useState } from 'react';

type Player = { id: string; name: string; number?: string };

type Props = {
  isOpen: boolean;
  team: 'team1' | 'team2' | null;
  players: Player[];
  onCancel: () => void;
  onConfirm: (payload: { team: 'team1'|'team2'; player?: Player | null; freeText?: { name: string; number?: string } }) => void;
  dark?: boolean;
};

export default function EventModal({ isOpen, team, players, onCancel, onConfirm, dark=true }: Props) {
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [freeName, setFreeName] = useState('');
  const [freeNumber, setFreeNumber] = useState('');

  useEffect(() => {
    setSelectedPlayerId(null);
    setFreeName('');
    setFreeNumber('');
  }, [isOpen, team, players]);

  if (!isOpen || !team) return null;

  const modalBg = dark ? 'bg-[#081124]/95' : 'bg-white';
  const panelBg = dark ? 'bg-[#0b1220]' : 'bg-white';

  const handleConfirm = () => {
    if (selectedPlayerId) {
      const p = players.find(pl => pl.id === selectedPlayerId);
      onConfirm({ team, player: p ?? null });
    } else {
      // if no players selected, but freeName present -> freeText
      if (!freeName.trim()) {
        // if there are players but none selected, don't allow empty
        if (players.length > 0) {
          alert('Selecciona una jugadora o introduce nombre y dorsal.');
          return;
        }
        // if no players exist, require freeName
        alert('Introduce nombre y dorsal de la jugadora (campo libre).');
        return;
      }
      onConfirm({ team, freeText: { name: freeName.trim(), number: freeNumber.trim() || undefined } });
    }
  };

  return (
    <div className={`fixed inset-0 flex items-center justify-center z-60 ${modalBg}`}>
      <div className={`w-full max-w-lg p-4 rounded-2xl ${panelBg} border border-white/10`}>
        <h3 className="text-xl font-bold text-white mb-3">Seleccionar autora del gol</h3>

        <div className="mb-3">
          <p className="text-sm text-gray-300">Equipo: <span className="font-semibold text-white">{team}</span></p>
        </div>

        <div className="max-h-72 overflow-y-auto space-y-2 mb-3">
          {players.length === 0 ? (
            <div className="text-sm text-gray-300">
              No hay jugadoras seleccionadas para este equipo. Puedes introducir nombre y dorsal libre abajo.
            </div>
          ) : (
            players.map(p => (
              <label key={p.id} className="flex items-center justify-between p-2 rounded border border-white/5">
                <div>
                  <div className="text-white font-medium">{p.name}</div>
                  <div className="text-xs text-gray-400">#{p.number}</div>
                </div>
                <input type="radio" name="scorer" checked={selectedPlayerId === p.id} onChange={() => setSelectedPlayerId(p.id)} />
              </label>
            ))
          )}
        </div>

        <div className="mt-3">
          <p className="text-sm text-gray-300 mb-1">O introducir jugadora (texto libre)</p>
          <div className="grid grid-cols-3 gap-2">
            <input placeholder="Nombre" value={freeName} onChange={(e)=>setFreeName(e.target.value)} className="col-span-2 p-2 rounded bg-white/5 text-white border border-white/10"/>
            <input placeholder="#Dorsal" value={freeNumber} onChange={(e)=>setFreeNumber(e.target.value)} className="p-2 rounded bg-white/5 text-white border border-white/10"/>
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onCancel} className="px-4 py-2 bg-gray-600 text-white rounded">Cancelar</button>
          <button onClick={handleConfirm} className="px-4 py-2 bg-green-600 text-white rounded">Confirmar gol</button>
        </div>
      </div>
    </div>
  );
}
