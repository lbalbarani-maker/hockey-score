// src/app/components/TeamSetupModal.tsx
'use client';

import { useState, useRef } from 'react';

interface TeamSetupModalProps {
  isOpen: boolean;
  onSave: (teams: { team1: any; team2: any }) => void;
}

export default function TeamSetupModal({ isOpen, onSave }: TeamSetupModalProps) {
  const [team1, setTeam1] = useState({
    name: 'Equipo Local',
    color: '#FF0000',
    logo: '',
    sponsorLogo: ''
  });
  
  const [team2, setTeam2] = useState({
    name: 'Equipo Visitante',
    color: '#0000FF',
    logo: '',
    sponsorLogo: ''
  });

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

  const handleSave = () => {
    onSave({
      team1,
      team2
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">Configurar Equipos</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Equipo 1 */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-700">Equipo 1</h3>
            
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
                  <img 
                    src={team1.logo} 
                    alt="Logo equipo 1" 
                    className="w-20 h-20 object-contain mx-auto"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Equipo 2 */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-700">Equipo 2</h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                Nombre del equipo
              </label>
              <input
                type="text"
                value={team2.name}
                onChange={(e) => setTeam2(prev => ({ ...prev, name: e.target.value }))}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              <label className="block text-sm font-medium text-gray-600 mb-1">
                Logo del equipo
              </label>
              <input
                type="file"
                ref={fileInput2}
                onChange={(e) => handleLogoUpload('team2', e)}
                accept="image/*"
                className="hidden"
              />
              <button
                onClick={() => fileInput2.current?.click()}
                className="w-full p-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-gray-400 transition-colors text-gray-600"
              >
                {team2.logo ? '✅ Logo cargado' : '📁 Subir logo'}
              </button>
              {team2.logo && (
                <div className="mt-2">
                  <img 
                    src={team2.logo} 
                    alt="Logo equipo 2" 
                    className="w-20 h-20 object-contain mx-auto"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Logo de Sponsor */}
        <div className="border-t pt-6 mt-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">🏢 Logo de Sponsor (Opcional)</h3>
          
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-2">
              Logo que aparecerá en la vista de espectadores
            </label>
            <input
              type="file"
              ref={sponsorInput}
              onChange={handleSponsorUpload}
              accept="image/*"
              className="hidden"
              id="sponsor-logo"
            />
            <label
              htmlFor="sponsor-logo"
              className="w-full p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-gray-400 transition-colors text-gray-600 cursor-pointer block text-center"
            >
              {team1.sponsorLogo ? '✅ Logo de sponsor cargado' : '🏢 Subir logo de sponsor'}
            </label>
            {team1.sponsorLogo && (
              <div className="mt-3 text-center">
                <p className="text-sm text-gray-600 mb-2">Vista previa:</p>
                <img 
                  src={team1.sponsorLogo} 
                  alt="Logo sponsor" 
                  className="w-32 h-16 object-contain mx-auto border rounded-lg"
                />
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-3 mt-8">
          <button
            onClick={handleSave}
            className="flex-1 bg-green-500 hover:bg-green-600 text-white font-bold py-3 rounded-lg transition-all"
          >
            🏁 Iniciar Partido
          </button>
        </div>
      </div>
    </div>
  );
}