"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { doc, getDoc, updateDoc, deleteDoc } from "firebase/firestore";
import {
  updateProfile,
  updateEmail,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
} from "firebase/auth";
import { db } from "@/lib/firebase";

export default function SettingsPage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

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

  // Redirect if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  // Load user data
  useEffect(() => {
    const loadUserData = async () => {
      if (user) {
        setDisplayName(user.displayName || "");
        setEmail(user.email || "");

        // Load user preferences from Firestore
        try {
          const userDocRef = doc(db, "users", user.uid);
          const userDoc = await getDoc(userDocRef);

          if (userDoc.exists()) {
            const userData = userDoc.data();
            setEmailNotifications(userData.emailNotifications ?? true);
            setNewUploadsNotification(userData.newUploadsNotification ?? true);
            setCommentsNotification(userData.commentsNotification ?? true);
          }
        } catch (error) {
          console.error("Error loading user preferences:", error);
        }
      }
    };

    loadUserData();
  }, [user]);

  const handleUpdateProfile = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
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
    } catch (error: any) {
      if (error.code === "auth/wrong-password") {
        setMessage({
          type: "error",
          text: "Incorrect password. Please try again.",
        });
      } else if (error.code === "auth/requires-recent-login") {
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

  interface UpdatePasswordError {
    code?: string;
    message?: string;
  }

  const updateUserPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
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

  const updateNotificationPreferences = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();
    setMessage({ type: "", text: "" });
    setIsLoading(true);

    try {
      if (user) {
        const userDocRef = doc(db, "users", user.uid);
        await updateDoc(userDocRef, {
          emailNotifications,
          newUploadsNotification,
          commentsNotification,
        });

        setMessage({
          type: "success",
          text: "Notification preferences updated successfully!",
        });
      }
    } catch (error) {
      setMessage({
        type: "error",
        text: "Failed to update notification preferences. Please try again.",
      });
      console.error("Error updating notification preferences:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    const confirmDelete = window.confirm(
      "Are you sure you want to delete your account? This action cannot be undone."
    );

    if (confirmDelete) {
      const finalConfirm = window.prompt(
        'To confirm, please type "DELETE" in the box below:'
      );

      if (finalConfirm === "DELETE") {
        try {
          setIsLoading(true);

          // Delete user document from Firestore
          if (user) {
            const userDocRef = doc(db, "users", user.uid);
            await deleteDoc(userDocRef);

            // Delete user from Firebase Auth
            await user.delete();

            // Redirect to home page
            router.push("/");
          }
        } catch (error) {
          console.error("Error deleting account:", error);
          setMessage({
            type: "error",
            text: "Failed to delete account. Please try again or contact support.",
          });
        } finally {
          setIsLoading(false);
        }
      }
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">
            Account Settings
          </h1>

          {message.text && (
            <div
              className={`mb-6 p-4 rounded-md ${
                message.type === "success"
                  ? "bg-green-50 text-green-700"
                  : "bg-red-50 text-red-700"
              }`}
            >
              {message.text}
            </div>
          )}

          <div className="flex flex-col md:flex-row gap-6">
            {/* Sidebar Navigation */}
            <div className="w-full md:w-64 bg-white rounded-lg shadow">
              <nav className="py-4">
                <ul>
                  <li>
                    <button
                      onClick={() => setActiveSection("profile")}
                      className={`w-full text-left px-4 py-2 ${
                        activeSection === "profile"
                          ? "bg-blue-50 text-blue-600 border-l-4 border-blue-600"
                          : "text-gray-700 hover:bg-gray-50"
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
                          ? "bg-blue-50 text-blue-600 border-l-4 border-blue-600"
                          : "text-gray-700 hover:bg-gray-50"
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
                          ? "bg-blue-50 text-blue-600 border-l-4 border-blue-600"
                          : "text-gray-700 hover:bg-gray-50"
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
                          ? "bg-blue-50 text-blue-600 border-l-4 border-blue-600"
                          : "text-gray-700 hover:bg-gray-50"
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
                          ? "bg-blue-50 text-blue-600 border-l-4 border-blue-600"
                          : "text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      Danger Zone
                    </button>
                  </li>
                </ul>
              </nav>
            </div>

            {/* Main Content */}
            <div className="flex-1 bg-white rounded-lg shadow p-6">
              {/* Profile Information Section */}
              {activeSection === "profile" && (
                <div>
                  <h2 className="text-xl font-semibold mb-4">
                    Profile Information
                  </h2>
                  <form onSubmit={handleUpdateProfile} className="space-y-4">
                    <div>
                      <label
                        htmlFor="displayName"
                        className="block text-sm font-medium text-gray-700"
                      >
                        Display Name
                      </label>
                      <input
                        type="text"
                        id="displayName"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      />
                    </div>

                    <div className="pt-4">
                      <button
                        type="submit"
                        disabled={isLoading}
                        className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-300"
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
                        className="block text-sm font-medium text-gray-700"
                      >
                        Email Address
                      </label>
                      <input
                        type="email"
                        id="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="currentPassword"
                        className="block text-sm font-medium text-gray-700"
                      >
                        Current Password (required to update email)
                      </label>
                      <input
                        type="password"
                        id="currentPassword"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      />
                    </div>

                    <div className="pt-4">
                      <button
                        type="submit"
                        disabled={isLoading}
                        className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-300"
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
                  <h2 className="text-xl font-semibold mb-4">
                    Update Password
                  </h2>
                  <form onSubmit={updateUserPassword} className="space-y-4">
                    <div>
                      <label
                        htmlFor="currentPasswordForPw"
                        className="block text-sm font-medium text-gray-700"
                      >
                        Current Password
                      </label>
                      <input
                        type="password"
                        id="currentPasswordForPw"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        required
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="newPassword"
                        className="block text-sm font-medium text-gray-700"
                      >
                        New Password
                      </label>
                      <input
                        type="password"
                        id="newPassword"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        required
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="confirmPassword"
                        className="block text-sm font-medium text-gray-700"
                      >
                        Confirm New Password
                      </label>
                      <input
                        type="password"
                        id="confirmPassword"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        required
                      />
                    </div>

                    <div className="pt-4">
                      <button
                        type="submit"
                        disabled={isLoading}
                        className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-300"
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
                          className="ml-2 block text-sm text-gray-700"
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
                          className="ml-2 block text-sm text-gray-700"
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
                          className="ml-2 block text-sm text-gray-700"
                        >
                          Notify me about comments on my photos
                        </label>
                      </div>
                    </div>

                    <div className="pt-4">
                      <button
                        type="submit"
                        disabled={isLoading}
                        className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-300"
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
                  <h2 className="text-xl font-semibold mb-4 text-red-600">
                    Danger Zone
                  </h2>
                  <div className="border border-red-200 rounded-md p-4 bg-red-50">
                    <h3 className="text-lg font-medium text-red-800">
                      Delete Account
                    </h3>
                    <p className="mt-1 text-sm text-red-700">
                      Once you delete your account, there is no going back.
                      Please be certain.
                    </p>
                    <div className="mt-4">
                      <button
                        type="button"
                        onClick={handleDeleteAccount}
                        className="inline-flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                      >
                        Delete Account
                      </button>
                    </div>
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
