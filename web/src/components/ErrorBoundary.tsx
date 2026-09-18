import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ErrorConReintento } from './ErrorConReintento';

interface ErrorBoundaryProps {
  /** Qué se le dice al usuario cuando lo envuelto rompe al renderizar. */
  mensaje: string;
  children: ReactNode;
}

interface ErrorBoundaryState {
  roto: boolean;
}

/**
 * Atrapa las excepciones de render de sus hijos y muestra el fallback de carga
 * fallida en vez de dejar la pestaña en blanco (#338). "Reintentar" vuelve a
 * montar los hijos. Es una clase porque React solo expone
 * getDerivedStateFromError en componentes de clase.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { roto: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { roto: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Error al renderizar:', error, info.componentStack);
  }

  reintentar = () => this.setState({ roto: false });

  render() {
    if (this.state.roto) {
      return <ErrorConReintento mensaje={this.props.mensaje} onReintentar={this.reintentar} />;
    }
    return this.props.children;
  }
}
