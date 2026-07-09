/**
 * Login.tsx - Página de Autenticación
 *
 * Maneja todas las vistas relacionadas con el acceso al sistema.
 * Usa un estado 'view' para cambiar entre formularios sin cambiar de ruta.
 *
 * VISTAS (controladas por el estado 'view'):
 * - 'login':          Formulario de inicio de sesión con usuario y contraseña
 * - 'signup':         Registro de nuevos clientes (rol: client)
 * - 'forgot-password': Ingresar email/usuario para solicitar código OTP
 * - 'reset-password': Ingresar el código OTP recibido + nueva contraseña
 *
 * VALIDACIONES EN REGISTRO:
 * - Verificación en tiempo real de usuario disponible (contra AuthContext)
 * - Verificación de email con debounce de 500ms (contra el backend)
 * - Barra de fortaleza de contraseña (débil → muy fuerte)
 * - Requisitos de contraseña: 8 chars, mayúscula, minúscula, número
 *
 * RECUPERACIÓN DE CONTRASEÑA:
 * - Se envía un código OTP de 6 caracteres (letras mayúsculas + números) por email
 * - El código se genera y guarda en memoria del backend (_otps dict)
 * - Funciona tanto para usuarios (tabla usuario) como clientes (tabla cliente)
 */
import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { useAudit } from '../context/AuditContext';
import { authAPI } from '../services/api';
import { useRef } from 'react';
import { LogIn, UserPlus, Mail, Lock, ArrowLeft, CheckCircle, XCircle, Eye, EyeOff } from 'lucide-react';
import { validatePassword, getPasswordStrengthColor, getPasswordStrengthText } from '../utils/passwordValidation';
import type { UserGender } from '../context/AuthContext';

type LoginView = 'login' | 'signup' | 'forgot-password' | 'reset-password';

