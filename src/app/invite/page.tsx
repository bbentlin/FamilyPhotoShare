"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import ThemeToggle from "@/components/ThemeToggle";
import Image from "next/image";
import { useDemo } from "@/context/DemoContext";
import { toast } from "react-hot-toast";

interface Invitation {
  id: string;
  email: string;
  status: "pending" | "accepted" | "expired";
  invitedBy: string;
  invitedByName: string;
  createdAt: any;
  expiresAt: any;
}

export default function InvitePanel() {
  const { user, loading } = useAuth();
  const { canWrite } = useDemo();
  const router = useRouter();
  const [email, setEmail] = useState<string>("");
  const [isInviting, setIsInviting] = useState(false);
  const [pendingInvites, setPendingInvites] = useState<Invitation[]>([]);
  const [familyMembers, setFamilyMembers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<{
    text: string;
    type: "success" | "error";
  } | null>(null);

  // Redirect if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  // Fetch data
  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    try {
      // Fetch pending invitations
      const invitesQuery = query(
        collection(db, "invitations"),
        where("status", "==", "pending")
      );
      const invitesSnapshot = await getDocs(invitesQuery);
      const invitesData = invitesSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Invitation[];
      setPendingInvites(invitesData);

      // Fetch family members
      const membersQuery = query(collection(db, "familyMembers"));
      const membersSnapshot = await getDocs(membersQuery);
      const membersData = membersSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setFamilyMembers(membersData);
    } catch (error: unknown) {
      console.error("Error fetching data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();

    // Block demo users
    if (!canWrite) {
      toast.error("Demo mode: Inviting family members is disabled");
      return;
    }

    if (!user || !email.trim()) return;

    setIsInviting(true);
    setMessage(null);

    try {
      // Check if email is already invited or is a member
      const existingInvite = pendingInvites.find((inv) => inv.email === email);
      const existingMember = familyMembers.find(
        (member) => member.email === email
      );

      if (existingInvite) {
        setMessage({
          text: "This email already has a pending invitation.",
          type: "error",
        });
        return;
      }

      if (existingMember) {
        setMessage({
          text: "This email is already a family member.",
          type: "error",
        });
        return;
      }

      // Create invitation
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + 7); // 7 days expiration

      await addDoc(collection(db, "invitations"), {
        email: email.toLocaleLowerCase().trim(),
        status: "pending",
        invitedBy: user.uid,
        invitedByName: user.displayName || user.email,
        createdAt: new Date(),
        expiresAt: expiryDate,
      });

      setMessage({ text: `Invitation sent to ${email}!`, type: "success" });
      setEmail("");
      fetchData(); // Refresh the list
    } catch (error: unknown) {
      console.error("Error sending invitation:", error);
      setMessage({
        text: "Failed to send invitation. Please try again.",
        type: "error",
      });
    } finally {
      setIsInviting(false);
    }
  };

  const handleCancelInvite = async (inviteId: string) => {
    // Block demo users
    if (!canWrite) {
      toast.error("Demo mode: Canceling invitations is disabled");
      return;
    }

    try {
      await deleteDoc(doc(db, "invitations", inviteId));
      setMessage({ text: "Invitation cancelled", type: "success" });
      fetchData(); // Refresh the list
    } catch (error: unknown) {
      console.error("Error cancelling invitation:", error);
      setMessage({ text: "Failed to cancel invitation.", type: "error" });
    }
  };

  if (loading || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Invite Family Members
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Send invitations to family members to join your photo sharing space.
          </p>
        </div>

        {/* Message Display */}
        {message && (
          <div
            className={`mb-6 p-4 rounded-lg ${
              message.type === "success"
                ? "bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300 border border-green-200 dark:border-green-800"
                : "bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800"
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Invite Form */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Send New Invitation
          </h2>

          <form onSubmit={handleInvite} className="flex gap-4">
            <div className="flex-1">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter family member's email"
                required
                disabled={!canWrite}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 disabled:opacity-50"
              />
            </div>
            <button
              type="submit"
              disabled={isInviting || !email.trim() || !canWrite}
              className="px-6 py-3 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {isInviting ? "Sending..." : "Send Invite"}
            </button>
          </form>

          <p className="text-sm text-gray-500 dark:text-gray-400 mt-3">
            Invitations expire after 7 days and can be canceled at any time.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Pending Invitations */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Pending Invitations ({pendingInvites.length})
            </h2>

            {pendingInvites.length > 0 ? (
              <div className="space-y-3">
                {pendingInvites.map((invite) => (
                  <div
                    key={invite.id}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 dark:text-white">
                        {invite.email}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Invited by {invite.invitedByName} •{" "}
                        {new Date(
                          invite.createdAt?.toDate?.() || invite.createdAt
                        ).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      onClick={() => handleCancelInvite(invite.id)}
                      className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 text-sm font-medium"
                    >
                      Cancel
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <svg
                  className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500 mb-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2M4 13h2m13-4h-2M7 9h2"
                  />
                </svg>
                <p className="text-gray-500 dark:text-gray-400">
                  No pending invitations
                </p>
              </div>
            )}
          </div>

          {/* Current Family Members */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Family Members ({familyMembers.length})
            </h2>

            {familyMembers.length > 0 ? (
              <div className="space-y-3">
                {familyMembers.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                  >
                    <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center mr-3">
                      {member.photoUrl ? (
                        <Image
                          src={member.photoUrl}
                          alt={member.name || member.email || "Member"}
                          width={40}
                          height={40}
                          className="w-full h-full rounded-full object-cover"
                          loading="lazy"
                          quality={75}
                        />
                      ) : (
                        <span className="text-blue-600 dark:text-blue-400 font-medium">
                          {member.name?.[0]?.toUpperCase() ||
                            member.email?.[0]?.toUpperCase() ||
                            "?"}
                        </span>
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 dark:text-white">
                        {member.name || "Unnamed Member"}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {member.email}
                      </p>
                    </div>
                    {member.role && (
                      <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs rounded-full">
                        {member.role}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <svg
                  className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500 mb-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
                <p className="text-gray-500 dark:text-gray-400">
                  No family members yet
                </p>
                <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
                  Send invitations to get started
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Info Section */}
        <div className="mt-8 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6">
          <div className="flex items-start">
            <svg
              className="h-6 w-6 text-blue-600 dark:text-blue-400 mt-0.5 mr-3 flex-shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div>
              <h3 className="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-2">
                How Family Invitations Work
              </h3>
              <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                <li>• Invitations are sent by email with a secure join link</li>
                <li>
                  • Family members can view and upload photos once they join
                </li>
                <li>• Invitations expire after 7 days for security</li>
                <li>• You can cancel pending invitations at any time</li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
