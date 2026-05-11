/**
 * Utilidades de Validación de Contraseñas
 * 
 * Funciones para validar que las contraseñas cumplan con requisitos de seguridad
 */

export interface PasswordValidation {
  isValid: boolean;
  message: string;
  strength: 'weak' | 'medium' | 'strong' | 'very-strong';
  requirements: {
    minLength: boolean;
    hasUpperCase: boolean;
    hasLowerCase: boolean;
    hasNumber: boolean;
    hasSpecialChar: boolean;
  };
}

/**
 * Valida una contraseña según requisitos de seguridad
 * 
 * Requisitos mínimos:
 * - Mínimo 8 caracteres
 * - Al menos una letra mayúscula
 * - Al menos una letra minúscula
 * - Al menos un número
 * 
 * Requisitos adicionales (para fortaleza):
 * - Caracteres especiales
 */
export const validatePassword = (password: string): PasswordValidation => {
  const requirements = {
    minLength: password.length >= 8,
    hasUpperCase: /[A-Z]/.test(password),
    hasLowerCase: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSpecialChar: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
  };

  // Validar requisitos mínimos
  const isValid =
    requirements.minLength &&
    requirements.hasUpperCase &&
    requirements.hasLowerCase &&
    requirements.hasNumber;

  // Determinar fortaleza
  let strength: PasswordValidation['strength'] = 'weak';
  const metRequirements = Object.values(requirements).filter(Boolean).length;

  if (metRequirements >= 5) {
    strength = 'very-strong';
  } else if (metRequirements >= 4) {
    strength = 'strong';
  } else if (metRequirements >= 3) {
    strength = 'medium';
  }

  // Generar mensaje
  const messages: string[] = [];
  if (!requirements.minLength) messages.push('Mínimo 8 caracteres');
  if (!requirements.hasUpperCase) messages.push('Una letra mayúscula (A-Z)');
  if (!requirements.hasLowerCase) messages.push('Una letra minúscula (a-z)');
  if (!requirements.hasNumber) messages.push('Un número (0-9)');

  const message = isValid
    ? '✅ Contraseña válida'
    : `❌ Falta: ${messages.join(', ')}`;

  return {
    isValid,
    message,
    strength,
    requirements,
  };
};

/**
 * Obtiene el color para mostrar la fortaleza de la contraseña
 */
export const getPasswordStrengthColor = (strength: PasswordValidation['strength']): string => {
  switch (strength) {
    case 'weak':
      return 'bg-red-500';
    case 'medium':
      return 'bg-yellow-500';
    case 'strong':
      return 'bg-blue-500';
    case 'very-strong':
      return 'bg-green-500';
    default:
      return 'bg-gray-300';
  }
};

/**
 * Obtiene el texto para mostrar la fortaleza de la contraseña
 */
export const getPasswordStrengthText = (strength: PasswordValidation['strength']): string => {
  switch (strength) {
    case 'weak':
      return 'Débil';
    case 'medium':
      return 'Media';
    case 'strong':
      return 'Fuerte';
    case 'very-strong':
      return 'Muy Fuerte';
    default:
      return 'Desconocida';
  }
};
