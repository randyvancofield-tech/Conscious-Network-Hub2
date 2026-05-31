import React from 'react';
import { AlertCircle, ChevronRight, Loader2 } from 'lucide-react';

type PageShellProps = {
  children: React.ReactNode;
  className?: string;
};

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
};

type SurfacePanelProps = {
  children: React.ReactNode;
  className?: string;
};

type EmptyStateProps = {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
};

type ActionButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'disabled';
  icon?: React.ReactNode;
};

const cnhLogoPath = '/brand/conscious-network-hub-logo.png';

export const PageShell: React.FC<PageShellProps> = ({ children, className = '' }) => (
  <div className={`mx-auto w-full max-w-full min-w-0 space-y-6 pb-20 sm:space-y-8 sm:pb-24 2xl:max-w-[100rem] ${className}`}>
    {children}
  </div>
);

export const PageHeader: React.FC<PageHeaderProps> = ({ eyebrow, title, description, actions }) => (
  <header className="flex min-w-0 flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
    <div className="flex min-w-0 max-w-4xl items-start gap-3 sm:gap-4">
      <img
        src={cnhLogoPath}
        alt="Conscious Network Hub"
        className="mt-1 h-12 w-12 shrink-0 rounded-xl bg-white/95 object-contain p-1 shadow-xl shadow-blue-950/20 sm:h-14 sm:w-14"
      />
      <div className="min-w-0 space-y-3">
        {eyebrow && (
          <p className="text-[10px] font-black uppercase tracking-widest text-blue-300/70">{eyebrow}</p>
        )}
        <h1 className="break-words text-3xl font-black uppercase leading-tight text-white sm:text-4xl 2xl:text-5xl">
          {title}
        </h1>
        {description && <p className="max-w-2xl text-sm leading-6 text-slate-400 sm:text-base">{description}</p>}
      </div>
    </div>
    {actions && <div className="flex min-w-0 flex-wrap items-center gap-3">{actions}</div>}
  </header>
);

export const SurfacePanel: React.FC<SurfacePanelProps> = ({ children, className = '' }) => (
  <section className={`glass-panel w-full max-w-full min-w-0 rounded-2xl border-white/10 p-5 sm:p-6 lg:p-8 ${className}`}>
    {children}
  </section>
);

export const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, description, action }) => (
  <SurfacePanel className="border-dashed text-center">
    <div className="mx-auto flex max-w-xl flex-col items-center gap-5">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600/10 text-blue-300">
        {icon || <AlertCircle className="h-7 w-7" />}
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-black uppercase text-white">{title}</h2>
        <p className="break-words text-sm leading-6 text-slate-400">{description}</p>
      </div>
      {action}
    </div>
  </SurfacePanel>
);

export const ActionButton: React.FC<ActionButtonProps> = ({
  children,
  variant = 'primary',
  icon,
  disabled,
  className = '',
  ...props
}) => {
  const resolvedVariant = disabled ? 'disabled' : variant;
  const variantClass =
    resolvedVariant === 'primary'
      ? 'bg-blue-600 text-white hover:bg-blue-500 border-blue-500/40'
      : resolvedVariant === 'secondary'
        ? 'bg-white/8 text-slate-100 hover:bg-white/12 border-white/10'
        : resolvedVariant === 'ghost'
          ? 'bg-transparent text-slate-300 hover:bg-white/8 border-white/10'
          : 'bg-slate-800/70 text-slate-500 border-slate-700/80 cursor-not-allowed';

  return (
    <button
      {...props}
      disabled={disabled}
      className={`inline-flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-xl border px-4 py-3 text-center text-xs font-black uppercase tracking-widest transition-all active:scale-[0.98] ${variantClass} ${className}`}
    >
      {icon}
      <span className="cnh-action-label min-w-0">{children}</span>
    </button>
  );
};

export const LoadingPanel: React.FC<{ label: string }> = ({ label }) => (
  <SurfacePanel className="flex items-center justify-center gap-3 text-sm text-slate-300">
    <Loader2 className="h-4 w-4 animate-spin text-blue-300" />
    {label}
  </SurfacePanel>
);

export const DetailLinkButton: React.FC<{ onClick: () => void; label?: string }> = ({
  onClick,
  label = 'Open detail',
}) => (
  <ActionButton type="button" variant="secondary" onClick={onClick} icon={<ChevronRight className="h-4 w-4" />}>
    {label}
  </ActionButton>
);
