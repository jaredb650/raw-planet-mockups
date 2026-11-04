import Link from "next/link";
import { Icon } from "./Icon";
import a from "./admin.module.css";

export function PageHeader({
  title,
  sub,
  actions,
  back,
}: {
  title: React.ReactNode;
  sub?: React.ReactNode;
  actions?: React.ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <header className={a.header}>
      <div className={a.headerText}>
        {back && (
          <Link href={back.href} className={a.back}>
            <Icon name="left" size={14} /> {back.label}
          </Link>
        )}
        <h1 className={a.title}>{title}</h1>
        {sub && <p className={a.sub}>{sub}</p>}
      </div>
      {actions && <div className={a.actions}>{actions}</div>}
    </header>
  );
}

export function Panel({
  title,
  count,
  action,
  children,
  footer,
  className,
  id,
}: {
  title?: React.ReactNode;
  count?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section className={`${a.panel} ${className ?? ""}`} id={id}>
      {title && (
        <div className={a.panelHead}>
          <h2>
            {title}
            {count !== undefined && <span className={a.count}>{count}</span>}
          </h2>
          {action}
        </div>
      )}
      {children}
      {footer && <div className={a.panelFoot}>{footer}</div>}
    </section>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className={a.empty}>{children}</p>;
}
