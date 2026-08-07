"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";
import { ErrorMessage, SuccessMessage } from "@/components/shared";

const sectionClass =
  "bg-[#131e2c]/90 border border-[#2a3645] rounded-2xl p-5 sm:p-6 space-y-4";
const inputClass =
  "w-full bg-[#0a121c] border border-[#2a3645] rounded-lg p-3 text-sm text-white placeholder:text-stone-600 focus:outline-none focus:border-[#7cc7e8]";
const labelClass =
  "block text-[11px] text-stone-500 uppercase tracking-wider font-semibold mb-1.5";

function IconEye({ open }) {
  if (open) {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M12 9a3 3 0 1 0 0 6a3 3 0 0 0 0-6m0 8a5 5 0 1 1 0-10a5 5 0 0 1 0 10m0-12C7 5 2.73 7.11 1 10.5C2.73 13.89 7 16 12 16s9.27-2.11 11-5.5C21.27 7.11 17 5 12 5" />
      </svg>
    );
  }
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M2 5.27L3.28 4L20 20.72L18.73 22l-3.08-3.08c-1.15.38-2.37.58-3.65.58c-5 0-9.27-2.11-11-5.5c.69-1.36 1.69-2.53 2.89-3.47L2 5.27M12 9a3 3 0 0 1 3 3a3 3 0 0 1-.17 1L11 9.17A3 3 0 0 1 12 9m0-4c5 0 9.27 2.11 11 5.5a11.8 11.8 0 0 1-4.18 4.32l-1.44-1.44A9.5 9.5 0 0 0 20.66 10.5C19.05 7.72 15.75 6 12 6c-.69 0-1.37.05-2.03.15L8.33 4.5C9.5 4.18 10.72 4 12 4M3.34 10.5A9.5 9.5 0 0 0 7.1 13.8l-1.43 1.43A11.9 11.9 0 0 1 1 10.5C1.73 9.05 2.78 7.8 4.04 6.84L5.5 8.3A9.4 9.4 0 0 0 3.34 10.5Z" />
    </svg>
  );
}

function IconCopy() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M21 8.94a1.3 1.3 0 0 0-.06-.27v-.09a1 1 0 0 0-.19-.28l-6-6a1 1 0 0 0-.28-.19a.3.3 0 0 0-.09 0a.9.9 0 0 0-.33-.11H10a3 3 0 0 0-3 3v1H6a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3v-1h1a3 3 0 0 0 3-3zm-6-3.53L17.59 8H16a1 1 0 0 1-1-1ZM15 19a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1h1v7a3 3 0 0 0 3 3h5Zm4-4a1 1 0 0 1-1 1h-8a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h3v3a3 3 0 0 0 3 3h3Z" />
    </svg>
  );
}

function IconPassword() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M2 19v-2h20v2zm1.15-6.05l-1.3-.75l.85-1.5H1V9.2h1.7l-.85-1.45L3.15 7L4 8.45L4.85 7l1.3.75L5.3 9.2H7v1.5H5.3l.85 1.5l-1.3.75l-.85-1.5zm8 0l-1.3-.75l.85-1.5H9V9.2h1.7l-.85-1.45l1.3-.75l.85 1.45l.85-1.45l1.3.75l-.85 1.45H15v1.5h-1.7l.85 1.5l-1.3.75l-.85-1.5zm8 0l-1.3-.75l.85-1.5H17V9.2h1.7l-.85-1.45l1.3-.75l.85 1.45l.85-1.45l1.3.75l-.85 1.45H23v1.5h-1.7l.85 1.5l-1.3.75l-.85-1.5z" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0z" />
      <path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1zM4.118 4L4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4zM2.5 3h11V2h-11z" />
    </svg>
  );
}

