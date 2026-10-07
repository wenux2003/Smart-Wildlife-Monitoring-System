import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import { Brand } from "./Brand.js";
import { useAuth } from "../auth/AuthContext.js";

export function AccountHeader() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function logout() {
    setPending(true);
    setError("");
    try {
      await signOut();
      navigate("/login", { replace: true });
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <header className="workspace-header w-full px-8 bg-[#FFFFFF] border-b border-[#DCE5DC]">
        <Brand />
        <div className="signed-in-identity">
          <span>
            <strong className="text-[#1F2937]">{user?.name}</strong>
            <small className="text-[#64748B]">{user?.email}</small>
            <small className="text-[#64748B]">{user?.parkName ?? (user?.role === "SUPER_ADMIN" ? "National administration" : "Park access pending")}</small>
          </span>
          <button
            className="button button-outline"
            onClick={() => void logout()}
            disabled={pending}
          >
            <LogOut size={16} />
            {pending ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </header>
      {error && (
        <p role="alert" className="form-error account-header-error w-full px-8">
          {error}
        </p>
      )}
    </>
  );
}