export function Login() {
  const [view, setView] = useState<LoginView>('login');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, register, checkUsernameAvailable } = useAuth();
  const { addEvent } = useAudit();

  // Aviso cuando la sesión se cerró sola (token caducado o 30 min de inactividad).
  useEffect(() => {
    if (searchParams.get('expired')) {
      setError('🔒 Tu sesión expiró por seguridad. Inicia sesión de nuevo.');
    } else if (searchParams.get('idle')) {
      setError('🔒 Cerramos tu sesión por inactividad. Inicia sesión de nuevo.');
    }
  }, [searchParams]);

  // Login state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // Signup state
  const [signupData, setSignupData] = useState({
    name: '', lastName: '', username: '', email: '',
    gender: 'masculino' as UserGender,
    city: '', phone: '', birthDate: '',
    nit_ci: '', razon_social: '',
  });
  const [signupPassword, setSignupPassword]             = useState('');
  const [confirmPassword, setConfirmPassword]           = useState('');
  const [usernameAvailable, setUsernameAvailable]       = useState<boolean | null>(null);
  const [emailAvailable, setEmailAvailable]             = useState<boolean | null>(null);
  const [checkingEmail, setCheckingEmail]               = useState(false);
  const emailDebounceRef                                = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showLoginPassword, setShowLoginPassword]       = useState(false);
  const [showPassword, setShowPassword]                 = useState(false);
  const [showConfirmPassword, setShowConfirmPassword]   = useState(false);

  // Forgot password state
  const [forgotIdentifier, setForgotIdentifier] = useState('');
  const [sendingOtp, setSendingOtp] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);

  // Reset password state
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  // Loading state for async registration
  const [registering, setRegistering] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!username || !password) {
      setError('Por favor completa todos los campos');
      return;
    }

    // Backend es la única fuente de verdad — no hay verificación local de contraseña
    const result = await login(username, password);

    if (result.success && result.loggedInUser) {
      const { loggedInUser } = result;
      addEvent({
        timestamp: new Date(),
        eventType: 'login',
        userId: loggedInUser.id,
        userName: loggedInUser.name,
        userRole: loggedInUser.role,
        description: `${loggedInUser.name} (${loggedInUser.role}) inició sesión en el sistema`,
        details: { ipAddress: 'APP-CLIENT' }
      });

      setSuccess('✅ ' + result.message);
      const role = loggedInUser.role;
      const redirectPath = role === 'admin' ? '/dashboard' : role === 'employee' ? '/inventory' : role === 'tecnico' ? '/mis-trabajos' : '/store';
      // Si vino desde un enlace protegido (?next=/...), volver ahí; si no, al inicio por rol.
      // Solo se acepta una ruta interna (evita redirecciones externas).
      const nextParam = searchParams.get('next');
      const destino = nextParam && nextParam.startsWith('/') && !nextParam.startsWith('//')
        ? nextParam
        : redirectPath;
      setTimeout(() => navigate(destino), 800);
    } else {
      setError(result.message);
    }
  };

  // Verifica si el nombre de usuario ya existe (en tiempo real, contra AuthContext local)
  const handleCheckUsername = (value: string) => {
    setSignupData({ ...signupData, username: value });
    if (value.trim()) {
      setUsernameAvailable(checkUsernameAvailable(value));
    } else {
      setUsernameAvailable(null);
    }
  };

  // Verifica si el email ya está registrado (con debounce de 500ms para no llamar en cada tecla)
  const handleCheckEmail = (value: string) => {
    setSignupData({ ...signupData, email: value });
    setEmailAvailable(null);

    if (emailDebounceRef.current) clearTimeout(emailDebounceRef.current);

    if (!value.trim()) return;

    emailDebounceRef.current = setTimeout(async () => {
      setCheckingEmail(true);
      try {
        const res = await authAPI.checkEmail(value.trim());
        setEmailAvailable(res.available);
      } catch {
        setEmailAvailable(null);
      } finally {
        setCheckingEmail(false);
      }
    }, 500);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!signupData.name || !signupData.lastName || !signupData.username || !signupData.email ||
        !signupData.city || !signupData.phone || !signupData.birthDate || !signupPassword) {
      setError('Por favor completa todos los campos');
      return;
    }

    const passwordValidation = validatePassword(signupPassword);
    if (!passwordValidation.isValid) {
      setError(`❌ Contraseña débil. ${passwordValidation.message}`);
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

    if (emailAvailable === false) {
      setError('El correo electrónico ya está registrado');
      return;
    }

    setRegistering(true);
    const result = await register({ ...signupData, role: 'client' } as any, signupPassword);
    setRegistering(false);

    if (result.success) {
      setSuccess('¡Cuenta creada exitosamente! Redirigiendo...');
      setTimeout(() => navigate('/store'), 2000);
    } else {
      setError(result.message);
    }
  };

  // Solicita el envío del código OTP al correo registrado del usuario/cliente
  // Siempre muestra mensaje genérico para no revelar si el usuario existe (seguridad)
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!forgotIdentifier) {
      setError('Por favor ingresa tu correo electrónico');
      return;
    }

    setSendingOtp(true);
    try {
      const data = await authAPI.forgotPassword(forgotIdentifier);
      setSuccess(data.message);
      setTimeout(() => setView('reset-password'), 2000);
    } catch (err) {
      // Mensaje genérico por seguridad (no revelar si el usuario existe)
      setSuccess('Si los datos son correctos, recibirás un código en tu correo.');
      setTimeout(() => setView('reset-password'), 2000);
    } finally {
      setSendingOtp(false);
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

    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.isValid) {
      setError(`❌ Contraseña débil. ${passwordValidation.message}`);
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }

    setResettingPassword(true);
    try {
      const data = await authAPI.resetPassword(forgotIdentifier, resetCode, newPassword);
      setSuccess(`✅ ${data.message} Redirigiendo...`);
      setTimeout(() => {
        setView('login');
        setNewPassword('');
        setConfirmNewPassword('');
        setResetCode('');
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Código inválido o expirado.');
    } finally {
      setResettingPassword(false);
    }
  };

  const resetForm = () => {
    setError('');
    setSuccess('');
    setUsername('');
    setPassword('');
    setSignupData({
      name: '', lastName: '', username: '', email: '',
      gender: 'masculino', city: '', phone: '', birthDate: '',
      nit_ci: '', razon_social: '',
    });
    setSignupPassword('');
    setConfirmPassword('');
    setUsernameAvailable(null);
    setEmailAvailable(null);
    setForgotIdentifier('');
    setResetCode('');
    setNewPassword('');
    setConfirmNewPassword('');
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-gray-100 p-4">
      <div className="w-full max-w-md">
        {/* Volver al inicio (landing pública) — visible siempre arriba del card */}
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-blue-700 hover:text-blue-900 mb-3 font-medium">
          <ArrowLeft className="w-4 h-4" /> Volver al inicio
        </Link>
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center mb-4">
              <img src="/logo.png" alt="SantaCruz Computer" className="h-48 w-auto object-contain" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900">SantaCruzComputer</h1>
            <p className="text-gray-600 mt-2">Sistema de Gestión</p>
          </div>

          {/* Login Form */}
          {view === 'login' && (
            <form onSubmit={handleLogin} className="space-y-6">
              <div>
                <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre de Usuario
                </label>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Usuario"
                  autoComplete="username"
                  required
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                  Contraseña
                </label>
                <div className="relative">
                <input
                  id="password"
                  type={showLoginPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  tabIndex={-1}
                >
                  {showLoginPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
                </div>
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
                  className="w-full bg-navy-800 text-white py-3 rounded-lg transition-colors font-medium flex items-center justify-center gap-2" style={{backgroundColor:'#1e3a5f'}} onMouseEnter={e=>(e.currentTarget.style.backgroundColor='#162d4a')} onMouseLeave={e=>(e.currentTarget.style.backgroundColor='#1e3a5f')}
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
                    placeholder="Juan123"
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
                <div className="relative">
                  <input
                    type="email"
                    value={signupData.email}
                    onChange={(e) => handleCheckEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm pr-10"
                    placeholder="JuanPerez123@gmail.com"
                    required
                  />
                  {checkingEmail && (
                    <div className="absolute right-3 top-2.5 w-5 h-5 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
                  )}
                  {!checkingEmail && emailAvailable === true && (
                    <CheckCircle className="absolute right-3 top-2.5 w-5 h-5 text-green-500" />
                  )}
                  {!checkingEmail && emailAvailable === false && (
                    <XCircle className="absolute right-3 top-2.5 w-5 h-5 text-red-500" />
                  )}
                </div>
                {emailAvailable === false && (
                  <p className="text-xs text-red-500 mt-1">Este correo ya está registrado</p>
                )}
              </div>

              {/* NIT / CI */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  NIT / CI <span className="text-gray-400 font-normal">(opcional)</span>
                </label>
                <input
                  type="text"
                  value={signupData.nit_ci}
                  onChange={(e) => setSignupData({ ...signupData, nit_ci: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  placeholder="12345678"
                />
              </div>

              {/* Razón Social */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Razón Social <span className="text-gray-400 font-normal">(opcional)</span>
                </label>
                <input
                  type="text"
                  value={signupData.razon_social}
                  onChange={(e) => setSignupData({ ...signupData, razon_social: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  placeholder="Empresa S.R.L."
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
                  placeholder="Santa Cruz de la Sierra"
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
                <div className="relative mb-2">
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
                
                {/* Mostrar validación de contraseña */}
                {signupPassword && (
                  <div className="space-y-2">
                    {/* Barra de fortaleza */}
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((i) => {
                        const validation = validatePassword(signupPassword);
                        const strength = ['weak', 'medium', 'strong', 'very-strong'];
                        const levelNum = ['weak', 'weak', 'medium', 'strong', 'very-strong'].indexOf(validation.strength) + 1;
                        const colors = ['bg-red-500', 'bg-yellow-500', 'bg-blue-500', 'bg-green-500'];
                        const color = i <= levelNum ? colors[Math.min(levelNum - 1, 3)] : 'bg-gray-200';
                        return <div key={i} className={`h-1 flex-1 ${color} rounded`} />;
                      })}
                    </div>
                    
                    {/* Mensaje de fortaleza */}
                    {(() => {
                      const validation = validatePassword(signupPassword);
                      return (
                        <div className="text-xs">
                          <p className="text-gray-600">
                            Fortaleza: <span className="font-semibold">{getPasswordStrengthText(validation.strength)}</span>
                          </p>
                          <p className={validation.isValid ? 'text-green-600' : 'text-red-600'}>
                            {validation.message}
                          </p>
                        </div>
                      );
                    })()}
                    
                    {/* Requisitos */}
                    {(() => {
                      const validation = validatePassword(signupPassword);
                      return (
                        <div className="bg-gray-50 p-2 rounded text-xs space-y-1">
                          <p className="font-semibold text-gray-700">Requisitos:</p>
                          <div className="space-y-1">
                            <div className={`flex items-center gap-2 ${validation.requirements.minLength ? 'text-green-600' : 'text-gray-600'}`}>
                              {validation.requirements.minLength ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                              <span>Mínimo 8 caracteres</span>
                            </div>
                            <div className={`flex items-center gap-2 ${validation.requirements.hasUpperCase ? 'text-green-600' : 'text-gray-600'}`}>
                              {validation.requirements.hasUpperCase ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                              <span>Una letra mayúscula (A-Z)</span>
                            </div>
                            <div className={`flex items-center gap-2 ${validation.requirements.hasLowerCase ? 'text-green-600' : 'text-gray-600'}`}>
                              {validation.requirements.hasLowerCase ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                              <span>Una letra minúscula (a-z)</span>
                            </div>
                            <div className={`flex items-center gap-2 ${validation.requirements.hasNumber ? 'text-green-600' : 'text-gray-600'}`}>
                              {validation.requirements.hasNumber ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                              <span>Un número (0-9)</span>
                            </div>
                            <div className={`flex items-center gap-2 ${validation.requirements.hasSpecialChar ? 'text-green-600' : 'text-gray-600'}`}>
                              {validation.requirements.hasSpecialChar ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                              <span>Un carácter especial (ej. ! @ # $ % &amp; * ? - _)</span>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
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
                  disabled={!usernameAvailable || emailAvailable === false || checkingEmail || registering}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium text-sm"
                >
                  <UserPlus className="w-4 h-4 inline mr-2" />
                  {registering ? 'Creando cuenta...' : 'Crear Cuenta'}
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
                  Ingresa tu correo electrónico y enviaremos un código a tu correo registrado
                </p>
              </div>

              <div>
                <label htmlFor="forgot-identifier" className="block text-sm font-medium text-gray-700 mb-2">
                  Correo electrónico
                </label>
                <input
                  id="forgot-identifier"
                  type="email"
                  value={forgotIdentifier}
                  onChange={(e) => setForgotIdentifier(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="JuanPerez123@gmail.com"
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
                disabled={sendingOtp}
                className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50"
              >
                <Mail className="w-4 h-4 inline mr-2" />
                {sendingOtp ? 'Enviando...' : 'Enviar Código'}
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
                  placeholder="Dígitos"
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
                
                {/* Mostrar validación de contraseña */}
                {newPassword && (
                  <div className="space-y-2 mt-2">
                    {/* Barra de fortaleza */}
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((i) => {
                        const validation = validatePassword(newPassword);
                        const levelNum = ['weak', 'weak', 'medium', 'strong', 'very-strong'].indexOf(validation.strength) + 1;
                        const colors = ['bg-red-500', 'bg-yellow-500', 'bg-blue-500', 'bg-green-500'];
                        const color = i <= levelNum ? colors[Math.min(levelNum - 1, 3)] : 'bg-gray-200';
                        return <div key={i} className={`h-1 flex-1 ${color} rounded`} />;
                      })}
                    </div>
                    
                    {/* Requisitos */}
                    {(() => {
                      const validation = validatePassword(newPassword);
                      return (
                        <div className="bg-gray-50 p-2 rounded text-xs space-y-1">
                          <div className={`flex items-center gap-2 ${validation.requirements.minLength ? 'text-green-600' : 'text-gray-600'}`}>
                            {validation.requirements.minLength ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                            <span>Mínimo 8 caracteres</span>
                          </div>
                          <div className={`flex items-center gap-2 ${validation.requirements.hasUpperCase ? 'text-green-600' : 'text-gray-600'}`}>
                            {validation.requirements.hasUpperCase ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                            <span>Una letra mayúscula (A-Z)</span>
                          </div>
                          <div className={`flex items-center gap-2 ${validation.requirements.hasLowerCase ? 'text-green-600' : 'text-gray-600'}`}>
                            {validation.requirements.hasLowerCase ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                            <span>Una letra minúscula (a-z)</span>
                          </div>
                          <div className={`flex items-center gap-2 ${validation.requirements.hasNumber ? 'text-green-600' : 'text-gray-600'}`}>
                            {validation.requirements.hasNumber ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                            <span>Un número (0-9)</span>
                          </div>
                          <div className={`flex items-center gap-2 ${validation.requirements.hasSpecialChar ? 'text-green-600' : 'text-gray-600'}`}>
                            {validation.requirements.hasSpecialChar ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                            <span>Un carácter especial (ej. ! @ # $ % &amp; * ? - _)</span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
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
                disabled={resettingPassword}
                className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm disabled:opacity-50"
              >
                <Lock className="w-4 h-4 inline mr-2" />
                {resettingPassword ? 'Actualizando...' : 'Actualizar Contraseña'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
