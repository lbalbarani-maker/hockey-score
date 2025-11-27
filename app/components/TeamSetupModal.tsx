//src/app/components/TeamSetupModal.tsx — Tu modal de configuración (actualizado: jugadoras por defecto PRESELECCIONADAS, permite editar/agregar y devuelve adminPin + adminPinHash en onSave).

// src/app/components/TeamSetupModal.tsx
'use client';

import { useState, useRef } from 'react';

interface Player {
  id: string;
  name: string;
  number: string;
  position: string;
  selected: boolean;
}

interface TeamSetupModalProps {
  isOpen: boolean;
  onSave: (data: { team1: any; team2: any; adminPin: string; adminPinHash: string }) => void;
}

export default function TeamSetupModal({ isOpen, onSave }: TeamSetupModalProps) {
  const [adminPin, setAdminPin] = useState('');
  const [team1, setTeam1] = useState({
    name: 'Equipo Local',
    color: '#FF0000',
    logo: '',
    sponsorLogo: '',
    players: [
      { id: 'gk1', name: 'Aida Agüero 🥅', number: '7', position: 'Portera', selected: true },
      { id: 'p3', name: 'Miriam D’alesio', number: '3', position: 'Jugadora', selected: true },
      { id: 'p12', name: 'Victoria Acosta', number: '12', position: 'Jugadora', selected: true },
      { id: 'p16', name: 'Carmen Aragon', number: '16', position: 'Jugadora', selected: true },
      { id: 'p24', name: 'Maria Morales', number: '24', position: 'Jugadora', selected: true },
      { id: 'p34', name: 'Belen Largo', number: '34', position: 'Jugadora', selected: true },
      { id: 'p37', name: 'Sol Pastor', number: '37', position: 'Jugadora', selected: true },
      { id: 'p43', name: 'Olivia Balbarani', number: '43', position: 'Jugadora', selected: true },
      { id: 'p61', name: 'Sofia Rivas', number: '61', position: 'Jugadora', selected: true },
      { id: 'p17', name: 'Daniela Garcia', number: '17', position: 'Jugadora', selected: true },
      { id: 'p51', name: 'Aitana Alonso', number: '51', position: 'Jugadora', selected: true }
    ] as Player[]
  });

  const [team2, setTeam2] = useState({
    name: 'Equipo Visitante',
    color: '#0000FF',
    logo: '',
    sponsorLogo: '',
    players: [] as Player[]
  });

  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerNumber, setNewPlayerNumber] = useState('');
  const [newPlayerPosition, setNewPlayerPosition] = useState<'Jugadora'|'Portera'>('Jugadora');

  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);

  const fileInput1 = useRef<HTMLInputElement>(null);
  const fileInput2 = useRef<HTMLInputElement>(null);
  const sponsorInput = useRef<HTMLInputElement>(null);

  const handleLogoUpload = (team: 'team1'|'team2', e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const data = ev.target?.result as string;
      if (team === 'team1') setTeam1(prev => ({ ...prev, logo: data }));
      else setTeam2(prev => ({ ...prev, logo: data }));
    };
    reader.readAsDataURL(file);
  };

  const handleSponsorUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const data = ev.target?.result as string;
      setTeam1(prev => ({ ...prev, sponsorLogo: data }));
    };
    reader.readAsDataURL(file);
  };

  const togglePlayerSelection = (team: 'team1'|'team2', id: string) => {
    if (team === 'team1') {
      setTeam1(prev => ({ ...prev, players: prev.players.map(p => p.id === id ? { ...p, selected: !p.selected } : p) }));
    } else {
      setTeam2(prev => ({ ...prev, players: prev.players.map(p => p.id === id ? { ...p, selected: !p.selected } : p) }));
    }
  };

  const addPlayer = (team: 'team1'|'team2') => {
    if (!newPlayerName.trim()) return;
    const player: Player = { id: Date.now().toString(), name: newPlayerName.trim(), number: newPlayerNumber.trim() || '', position: newPlayerPosition, selected: true };
    if (team === 'team1') setTeam1(prev => ({ ...prev, players: [...prev.players, player] }));
    else setTeam2(prev => ({ ...prev, players: [...prev.players, player] }));
    setNewPlayerName(''); setNewPlayerNumber(''); setNewPlayerPosition('Jugadora');
  };

  const saveEditing = () => {
    if (!editingPlayer) return;
    const updated = editingPlayer;
    if (editingPlayer.id && editingPlayer.id) {
      if (team1.players.some(p => p.id === editingPlayer.id)) {
        setTeam1(prev => ({ ...prev, players: prev.players.map(p => p.id === updated.id ? updated : p) }));
      } else {
        setTeam2(prev => ({ ...prev, players: prev.players.map(p => p.id === updated.id ? updated : p) }));
      }
    }
    setEditingPlayer(null);
  };

  const deletePlayer = (team: 'team1'|'team2', id: string) => {
    if (team === 'team1') setTeam1(prev => ({ ...prev, players: prev.players.filter(p => p.id !== id) }));
    else setTeam2(prev => ({ ...prev, players: prev.players.filter(p => p.id !== id) }));
  };

  const hashPin = async (pin: string) => {
    const enc = new TextEncoder();
    const data = enc.encode(pin);
    const h = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2,'0')).join('');
  };

  const handleSave = async () => {
    if (!adminPin.trim()) {
      alert('Introduce un PIN de administrador');
      return;
    }
    const adminPinHash = await hashPin(adminPin);
    onSave({
      team1,
      team2,
      adminPin,
      adminPinHash
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-[#071025] rounded-2xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-white/10">
        <h2 className="text-2xl font-bold text-white mb-4">Configurar Equipos</h2>

        <div className="mb-4">
          <label className="block text-sm text-gray-300 mb-1">🔐 PIN de Administrador</label>
          <input value={adminPin} onChange={(e)=>setAdminPin(e.target.value)} className="w-full p-2 rounded bg-white/5 text-white border border-white/10" placeholder="1234" />
          <p className="text-xs text-gray-400 mt-1">El PIN te permitirá entrar en modo admin. No se guardará en texto plano.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Team1 */}
          <div className="p-4 rounded bg-white/5">
            <h3 className="text-lg font-semibold text-white mb-2">Equipo Local</h3>

            <input type="text" value={team1.name} onChange={(e)=>setTeam1(prev=>({...prev, name: e.target.value}))} className="w-full p-2 rounded bg-white/5 text-white mb-2 border border-white/10" />
            <div className="flex items-center gap-3 mb-3">
              <input type="color" value={team1.color} onChange={(e)=>setTeam1(prev=>({...prev, color: e.target.value}))} className="w-12 h-10 border rounded" />
              <button onClick={()=>fileInput1.current?.click()} className="px-3 py-2 bg-white/5 rounded text-white border border-white/10">Logo</button>
              <input ref={fileInput1} type="file" className="hidden" accept="image/*" onChange={(e)=>handleLogoUpload('team1', e)} />
            </div>

            <div className="mb-3">
              <h4 className="text-sm text-gray-200 mb-2">Jugadoras</h4>
              <div className="max-h-56 overflow-y-auto space-y-2">
                {team1.players.map(p => (
                  <div key={p.id} className="flex items-center justify-between gap-2 p-2 bg-white/3 rounded">
                    <div className="flex items-center gap-2">
                      <input type="checkbox" checked={p.selected} onChange={()=>togglePlayerSelection('team1', p.id)} />
                      <div className="text-sm text-white">{p.name} <span className="text-xs text-gray-300">#{p.number}</span></div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={()=>setEditingPlayer(p)} className="text-xs text-blue-300">✏️</button>
                      <button onClick={()=>deletePlayer('team1', p.id)} className="text-xs text-red-400">🗑️</button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-3 p-3 border border-white/6 rounded">
                <div className="flex gap-2 mb-2">
                  <input value={newPlayerName} onChange={(e)=>setNewPlayerName(e.target.value)} placeholder="Nombre" className="flex-1 p-2 rounded bg-white/5 text-white" />
                  <input value={newPlayerNumber} onChange={(e)=>setNewPlayerNumber(e.target.value)} placeholder="Dorsal" className="w-24 p-2 rounded bg-white/5 text-white" />
                </div>
                <div className="flex gap-2 mb-2">
                  <select value={newPlayerPosition} onChange={(e)=>setNewPlayerPosition(e.target.value as any)} className="p-2 rounded bg-white/5 text-white">
                    <option value="Jugadora">Jugadora</option>
                    <option value="Portera">Portera</option>
                  </select>
                  <button onClick={()=>addPlayer('team1')} className="ml-auto bg-green-600 px-3 py-2 rounded text-white">Añadir</button>
                </div>
              </div>
            </div>
          </div>

          {/* Team2 */}
          <div className="p-4 rounded bg-white/5">
            <h3 className="text-lg font-semibold text-white mb-2">Equipo Visitante</h3>

            <input type="text" value={team2.name} onChange={(e)=>setTeam2(prev=>({...prev, name: e.target.value}))} className="w-full p-2 rounded bg-white/5 text-white mb-2 border border-white/10" />
            <div className="flex items-center gap-3 mb-3">
              <input type="color" value={team2.color} onChange={(e)=>setTeam2(prev=>({...prev, color: e.target.value}))} className="w-12 h-10 border rounded" />
              <button onClick={()=>fileInput2.current?.click()} className="px-3 py-2 bg-white/5 rounded text-white border border-white/10">Logo</button>
              <input ref={fileInput2} type="file" className="hidden" accept="image/*" onChange={(e)=>handleLogoUpload('team2', e)} />
            </div>

            <div className="mb-3">
              <h4 className="text-sm text-gray-200 mb-2">Jugadoras</h4>
              <div className="max-h-56 overflow-y-auto space-y-2">
                {team2.players.map(p => (
                  <div key={p.id} className="flex items-center justify-between gap-2 p-2 bg-white/3 rounded">
                    <div className="flex items-center gap-2">
                      <input type="checkbox" checked={p.selected} onChange={()=>togglePlayerSelection('team2', p.id)} />
                      <div className="text-sm text-white">{p.name} <span className="text-xs text-gray-300">#{p.number}</span></div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={()=>setEditingPlayer(p)} className="text-xs text-blue-300">✏️</button>
                      <button onClick={()=>deletePlayer('team2', p.id)} className="text-xs text-red-400">🗑️</button>
                    </div>
                  </div>
                ))}
                {team2.players.length === 0 && <div className="text-gray-400 text-sm">No hay jugadoras definidas</div>}
              </div>

              <div className="mt-3 p-3 border border-white/6 rounded">
                <div className="flex gap-2 mb-2">
                  <input value={newPlayerName} onChange={(e)=>setNewPlayerName(e.target.value)} placeholder="Nombre" className="flex-1 p-2 rounded bg-white/5 text-white" />
                  <input value={newPlayerNumber} onChange={(e)=>setNewPlayerNumber(e.target.value)} placeholder="Dorsal" className="w-24 p-2 rounded bg-white/5 text-white" />
                </div>
                <div className="flex gap-2 mb-2">
                  <select value={newPlayerPosition} onChange={(e)=>setNewPlayerPosition(e.target.value as any)} className="p-2 rounded bg-white/5 text-white">
                    <option value="Jugadora">Jugadora</option>
                    <option value="Portera">Portera</option>
                  </select>
                  <button onClick={()=>addPlayer('team2')} className="ml-auto bg-blue-600 px-3 py-2 rounded text-white">Añadir</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* editing modal */}
        {editingPlayer && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-[#071025] p-4 rounded w-full max-w-md border border-white/10">
              <h4 className="text-white font-bold mb-2">Editar Jugadora</h4>
              <input value={editingPlayer.name} onChange={(e)=>setEditingPlayer(prev=> prev?{...prev, name:e.target.value}:null)} className="w-full p-2 rounded bg-white/5 text-white mb-2" />
              <input value={editingPlayer.number} onChange={(e)=>setEditingPlayer(prev=> prev?{...prev, number:e.target.value}:null)} className="w-full p-2 rounded bg-white/5 text-white mb-2" />
              <select value={editingPlayer.position} onChange={(e)=>setEditingPlayer(prev=> prev?{...prev, position:e.target.value as any}:null)} className="w-full p-2 rounded bg-white/5 text-white mb-3">
                <option value="Jugadora">Jugadora</option>
                <option value="Portera">Portera</option>
              </select>
              <div className="flex gap-2 justify-end">
                <button onClick={()=>setEditingPlayer(null)} className="px-4 py-2 bg-gray-600 text-white rounded">Cancelar</button>
                <button onClick={saveEditing} className="px-4 py-2 bg-green-600 text-white rounded">Guardar</button>
              </div>
            </div>
          </div>
        )}

        <div className="mt-6 flex gap-3">
          <button onClick={handleSave} className="flex-1 bg-green-600 text-white py-3 rounded">🏁 Iniciar Partido</button>
        </div>
      </div>
    </div>
  );
}
