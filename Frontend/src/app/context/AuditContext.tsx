/**
 * AuditContext.tsx - Sistema de Auditoría/Bitácora
 * 
 * Este archivo maneja el registro de todos los eventos importantes del sistema:
 * - Logins y Logouts
 * - Cambios de contraseña
 * - Creación de usuarios
 * - Ventas realizadas
 * - Solicitudes de productos
 * - Cambios administrativos
 * 
 * El administrador puede ver toda la bitácora de movimientos
 */

import { createContext, useContext, useState, ReactNode } from 'react';

// ============ TIPOS Y INTERFACES ============

/** Tipos de eventos que se pueden registrar */
export type AuditEventType = 
  | 'login'
  | 'logout'
  | 'password_change'
  | 'password_reset'
  | 'user_created'
  | 'user_blocked'
  | 'user_unblocked'
  | 'sale_created'
  | 'product_requested'
  | 'inventory_modified'
  | 'admin_action';

/**
 * Interfaz AuditEvent - Define un evento registrado en la bitácora
 */
export interface AuditEvent {
  id: string;                      // ID único del evento
  timestamp: Date;                 // Cuándo ocurrió
  eventType: AuditEventType;       // Tipo de evento
  userId: string;                  // ID del usuario que generó el evento
  userName: string;                // Nombre del usuario
  userRole: 'admin' | 'employee' | 'client';  // Rol del usuario
  description: string;             // Descripción legible del evento
  details?: {                       // Detalles adicionales
    affectedUserId?: string;        // Usuario afectado (ej: cambio de contraseña)
    affectedUserName?: string;
    productId?: string;
    productName?: string;
    quantity?: number;
    saleAmount?: number;
    ipAddress?: string;             // IP del usuario (simulada)
    [key: string]: any;
  };
}

/**
 * Interfaz AuditContextType - Define funciones disponibles
 */
interface AuditContextType {
  events: AuditEvent[];                                  // Lista de eventos
  addEvent: (event: Omit<AuditEvent, 'id'>) => void;   // Agregar evento
  getEventsByType: (type: AuditEventType) => AuditEvent[];  // Filtrar por tipo
  getEventsByUser: (userId: string) => AuditEvent[];    // Filtrar por usuario
  getEventsByDateRange: (startDate: Date, endDate: Date) => AuditEvent[];  // Por rango de fechas
  clearEvents: () => void;                              // Limpiar bitácora
}

// Crear el contexto
const AuditContext = createContext<AuditContextType | undefined>(undefined);

// ============ PROVEEDOR DE CONTEXTO ============

export function AuditProvider({ children }: { children: ReactNode }) {
  const [events, setEvents] = useState<AuditEvent[]>([
    {
      id: '1',
      timestamp: new Date(Date.now() - 3600000),
      eventType: 'login',
      userId: '1',
      userName: 'josecaficc2026',
      userRole: 'admin',
      description: 'Acceso al sistema',
      details: {}
    },
    {
      id: '2',
      timestamp: new Date(Date.now() - 1800000),
      eventType: 'sale_created',
      userId: '1',
      userName: 'josecaficc2026',
      userRole: 'admin',
      description: 'Venta registrada',
      details: {}
    },
    {
      id: '3',
      timestamp: new Date(Date.now() - 900000),
      eventType: 'login',
      userId: '2',
      userName: 'empleado',
      userRole: 'employee',
      description: 'Acceso al sistema',
      details: {}
    }
  ]);

  /**
   * Agregar un evento a la bitácora
   */
  const addEvent = (event: Omit<AuditEvent, 'id'>) => {
    const newEvent: AuditEvent = {
      id: String(Date.now()),
      ...event,
      timestamp: new Date(event.timestamp)
    };
    setEvents([newEvent, ...events]);
  };

  /**
   * Obtener eventos por tipo
   */
  const getEventsByType = (type: AuditEventType): AuditEvent[] => {
    return events.filter(e => e.eventType === type);
  };

  /**
   * Obtener eventos por usuario
   */
  const getEventsByUser = (userId: string): AuditEvent[] => {
    return events.filter(e => e.userId === userId);
  };

  /**
   * Obtener eventos en un rango de fechas
   */
  const getEventsByDateRange = (startDate: Date, endDate: Date): AuditEvent[] => {
    return events.filter(e => 
      e.timestamp >= startDate && e.timestamp <= endDate
    );
  };

  /**
   * Limpiar toda la bitácora
   */
  const clearEvents = () => {
    setEvents([]);
  };

  return (
    <AuditContext.Provider value={{
      events,
      addEvent,
      getEventsByType,
      getEventsByUser,
      getEventsByDateRange,
      clearEvents
    }}>
      {children}
    </AuditContext.Provider>
  );
}

/**
 * Hook useAudit - Para acceder a auditoría desde cualquier componente
 */
export function useAudit() {
  const context = useContext(AuditContext);
  if (!context) {
    throw new Error('useAudit must be used within AuditProvider');
  }
  return context;
}
