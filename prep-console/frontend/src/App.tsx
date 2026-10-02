import { Navigate, Route, Routes, useParams } from "react-router-dom";
import { Layout } from "./components/Layout";
import { DESIGNS, TRACKS } from "./content";
import { ProgressProvider } from "./store";
import { Bank } from "./views/Bank";
import { Cards } from "./views/Cards";
import { Data } from "./views/Data";
import { Dsa } from "./views/Dsa";
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

export function App() {
  return (
    <ProgressProvider>
      <Layout>
        <Routes>
          <Route path="/" element={<Overview />} />
          <Route path="/roadmap" element={<Roadmap />} />
          <Route path="/mock" element={<Mock />} />
          <Route path="/cards" element={<Cards />} />
          <Route path="/data" element={<Data />} />
          <Route path="/dsa" element={<Dsa />} />
          <Route path="/bank" element={<Bank />} />
          <Route path="/search" element={<Search />} />
          <Route path="/:view" element={<SectionRoute />} />
        </Routes>
      </Layout>
    </ProgressProvider>
  );
}
