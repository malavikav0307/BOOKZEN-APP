import { useEffect, useState } from "react";
import "./Notifications.css";

import { db, auth } from "../firebase";
import BackButton from "../components/BackButton";

import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  writeBatch
} from "firebase/firestore";

function Notifications({ setPage, setSelectedBook, currentUser, goBack }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const activeUser = currentUser || auth.currentUser;
  const userEmail = activeUser?.email || "";

  useEffect(() => {
    if (!activeUser || !userEmail) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    // Query notifications by receiverEmail
    const q = query(
      collection(db, "notifications"),
      where("receiverEmail", "==", userEmail)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const notifs = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data()
        }));

        // Sort in memory by createdAt descending
        notifs.sort((a, b) => {
          const tA = a.createdAt?.toMillis ? a.createdAt.toMillis() : a.createdAt || 0;
          const tB = b.createdAt?.toMillis ? b.createdAt.toMillis() : b.createdAt || 0;
          return tB - tA;
        });

        setNotifications(notifs);
        setLoading(false);
      },
      (error) => {
        console.error("Notification error:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [activeUser, userEmail]);

  // =========================================================
  // MARK ALL AS READ
  // =========================================================
  const handleMarkAllAsRead = async () => {
    const unread = notifications.filter(
      (n) => n.status === "unread" || n.isRead === false
    );
    if (unread.length === 0) return;

    try {
      const batch = writeBatch(db);
      unread.forEach((n) => {
        const ref = doc(db, "notifications", n.id);
        batch.update(ref, { isRead: true, status: "read" });
      });
      await batch.commit();
    } catch (err) {
      console.error("Error marking all read:", err);
    }
  };

  // =========================================================
  // HANDLE NOTIFICATION CLICK
  // =========================================================
  const handleNotificationClick = async (notif) => {
    // 1. Mark as read
    if (notif.status === "unread" || notif.isRead === false) {
      try {
        await updateDoc(doc(db, "notifications", notif.id), {
          isRead: true,
          status: "read"
        });
      } catch (err) {
        console.warn("Could not mark read:", err);
      }
    }

    // 2. Navigate to relevant page
    if (notif.type === "message" || notif.event === "new_chat_message" || notif.conversationId) {
      if (typeof setSelectedBook === "function" && notif.bookId) {
        setSelectedBook({
          id: notif.bookId,
          bookId: notif.bookId,
          title: notif.bookName || "Book",
          bookName: notif.bookName || "Book",
          frontCover: notif.bookImage || "",
          buyerUid: notif.senderUid === (activeUser?.uid) ? notif.receiverUid : notif.senderUid,
          buyerEmail: notif.senderEmail === (activeUser?.email) ? notif.receiverEmail : notif.senderEmail,
          sellerUid: notif.senderUid === (activeUser?.uid) ? notif.senderUid : notif.receiverUid,
          sellerEmail: notif.senderEmail === (activeUser?.email) ? notif.senderEmail : notif.receiverEmail
        });
        setPage("chat");
      } else {
        setPage("messages");
      }
      return;
    }

    if (notif.orderId || notif.type?.includes("order")) {
      setPage("orders");
    }
  };

  // =========================================================
  // DELETE NOTIFICATION
  // =========================================================
  const handleDeleteNotification = async (id, e) => {
    if (e) e.stopPropagation();
    try {
      await deleteDoc(doc(db, "notifications", id));
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch (err) {
      console.error("Error deleting notification:", err);
    }
  };

  const unreadCount = notifications.filter(
    (n) => n.status === "unread" || n.isRead === false
  ).length;

  const getNotifIcon = (type) => {
    switch (type) {
      case "message":
        return "💬";
      case "order":
        return "🛍️";
      case "order_placed":
        return "🎉";
      case "order_cancelled":
        return "⚠️";
      default:
        return "🔔";
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return "Just now";
    const date = timestamp.toMillis ? new Date(timestamp.toMillis()) : new Date(timestamp);
    return date.toLocaleDateString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  return (
    <div className="notifications-page">
      {/* BACK BUTTON */}
      <BackButton setPage={setPage} previousPage="home" goBack={goBack} />

      <div className="notifications-header-row">
        <div>
          <h1>Notifications</h1>
          <p className="notif-subtitle">
            {unreadCount > 0 ? `${unreadCount} unread update${unreadCount > 1 ? "s" : ""}` : "All caught up"}
          </p>
        </div>

        {unreadCount > 0 && (
          <button
            type="button"
            className="mark-all-read-btn"
            onClick={handleMarkAllAsRead}
          >
            ✓ Mark all read
          </button>
        )}
      </div>

      {loading && (
        <p className="no-notifications">Loading notifications...</p>
      )}

      {!loading && notifications.length === 0 ? (
        <div className="no-notifications-box">
          <span className="empty-notif-icon">🔔</span>
          <p>No notifications yet.</p>
          <small>You will receive updates when you buy or sell books!</small>
        </div>
      ) : (
        <div className="notifications-list">
          {notifications.map((notification) => {
            const isUnread =
              notification.status === "unread" || notification.isRead === false;

            return (
              <div
                key={notification.id}
                className={`notification-card ${isUnread ? "unread" : ""}`}
                onClick={() => handleNotificationClick(notification)}
              >
                <div className="notification-icon">
                  {getNotifIcon(notification.type)}
                </div>

                <div className="notification-content">
                  <div className="notif-title-row">
                    <h3>{notification.title}</h3>
                    <span className="notif-time">
                      {formatTime(notification.createdAt)}
                    </span>
                  </div>

                  <p>{notification.message}</p>

                  {notification.orderId && (
                    <span className="notif-link-badge">
                      Tap to view order →
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  className="notif-delete-btn"
                  onClick={(e) => handleDeleteNotification(notification.id, e)}
                  title="Dismiss notification"
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default Notifications;