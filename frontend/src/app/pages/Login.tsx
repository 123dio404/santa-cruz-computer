import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { LogIn, UserPlus, Mail, Lock, ArrowLeft, CheckCircle, XCircle, Eye, EyeOff } from 'lucide-react';
import type { UserGender } from '../context/AuthContext';

type LoginView = 'login' | 'signup' | 'forgot-password' | 'reset-password';

export function Login() {
  const [view, setView] = useState<LoginView>('login');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();
  const { login, register, checkUsernameAvailable } = useAuth();

  // Login state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // Signup state
  const [signupData, setSignupData] = useState({
    name: '',
    lastName: '',
    username: '',
    email: '',
    gender: 'masculino' as UserGender,
    city: '',
    phone: '',
    birthDate: '',
  });
  const [signupPassword, setSignupPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Forgot password state
  const [forgotUsername, setForgotUsername] = useState('');

  // Reset password state
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!username || !password) {
      setError('Por favor completa todos los campos');
      return;
    }

    if (login(username, password)) {
      navigate('/dashboard');
    } else {
      setError('Usuario o contraseña incorrectos');
    }
  };

  const handleCheckUsername = (value: string) => {
    setSignupData({ ...signupData, username: value });
    if (value.trim()) {
      setUsernameAvailable(checkUsernameAvailable(value));
    } else {
      setUsernameAvailable(null);
    }
  };

  const handleSignup = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!signupData.name || !signupData.lastName || !signupData.username || !signupData.email || 
        !signupData.city || !signupData.phone || !signupData.birthDate || !signupPassword) {
      setError('Por favor completa todos los campos');
      return;
    }

    if (signupPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }

    if (!usernameAvailable) {
      setError('El usuario no está disponible');
      return;
    }

    const result = register(
      {
        ...signupData,
        role: 'client',
      },
      signupPassword
    );

    if (result.success) {
      setSuccess('¡Cuenta creada exitosamente! Redirigiendo...');
      setTimeout(() => navigate('/dashboard'), 2000);
    } else {
      setError(result.message);
    }
  };

  const handleForgotPassword = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!forgotUsername) {
      setError('Por favor ingresa tu usuario');
      return;
    }

    setSuccess('Se ha enviado un código de recuperación a tu correo registrado');
    setTimeout(() => setView('reset-password'), 2000);
  };

  const handleResetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!resetCode || !newPassword || !confirmNewPassword) {
      setError('Por favor completa todos los campos');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }

    setSuccess('¡Contraseña actualizada exitosamente! Redirigiendo...');
    setTimeout(() => {
      setView('login');
      setNewPassword('');
      setConfirmNewPassword('');
      setResetCode('');
    }, 2000);
  };

  const resetForm = () => {
    setError('');
    setSuccess('');
    setUsername('');
    setPassword('');
    setSignupData({
      name: '',
      lastName: '',
      username: '',
      email: '',
      gender: 'masculino',
      city: '',
      phone: '',
      birthDate: '',
    });
    setSignupPassword('');
    setConfirmPassword('');
    setUsernameAvailable(null);
    setForgotUsername('');
    setResetCode('');
    setNewPassword('');
    setConfirmNewPassword('');
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-gray-100 p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-full mb-4">
              <LogIn className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900">SantaCruz-Computer</h1>
            <p className="text-gray-600 mt-2">Sistema de Gestión</p>
          </div>

          {/* Login Form */}
          {view === 'login' && (
            <form onSubmit={handleLogin} className="space-y-6">
              <div>
                <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
                  Usuario
                </label>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Josecaficc2026"
                  required
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                  Contraseña
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="••••••••"
                  required
                />
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Iniciar sesión
              </button>

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => {
                    setView('signup');
                    resetForm();
                  }}
                  className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 transition-colors font-medium flex items-center justify-center gap-2"
                >
                  <UserPlus className="w-5 h-5" />
                  Crear Cuenta Nueva
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setView('forgot-password');
                    resetForm();
                  }}
                  className="w-full text-gray-600 hover:text-gray-700 text-sm"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
            </form>
          )}

          {/* Signup Form */}
          {view === 'signup' && (
            <form onSubmit={handleSignup} className="space-y-4 max-h-[75vh] overflow-y-auto">
              <button
                type="button"
                onClick={() => {
                  setView('login');
                  resetForm();
                }}
                className="flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm font-medium mb-4"
              >
                <ArrowLeft className="w-4 h-4" />
                Volver al inicio
              </button>

              <h2 className="text-lg font-semibold text-gray-900">Crear Nueva Cuenta</h2>

              {/* Nombre */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre
                </label>
                <input
                  type="text"
                  value={signupData.name}
                  onChange={(e) => setSignupData({ ...signupData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  placeholder="Juan"
                  required
                />
              </div>

              {/* Apellido */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Apellido
                </label>
                <input
                  type="text"
                  value={signupData.lastName}
                  onChange={(e) => setSignupData({ ...signupData, lastName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  placeholder="Pérez"
                  required
                />
              </div>

              {/* Usuario Único */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Usuario
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={signupData.username}
                    onChange={(e) => handleCheckUsername(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm pr-10"
                    placeholder="usuario_unico"
                    required
                  />
                  {usernameAvailable === true && (
                    <CheckCircle className="absolute right-3 top-2.5 w-5 h-5 text-green-500" />
                  )}
                  {usernameAvailable === false && (
                    <XCircle className="absolute right-3 top-2.5 w-5 h-5 text-red-500" />
                  )}
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Correo Electrónico
                </label>
                <input
                  type="email"
                  value={signupData.email}
                  onChange={(e) => setSignupData({ ...signupData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  placeholder="tu@correo.com"
                  required
                />
              </div>

              {/* Sexo */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sexo
                </label>
                <select
                  value={signupData.gender}
                  onChange={(e) => setSignupData({ ...signupData, gender: e.target.value as UserGender })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  required
                >
                  <option value="masculino">Masculino</option>
                  <option value="femenino">Femenino</option>
                  <option value="otro">Otro</option>
                </select>
              </div>

              {/* Ciudad */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ciudad
                </label>
                <input
                  type="text"
                  value={signupData.city}
                  onChange={(e) => setSignupData({ ...signupData, city: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  placeholder="Santa Cruz"
                  required
                />
              </div>

              {/* Teléfono */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Teléfono
                </label>
                <input
                  type="tel"
                  value={signupData.phone}
                  onChange={(e) => setSignupData({ ...signupData, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  placeholder="+591 123456789"
                  required
                />
              </div>

              {/* Fecha de Nacimiento */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fecha de Nacimiento
                </label>
                <input
                  type="date"
                  value={signupData.birthDate}
                  onChange={(e) => setSignupData({ ...signupData, birthDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  required
                />
              </div>

              {/* Contraseña */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contraseña
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm pr-10"
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-gray-500 hover:text-gray-700"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Confirmar Contraseña */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Confirmar Contraseña
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm pr-10"
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-2.5 text-gray-500 hover:text-gray-700"
                  >
                    {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {error}
                </div>
              )}

              {success && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
                  {success}
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setView('login');
                    resetForm();
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!usernameAvailable}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium text-sm"
                >
                  <UserPlus className="w-4 h-4 inline mr-2" />
                  Crear Cuenta
                </button>
              </div>
            </form>
          )}

          {/* Forgot Password Form */}
          {view === 'forgot-password' && (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <button
                type="button"
                onClick={() => {
                  setView('login');
                  resetForm();
                }}
                className="flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm font-medium mb-4"
              >
                <ArrowLeft className="w-4 h-4" />
                Volver al inicio
              </button>

              <div className="text-center mb-6">
                <h2 className="text-xl font-bold text-gray-900">Recuperar Contraseña</h2>
                <p className="text-sm text-gray-600 mt-2">
                  Ingresa tu usuario y te enviaremos un código de recuperación
                </p>
              </div>

              <div>
                <label htmlFor="forgot-username" className="block text-sm font-medium text-gray-700 mb-2">
                  Usuario
                </label>
                <input
                  id="forgot-username"
                  type="text"
                  value={forgotUsername}
                  onChange={(e) => setForgotUsername(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Josecaficc2026"
                  required
                />
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {error}
                </div>
              )}

              {success && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
                  {success}
                </div>
              )}

              <button
                type="submit"
                className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                <Mail className="w-4 h-4 inline mr-2" />
                Enviar Código
              </button>
            </form>
          )}

          {/* Reset Password Form */}
          {view === 'reset-password' && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <button
                type="button"
                onClick={() => {
                  setView('login');
                  resetForm();
                }}
                className="flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm font-medium mb-4"
              >
                <ArrowLeft className="w-4 h-4" />
                Volver al inicio
              </button>

              <div className="text-center mb-6">
                <h2 className="text-xl font-bold text-gray-900">Nueva Contraseña</h2>
                <p className="text-sm text-gray-600 mt-2">
                  Ingresa el código que recibiste y tu nueva contraseña
                </p>
              </div>

              <div>
                <label htmlFor="reset-code" className="block text-sm font-medium text-gray-700 mb-2">
                  Código de Recuperación
                </label>
                <input
                  id="reset-code"
                  type="text"
                  value={resetCode}
                  onChange={(e) => setResetCode(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  placeholder="ABC123"
                  required
                />
              </div>

              <div>
                <label htmlFor="new-password" className="block text-sm font-medium text-gray-700 mb-2">
                  Nueva Contraseña
                </label>
                <input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  placeholder="••••••••"
                  required
                />
              </div>

              <div>
                <label htmlFor="confirm-new-password" className="block text-sm font-medium text-gray-700 mb-2">
                  Confirmar Nueva Contraseña
                </label>
                <input
                  id="confirm-new-password"
                  type="password"
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  placeholder="••••••••"
                  required
                />
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {error}
                </div>
              )}

              {success && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
                  {success}
                </div>
              )}

              <button
                type="submit"
                className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
              >
                <Lock className="w-4 h-4 inline mr-2" />
                Actualizar Contraseña
              </button>
            </form>
          )}

          {/* Demo Users */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <p className="text-sm text-gray-600 mb-3 font-semibold">👤 Usuarios de prueba:</p>
            <div className="space-y-2 text-xs text-gray-500">
              <div className="flex justify-between bg-blue-50 p-2 rounded">
                <span className="font-medium">Admin:</span>
                <span>josecaficc2026 / 123456</span>
              </div>
              <div className="flex justify-between bg-gray-50 p-2 rounded">
                <span className="font-medium">Empleado:</span>
                <span>john_employee / 123456</span>
              </div>
              <div className="flex justify-between bg-gray-50 p-2 rounded">
                <span className="font-medium">Cliente:</span>
                <span>jane_customer / 123456</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
