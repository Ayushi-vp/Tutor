import { useState } from "react";

/** Profile picture from the sign-in provider, or initials when there is none (or it fails to load). */
export function Avatar({ user, size = 28 }: { user: { name: string; email: string; avatar: string }; size?: number }) {
  const [broken, setBroken] = useState(false);
  const label = user.name || user.email;
  const initials = label.split(/[\s@._-]+/).filter(Boolean).slice(0, 2).map(w => w[0]!.toUpperCase()).join("");
  const style = { width: size, height: size, fontSize: Math.round(size * 0.4) };
  if (user.avatar && !broken) {
    return <img className="avatar" src={user.avatar} alt="" style={style} referrerPolicy="no-referrer" onError={() => setBroken(true)} />;
  }
  return <span className="avatar" style={style} aria-hidden="true">{initials || "?"}</span>;
}
