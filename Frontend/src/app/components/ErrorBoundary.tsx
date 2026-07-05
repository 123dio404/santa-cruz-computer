/**
 * ErrorBoundary.tsx - Red de seguridad ante errores de render/commit
 *
 * Captura errores que romperían toda la pantalla (por ejemplo el clásico
 * "removeChild ... is not a child of this node" que provoca la traducción
 * automática del navegador al mutar el DOM) y muestra una pantalla amable
 * con un botón para recargar, en lugar de dejar la app en blanco.
 */
import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Deja rastro en consola para diagnóstico
    console.error('ErrorBoundary capturó un error:', error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          padding: 24,
          textAlign: 'center',
          fontFamily: 'Arial, Helvetica, sans-serif',
        }}
      >
        <h1 style={{ color: '#1e40af', margin: 0 }}>Algo salió mal</h1>
        <p style={{ color: '#555', maxWidth: 460, lineHeight: 1.5 }}>
          Ocurrió un error inesperado. Si tienes activada la <strong>traducción automática</strong> del
          navegador, desactívala para esta página. Luego recarga para continuar.
        </p>
        <button
          onClick={this.handleReload}
          style={{
            background: '#1e40af',
            color: 'white',
            border: 'none',
            padding: '10px 22px',
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: 14,
          }}
        >
          Recargar
        </button>
      </div>
    );
  }
}
