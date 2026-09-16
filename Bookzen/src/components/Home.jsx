import { FaBell, FaHeart, FaComments } from "react-icons/fa";
import "./Home.css";
import { useEffect, useState } from "react";

import { db, auth } from "../firebase";

import {
  collection,
  query,
  where,
  onSnapshot
} from "firebase/firestore";

function Home({
  setPage,
  setCategory,
  setSelectedBook,
  currentUser
}) {
  const [books, setBooks] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [unreadMsgCount, setUnreadMsgCount] = useState(0);
  const [wishlistCount, setWishlistCount] = useState(0);

  const activeUser = currentUser || auth.currentUser;
  const userUid = activeUser?.uid || "";
  const userEmail = activeUser?.email || "";

  // ========================================
  // REAL-TIME BOOKS LISTENER (SYNC ADDS & DELETES)
  // ========================================
  useEffect(() => {
    let isMounted = true;

    const unsubscribe = onSnapshot(
      collection(db, "books"),
      (snapshot) => {
        if (!isMounted) return;
        const booksData = snapshot.docs.map((book) => ({
          ...book.data(),
          id: book.id
        }));

        // In-memory sort by createdAt descending
        booksData.sort((a, b) => {
          const tA = a.createdAt?.toMillis ? a.createdAt.toMillis() : a.createdAt || 0;
          const tB = b.createdAt?.toMillis ? b.createdAt.toMillis() : b.createdAt || 0;
          return tB - tA;
        });

        setBooks(booksData);
        setLoading(false);
      },
      (error) => {
        console.error("Error listening to books:", error);
        if (isMounted) {
          setLoading(false);
        }
      }
    );

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  // ========================================
  // UNREAD NOTIFICATIONS BADGE
  // ========================================
  useEffect(() => {
    if (!activeUser || !userEmail || !auth.currentUser) {
      setUnreadNotifCount(0);
      return;
    }

    const q = query(
      collection(db, "notifications"),
      where("receiverEmail", "==", userEmail)
    );

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const unread = snapshot.docs.filter((d) => {
          const data = d.data();
          return data.status === "unread" || data.isRead === false;
        }).length;
        setUnreadNotifCount(unread);
      },
      (err) => {
        console.warn("Unread badge listener error:", err);
      }
    );

    return () => {
      unsub();
    };
  }, [activeUser, userEmail]);

  // ========================================
  // UNREAD MESSAGES BADGE
  // ========================================
  useEffect(() => {
    if (!activeUser || (!userUid && !userEmail) || !auth.currentUser) {
      setUnreadMsgCount(0);
      return;
    }

    const convRef = collection(db, "conversations");
    const queries = [];
    if (userUid) {
      queries.push(query(convRef, where("participantUids", "array-contains", userUid)));
    }
    if (userEmail) {
      queries.push(query(convRef, where("participantEmails", "array-contains", userEmail.toLowerCase())));
    }

    const unsubs = [];
    const convMap = new Map();

    queries.forEach((q) => {
      const unsub = onSnapshot(
        q,
        (snap) => {
          snap.docs.forEach((d) => convMap.set(d.id, d.data()));
          let totalUnread = 0;
          convMap.forEach((conv) => {
            const isSeller = Boolean(
              (userUid && conv.sellerId === userUid) ||
              (userUid && conv.sellerUid === userUid) ||
              (userEmail && conv.sellerEmail?.toLowerCase() === userEmail.toLowerCase())
            );
            const count = isSeller ? (conv.sellerUnreadCount || 0) : (conv.buyerUnreadCount || 0);
            totalUnread += count;
          });
          setUnreadMsgCount(totalUnread);
        },
        (err) => {
          console.warn("Unread msg count error:", err);
        }
      );
      unsubs.push(unsub);
    });

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [activeUser, userUid, userEmail]);

  // ========================================
  // WISHLIST BADGE
  // ========================================
  useEffect(() => {
    if (!activeUser || !userUid || !auth.currentUser) {
      setWishlistCount(0);
      return;
    }

    const wishRef = collection(db, "users", userUid, "wishlist");
    const unsub = onSnapshot(
      wishRef,
      (snapshot) => {
        setWishlistCount(snapshot.size);
      },
      (err) => {
        console.warn("Wishlist count listener error:", err);
      }
    );

    return () => {
      unsub();
    };
  }, [activeUser, userUid]);

    // ========================================
// CATEGORIES
// ========================================
const categories = [
  { name: "Academic", icon: "📚" },
  { name: "Novels", icon: "📖" },
  { name: "Programming", icon: "💻" },
  { name: "Competitive Exams", icon: "🏆" },
  { name: "School", icon: "🏫" },
  { name: "Kids", icon: "🧸" },
  { name: "Comics", icon: "🦸" },
  { name: "Finance & Business", icon: "💼" },
  { name: "Self-Help", icon: "🧠" },
  { name: "Romance", icon: "❤️" },
  { name: "Mystery & Thriller", icon: "🔍" },
  { name: "Science & Engineering", icon: "🔬" },
  { name: "History & Biography", icon: "📜" },
  { name: "Medical & Law", icon: "⚖️" },
  { name: "Other", icon: "📚" }
];

  // ========================================
  // SEARCH FILTER
  // ========================================
  const filteredBooks = books.filter((book) => {
    const search = searchTerm.toLowerCase().trim();
    if (!search) return true;

    const titleMatch = (book.bookName || book.title || "")
      .toLowerCase()
      .includes(search);

    const authorMatch = (book.author || "")
      .toLowerCase()
      .includes(search);

    const categoryMatch = (book.category || "")
      .toLowerCase()
      .includes(search);

    const conditionMatch = (book.condition || "")
      .toLowerCase()
      .includes(search);

    return titleMatch || authorMatch || categoryMatch || conditionMatch;
  });

  // ========================================
  // OPEN BOOK
  // ========================================
  const openBook = (book) => {
    setSelectedBook(book);
    setPage("bookDetails");
  };

  return (
    <div className="home">
      {/* ====================================
          TOP NAVBAR
      ==================================== */}
      <header className="top-navbar">
        <div className="brand">
          <span className="book-emoji">📚</span>
          <span>BOOKZEN</span>
        </div>

        <div className="top-navbar-actions">
          {/* MESSAGES INBOX BUTTON */}
          <div
            className="navbar-icon-btn"
            onClick={() => setPage("messages")}
            title="Messages"
          >
            <FaComments className="navbar-action-icon" />
            {unreadMsgCount > 0 && (
              <span className="action-badge-count">
                {unreadMsgCount > 9 ? "9+" : unreadMsgCount}
              </span>
            )}
          </div>

          {/* WISHLIST BUTTON */}
          <div
            className="navbar-icon-btn"
            onClick={() => setPage("wishlist")}
            title="My Wishlist"
          >
            <FaHeart className="navbar-action-icon heart" />
            {wishlistCount > 0 && (
              <span className="action-badge-count">
                {wishlistCount > 9 ? "9+" : wishlistCount}
              </span>
            )}
          </div>

          {/* NOTIFICATION BUTTON */}
          <div
            className="navbar-icon-btn"
            onClick={() => setPage("notifications")}
            title="Notifications"
          >
            <FaBell className="navbar-action-icon" />
            {unreadNotifCount > 0 && (
              <span className="action-badge-count">
                {unreadNotifCount > 9 ? "9+" : unreadNotifCount}
              </span>
            )}
          </div>
        </div>
      </header>

      {/* ====================================
          SEARCH
      ==================================== */}
      <div className="home-search">
        <input
          type="text"
          placeholder="Search books, authors..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <span>🔍</span>
      </div>

      {/* ====================================
          HOME CONTENT
      ==================================== */}
      <main className="home-content">
        {/* CATEGORIES */}
        <section className="categories-section">
          <h2>Categories</h2>

          <div className="categories-scroll">
            {categories.map((item) => (
              <button
                key={item.name}
                className="category-item"
                onClick={() => {
                  setCategory(item.name);
                  setPage("categoryBooks");
                }}
              >
                <span className="category-icon">{item.icon}</span>
                <span>{item.name}</span>
              </button>
            ))}
          </div>
        </section>

        {/* LATEST BOOKS */}
        <section className="latest-books-section">
          <h2>{searchTerm ? "Search Results" : "Latest Books"}</h2>

          {/* LOADING */}
          {loading ? (
            <p className="no-books">Loading books...</p>
          ) : filteredBooks.length === 0 ? (
            <p className="no-books">
              {searchTerm
                ? "No books found matching your search."
                : "No books available yet."}
            </p>
          ) : (
            <div className="book-container">
              {filteredBooks.map((book) => (
                <div
                  className="book-card"
                  key={book.id}
                  onClick={() => openBook(book)}
                >
                  {/* BOOK IMAGE */}
                  <div className="book-card-image">
                    <img
                      src={
                        book.frontCover ||
                        book.frontImage ||
                        book.image ||
                        ""
                      }
                      alt={book.bookName || book.title || "Book"}
                    />
                  </div>

                  {/* BOOK DETAILS */}
                  <div className="book-card-content">
                    <h3>{book.bookName || book.title}</h3>
                    <p>{book.author}</p>
                    <p>
                      {book.category}{" "}
                      {book.condition ? `• ${book.condition}` : ""}
                    </p>
                    <h4>₹{book.price}</h4>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default Home;