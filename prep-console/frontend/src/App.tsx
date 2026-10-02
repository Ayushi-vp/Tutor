import { Navigate, Route, Routes, useParams } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth";
import { Layout } from "./components/Layout";
import { DESIGNS, TRACKS } from "./content";
import { ProgressProvider } from "./store";
import { Account } from "./views/Account";
import { Admin } from "./views/Admin";
import { Bank } from "./views/Bank";
import { Cards } from "./views/Cards";
import { Dsa } from "./views/Dsa";
import { Landing } from "./views/Landing";
import { Mock } from "./views/Mock";
import { Overview } from "./views/Overview";
import { Roadmap } from "./views/Roadmap";
import { Search } from "./views/Search";
import { Section } from "./views/Section";

/** /ml, /ts, /classic, /lld … — any learning track or design family. */
function SectionRoute() {
  const { view = "" } = useParams();
  if (!(view in TRACKS) && !(view in DESIGNS)) return <Navigate to="/" replace />;
  return <Section key={view} view={view} />;
}

function Gate() {
  const { status } = useAuth();
  if (status === "loading") return <div className="splash" aria-busy="true"><div className="mark" /></div>;
  if (status === "signed-out") return <Landing />;
  return (
    <ProgressProvider>
      <Layout>
        <Routes>
          <Route path="/" element={<Overview />} />
          <Route path="/roadmap" element={<Roadmap />} />
          <Route path="/mock" element={<Mock />} />
          <Route path="/cards" element={<Cards />} />
          <Route path="/account" element={<Account />} />
          <Route path="/data" element={<Navigate to="/account" replace />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/dsa" element={<Dsa />} />
          <Route path="/bank" element={<Bank />} />
          <Route path="/search" element={<Search />} />
          <Route path="/:view" element={<SectionRoute />} />
        </Routes>
      </Layout>
    </ProgressProvider>
  );
}

export function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}
