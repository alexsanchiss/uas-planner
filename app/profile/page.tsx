"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../hooks/useToast";
import { ProtectedRoute } from "../components/auth/protected-route";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Mail, Calendar, Shield, FileText, Pencil } from "lucide-react";

interface Draft {
  id: number;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export default function ProfilePage() {
  const { user } = useAuth();
  const toast = useToast();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  // Drafts state
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [draftsLoading, setDraftsLoading] = useState(false);
  const [editingDraftId, setEditingDraftId] = useState<number | null>(null);
  const [editingDraftName, setEditingDraftName] = useState("");

  const fetchDrafts = useCallback(async () => {
    const token = localStorage.getItem("authToken");
    if (!token) return;
    setDraftsLoading(true);
    try {
      const res = await fetch("/api/user/drafts", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setDrafts(data);
      }
    } catch {
      // ignore
    } finally {
      setDraftsLoading(false);
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("authToken");
    if (!token) return;
    fetch("/api/user/profile", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data) {
          setFirstName(data.firstName || "");
          setLastName(data.lastName || "");
          setPhone(data.phone || "");
          setProfileLoaded(true);
        }
      })
      .catch(() => {});

    fetchDrafts();
  }, [fetchDrafts]);

  const handleSaveProfile = async () => {
    const token = localStorage.getItem("authToken");
    if (!token) return;
    setSaving(true);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ firstName, lastName, phone }),
      });
      if (!res.ok) throw new Error("Failed to update profile");
      toast.success("Profile updated successfully");
      window.dispatchEvent(new Event("auth:changed"));
    } catch {
      toast.error("Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const handleRenameDraft = async (draftId: number) => {
    const token = localStorage.getItem("authToken");
    if (!token || !editingDraftName.trim()) return;
    try {
      const res = await fetch(`/api/user/drafts/${draftId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: editingDraftName.trim() }),
      });
      if (!res.ok) throw new Error("Failed to rename draft");
      toast.success("Draft renamed");
      setEditingDraftId(null);
      setEditingDraftName("");
      fetchDrafts();
    } catch {
      toast.error("Failed to rename draft");
    }
  };


  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-[var(--bg-primary)] py-8 px-4">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-[var(--text-primary)]">Profile</h1>
            <p className="text-[var(--text-muted)] mt-1">Your account information</p>
          </div>

          {/* Profile Card */}
          <div className="bg-[var(--surface-primary)] border border-[var(--border-primary)] rounded-xl p-6 shadow-lg">
            {/* Avatar and Name */}
            <div className="flex items-center gap-4 mb-6 pb-6 border-b border-[var(--border-primary)]">
              <div className="w-20 h-20 rounded-full bg-[var(--color-primary)] flex items-center justify-center text-white text-2xl font-bold">
                {user?.firstName?.charAt(0)?.toUpperCase() || user?.username?.charAt(0)?.toUpperCase() || "U"}
              </div>
              <div>
                <h2 className="text-xl font-semibold text-[var(--text-primary)]">
                  {user?.firstName && user?.lastName
                    ? `${user.firstName} ${user.lastName}`
                    : user?.username || "User"}
                </h2>
                <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--status-success-bg)] text-[var(--status-success-text)] border border-[var(--status-success-border)]">
                  <Shield className="w-3 h-3" />
                  Active Account
                </span>
              </div>
            </div>

            {/* Editable Profile Fields */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">First Name</label>
                <Input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Enter your first name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Last Name</label>
                <Input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Enter your last name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Phone</label>
                <Input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Enter your phone number"
                />
              </div>

              <div>
                <Button onClick={handleSaveProfile} disabled={saving || !profileLoaded}>
                  {saving ? "Saving..." : "Save Profile"}
                </Button>
              </div>

              {/* Read-only fields */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--bg-secondary)]">
                <div className="w-10 h-10 rounded-full bg-[var(--color-primary-light)] flex items-center justify-center">
                  <Mail className="w-5 h-5 text-[var(--color-primary)]" />
                </div>
                <div>
                  <p className="text-xs text-[var(--text-muted)]">Email</p>
                  <p className="text-[var(--text-primary)] font-medium">{user?.email || "Not set"}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--bg-secondary)]">
                <div className="w-10 h-10 rounded-full bg-[var(--color-primary-light)] flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-[var(--color-primary)]" />
                </div>
                <div>
                  <p className="text-xs text-[var(--text-muted)]">Account ID</p>
                  <p className="text-[var(--text-primary)] font-medium">#{user?.id || "—"}</p>
                </div>
              </div>
            </div>
          </div>

          {/* U-Plan Drafts Section */}
          <div className="mt-8 bg-[var(--surface-primary)] border border-[var(--border-primary)] rounded-xl p-6 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-[var(--color-primary)]" />
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">U-Plan Drafts</h2>
              </div>
              <span className="text-sm text-[var(--text-muted)]">
                {drafts.length} draft{drafts.length !== 1 ? "s" : ""}
              </span>
            </div>
            <p className="text-sm text-[var(--text-muted)] mb-4">
              Save and load U-Plan form configurations to avoid re-entering the same data.
              Use &ldquo;Save as Draft&rdquo; in the U-Plan form to create drafts.
            </p>

            {draftsLoading ? (
              <div className="text-center py-6 text-[var(--text-muted)]">Loading drafts...</div>
            ) : drafts.length === 0 ? (
              <div className="text-center py-6 text-[var(--text-muted)] border border-dashed border-[var(--border-primary)] rounded-lg">
                <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p>No drafts yet</p>
                <p className="text-xs mt-1">Open the U-Plan form and click &ldquo;Save as Draft&rdquo; to create one</p>
              </div>
            ) : (
              <div className="space-y-2">
                {drafts.map((draft) => (
                  <div
                    key={draft.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-primary)] hover:border-[var(--color-primary)] transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      {editingDraftId === draft.id ? (
                        <div className="flex items-center gap-2">
                          <Input
                            type="text"
                            value={editingDraftName}
                            onChange={(e) => setEditingDraftName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleRenameDraft(draft.id);
                              if (e.key === "Escape") { setEditingDraftId(null); setEditingDraftName(""); }
                            }}
                            className="py-1 text-sm"
                            autoFocus
                          />
                          <Button
                            onClick={() => handleRenameDraft(draft.id)}
                            className="px-3 py-1 text-xs"
                          >
                            Save
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => { setEditingDraftId(null); setEditingDraftName(""); }}
                            className="px-3 py-1 text-xs"
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <>
                          <p className="font-medium text-[var(--text-primary)] truncate">{draft.name}</p>
                          <p className="text-xs text-[var(--text-muted)]">
                            Updated {new Date(draft.updatedAt).toLocaleDateString(undefined, {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </>
                      )}
                    </div>
                    {editingDraftId !== draft.id && (
                      <div className="flex items-center gap-1 ml-3">
                        <button
                          onClick={() => {
                            setEditingDraftId(draft.id);
                            setEditingDraftName(draft.name);
                          }}
                          className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-primary)] transition-colors"
                          title="Rename draft"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>

                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
