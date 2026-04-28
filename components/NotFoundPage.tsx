import React from 'react';
import { Compass, Home } from 'lucide-react';
import { ActionButton, EmptyState, PageShell } from './ui/PlatformPrimitives';

type NotFoundPageProps = {
  path: string;
  onGoHome: () => void;
  onGoDashboard: () => void;
};

const NotFoundPage: React.FC<NotFoundPageProps> = ({ path, onGoHome, onGoDashboard }) => (
  <PageShell className="flex min-h-[60vh] items-center">
    <EmptyState
      icon={<Compass className="h-8 w-8" />}
      title="Route not found"
      description={`No frontend route is registered for "${path || '/'}". Unknown routes are intentionally not redirected to the homepage.`}
      action={
        <div className="flex flex-col gap-3 sm:flex-row">
          <ActionButton type="button" onClick={onGoHome} icon={<Home className="h-4 w-4" />}>
            Portal Entry
          </ActionButton>
          <ActionButton type="button" variant="secondary" onClick={onGoDashboard} icon={<Compass className="h-4 w-4" />}>
            Dashboard
          </ActionButton>
        </div>
      }
    />
  </PageShell>
);

export default NotFoundPage;
