import React, { useState } from 'react';
import { api } from '../utils/api';
import medicationHero from '../assets/medication_hero.png';

export default function Login({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Por favor complete todos los campos.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await api.auth.login(email, password);
      onLoginSuccess(response.user);
    } catch (err) {
      setError(err.message || 'Error al iniciar sesión. Verifique sus credenciales.');
    } finally {
      setLoading(false);
    }
  };

  const fillCredentials = (mail, pass) => {
    setEmail(mail);
    setPassword(pass);
  };

  return (
    <div className="min-h-screen bg-background text-on-surface flex items-center justify-center p-margin-mobile md:p-margin-desktop font-body-lg">
      <div className="bg-surface-container border border-outline-variant rounded-2xl w-full max-w-[960px] min-h-[580px] shadow-2xl flex overflow-hidden">
        
        {/* PANEL VISUAL (IZQUIERDA - SOLO DESKTOP) */}
        <div 
          className="hidden md:flex md:w-1/2 relative bg-cover bg-center p-xl flex-col justify-between overflow-hidden" 
          style={{ backgroundImage: `url(${medicationHero})` }}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-background/95 via-background/85 to-primary/30 z-10"></div>
          
          <div className="relative z-20 flex items-center gap-sm">
            <div className="w-9 h-9 bg-primary-container flex items-center justify-center rounded-lg">
              <span className="material-symbols-outlined text-on-primary-container text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>medical_services</span>
            </div>
            <span className="font-headline-md text-headline-md text-primary tracking-tight text-lg">Drogas CE</span>
          </div>

          <div className="relative z-20 space-y-md my-auto">
            <h2 className="text-display-lg font-display-lg text-white leading-tight">
              Gestión Digital de Kárdex y Recetas
            </h2>
            <p className="text-body-sm text-on-surface-variant leading-relaxed">
              El estándar moderno de seguridad, trazabilidad e inventario farmacéutico con registro atómico de egresos.
            </p>

            <div className="space-y-sm pt-4">
              
              <div className="flex gap-md items-start group">
                <div className="w-8 h-8 rounded-lg bg-surface-variant/30 flex items-center justify-center text-primary border border-outline-variant group-hover:bg-primary group-hover:text-on-primary transition-all">
                  <span className="material-symbols-outlined text-sm">edit_document</span>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white">Captura de Recetas Físicas</h4>
                  <p className="text-xs text-on-surface-variant mt-0.5">Digitalización y validación inmediata en ventanilla.</p>
                </div>
              </div>

              <div className="flex gap-md items-start group">
                <div className="w-8 h-8 rounded-lg bg-surface-variant/30 flex items-center justify-center text-primary border border-outline-variant group-hover:bg-primary group-hover:text-on-primary transition-all">
                  <span className="material-symbols-outlined text-sm">warning</span>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white">Prevención de Quiebres</h4>
                  <p className="text-xs text-on-surface-variant mt-0.5">Control estricto de existencias mínimas de seguridad.</p>
                </div>
              </div>

              <div className="flex gap-md items-start group">
                <div className="w-8 h-8 rounded-lg bg-surface-variant/30 flex items-center justify-center text-primary border border-outline-variant group-hover:bg-primary group-hover:text-on-primary transition-all">
                  <span className="material-symbols-outlined text-sm">analytics</span>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white">Bitácora Oficial Kárdex</h4>
                  <p className="text-xs text-on-surface-variant mt-0.5">Registro cronológico de entradas y salidas listo para imprimir.</p>
                </div>
              </div>

            </div>
          </div>

          <div className="relative z-20 text-[10px] text-on-surface-variant font-medium tracking-wider uppercase border-t border-outline-variant/30 pt-md mt-lg">
            © 2026 Drogas CE | PharmOps Pro Terminal 08-24
          </div>
        </div>

        {/* PANEL DE FORMULARIO (DERECHA) */}
        <div className="w-full md:w-1/2 p-md md:p-xl flex flex-col justify-center bg-surface-container-low">
          
          {/* Cabecera Móvil */}
          <div className="flex flex-col items-center text-center md:hidden mb-lg">
            <div className="w-12 h-12 bg-primary-container flex items-center justify-center rounded-xl mb-sm shadow-md">
              <span className="material-symbols-outlined text-on-primary-container text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>medical_services</span>
            </div>
            <h1 className="font-display-lg text-display-lg text-primary tracking-tight">Drogas CE</h1>
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">Inventario de Medicamentos</p>
          </div>

          {/* Cabecera Desktop */}
          <div className="hidden md:block mb-xl">
            <h2 className="text-2xl font-bold text-on-surface font-headline-md tracking-tight">Iniciar Sesión</h2>
            <p className="text-sm text-on-surface-variant mt-1">Ingrese sus credenciales farmacéuticas autorizadas.</p>
          </div>

          {error && (
            <div className="bg-error-container/20 border border-error text-error p-sm rounded-lg flex items-center gap-xs text-xs mb-md">
              <span className="material-symbols-outlined text-sm">warning</span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-md">
            
            <div className="flex flex-col gap-xs">
              <label className="text-xs font-semibold text-on-surface-variant">Usuario Farmacéutico</label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-base">person</span>
                <input
                  type="email"
                  required
                  className="w-full bg-surface-variant border-none rounded-lg pl-10 pr-4 py-2.5 text-on-surface placeholder:text-on-surface-variant focus:ring-1 focus:ring-primary text-sm focus:outline-none"
                  placeholder="Ej. usuario@hospital.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>

            <div className="flex flex-col gap-xs">
              <label className="text-xs font-semibold text-on-surface-variant">Contraseña de Almacén</label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-base">lock</span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  className="w-full bg-surface-variant border-none rounded-lg pl-10 pr-4 py-2.5 text-on-surface placeholder:text-on-surface-variant focus:ring-1 focus:ring-primary text-sm focus:outline-none"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div className="flex items-center gap-sm mt-xs">
                <input
                  id="show-password"
                  type="checkbox"
                  className="w-4 h-4 bg-surface-variant border-none rounded text-primary focus:ring-0 cursor-pointer"
                  checked={showPassword}
                  onChange={(e) => setShowPassword(e.target.checked)}
                />
                <label htmlFor="show-password" className="text-xs text-on-surface-variant font-medium cursor-pointer select-none">
                  Mostrar Contraseña
                </label>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded bg-primary text-on-primary font-label-caps text-label-caps text-sm hover:brightness-110 transition-all flex items-center justify-center font-bold tracking-wider"
            >
              {loading ? 'Accediendo al Kárdex...' : 'Ingresar al Kárdex'}
            </button>

          </form>

          {/* Accesos rápidos */}
          <div className="mt-xl border-t border-outline-variant/60 pt-md">
            <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-sm">Accesos de prueba (usa correo de Supabase):</p>
            <div className="space-y-xs">
              <button
                onClick={() => fillCredentials('admin@drogasce.local', 'admin123')}
                disabled={loading}
                className="w-full flex justify-between items-center px-sm py-2 rounded-lg bg-surface-variant border border-outline-variant text-xs text-on-surface hover:border-primary hover:text-primary transition-all focus:outline-none"
              >
                <span className="font-semibold flex items-center gap-xs">💻 Administrador</span>
                <code className="bg-background/40 px-xs py-0.5 rounded text-[10px]">admin@drogasce.local / admin123</code>
              </button>
              <button
                onClick={() => fillCredentials('farma@drogasce.local', 'farma123')}
                disabled={loading}
                className="w-full flex justify-between items-center px-sm py-2 rounded-lg bg-surface-variant border border-outline-variant text-xs text-on-surface hover:border-primary hover:text-primary transition-all focus:outline-none"
              >
                <span className="font-semibold flex items-center gap-xs">💊 Farmacéutico</span>
                <code className="bg-background/40 px-xs py-0.5 rounded text-[10px]">farma@drogasce.local / farma123</code>
              </button>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}




