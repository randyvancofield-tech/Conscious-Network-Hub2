import React from 'react';

type VisualRenderBoundaryProps = {
  children: React.ReactNode;
  moduleName: string;
  fallbackTitle?: string;
};

type VisualRenderBoundaryState = {
  hasError: boolean;
};

class VisualRenderBoundary extends React.Component<VisualRenderBoundaryProps, VisualRenderBoundaryState> {
  state: VisualRenderBoundaryState = { hasError: false };

  static getDerivedStateFromError(): VisualRenderBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error(`[VISUAL_RENDER_BOUNDARY][${this.props.moduleName}]`, {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <section className="rounded-2xl border border-red-400/30 bg-red-500/10 p-5 text-sm leading-6 text-red-100 sm:p-6">
          <h2 className="text-sm font-black uppercase text-white">
            {this.props.fallbackTitle || 'This view could not render.'}
          </h2>
          <p className="mt-2 break-words text-red-100/80">
            A protected visual boundary caught the rendering failure. Refresh this view or return to the previous page.
          </p>
        </section>
      );
    }

    return this.props.children;
  }
}

export default VisualRenderBoundary;
