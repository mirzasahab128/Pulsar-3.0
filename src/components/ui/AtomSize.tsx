import { Atom } from "loading-dev";

export function AtomSize() {
  return (
    <div className="flex items-center gap-6">
      <Atom size={16} />
      <Atom size={24} />
      <Atom size={40} />
    </div>
  );
}

export default AtomSize;
