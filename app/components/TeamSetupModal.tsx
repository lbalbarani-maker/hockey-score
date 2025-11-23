// src/app/components/TeamSetupModal.tsx

'use client';

import { useState, useRef } from 'react';

interface TeamSetupModalProps {
  isOpen: boolean;
  onSave: (data: { team1: any; team2: any; adminPinHash?: string }) => void;
}

interface Player {
  id: string;
  name: string;
  number: string;
  position: string;
  selected: boolean;
}

export default function TeamSetupModal({ isOpen, onSave }: TeamSetupModalProps) {
  const [adminPin, setAdminPin] = useState('');
  const [team1, setTeam1] = useState({ 
    name: 'Equipo Local', 
    color: '#FF0000', 
    logo: '', 
    sponsorLogo: '',
    players: [
      { id: '1', name: 'Aida Agüero 🥅', number: '7', position: 'Portera', selected: true },
      { id: '2', name: 'Miriam D’alesio', number: '3', position: 'Jugadora', selected: true },
      { id: '3', name: 'Victoria Acosta', number: '12', position: 'Jugadora', selected: true },
      { id: '4', name: 'Carmen Aragon', number: '16', position: 'Jugadora', selected: true },
      { id: '5', name: 'Maria Morales', number: '24', position: 'Jugadora', selected: true },
      { id: '6', name: 'Belen Largo', number: '34', position: 'Jugadora', selected: true },
      { id: '7', name: 'Sol Pastor', number: '37', position: 'Jugadora', selected: true },
      { id: '8', name: 'Olivia Balbarani', number: '43', position: 'Jugadora', selected: true },
      { id: '9', name: 'Sofia Rivas', number: '61', position: 'Jugadora', selected: true },
      { id: '10', name: 'Daniela Garcia', number: '17', position: 'Jugadora', selected: true },
      { id: '11', name: 'Aitana Alonso', number: '51', position: 'Jugadora', selected: true }
    ] as Player[]
  });

  const [team2, setTeam2] = useState({ 
    name: 'Equipo Visitante', 
    color: '#0000FF', 
    logo: '', 
    sponsorLogo: '',
    players: [] as Player[]
  });

  const [newPlayer, setNewPlayer] = useState({ name: '', number: '', position: 'Jugadora' });
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);

  const fileInput1 = useRef<HTMLInputElement>(null);
  const fileInput2 = useRef<HTMLInputElement>(null);
  const sponsorInput = useRef<HTMLInputElement>(null);

  const handleLogoUpload = (team: 'team1' | 'team2', event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const logoData = e.target?.result as string;
        if (team === 'team1') {
          setTeam1(prev => ({ ...prev, logo: logoData }));
        } else {
          setTeam2(prev => ({ ...prev, logo: logoData }));
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSponsorUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const sponsorLogo = e.target?.result as string;
        setTeam1(prev => ({ ...prev, sponsorLogo }));
      };
      reader.readAsDataURL(file);
    }
  };

  const togglePlayerSelection = (team: 'team1' | 'team2', playerId: string) => {
    if (team === 'team1') {
      setTeam1(prev => ({
        ...prev,
        players: prev.players.map(player =>
          player.id === playerId ? { ...player, selected: !player.selected } : player
        )
      }));
    } else {
      setTeam2(prev => ({
        ...prev,
        players: prev.players.map(player =>
          player.id === playerId ? { ...player, selected: !player.selected } : player
        )
      }));
    }
  };

  const addPlayer = (team: 'team1' | 'team2') => {
    if (!newPlayer.name.trim() || !newPlayer.number.trim()) return;

    const player: Player = {
      id: Date.now().toString(),
      name: newPlayer.name,
      number: newPlayer.number,
      position: newPlayer.position,
      selected: true
    };

    if (team === 'team1') {
      setTeam1(prev => ({
        ...prev,
        players: [...prev.players, player]
      }));
    } else {
      setTeam2(prev => ({
        ...prev,
        players: [...prev.players, player]
      }));
    }

    setNewPlayer({ name: '', number: '', position: 'Jugadora' });
  };

  const updatePlayer = (team: 'team1' | 'team2', updatedPlayer: Player) => {
    if (team === 'team1') {
      setTeam1(prev => ({
        ...prev,
        players: prev.players.map(player =>
          player.id === updatedPlayer.id ? updatedPlayer : player
        )
      }));
    } else {
      setTeam2(prev => ({
        ...prev,
        players: prev.players.map(player =>
          player.id === updatedPlayer.id ? updatedPlayer : player
        )
      }));
    }
    setEditingPlayer(null);
  };

  const deletePlayer = (team: 'team1' | 'team2', playerId: string) => {
    if (team === 'team1') {
      setTeam1(prev => ({
        ...prev,
        players: prev.players.filter(player => player.id !== playerId)
      }));
    } else {
      setTeam2(prev => ({
        ...prev,
        players: prev.players.filter(player => player.id !== playerId)
      }));
    }
  };

  /** HASH SHA-256 DEL PIN */
  const hashPin = async (pin: string): Promise<string> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(pin);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");
  };

  const handleSave = async () => {
    // Validación mínima: pin obligatorio
    if (!adminPin.trim()) {
      alert("Debes ingresar un PIN de administrador.");
      return;
    }

    // Hash del PIN antes de enviar
    const adminPinHash = await hashPin(adminPin);

    onSave({
      team1,
      team2,
      adminPinHash
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">Configurar Equipos</h2>

        {/* PIN DE ADMIN */}
        <div className="mb-6 p-4 border border-gray-300 rounded-lg bg-gray-50">
          <label className="block text-sm font-medium text-gray-700 mb-2">🔐 PIN de Administrador (obligatorio)</label>
          <input
            type="password"
            placeholder="Introduce un PIN (ej: 1234)"
            value={adminPin}
            onChange={(e) => setAdminPin(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-lg"
          />
          <p className="text-xs text-gray-500 mt-1">
            Este PIN será necesario para editar y controlar el partido desde la interfaz admin. No se almacenará en texto plano.
          </p>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Equipo 1 */}
          <div className="space-y-6">
            <h3 className="text-xl font-semibold text-gray-900 border-b pb-2">Equipo Local</h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                Nombre del equipo
              </label>
              <input 
                type="text" 
                value={team1.name} 
                onChange={(e) => setTeam1(prev => ({ ...prev, name: e.target.value }))}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                placeholder="Nombre del equipo" 
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                🎽 Color de camiseta
              </label>
              <div className="flex items-center gap-3">
                <input 
                  type="color" 
                  value={team1.color} 
                  onChange={(e) => setTeam1(prev => ({ ...prev, color: e.target.value }))}
                  className="w-16 h-16 border border-gray-300 rounded cursor-pointer" 
                />
                <div className="flex flex-col">
                  <span className="text-sm text-gray-500">{team1.color}</span>
                  <span className="text-xs text-gray-400">Color principal del equipo</span>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                Logo del equipo
              </label>
              <input 
                type="file" 
                ref={fileInput1} 
                onChange={(e) => handleLogoUpload('team1', e)} 
                accept="image/*" 
                className="hidden" 
              />
              <button 
                onClick={() => fileInput1.current?.click()}
                className="w-full p-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-gray-400 transition-colors text-gray-600"
              >
                {team1.logo ? '✅ Logo cargado' : '📁 Subir logo'}
              </button>
              {team1.logo && (
                <div className="mt-2">
                  <img src={team1.logo} alt="Logo equipo 1" className="w-20 h-20 object-contain mx-auto" />
                </div>
              )}
            </div>

            {/* Lista de Jugadoras - Equipo 1 */}
            <div className="border-t pt-4">
              <h4 className="text-lg font-semibold text-gray-800 mb-3">👥 Jugadoras</h4>
              
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {team1.players.map((player) => (
                  <div key={player.id} className="flex items-center gap-3 p-2 border rounded-lg">
                    <input
                      type="checkbox"
                      checked={player.selected}
                      onChange={() => togglePlayerSelection('team1', player.id)}
                      className="w-4 h-4 text-red-600 rounded focus:ring-red-500"
                    />
                    <span className="font-mono bg-gray-100 px-2 py-1 rounded text-sm">#{player.number}</span>
                    <span className="flex-1 text-sm">{player.name}</span>
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">{player.position}</span>
                    <button onClick={() => setEditingPlayer(player)} className="text-blue-600 hover:text-blue-800 text-sm">✏️</button>
                  </div>
                ))}
              </div>

              {/* Añadir nueva jugadora - Equipo 1 */}
              <div className="mt-4 p-3 border-2 border-dashed border-gray-300 rounded-lg">
                <h5 className="text-sm font-semibold text-gray-700 mb-2">➕ Añadir jugadora invitada</h5>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <input
                    type="text"
                    placeholder="Nombre"
                    value={newPlayer.name}
                    onChange={(e) => setNewPlayer(prev => ({ ...prev, name: e.target.value }))}
                    className="p-2 border border-gray-300 rounded text-sm"
                  />
                  <input
                    type="text"
                    placeholder="Dorsal"
                    value={newPlayer.number}
                    onChange={(e) => setNewPlayer(prev => ({ ...prev, number: e.target.value }))}
                    className="p-2 border border-gray-300 rounded text-sm"
                  />
                </div>
                <select
                  value={newPlayer.position}
                  onChange={(e) => setNewPlayer(prev => ({ ...prev, position: e.target.value }))}
                  className="w-full p-2 border border-gray-300 rounded text-sm mb-2"
                >
                  <option value="Jugadora">Jugadora</option>
                  <option value="Portera">Portera</option>
                </select>
                <button onClick={() => addPlayer('team1')} className="w-full bg-gray-500 hover:bg-gray-600 text-white py-2 rounded text-sm">
                  Añadir al Equipo 1
                </button>
              </div>
            </div>
          </div>

          {/* Equipo 2 */}
          <div className="space-y-6">
            <h3 className="text-xl font-semibold text-gray-900 border-b pb-2">Equipo Visitante</h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Nombre del equipo</label>
              <input 
                type="text" 
                value={team2.name} 
                onChange={(e) => setTeam2(prev => ({ ...prev, name: e.target.value }))}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Nombre del equipo" 
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">🎽 Color de camiseta</label>
              <div className="flex items-center gap-3">
                <input 
                  type="color" 
                  value={team2.color} 
                  onChange={(e) => setTeam2(prev => ({ ...prev, color: e.target.value }))}
                  className="w-16 h-16 border border-gray-300 rounded cursor-pointer" 
                />
                <div className="flex flex-col">
                  <span className="text-sm text-gray-500">{team2.color}</span>
                  <span className="text-xs text-gray-400">Color principal del equipo</span>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Logo del equipo</label>
              <input 
                type="file" 
                ref={fileInput2} 
                onChange={(e) => handleLogoUpload('team2', e)} 
                accept="image/*" 
                className="hidden" 
              />
              <button onClick={() => fileInput2.current?.click()} className="w-full p-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-gray-400 transition-colors text-gray-600">
                {team2.logo ? '✅ Logo cargado' : '📁 Subir logo'}
              </button>
              {team2.logo && (
                <div className="mt-2">
                  <img src={team2.logo} alt="Logo equipo 2" className="w-20 h-20 object-contain mx-auto" />
                </div>
              )}
            </div>

            {/* Lista de Jugadoras - Equipo 2 */}
            <div className="border-t pt-4">
              <h4 className="text-lg font-semibold text-gray-800 mb-3">👥 Jugadoras</h4>
              
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {team2.players.map((player) => (
                  <div key={player.id} className="flex items-center gap-3 p-2 border rounded-lg">
                    <input
                      type="checkbox"
                      checked={player.selected}
                      onChange={() => togglePlayerSelection('team2', player.id)}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <span className="font-mono bg-gray-100 px-2 py-1 rounded text-sm">#{player.number}</span>
                    <span className="flex-1 text-sm">{player.name}</span>
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">{player.position}</span>
                    <button onClick={() => setEditingPlayer(player)} className="text-blue-600 hover:text-blue-800 text-sm">✏️</button>
                    <button onClick={() => deletePlayer('team2', player.id)} className="text-red-600 hover:text-red-800 text-sm">🗑️</button>
                  </div>
                ))}
                {team2.players.length === 0 && (
                  <p className="text-gray-500 text-sm text-center py-4">No hay jugadoras añadidas</p>
                )}
              </div>

              {/* Añadir nueva jugadora - Equipo 2 */}
              <div className="mt-4 p-3 border-2 border-dashed border-gray-300 rounded-lg">
                <h5 className="text-sm font-semibold text-gray-700 mb-2">➕ Añadir jugadora</h5>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <input type="text" placeholder="Nombre" value={newPlayer.name} onChange={(e) => setNewPlayer(prev => ({ ...prev, name: e.target.value }))} className="p-2 border border-gray-300 rounded text-sm" />
                  <input type="text" placeholder="Dorsal" value={newPlayer.number} onChange={(e) => setNewPlayer(prev => ({ ...prev, number: e.target.value }))} className="p-2 border border-gray-300 rounded text-sm" />
                </div>
                <select value={newPlayer.position} onChange={(e) => setNewPlayer(prev => ({ ...prev, position: e.target.value }))} className="w-full p-2 border border-gray-300 rounded text-sm mb-2">
                  <option value="Jugadora">Jugadora</option>
                  <option value="Portera">Portera</option>
                </select>
                <button onClick={() => addPlayer('team2')} className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 rounded text-sm">Añadir al Equipo 2</button>
              </div>
            </div>
          </div>
        </div>

        {/* Logo de Sponsor */}
        <div className="border-t pt-6 mt-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">🏢 Logo de Sponsor (Opcional)</h3>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-2">Logo que aparecerá en la vista de espectadores</label>
            <input type="file" ref={sponsorInput} onChange={handleSponsorUpload} accept="image/*" className="hidden" id="sponsor-logo" />
            <label htmlFor="sponsor-logo" className="w-full p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-gray-400 transition-colors text-gray-600 cursor-pointer block text-center">
              {team1.sponsorLogo ? '✅ Logo de sponsor cargado' : '🏢 Subir logo de sponsor'}
            </label>
            {team1.sponsorLogo && (
              <div className="mt-3 text-center">
                <p className="text-sm text-gray-600 mb-2">Vista previa:</p>
                <img src={team1.sponsorLogo} alt="Logo sponsor" className="w-32 h-16 object-contain mx-auto border rounded-lg" />
              </div>
            )}
          </div>
        </div>

        {/* Modal de edición de jugadora */}
        {editingPlayer && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full">
              <h3 className="text-xl font-bold text-gray-800 mb-4">Editar Jugadora</h3>
              <div className="space-y-3">
                <input type="text" value={editingPlayer.name} onChange={(e) => setEditingPlayer(prev => prev ? { ...prev, name: e.target.value } : null)} className="w-full p-2 border border-gray-300 rounded" placeholder="Nombre" />
                <input type="text" value={editingPlayer.number} onChange={(e) => setEditingPlayer(prev => prev ? { ...prev, number: e.target.value } : null)} className="w-full p-2 border border-gray-300 rounded" placeholder="Dorsal" />
                <select value={editingPlayer.position} onChange={(e) => setEditingPlayer(prev => prev ? { ...prev, position: e.target.value } : null)} className="w-full p-2 border border-gray-300 rounded">
                  <option value="Jugadora">Jugadora</option>
                  <option value="Portera">Portera</option>
                </select>
                <div className="flex gap-2 mt-4">
                  <button onClick={() => updatePlayer(editingPlayer.id.startsWith('1') ? 'team1' : 'team2', editingPlayer)} className="flex-1 bg-green-500 hover:bg-green-600 text-white py-2 rounded">Guardar</button>
                  <button onClick={() => setEditingPlayer(null)} className="flex-1 bg-gray-500 hover:bg-gray-600 text-white py-2 rounded">Cancelar</button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-3 mt-8">
          <button onClick={handleSave} className="flex-1 bg-green-500 hover:bg-green-600 text-white font-bold py-3 rounded-lg transition-all">🏁 Iniciar Partido</button>
        </div>
      </div>
    </div>
  );
}
