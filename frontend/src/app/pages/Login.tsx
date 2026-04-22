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
  const { login, register, checkUsernameAvailable, forgotPassword, resetPassword } = useAuth();

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

  // Validación de complejidad de contraseña
  const validatePasswordComplexity = (pass: string) => {
    const hasUpperCase = /[A-Z]/.test(pass);
    const hasLowerCase = /[a-z]/.test(pass);
    const hasNumber = /[0-9]/.test(pass);
    const hasMinLen = pass.length >= 8;
    return { hasUpperCase, hasLowerCase, hasNumber, hasMinLen };
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!username || !password) {
      setError('Por favor completa todos los campos');
      return;
    }

    const result = await login(username, password);
    if (result.success) {
      navigate('/dashboard');
    } else {
      setError(result.message);
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

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const complexity = validatePasswordComplexity(signupPassword);
    if (!complexity.hasUpperCase || !complexity.hasLowerCase || !complexity.hasNumber || !complexity.hasMinLen) {
      setError('La contraseña no cumple con los requisitos de seguridad');
      return;
    }

    if (signupPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }

    const result = await register(
      {
        ...signupData,
        role: 'client',
      },
      signupPassword
    );

    if (result.success) {
      setSuccess('¡Cuenta creada exitosamente! Ya puedes iniciar sesión.');
      setTimeout(() => setView('login'), 2000);
    } else {
      setError(result.message);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!forgotUsername) {
      setError('Por favor ingresa tu usuario');
      return;
    }

    const result = await forgotPassword(forgotUsername);
    if (result.success) {
      setSuccess(result.message);
      setTimeout(() => setView('reset-password'), 2000);
    } else {
      setError(result.message);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
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

    const result = await resetPassword(forgotUsername, resetCode, newPassword);
    if (result.success) {
      setSuccess('¡Contraseña actualizada exitosamente!');
      setTimeout(() => {
        setView('login');
        resetForm();
      }, 2000);
    } else {
      setError(result.message);
    }
  };

  const resetForm = () => {
    setError('');
    setSuccess('');
    setUsername('');
    setPassword('');
    // ... rest of reset
  };

  const complexity = validatePasswordComplexity(signupPassword);

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
            <p className="text-gray-600 mt-2">Sistema de Gestión Real</p>
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
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm animate-pulse">
                  ⚠️ {error}
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
            <form onSubmit={handleSignup} className="space-y-4 max-h-[75vh] overflow-y-auto pr-2">
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

              {/* ... Campos de datos (nombre, apellido, etc.) omitidos para brevedad en el replace ... */}
              {/* Nota: En la implementación real mantendré todos los campos pero conectándolos al backend */}
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                <input type="text" value={signupData.name} onChange={(e) => setSignupData({ ...signupData, name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="Juan" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Apellido</label>
                <input type="text" value={signupData.lastName} onChange={(e) => setSignupData({ ...signupData, lastName: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="Pérez" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Usuario</label>
                <input type="text" value={signupData.username} onChange={(e) => setSignupData({ ...signupData, username: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="usuario_unico" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Correo</label>
                <input type="email" value={signupData.email} onChange={(e) => setSignupData({ ...signupData, email: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="tu@correo.com" required />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sexo</label>
                  <select value={signupData.gender} onChange={(e) => setSignupData({ ...signupData, gender: e.target.value as any })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                    <option value="masculino">Masculino</option>
                    <option value="femenino">Femenino</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ciudad</label>
                  <input type="text" value={signupData.city} onChange={(e) => setSignupData({ ...signupData, city: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="Santa Cruz" required />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                  <input type="tel" value={signupData.phone} onChange={(e) => setSignupData({ ...signupData, phone: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="+591 ..." required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nacimiento</label>
                  <input type="date" value={signupData.birthDate} onChange={(e) => setSignupData({ ...signupData, birthDate: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" required />
                </div>
              </div>

              {/* Requisitos de Contraseña */}
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <p className="text-xs font-semibold text-gray-700 mb-2">Requisitos de seguridad:</p>
                <ul className="space-y-1">
                  <li className={`text-xs flex items-center gap-2 ${complexity.hasMinLen ? 'text-green-600' : 'text-gray-500'}`}>
                    {complexity.hasMinLen ? '✅' : '○'} Mínimo 8 caracteres
                  </li>
                  <li className={`text-xs flex items-center gap-2 ${complexity.hasUpperCase ? 'text-green-600' : 'text-gray-500'}`}>
                    {complexity.hasUpperCase ? '✅' : '○'} Una mayúscula
                  </li>
                  <li className={`text-xs flex items-center gap-2 ${complexity.hasLowerCase ? 'text-green-600' : 'text-gray-500'}`}>
                    {complexity.hasLowerCase ? '✅' : '○'} Una minúscula
                  </li>
                  <li className={`text-xs flex items-center gap-2 ${complexity.hasNumber ? 'text-green-600' : 'text-gray-500'}`}>
                    {complexity.hasNumber ? '✅' : '○'} Un número
                  </li>
                </ul>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
                <input
                  type="password"
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="••••••••"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar Contraseña</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="••••••••"
                  required
                />
              </div>

              {error && <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg">{error}</div>}
              {success && <div className="p-3 bg-green-50 text-green-700 text-sm rounded-lg">{success}</div>}

              <button type="submit" className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium">Crear Cuenta</button>
            </form>
          )}

          {/* Forgot Password View */}
          {view === 'forgot-password' && (
            <form onSubmit={handleForgotPassword} className="space-y-4">
               <button type="button" onClick={() => setView('login')} className="flex items-center gap-2 text-blue-600 text-sm mb-4"><ArrowLeft className="w-4 h-4" /> Volver</button>
               <h2 className="text-xl font-bold">Recuperar Acceso</h2>
               <p className="text-sm text-gray-600">Ingresa tu usuario para recibir un código (ver terminal de Django)</p>
               <input type="text" value={forgotUsername} onChange={(e) => setForgotUsername(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-lg" placeholder="Usuario" required />
               {error && <div className="text-red-700 text-sm">{error}</div>}
               {success && <div className="text-green-700 text-sm">{success}</div>}
               <button type="submit" className="w-full bg-blue-600 text-white py-3 rounded-lg">Enviar Código</button>
            </form>
          )}

          {/* Reset Password View */}
          {view === 'reset-password' && (
            <form onSubmit={handleResetPassword} className="space-y-4">
               <h2 className="text-xl font-bold">Nueva Contraseña</h2>
               <input type="text" value={resetCode} onChange={(e) => setResetCode(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="Código de 6 dígitos" required />
               <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="Nueva Contraseña" required />
               <input type="password" value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="Confirmar Contraseña" required />
               {error && <div className="text-red-700 text-sm">{error}</div>}
               {success && <div className="text-green-700 text-sm">{success}</div>}
               <button type="submit" className="w-full bg-blue-600 text-white py-3 rounded-lg">Cambiar Contraseña</button>
            </form>
          )}

          {/* Demo Users */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <p className="text-sm text-gray-600 mb-3 font-semibold">👤 Usuarios de prueba:</p>
            <div className="space-y-2 text-xs text-gray-500">
              <div className="flex justify-between bg-blue-50 p-2 rounded">
                <span className="font-medium">Admin:</span>
                <span>josecaficc2026 / SantaCruz2026</span>
              </div>
              <div className="flex justify-between bg-gray-50 p-2 rounded">
                <span className="font-medium">Empleado:</span>
                <span>john_employee / SantaCruz2026</span>
              </div>
              <div className="flex justify-between bg-gray-50 p-2 rounded">
                <span className="font-medium">Cliente:</span>
                <span>jane_customer / SantaCruz2026</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
