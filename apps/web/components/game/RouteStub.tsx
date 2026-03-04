import type { ReactNode } from 'react';

type RouteStubProps = {
  title: string;
  subtitle: string;
  children?: ReactNode;
};

export function RouteStub({ title, subtitle, children }: RouteStubProps) {
  return (
    <section className="page-card">
      <h1 className="page-title">{title}</h1>
      <p className="page-subtitle">{subtitle}</p>
      {children}
    </section>
  );
}
