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

function Toggle({ checked, onChange, disabled, label, description }) {
  return (
    <label className="flex items-start justify-between gap-4 cursor-pointer">
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
    </label>
  );
}

export default function AccountSettingsPage() {
  const { user, updatePassword, signOut } = useAuth();
  const router = useRouter();

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
        setIsPrivate(!!data.is_private);
        setDiaryPublic(
          data.diary_public !== undefined ? !!data.diary_public : true
        );
        setShowActivity(
          data.show_activity !== undefined ? !!data.show_activity : true
        );
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

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordMsg({ type: "", text: "" });

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordMsg({ type: "error", text: "All password fields are required." });
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
      const supabase = createClient();
      const email = user?.email;
      if (!email) throw new Error("No email on session.");

      // Verify current password
      const { error: reauthError } = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword,
      });
      if (reauthError) {
        throw new Error("Current password is incorrect.");
      }

      await updatePassword(newPassword);
      setPasswordMsg({ type: "success", text: "Password updated successfully." });
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
      await api.updateUserProfile(user.id, {
        is_private: next.isPrivate,
        diary_public: next.diaryPublic,
        show_activity: next.showActivity,
        username: user.username || undefined,
      });
      setPrivacyMsg({ type: "success", text: "Privacy settings saved." });
    } catch (err) {
      setPrivacyMsg({
        type: "error",
        text: err.message || "Could not save privacy settings.",
      });
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
      setDeleteError('Type DELETE in capital letters to confirm.');
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
        <p className="text-sm text-stone-300">{user?.email || "—"}</p>
        <p className="text-xs text-stone-500">
          Email changes are not available yet. Contact support if you need to
          update it.
        </p>
      </section>

      {/* Password */}
      <section className={sectionClass}>
        <h2 className="text-sm font-semibold text-white">Change password</h2>
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
      </section>

      {/* Privacy */}
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

      {/* Danger zone */}
      <section className="bg-[#1a1216]/90 border border-red-900/40 rounded-2xl p-5 sm:p-6 space-y-4">
        <h2 className="text-sm font-semibold text-red-400">Danger zone</h2>
        <p className="text-xs text-stone-500">
          Permanently delete your account, profile, listens, reviews and lists.
          This cannot be undone.
        </p>
        {deleteError && (
          <ErrorMessage
            message={deleteError}
            onDismiss={() => setDeleteError("")}
          />
        )}
        <div>
          <label className={labelClass}>
            Type DELETE to confirm
          </label>
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
      </section>
    </div>
  );
}
