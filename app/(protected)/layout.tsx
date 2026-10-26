import { ProtectedRoute } from "../components/auth/protected-route";

// Route group: URLs are unchanged. Auth guard applied once for every page below.
export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return <ProtectedRoute>{children}</ProtectedRoute>;
}
