"use client";

import { useEffect, useState } from "react";
import { fetchMyProfile, updateMyProfile } from "@/lib/action/user";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";

export default function ProfilePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [batchName, setBatchName] = useState("");
  const [createdAt, setCreatedAt] = useState("");
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");

  useEffect(() => {
    fetchMyProfile().then((res) => {
      if (res.success) {
        setName(res.data.name);
        setEmail(res.data.email);
        setRole(res.data.role);
        setBatchName(res.data.batch?.name || "");
        setCreatedAt(res.data.createdAt);
      }
      setLoading(false);
    });
  }, []);

  const validatePassword = (): boolean => {
    setPasswordError("");
    if (newPassword && newPassword.length < 6) {
      setPasswordError("Password must be at least 6 characters");
      return false;
    }
    if (newPassword && newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match");
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!validatePassword()) {
      return;
    }

    setSaving(true);
    const updateData: any = { name, email };
    if (newPassword) {
      updateData.password = newPassword;
    }

    const res = await updateMyProfile(updateData);
    setSaving(false);
    if (res.success) {
      toast.success("Profile updated successfully");
      if (newPassword) {
        setNewPassword("");
        setConfirmPassword("");
        setShowPasswordChange(false);
      }
    } else {
      toast.error(res.message || "Failed to update profile");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground/20" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto w-full space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Profile</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your account information
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Personal Information</CardTitle>
          <CardDescription>
            Update your name and email address
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Email</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Your email"
            />
          </div>
          <div className="flex justify-end pt-2">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Security</CardTitle>
          <CardDescription>
            Change your password
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!showPasswordChange ? (
            <Button
              variant="outline"
              onClick={() => setShowPasswordChange(true)}
            >
              Change Password
            </Button>
          ) : (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">New Password</label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    setPasswordError("");
                  }}
                  placeholder="Enter new password (min 6 characters)"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Confirm Password</label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    setPasswordError("");
                  }}
                  placeholder="Confirm new password"
                />
              </div>
              {passwordError && (
                <p className="text-sm text-red-500">{passwordError}</p>
              )}
              <div className="flex gap-2 justify-end pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowPasswordChange(false);
                    setNewPassword("");
                    setConfirmPassword("");
                    setPasswordError("");
                  }}
                >
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={saving || !newPassword}>
                  {saving ? "Saving..." : "Update Password"}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account Details</CardTitle>
          <CardDescription>
            These details cannot be changed
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between py-2 border-b border-border/50">
            <span className="text-sm text-muted-foreground">Role</span>
            <span className="text-sm font-medium capitalize">{role}</span>
          </div>
          {batchName && (
            <div className="flex items-center justify-between py-2 border-b border-border/50">
              <span className="text-sm text-muted-foreground">Batch</span>
              <span className="text-sm font-medium">{batchName}</span>
            </div>
          )}
          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-muted-foreground">Member since</span>
            <span className="text-sm font-medium">
              {new Date(createdAt).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
