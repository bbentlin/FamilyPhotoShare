"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { doc, updateDoc, getDoc } from "firebase/firestore";
import {
  updateProfile,
  updateEmail,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
} from "firebase/auth";
import { getDb } from "@/lib/firebase";
import { saveNotificationPrefs } from "@/lib/user";
import { useDemo } from "@/context/DemoContext";

export default function SettingsPage() {
  const { user, loading } = useAuth();
  const { canWrite, isDemoMode } = useDemo();
  const router = useRouter();
  const [db, setDb] = useState<any>(null);

  // User profile states
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Notification preference states
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [newUploadsNotification, setNewUploadsNotification] = useState(true);
  const [commentsNotification, setCommentsNotification] = useState(true);

  // UI states
  const [isLoading, setIsLoading] = useState(false);
  const [activeSection, setActiveSection] = useState("profile");
  const [message, setMessage] = useState({ type: "", text: "" });

  useEffect(() => {
    setDb(getDb());
  }, []);

  // Redirect if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  // Load user data
  useEffect(() => {
    let mounted = true;
    (async () => {
      const db = getDb();
      setDb(db);
      if (!user) return;
      const ref = doc(db, "users", user.uid);
      const snap = await getDoc(ref);
      if (!mounted) return;
      if (snap.exists()) {
        const d = snap.data() as any;
        setDisplayName(d.displayName ?? user.displayName ?? "");
        setEmail(d.email ?? user.email ?? "");
        setEmailNotifications(d.emailNotifications ?? true);
        setNewUploadsNotification(d.newUploadsNotification ?? true);
        setCommentsNotification(d.commentsNotification ?? true);
      } else {
        // ensure defaults (AuthContext also does this)
        setEmailNotifications(true);
        setNewUploadsNotification(true);
        setCommentsNotification(true);
      }
    })().catch(() => {});
    return () => {
      mounted = false;
    };
  }, [user]);

  const handleUpdateProfile = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Block demo users
    if (!canWrite) {
      setMessage({
        type: "error",
        text: "Demo mode: Profile updates are disabled",
      });
      return;
    }

    setMessage({ type: "", text: "" });
    setIsLoading(true);

    try {
      // Update display name in Firebase Auth
      if (user) {
        await updateProfile(user, {
          displayName,
        });

        // Update user document in Firestore
        const userDocRef = doc(db, "users", user.uid);
        await updateDoc(userDocRef, {
          displayName,
        });

        setMessage({
          type: "success",
          text: "Profile updated successfully!",
        });
      }
    } catch (error) {
      setMessage({
        type: "error",
        text: "Failed to update profile. Please try again.",
      });
      console.error("Error updating profile:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateEmailAddress = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Block demo users
    if (!canWrite) {
      setMessage({
        type: "error",
        text: "Demo mode: Email updates are disabled",
      });
      return;
    }

    setMessage({ type: "", text: "" });

    if (!currentPassword) {
      setMessage({
        type: "error",
        text: "Please enter your current password to update email",
      });
      return;
    }

    setIsLoading(true);

    try {
      if (user && user.email) {
        // Re-authenticate user before changing email
        const credential = EmailAuthProvider.credential(
          user.email,
          currentPassword
        );

        await reauthenticateWithCredential(user, credential);
        await updateEmail(user, email);

        // Update user document in Firestore
        const userDocRef = doc(db, "users", user.uid);
        await updateDoc(userDocRef, {
          email,
        });

        setMessage({
          type: "success",
          text: "Email updated successfully!",
        });
        setCurrentPassword("");
      }
    } catch (error: unknown) {
      const authError = error as { code?: string };
      if (authError.code === "auth/wrong-password") {
        setMessage({
          type: "error",
          text: "Incorrect password. Please try again.",
        });
      } else if (authError.code === "auth/requires-recent-login") {
        setMessage({
          type: "error",
          text: "This operation requires recent authentication. Please log in again before retrying.",
        });
      } else {
        setMessage({
          type: "error",
          text: "Faile to update email. Please try again.",
        });
      }
      console.error("Error updating email:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateUserPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Block demo users
    if (!canWrite) {
      setMessage({
        type: "error",
        text: "Demo mode: Password updates are disabled",
      });
      return;
    }

    setMessage({ type: "", text: "" });

    // Validate passwords
    if (newPassword !== confirmPassword) {
      setMessage({
        type: "error",
        text: "New passwords don't match",
      });
      return;
    }

    if (newPassword.length < 6) {
      setMessage({
        type: "error",
        text: "Password must be at least 6 characters",
      });
      return;
    }

    if (!currentPassword) {
      setMessage({
        type: "error",
        text: "Please enter your current password",
      });
      return;
    }

    setIsLoading(true);

    try {
      if (user && user.email) {
        // Re-authenticate user before changing password
        const credential = EmailAuthProvider.credential(
          user.email,
          currentPassword
        );

        await reauthenticateWithCredential(user, credential);
        await updatePassword(user, newPassword);

        setMessage({
          type: "success",
          text: "Password updated successfully!",
        });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch (error: unknown) {
      const authError = error as { code?: string };
      if (authError.code === "auth/wrong-password") {
        setMessage({
          type: "error",
          text: "Incorrect current password. Please try again.",
        });
      } else {
        setMessage({
          type: "error",
          text: "Failed to update password. Please try again.",
        });
      }
      console.error("Error updating password:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveNotifications = async () => {
    if (!user) return;
    setIsLoading(true);
    setMessage({ type: "", text: "" });
    try {
      await saveNotificationPrefs(user.uid, {
        emailNotifications,
        newUploadsNotification,
        commentsNotification,
      });
      setMessage({ type: "success", text: "Notification preferences saved." });
    } catch (e: any) {
      setMessage({
        type: "error",
        text: e?.message || "Failed to save preferences.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const updateNotificationPreferences = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();
    await handleSaveNotifications();
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!db) {
    return <p>Loading settings…</p>;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
            Account Settings
          </h1>

          {/* Demo mode warning */}
          {isDemoMode && (
            <div className="mb-6 bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 dark:border-yellow-600 p-4">
              <p className="text-yellow-700 dark:text-yellow-400">
                You're in demo mode. Settings cannot be changed.
              </p>
            </div>
          )}

          {message.text && (
            <div
              className={`mb-6 p-4 rounded-md ${
                message.type === "success"
                  ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400"
                  : "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400"
              }`}
            >
              {message.text}
            </div>
          )}

          <div className="flex flex-col md:flex-row gap-6">
            {/* Sidebar Navigation */}
            <div className="w-full md:w-64 bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
              <nav className="py-4">
                <ul>
                  <li>
                    <button
                      onClick={() => setActiveSection("profile")}
                      className={`w-full text-left px-4 py-2 ${
                        activeSection === "profile"
                          ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-l-4 border-blue-600 dark:border-blue-400"
                          : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                      }`}
                    >
                      Profile Information
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={() => setActiveSection("email")}
                      className={`w-full text-left px-4 py-2 ${
                        activeSection === "email"
                          ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-l-4 border-blue-600 dark:border-blue-400"
                          : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                      }`}
                    >
                      Email Settings
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={() => setActiveSection("password")}
                      className={`w-full text-left px-4 py-2 ${
                        activeSection === "password"
                          ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-l-4 border-blue-600 dark:border-blue-400"
                          : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                      }`}
                    >
                      Password
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={() => setActiveSection("notifications")}
                      className={`w-full text-left px-4 py-2 ${
                        activeSection === "notifications"
                          ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-l-4 border-blue-600 dark:border-blue-400"
                          : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                      }`}
                    >
                      Notifications
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={() => setActiveSection("danger")}
                      className={`w-full text-left px-4 py-2 ${
                        activeSection === "danger"
                          ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-l-4 border-blue-600 dark:border-blue-400"
                          : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                      }`}
                    >
                      Danger Zone
                    </button>
                  </li>
                </ul>
              </nav>
            </div>

            {/* Main Content */}
            <div className="flex-1 bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
              {/* Profile Information Section */}
              {activeSection === "profile" && (
                <div>
                  <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
                    Profile Information
                  </h2>
                  <form onSubmit={handleUpdateProfile} className="space-y-4">
                    <div>
                      <label
                        htmlFor="displayName"
                        className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                      >
                        Display Name
                      </label>
                      <input
                        type="text"
                        id="displayName"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        className="mt-1 block w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="email"
                        className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                      >
                        Email
                      </label>
                      <input
                        type="email"
                        id="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="mt-1 block w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      />
                    </div>

                    <div className="pt-4">
                      <button
                        type="submit"
                        disabled={isLoading}
                        className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-300 dark:disabled:bg-blue-400"
                      >
                        {isLoading ? "Saving..." : "Save Changes"}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Email Settings Section */}
              {activeSection === "email" && (
                <div>
                  <h2 className="text-xl font-semibold mb-4">Email Settings</h2>
                  <form onSubmit={updateEmailAddress} className="space-y-4">
                    <div>
                      <label
                        htmlFor="email"
                        className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                      >
                        Email Address
                      </label>
                      <input
                        type="email"
                        id="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="mt-1 block w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="currentPassword"
                        className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                      >
                        Current Password (required to update email)
                      </label>
                      <input
                        type="password"
                        id="currentPassword"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="mt-1 block w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      />
                    </div>

                    <div className="pt-4">
                      <button
                        type="submit"
                        disabled={isLoading}
                        className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-300 dark:disabled:bg-blue-400"
                      >
                        {isLoading ? "Updating..." : "Update Email"}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Password Section */}
              {activeSection === "password" && (
                <div>
                  <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
                    Change Password
                  </h2>
                  <form onSubmit={updateUserPassword} className="space-y-4">
                    <div>
                      <label
                        htmlFor="currentPassword"
                        className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                      >
                        Current Password
                      </label>
                      <input
                        type="password"
                        id="currentPassword"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="mt-1 block w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        required
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="newPassword"
                        className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                      >
                        New Password
                      </label>
                      <input
                        type="password"
                        id="newPassword"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="mt-1 block w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        required
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="confirmPassword"
                        className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                      >
                        Confirm New Password
                      </label>
                      <input
                        type="password"
                        id="confirmPassword"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="mt-1 block w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        required
                      />
                    </div>

                    <div className="pt-4">
                      <button
                        type="submit"
                        disabled={isLoading}
                        className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-300 dark:disabled:bg-blue-400"
                      >
                        {isLoading ? "Updating..." : "Update Password"}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Notifications Section */}
              {activeSection === "notifications" && (
                <div>
                  <h2 className="text-xl font-semibold mb-4">
                    Notifications Preferences
                  </h2>
                  <form
                    onSubmit={updateNotificationPreferences}
                    className="space-y-4"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center">
                        <input
                          id="emailNotifications"
                          name="emailNotifications"
                          type="checkbox"
                          checked={emailNotifications}
                          onChange={(e) =>
                            setEmailNotifications(e.target.checked)
                          }
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <label
                          htmlFor="emailNotifications"
                          className="ml-2 block text-sm text-gray-700 dark:text-gray-300"
                        >
                          Enable email notifications
                        </label>
                      </div>

                      <div className="flex items-center">
                        <input
                          id="newUploadsNotification"
                          name="newUploadsNotification"
                          type="checkbox"
                          checked={newUploadsNotification}
                          onChange={(e) =>
                            setNewUploadsNotification(e.target.checked)
                          }
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <label
                          htmlFor="newUploadsNotification"
                          className="ml-2 block text-sm text-gray-700 dark:text-gray-300"
                        >
                          Notify me about new photo uploads
                        </label>
                      </div>

                      <div className="flex items-center">
                        <input
                          id="commentsNotification"
                          name="commentsNotification"
                          type="checkbox"
                          checked={commentsNotification}
                          onChange={(e) =>
                            setCommentsNotification(e.target.checked)
                          }
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <label
                          htmlFor="commentsNotification"
                          className="ml-2 block text-sm text-gray-700 dark:text-gray-300"
                        >
                          Notify me about comments on my photos
                        </label>
                      </div>
                    </div>

                    <div className="pt-4">
                      <button
                        type="submit"
                        disabled={isLoading}
                        className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-300 dark:disabled:bg-blue-400"
                      >
                        {isLoading ? "Saving..." : "Save Preferences"}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Danger Zone Section */}
              {activeSection === "danger" && (
                <div>
                  <h2 className="text-xl font-semibold mb-4 text-red-600 dark:text-red-400">
                    Danger Zone
                  </h2>
                  <div className="border border-red-200 dark:border-red-800 rounded-md p-4 bg-red-50 dark:bg-red-900/20">
                    <h3 className="text-lg font-medium text-red-800 dark:text-red-300">
                      Delete Account
                    </h3>
                    <p className="mt-1 text-sm text-red-700 dark:text-red-400">
                      Once you delete your account, there is no going back.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
