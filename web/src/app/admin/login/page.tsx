import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { Mark } from "@/components/admin/Mark";
import { LoginForm } from "./LoginForm";
import a from "@/components/admin/admin.module.css";
import s from "./login.module.css";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" && sp.next.startsWith("/admin") && !sp.next.startsWith("//") ? sp.next : "/admin";
  if (await isAdmin()) redirect(next);
  return (
    <div className={`${a.root} ${s.wrap}`}>
      <main className={s.card}>
        <div className={s.brand}>
          <Mark size={36} />
          <div>
            <p className={s.name}>Raw Planet</p>
            <p className={s.sub}>Studio admin</p>
          </div>
        </div>
        <h1 className={s.title}>Sign in</h1>
        <p className={s.lede}>Bookings, calendar and everything behind the website.</p>
        <LoginForm next={next} />
      </main>
    </div>
  );
}
