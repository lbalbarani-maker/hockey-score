// src/app/components/TeamSetupModal.tsx
'use client';

import { useState, useRef } from 'react';

interface TeamSetupModalProps {
  isOpen: boolean;
  onSave: (data: {
    team1: any;
    team2: any;
    adminPin: string;
    adminPinHash: string;
  }) => void;
}

export default function TeamSetupModal({ isOpen, onSave }: TeamSetupModalProps) {
  const [adminPin, setAdminPin] = useState('');
  const [team1, setTeam1] = useState({
    name: 'Equipo Local',
    color: '#FF0000',
    logo: '',
    sponsorLogo: '',
    players: [
      { id: 'gk1', name: 'Aida Agüero 🥅', number: '7', position: 'goalkeeper', selected: false },

      { id: 'p3', name: 'Miriam D’alesio', number: '3', position: 'player', selected: false },
      { id: 'p12', name: 'Victoria Acosta', number: '12', position: 'player', selected: false },
      { id: 'p16', name: 'Carmen Aragon', number: '16', position: 'player', selected: false },
      { id: 'p24', name: 'Maria Morales', number: '24', position: 'player', selected: false },
      { id: 'p34', name: 'Belen Largo', number: '34', position: 'player', selected: false },
      { id: 'p37', name: 'Sol Pastor', number: '37', position: 'player', selected: false },
      { id: 'p43', name: 'Olivia Balbarani', number: '43', position: 'player', selected: false },
      { id: 'p61', name: 'Sofia Rivas', number: '61', position: 'player', selected: false },
      { id: 'p17', name: 'Daniela Garcia', number: '17', position: 'player', selected: false },
      { id: 'p51', name: 'Aitana Alonso', number: '51', position: 'player', selected: false }
    ]
  });

  const [team2, setTeam2] = useState({
    name: 'Equipo Visitante',
    color: '#0000FF',
    logo: '',
    players: []
  });

  const fileInput1 = useRef<HTMLInputElement>(null);
  const fileInput2 = useRef<HTMLInputElement>(null);
  const sponsorInput = useRef<HTMLInputElement>(null);

  const handleLogoUpload = (team: 'team1' | 'team2', event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = e => {
      const data = e.target?.result as string;
      if (team === 'team1') setTeam1(prev => ({ ...prev, logo: data }));
      else setTeam2(prev => ({ ...prev, logo: data }));
    };
    reader.readAsDataURL(file);
  };

  const handleSponsorUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = e => {
      const logo = e.target?.result as string;
      setTeam1(prev => ({ ...prev, sponsorLogo: logo }));
    };
    reader.readAsDataURL(file);
  };

  // Hash PIN
  const hashPin = async (pin: string) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(pin);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  };

  const togglePlayer = (id: string) => {
    setTeam1(prev => ({
      ...prev,
      players: prev.players.map(p =>
        p.id === id ? { ...p, selected: !p.selected } : p
      )
    }));
  };

  const handleSave = async () => {
    if (!adminPin) {
      alert('Debes ingresar un PIN de administrador');
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
      <div className="bg-white rounded-2xl p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto">

        <h2 className="text-2xl font-bold text-gray-800 mb-6">Configurar Partido</h2>

        {/* PIN */}
        <div className="mb-6">
          <label className="block text-sm font-medium mb-1">PIN de Administrador</label>
          <input
            type="text"
            className="w-full p-2 border rounded"
            placeholder="Ej: 1234"
            value={adminPin}
            onChange={e => setAdminPin(e.target.value)}
          />
          <p className="text-xs text-gray-500 mt-1">Este PIN te permitirá entrar en modo administrador.</p>
        </div>

        {/* TEAM 1 */}
        <div className="mb-8 border p-4 rounded-xl bg-gray-50">
          <h3 className="text-xl font-semibold mb-3">Equipo Local</h3>

          <label className="text-sm block mb-1">Nombre</label>
          <input
            type="text"
            className="w-full p-2 border rounded mb-3"
            value={team1.name}
            onChange={e => setTeam1({ ...team1, name: e.target.value })}
          />

          <label className="text-sm block mb-1">Color</label>
          <input
            type="color"
            className="w-16 h-10 border rounded mb-3"
            value={team1.color}
            onChange={e => setTeam1({ ...team1, color: e.target.value })}
          />

          {/* Logo */}
          <div className="mb-6">
            <label className="text-sm block mb-1">Logo</label>
            <button
              onClick={() => fileInput1.current?.click()}
              className="w-full p-3 border rounded bg-white"
            >
              {team1.logo ? 'Cambiar Logo' : 'Subir Logo'}
            </button>
            <input ref={fileInput1} type="file" className="hidden" onChange={e => handleLogoUpload('team1', e)} />
            {team1.logo && <img src={team1.logo} className="w-24 mx-auto mt-2" />}
          </div>

          {/* Sponsor */}
          <label className="text-sm block mb-1">Sponsor</label>
          <button
            onClick={() => sponsorInput.current?.click()}
            className="w-full p-3 border rounded bg-white"
          >
            {team1.sponsorLogo ? 'Cambiar Sponsor' : 'Subir Sponsor'}
          </button>
          <input ref={sponsorInput} type="file" className="hidden" onChange={handleSponsorUpload} />
          {team1.sponsorLogo && <img src={team1.sponsorLogo} className="w-24 mx-auto mt-2" />}

          {/* Players */}
          <h4 className="font-semibold mt-6 mb-2">Jugadoras del Partido</h4>

          <div className="max-h-64 overflow-y-auto border rounded p-3 bg-white">
            {team1.players.map(p => (
              <label key={p.id} className="flex items-center gap-3 p-2 border-b last:border-none">
                <input
                  type="checkbox"
                  checked={p.selected}
                  onChange={() => togglePlayer(p.id)}
                />
                <span>{p.name} — #{p.number}</span>
              </label>
            ))}
          </div>
        </div>

        {/* TEAM 2 */}
        <div className="mb-8 border p-4 rounded-xl bg-gray-50">
          <h3 className="text-xl font-semibold mb-3">Equipo Visitante</h3>

          <label className="text-sm block mb-1">Nombre</label>
          <input
            type="text"
            className="w-full p-2 border rounded mb-3"
            value={team2.name}
            onChange={e => setTeam2({ ...team2, name: e.target.value })}
          />

          <label className="text-sm block mb-1">Color</label>
          <input
            type="color"
            className="w-16 h-10 border rounded mb-3"
            value={team2.color}
            onChange={e => setTeam2({ ...team2, color: e.target.value })}
          />

          {/* Logo */}
          <button
            onClick={() => fileInput2.current?.click()}
            className="w-full p-3 border rounded bg-white mb-3"
          >
            {team2.logo ? 'Cambiar Logo' : 'Subir Logo'}
          </button>
          <input ref={fileInput2} type="file" className="hidden" onChange={e => handleLogoUpload('team2', e)} />
          {team2.logo && <img src={team2.logo} className="w-24 mx-auto mt-2" />}
        </div>

        {/* SAVE BUTTON */}
        <button
          onClick={handleSave}
          className="w-full bg-green-600 text-white font-bold py-3 rounded-xl text-lg"
        >
          Iniciar Partido
        </button>
      </div>
    </div>
  );
}
