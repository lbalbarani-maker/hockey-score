// src/app/page.tsx
'use client';

import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  const createNewMatch = () => {
    // Generar ID único para el partido
    const matchId = Math.random().toString(36).substring(2, 8).toUpperCase();
    router.push(`/match/${matchId}?admin=true`);
  };

  const joinExistingMatch = () => {
    const matchId = prompt('Ingresa el código del partido:');
    if (matchId) {
      // Siempre como admin
      router.push(`/match/${matchId}?admin=true`);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-purple-900 flex flex-col items-center justify-center p-8">
      <div className="text-center mb-12">
        <h1 className="text-6xl font-bold text-white mb-4">🏑 Hockey Score</h1>
        <p className="text-xl text-gray-300">Marcador en tiempo real para hockey hierba</p>
      </div>

      <div className="bg-gray-500/90 backdrop-blur-lg rounded-2xl p-8 border border-white/20 max-w-md w-full">
        <h2 className="text-2xl font-bold text-white text-center mb-8">Administrar Partido</h2>
        
        <button
          onClick={createNewMatch}
          className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-4 px-6 rounded-xl text-lg mb-4 transition-all duration-200 transform hover:scale-105"
        >
          🆕 Crear Nuevo Partido
        </button>

        <button
          onClick={joinExistingMatch}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-4 px-6 rounded-xl text-lg transition-all duration-200 transform hover:scale-105"
        >
          🔗 Entrar a Partido Existente
        </button>
      </div>

      <div className="mt-8 text-center text-gray-400">
        <p>Modo administrador - Control total del partido</p>
      </div>
    </div>
  );
}