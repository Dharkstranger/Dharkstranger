"use client";

export function SignOutButton() {
  return (
    <button
      type="button"
      onClick={async () => {
        await fetch("/api/auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "signout" }),
        });
        window.location.href = "/";
      }}
      className="rounded-full bg-haze px-3 py-1.5 text-[12px] font-semibold"
    >
      Sign out
    </button>
  );
}
