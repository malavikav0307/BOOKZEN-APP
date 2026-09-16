import { useEffect, useState, useMemo } from "react";
import "./Messages.css";
import { db, auth } from "../firebase";
import {
  collection,
  query,
  where,
  onSnapshot
} from "firebase/firestore";

function Messages({ setPage, setSelectedBook, currentUser, goBack }) {
  const activeUser = currentUser || auth.currentUser;
  const userUid = activeUser?.uid || "";
  const userEmail = activeUser?.email || localStorage.getItem("userEmail") || "";

  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (!activeUser || (!userUid && !userEmail) || !auth.currentUser) {
      setConversations([]);
      setLoading(false);
      return;
    }

    let isMounted = true;
    const convRef = collection(db, "conversations");

    // Build participant queries
    const queryList = [];

    if (userUid) {
      queryList.push(query(convRef, where("participantUids", "array-contains", userUid)));
      queryList.push(query(convRef, where("buyerId", "==", userUid)));
      queryList.push(query(convRef, where("sellerId", "==", userUid)));
      queryList.push(query(convRef, where("buyerUid", "==", userUid)));
      queryList.push(query(convRef, where("sellerUid", "==", userUid)));
    }

    if (userEmail) {
      const lowerEmail = userEmail.toLowerCase();
      queryList.push(query(convRef, where("participantEmails", "array-contains", lowerEmail)));
      queryList.push(query(convRef, where("buyerEmail", "==", userEmail)));
      queryList.push(query(convRef, where("sellerEmail", "==", userEmail)));
      if (lowerEmail !== userEmail) {
        queryList.push(query(convRef, where("buyerEmail", "==", lowerEmail)));
        queryList.push(query(convRef, where("sellerEmail", "==", lowerEmail)));
      }
    }

    // Subscribe to queries and merge results
    const unsubscribes = [];
    const conversationMap = new Map();

    queryList.forEach((q) => {
      const unsub = onSnapshot(
        q,
        (snapshot) => {
          if (!isMounted) return;

          snapshot.docs.forEach((docSnap) => {
            const data = docSnap.data();
            conversationMap.set(docSnap.id, {
              id: docSnap.id,
              ...data
            });
          });

          // Sort conversations by lastMessageAt descending
          const sortedList = Array.from(conversationMap.values()).sort((a, b) => {
            const tA = a.lastMessageAt?.toMillis
              ? a.lastMessageAt.toMillis()
              : a.updatedAt?.toMillis
              ? a.updatedAt.toMillis()
              : a.createdAt?.toMillis
              ? a.createdAt.toMillis()
              : 0;
            const tB = b.lastMessageAt?.toMillis
              ? b.lastMessageAt.toMillis()
              : b.updatedAt?.toMillis
              ? b.updatedAt.toMillis()
              : b.createdAt?.toMillis
              ? b.createdAt.toMillis()
              : 0;
            return tB - tA;
          });

          setConversations(sortedList);
          setLoading(false);
        },
        (error) => {
          console.warn("Messages inbox query error:", error);
          if (isMounted) setLoading(false);
        }
      );
      unsubscribes.push(unsub);
    });

    return () => {
      isMounted = false;
      unsubscribes.forEach((unsub) => unsub());
    };
  }, [userUid, userEmail, activeUser]);

  // Open Conversation
  const handleOpenConversation = (conv) => {
    const isSeller = Boolean(
      (userUid && conv.sellerId === userUid) ||
      (userUid && conv.sellerUid === userUid) ||
      (userEmail && conv.sellerEmail?.toLowerCase() === userEmail.toLowerCase())
    );

    const bookData = {
      id: conv.bookId || conv.id,
      bookId: conv.bookId || conv.id,
      title: conv.bookTitle || conv.bookName || "Book",
      bookName: conv.bookTitle || conv.bookName || "Book",
      frontCover: conv.bookImage || "",
      price: conv.bookPrice || 0,
      sellerId: conv.sellerId || conv.sellerUid || "",
      sellerUid: conv.sellerUid || conv.sellerId || "",
      sellerEmail: conv.sellerEmail || "",
      sellerName: conv.sellerName || "",
      buyerId: conv.buyerId || conv.buyerUid || "",
      buyerUid: conv.buyerUid || conv.buyerId || "",
      buyerEmail: conv.buyerEmail || "",
      buyerName: conv.buyerName || ""
    };

    if (typeof setSelectedBook === "function") {
      setSelectedBook(bookData);
    }
    setPage("chat");
  };

  const handleBack = () => {
    if (typeof goBack === "function") {
      goBack("home");
    } else {
      setPage("home");
    }
  };

  // Format relative timestamp
  const formatTimeAgo = (timestamp) => {
    if (!timestamp) return "Just now";
    const date = timestamp.toMillis ? new Date(timestamp.toMillis()) : new Date(timestamp);
    const now = new Date();
    const diffSeconds = Math.floor((now - date) / 1000);

    if (diffSeconds < 60) return "Just now";
    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  // Filtered by Search
  const filteredConversations = useMemo(() => {
    if (!searchTerm.trim()) return conversations;
    const term = searchTerm.toLowerCase().trim();

    return conversations.filter((conv) => {
      const bookMatch = (conv.bookName || conv.bookTitle || "").toLowerCase().includes(term);
      const buyerMatch = (conv.buyerName || conv.buyerEmail || "").toLowerCase().includes(term);
      const sellerMatch = (conv.sellerName || conv.sellerEmail || "").toLowerCase().includes(term);
      const msgMatch = (conv.lastMessage || "").toLowerCase().includes(term);
      return bookMatch || buyerMatch || sellerMatch || msgMatch;
    });
  }, [conversations, searchTerm]);

  // Total Unread Messages for Current User
  const totalUnreadCount = useMemo(() => {
    return conversations.reduce((acc, conv) => {
      const isSeller = Boolean(
        (userUid && conv.sellerId === userUid) ||
        (userUid && conv.sellerUid === userUid) ||
        (userEmail && conv.sellerEmail?.toLowerCase() === userEmail.toLowerCase())
      );
      const unread = isSeller ? (conv.sellerUnreadCount || 0) : (conv.buyerUnreadCount || 0);
      return acc + unread;
    }, 0);
  }, [conversations, userUid, userEmail]);

  return (
    <div className="messages-inbox-page">
      {/* HEADER */}
      <header className="messages-header">
        <button
          type="button"
          className="back-button"
          onClick={handleBack}
          title="Back to Home"
        >
          ←
        </button>

        <div className="messages-header-info">
          <h1>Messages</h1>
          <p className="messages-header-subtitle">
            {totalUnreadCount > 0
              ? `${totalUnreadCount} unread message${totalUnreadCount > 1 ? "s" : ""}`
              : `${conversations.length} conversation${conversations.length === 1 ? "" : "s"}`}
          </p>
        </div>
      </header>

      {/* SEARCH BAR */}
      <div className="messages-search">
        <input
          type="text"
          placeholder="Search chats, books, users..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <span>🔍</span>
      </div>

      {/* LOADING STATE */}
      {loading && (
        <div className="messages-loading">
          <p>Loading your conversations...</p>
        </div>
      )}

      {/* EMPTY INBOX */}
      {!loading && conversations.length === 0 && (
        <div className="messages-empty-state">
          <span className="empty-chat-icon">💬</span>
          <h2>No Messages Yet</h2>
          <p>
            When buyers or sellers message you about books, your conversations will appear here in real time.
          </p>
          <button
            type="button"
            className="explore-books-btn"
            onClick={() => setPage("home")}
          >
            Explore Books on Home
          </button>
        </div>
      )}

      {/* SEARCH NO RESULTS */}
      {!loading && conversations.length > 0 && filteredConversations.length === 0 && (
        <div className="messages-empty-state">
          <span className="empty-chat-icon">🔍</span>
          <h2>No Matching Chats</h2>
          <p>No conversations found matching "{searchTerm}".</p>
        </div>
      )}

      {/* CONVERSATION LIST */}
      {!loading && filteredConversations.length > 0 && (
        <div className="conversations-list">
          {filteredConversations.map((conv) => {
            const isSeller = Boolean(
              (userUid && conv.sellerId === userUid) ||
              (userUid && conv.sellerUid === userUid) ||
              (userEmail && conv.sellerEmail?.toLowerCase() === userEmail.toLowerCase())
            );

            const otherName = isSeller
              ? (conv.buyerName || conv.buyerEmail?.split("@")[0] || "Buyer")
              : (conv.sellerName || conv.sellerEmail?.split("@")[0] || "Seller");

            const otherEmail = isSeller ? conv.buyerEmail : conv.sellerEmail;
            const otherRole = isSeller ? "Buyer" : "Seller";
            const unreadCount = isSeller ? (conv.sellerUnreadCount || 0) : (conv.buyerUnreadCount || 0);
            const hasUnread = unreadCount > 0;

            return (
              <div
                key={conv.id}
                className={`conversation-card ${hasUnread ? "has-unread" : ""}`}
                onClick={() => handleOpenConversation(conv)}
              >
                {/* BOOK THUMBNAIL */}
                <div className="conversation-book-thumb">
                  {conv.bookImage ? (
                    <img src={conv.bookImage} alt={conv.bookName || "Book"} />
                  ) : (
                    <div className="thumb-placeholder">📚</div>
                  )}
                </div>

                {/* CONVERSATION INFO */}
                <div className="conversation-main-info">
                  <div className="conversation-top-row">
                    <h3 className="conversation-book-title">
                      {conv.bookTitle || conv.bookName || "Book Listing"}
                    </h3>
                    <span className="conversation-time">
                      {formatTimeAgo(conv.lastMessageAt || conv.updatedAt || conv.createdAt)}
                    </span>
                  </div>

                  <div className="conversation-user-tag">
                    <span className={`role-badge ${isSeller ? "buyer-badge" : "seller-badge"}`}>
                      {otherRole}
                    </span>
                    <span className="user-name-text">
                      {otherName} {otherEmail ? `(${otherEmail})` : ""}
                    </span>
                  </div>

                  <div className="conversation-bottom-row">
                    <p className={`last-message-preview ${hasUnread ? "unread-text" : ""}`}>
                      {conv.lastMessage || "Start conversation..."}
                    </p>

                    {hasUnread && (
                      <span className="unread-badge-pill">
                        {unreadCount > 9 ? "9+" : unreadCount} unread
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default Messages;
