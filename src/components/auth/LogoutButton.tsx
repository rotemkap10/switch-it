import { logout } from "@/actions/auth";

export function LogoutButton() {
  return (
    <form action={logout}>
      <button
        type="submit"
        className="rounded border border-zinc-300 px-3 py-1.5 text-sm font-medium"
      >
        Log out
      </button>
    </form>
  );
}
