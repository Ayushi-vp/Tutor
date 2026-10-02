import { useCallback, useEffect, useState, type FormEvent } from "react";
import { call } from "../api";
import { useAuth } from "../auth";
import { Avatar } from "../components/Avatar";

interface Invite { email: string; created_at: number; used_at: number | null; invited_by: string | null }
interface UserRow { id: number; email: string; name: string; avatar: string; provider: string; created_at: number;
  last_login: number; disabled: boolean; admin: boolean; done: number }

const when = (t: number | null) => (t ? new Date(t * 1000).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "â€”");

/** Invite people and manage who can sign in. Admins are set by ADMIN_EMAILS on the server. */
export function Admin() {
  const { user } = useAuth();
  const [invites, setInvites] = useState<Invite[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const [i, u] = await Promise.all([call<Invite[]>("GET", "/api/admin/invites"), call<UserRow[]>("GET", "/api/admin/users")]);
      setInvites(i); setUsers(u); setError("");
    } catch (e) { setError((e as Error).message); }
  }, []);
  useEffect(() => { if (user?.admin) void load(); }, [user, load]);

  if (!user?.admin) {
    return (
      <div className="wrap" style={{ maxWidth: 860 }}>
        <div className="eyebrow">Workspace</div>
        <h1 className="page-h">Admin</h1>
        <p className="lede">Only admins can manage invites and users.</p>
      </div>
    );
  }

  const invite = async (e: FormEvent) => {
    e.preventDefault();
    const addr = email.trim().toLowerCase();
    if (!addr) return;
    try {
      setInvites(await call<Invite[]>("POST", "/api/admin/invites", { email: addr }));
      setEmail(""); setMsg(`Invited ${addr}. They can now sign in with Google or GitHub using that email.`);
    } catch (err) { setMsg((err as Error).message); }
  };
  const revoke = async (addr: string) => {
    if (!window.confirm(`Remove the invite for ${addr}? Someone who already signed in keeps their account; disable them below to block access.`)) return;
    try { setInvites(await call<Invite[]>("DELETE", `/api/admin/invites/${encodeURIComponent(addr)}`)); } catch (err) { setMsg((err as Error).message); }
  };
  const toggle = async (u: UserRow) => {
    try { await call("PUT", `/api/admin/users/${u.id}`, { disabled: !u.disabled }); await load(); } catch (err) { setMsg((err as Error).message); }
  };

  return (
    <div className="wrap" style={{ maxWidth: 960 }}>
      <div className="eyebrow">Workspace</div>
      <h1 className="page-h">Admin</h1>
      <p className="lede">Invite people by the email they use for Google or GitHub. Admins are set with <code>ADMIN_EMAILS</code> in the server's <code>.env</code>.</p>
      {error && <p className="notice err" role="alert">{error}</p>}

      <div className="sec">
        <h2 className="sec-h">Invites</h2>
        <form className="invite-form" onSubmit={invite}>
          <input type="email" required placeholder="name@example.com" aria-label="Email to invite" value={email} onChange={e => setEmail(e.target.value)} />
          <button className="btn" type="submit">Send invite</button>
        </form>
        {msg && <p className="notice" role="status">{msg}</p>}
        <div className="table-wrap">
          <table className="tbl">
            <thead><tr><th>Email</th><th>Status</th><th>Invited</th><th>By</th><th /></tr></thead>
            <tbody>
              {invites.length === 0 && <tr><td colSpan={5} className="tbl-empty">No invites yet.</td></tr>}
              {invites.map(i => (
                <tr key={i.email}>
                  <td>{i.email}</td>
                  <td>{i.used_at ? <span className="pill ok">Joined</span> : <span className="pill">Pending</span>}</td>
                  <td>{when(i.created_at)}</td>
                  <td className="muted">{i.invited_by || "â€”"}</td>
                  <td className="act"><button className="linkbtn" type="button" onClick={() => revoke(i.email)}>Remove</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="sec">
        <h2 className="sec-h">Users</h2>
        <p className="sec-s">Everyone who has signed in. Disabling someone signs them out at once and blocks them from signing in again.</p>
        <div className="table-wrap">
          <table className="tbl">
            <thead><tr><th>User</th><th>Signed in with</th><th>Last seen</th><th>Done</th><th /></tr></thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className={u.disabled ? "off" : ""}>
                  <td><div className="who"><Avatar user={u} size={26} /><div><b>{u.name || u.email}</b>{u.admin && <span className="badge">Admin</span>}{u.disabled && <span className="badge crit">Disabled</span>}<small>{u.email}</small></div></div></td>
                  <td>{u.provider}</td>
                  <td>{when(u.last_login)}</td>
                  <td className="num">{u.done}</td>
                  <td className="act">{u.id !== user.id && (
                    <button className="linkbtn" type="button" onClick={() => toggle(u)}>{u.disabled ? "Enable" : "Disable"}</button>)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