function Toggle({ checked, onChange, disabled, label, description }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-white">{label}</p>
        {description && (
          <p className="text-xs text-stone-500 mt-0.5">{description}</p>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${
          checked ? "bg-[#7cc7e8]" : "bg-[#2a3645]"
        } disabled:opacity-50`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}

function maskEmail(email) {
  if (!email || !email.includes("@")) return "••••••@••••";
  const [local, domain] = email.split("@");
  const masked =
    local.length <= 2
      ? "••"
      : local[0] + "•".repeat(Math.min(local.length - 1, 8));
  return `${masked}@${domain}`;
}

export default function AccountSettingsPage() {
  const { user, updatePassword, signOut } = useAuth();
  const router = useRouter();

  const [emailRevealed, setEmailRevealed] = useState(false);
  const [showEmailAuth, setShowEmailAuth] = useState(false);
  const [emailAuthPassword, setEmailAuthPassword] = useState("");
  const [emailAuthError, setEmailAuthError] = useState("");
  const [emailAuthLoading, setEmailAuthLoading] = useState(false);
  const [emailCopied, setEmailCopied] = useState(false);

  const [openPassword, setOpenPassword] = useState(false);
  const [openDelete, setOpenDelete] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMsg, setPasswordMsg] = useState({ type: "", text: "" });
  const [savingPassword, setSavingPassword] = useState(false);

  const [isPrivate, setIsPrivate] = useState(false);
  const [diaryPublic, setDiaryPublic] = useState(true);
  const [showActivity, setShowActivity] = useState(true);
  const [privacyMsg, setPrivacyMsg] = useState({ type: "", text: "" });
  const [savingPrivacy, setSavingPrivacy] = useState(false);
  const [privacyLoaded, setPrivacyLoaded] = useState(false);

  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await api.getUserProfile(user.id);
        if (cancelled || !data) return;
        setIsPrivate(data.is_private === true);
        setDiaryPublic(data.diary_public !== false);
        setShowActivity(data.show_activity !== false);
      } catch {
        /* defaults */
      } finally {
        if (!cancelled) setPrivacyLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const verifyPassword = async (password) => {
    const supabase = createClient();
    const email = user?.email;
    if (!email) throw new Error("No email on session.");
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw new Error("Incorrect password.");
  };

  const handleRevealEmail = async (e) => {
    e.preventDefault();
    setEmailAuthError("");
    if (!emailAuthPassword) {
      setEmailAuthError("Enter your password.");
      return;
    }
    setEmailAuthLoading(true);
    try {
      await verifyPassword(emailAuthPassword);
      setEmailRevealed(true);
      setShowEmailAuth(false);
      setEmailAuthPassword("");
    } catch (err) {
      setEmailAuthError(err.message || "Could not verify.");
    } finally {
      setEmailAuthLoading(false);
    }
  };

  const handleHideEmail = () => {
    setEmailRevealed(false);
    setShowEmailAuth(false);
    setEmailAuthPassword("");
    setEmailAuthError("");
  };

  const handleCopyEmail = async () => {
    if (!user?.email || !emailRevealed) return;
    try {
      await navigator.clipboard.writeText(user.email);
      setEmailCopied(true);
      setTimeout(() => setEmailCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordMsg({ type: "", text: "" });

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordMsg({
        type: "error",
        text: "All password fields are required.",
      });
      return;
    }
    if (newPassword.length < 6) {
      setPasswordMsg({
        type: "error",
        text: "New password must be at least 6 characters.",
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: "error", text: "New passwords do not match." });
      return;
    }

    setSavingPassword(true);
    try {
      await verifyPassword(currentPassword);
      await updatePassword(newPassword);
      setPasswordMsg({
        type: "success",
        text: "Password updated successfully.",
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setPasswordMsg({
        type: "error",
        text: err.message || "Could not update password.",
      });
    } finally {
      setSavingPassword(false);
    }
  };

  const savePrivacy = async (next) => {
    if (!user?.id) return;
    setSavingPrivacy(true);
    setPrivacyMsg({ type: "", text: "" });
    try {
      const res = await api.updatePrivacy(user.id, {
        is_private: next.isPrivate,
        diary_public: next.diaryPublic,
        show_activity: next.showActivity,
      });

      const saved = res?.data;
      if (saved) {
        setIsPrivate(saved.is_private === true);
        setDiaryPublic(saved.diary_public !== false);
        setShowActivity(saved.show_activity !== false);
      }

      setPrivacyMsg({ type: "success", text: "Privacy settings saved." });
    } catch (err) {
      setPrivacyMsg({
        type: "error",
        text: err.message || "Could not save privacy settings.",
      });
      try {
        const data = await api.getUserProfile(user.id);
        setIsPrivate(data.is_private === true);
        setDiaryPublic(data.diary_public !== false);
        setShowActivity(data.show_activity !== false);
      } catch {
        /* ignore */
      }
    } finally {
      setSavingPrivacy(false);
    }
  };

  const handleToggle = (key, value) => {
    const next = {
      isPrivate,
      diaryPublic,
      showActivity,
      [key]: value,
    };
    if (key === "isPrivate") setIsPrivate(value);
    if (key === "diaryPublic") setDiaryPublic(value);
    if (key === "showActivity") setShowActivity(value);
    savePrivacy(next);
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== "DELETE") {
      setDeleteError("Type DELETE in capital letters to confirm.");
      return;
    }
    if (!user?.id) return;
    setDeleting(true);
    setDeleteError("");
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Session expired. Log in again.");

      const res = await fetch(`/api/users/${user.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not delete account.");

      await signOut();
      router.replace("/");
      router.refresh();
    } catch (err) {
      setDeleteError(err.message || "Could not delete account.");
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Email */}
      <section className={sectionClass}>
        <h2 className="text-sm font-semibold text-white">Email</h2>
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm text-stone-300 font-mono">
            {emailRevealed
              ? user?.email || "—"
              : maskEmail(user?.email)}
          </p>
          <button
            type="button"
            onClick={() => {
              if (emailRevealed) handleHideEmail();
              else {
                setShowEmailAuth(true);
                setEmailAuthError("");
              }
            }}
            className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-[#1f2b3a] transition-colors"
            title={emailRevealed ? "Hide email" : "Reveal email"}
          >
            <IconEye open={emailRevealed} />
          </button>
          {emailRevealed && (
            <button
              type="button"
              onClick={handleCopyEmail}
              className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-[#1f2b3a] transition-colors"
              title="Copy email"
            >
              <IconCopy />
            </button>
          )}
          {emailCopied && (
            <span className="text-[11px] text-[#7cc7e8]">Copied</span>
          )}
        </div>

        {showEmailAuth && !emailRevealed && (
          <form
            onSubmit={handleRevealEmail}
            className="mt-2 space-y-2 p-3 rounded-xl bg-[#0a121c] border border-[#2a3645]"
          >
            <p className="text-xs text-stone-500">
              Enter your password to view your email.
            </p>
            {emailAuthError && (
              <p className="text-xs text-red-400">{emailAuthError}</p>
            )}
            <input
              type="password"
              value={emailAuthPassword}
              onChange={(e) => setEmailAuthPassword(e.target.value)}
              placeholder="Current password"
              className={inputClass}
              autoComplete="current-password"
              disabled={emailAuthLoading}
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={emailAuthLoading}
                className="text-xs font-semibold px-3 py-2 rounded-lg bg-[#7cc7e8] text-[#0a121c] disabled:opacity-50"
              >
                {emailAuthLoading ? "..." : "Confirm"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowEmailAuth(false);
                  setEmailAuthPassword("");
                  setEmailAuthError("");
                }}
                className="text-xs text-stone-500 px-2"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        <p className="text-xs text-stone-500">
          Email changes are not available yet. Contact support if you need to
          update it.
        </p>
      </section>

      {/* Privacy — first actionable block */}
      <section className={sectionClass}>
        <h2 className="text-sm font-semibold text-white">Privacy</h2>
        {!privacyLoaded ? (
          <p className="text-xs text-stone-500">Loading...</p>
        ) : (
          <div className="space-y-5">
            {privacyMsg.text &&
              (privacyMsg.type === "error" ? (
                <ErrorMessage
                  message={privacyMsg.text}
                  onDismiss={() => setPrivacyMsg({ type: "", text: "" })}
                />
              ) : (
                <SuccessMessage message={privacyMsg.text} />
              ))}
            <Toggle
              checked={isPrivate}
              disabled={savingPrivacy}
              onChange={(v) => handleToggle("isPrivate", v)}
              label="Private profile"
              description="Only you can see your full profile. Others see a limited view."
            />
            <Toggle
              checked={diaryPublic}
              disabled={savingPrivacy}
              onChange={(v) => handleToggle("diaryPublic", v)}
              label="Public diary"
              description="Allow others to open your diary page from your profile."
            />
            <Toggle
              checked={showActivity}
              disabled={savingPrivacy}
              onChange={(v) => handleToggle("showActivity", v)}
              label="Show recent activity"
              description="Show your recent listens on your public profile."
            />
          </div>
        )}
      </section>

      {/* Change password — collapsed */}
      <section className={sectionClass}>
        <button
          type="button"
          onClick={() => setOpenPassword((v) => !v)}
          className="w-full flex items-center justify-between gap-3 text-left"
        >
          <span className="flex items-center gap-2.5 text-sm font-semibold text-white">
            <span className="text-stone-400">
              <IconPassword />
            </span>
            Change password
          </span>
          <span className="text-stone-500 text-xs">
            {openPassword ? "Hide" : "Show"}
          </span>
        </button>

        {openPassword && (
          <div className="pt-2 space-y-3 border-t border-[#2a3645]">
            {passwordMsg.text &&
              (passwordMsg.type === "error" ? (
                <ErrorMessage
                  message={passwordMsg.text}
                  onDismiss={() => setPasswordMsg({ type: "", text: "" })}
                />
              ) : (
                <SuccessMessage message={passwordMsg.text} />
              ))}
            <form onSubmit={handleChangePassword} className="space-y-3">
              <div>
                <label className={labelClass}>Current password</label>
                <input
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className={inputClass}
                  disabled={savingPassword}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>New password</label>
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className={inputClass}
                    disabled={savingPassword}
                  />
                </div>
                <div>
                  <label className={labelClass}>Confirm new password</label>
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={inputClass}
                    disabled={savingPassword}
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={savingPassword}
                className="bg-[#7cc7e8] text-[#0a121c] px-5 py-2.5 text-sm font-semibold rounded-lg hover:bg-[#a5d8f0] disabled:opacity-50"
              >
                {savingPassword ? "Updating..." : "Update password"}
              </button>
            </form>
          </div>
        )}
      </section>

      {/* Delete — collapsed */}
      <section className="bg-[#1a1216]/90 border border-red-900/40 rounded-2xl p-5 sm:p-6 space-y-4">
        <button
          type="button"
          onClick={() => setOpenDelete((v) => !v)}
          className="w-full flex items-center justify-between gap-3 text-left"
        >
          <span className="flex items-center gap-2.5 text-sm font-semibold text-red-400">
            <IconTrash />
            Delete account
          </span>
          <span className="text-stone-500 text-xs">
            {openDelete ? "Hide" : "Show"}
          </span>
        </button>

        {openDelete && (
          <div className="pt-2 space-y-4 border-t border-red-900/30">
            <p className="text-xs text-stone-500">
              Permanently delete your account, profile, listens, reviews and
              lists. This cannot be undone.
            </p>
            {deleteError && (
              <ErrorMessage
                message={deleteError}
                onDismiss={() => setDeleteError("")}
              />
            )}
            <div>
              <label className={labelClass}>Type DELETE to confirm</label>
              <input
                type="text"
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                className={inputClass}
                placeholder="DELETE"
                disabled={deleting}
                autoComplete="off"
              />
            </div>
            <button
              type="button"
              onClick={handleDeleteAccount}
              disabled={deleting || deleteConfirm !== "DELETE"}
              className="bg-red-600/90 hover:bg-red-500 text-white px-5 py-2.5 text-sm font-semibold rounded-lg disabled:opacity-40"
            >
              {deleting ? "Deleting..." : "Delete my account"}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
