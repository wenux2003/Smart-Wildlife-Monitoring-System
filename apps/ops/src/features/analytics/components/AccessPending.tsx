import { LockKeyhole } from "lucide-react";

export function AccessPending() {
  return (
    <section className="an-access-pending" role="status">
      <LockKeyhole size={30} aria-hidden="true" />
      <p className="an-overline">PARK ACCESS REQUIRED</p>
      <h1>Park access pending</h1>
      <p>Ask the Park Manager of the park you study to assign your access.</p>
    </section>
  );
}
