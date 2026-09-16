import { useEffect, useState } from "react";
import "./Wishlist.css";
import { db, auth } from "../firebase";
import {
  collection,
  onSnapshot,
  doc,
  deleteDoc,
  getDoc
} from "firebase/firestore";

function Wishlist({ setPage, setSelectedBook, currentUser, goBack }) {
  const [wishlistItems, setWishlistItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState(null);

  const activeUser = currentUser || auth.currentUser;
  const userUid = activeUser?.uid || "";

  const handleBack = () => {
    if (typeof goBack === "function") {
      goBack("home");
    } else if (typeof setPage === "function") {
      setPage("home");
    }
  };

  // =========================================================
  // REAL-TIME WISHLIST LISTENER
  // =========================================================
  useEffect(() => {
    if (!activeUser || !userUid || !auth.currentUser) {
      setWishlistItems([]);
      setLoading(false);
      return;
    }

    const wishlistRef = collection(db, "users", userUid, "wishlist");

    const unsubscribe = onSnapshot(
      wishlistRef,
      (snapshot) => {
        const items = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data()
        }));

        // Sort descending by createdAt
        items.sort((a, b) => {
          const tA = a.createdAt?.toMillis ? a.createdAt.toMillis() : a.createdAt || 0;
          const tB = b.createdAt?.toMillis ? b.createdAt.toMillis() : b.createdAt || 0;
          return tB - tA;
        });

        setWishlistItems(items);
        setLoading(false);
      },
      (error) => {
        console.error("Wishlist listener error:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [activeUser, userUid]);

  // =========================================================
  // REMOVE FROM WISHLIST
  // =========================================================
  const handleRemoveFromWishlist = async (bookId, e) => {
    if (e) e.stopPropagation();
    if (!userUid) return;

    try {
      setRemovingId(bookId);
      await deleteDoc(doc(db, "users", userUid, "wishlist", bookId));
    } catch (err) {
      console.error("Error removing from wishlist:", err);
      alert("Failed to remove item: " + (err.message || ""));
    } finally {
      setRemovingId(null);
    }
  };

  // =========================================================
  // OPEN BOOK DETAILS
  // =========================================================
  const handleOpenBook = async (item) => {
    const bookId = item.bookId || item.id;
    if (!bookId) return;

    try {
      // Check if the book is still active in the marketplace
      const bookSnap = await getDoc(doc(db, "books", bookId));

      if (bookSnap.exists()) {
        setSelectedBook({
          ...bookSnap.data(),
          id: bookSnap.id
        });
        setPage("bookDetails");
      } else {
        // Book was deleted by seller
        const confirmRemove = window.confirm(
          `"This book is no longer available." It may have been sold or removed by the seller.\n\nWould you like to remove it from your Wishlist?`
        );
        if (confirmRemove && userUid) {
          await deleteDoc(doc(db, "users", userUid, "wishlist", bookId));
        }
      }
    } catch (err) {
      console.error("Error opening book from wishlist:", err);
      // Fallback with saved item data so user can at least view what it was
      setSelectedBook({
        ...item,
        id: bookId
      });
      setPage("bookDetails");
    }
  };

  return (
    <div className="wishlist-page">
      {/* HEADER */}
      <div className="wishlist-header">
        <button
          type="button"
          className="back-button"
          onClick={handleBack}
          title="Back"
        >
          ←
        </button>
        <h1>My Wishlist</h1>
        <span className="wishlist-count-pill">{wishlistItems.length}</span>
      </div>

      {/* LOADING */}
      {loading ? (
        <p className="no-books">Loading your saved books...</p>
      ) : !activeUser ? (
        <div className="wishlist-empty-box">
          <span className="empty-icon">🔒</span>
          <h3>Please Login</h3>
          <p>Login to your account to view your saved books wishlist.</p>
          <button
            type="button"
            className="explore-btn"
            onClick={() => setPage("login")}
          >
            Go to Login
          </button>
        </div>
      ) : wishlistItems.length === 0 ? (
        <div className="wishlist-empty-box">
          <span className="empty-icon">💖</span>
          <h3>Your Wishlist is Empty</h3>
          <p>Save books you're interested in by tapping the heart icon on any book listing!</p>
          <button
            type="button"
            className="explore-btn"
            onClick={() => setPage("home")}
          >
            Explore Books 📚
          </button>
        </div>
      ) : (
        <div className="wishlist-grid">
          {wishlistItems.map((item) => (
            <div
              className="wishlist-card"
              key={item.id}
              onClick={() => handleOpenBook(item)}
            >
              {/* IMAGE */}
              <div className="wishlist-card-image">
                <img
                  src={
                    item.frontCover ||
                    item.frontImage ||
                    item.image ||
                    ""
                  }
                  alt={item.title || item.bookName || "Book"}
                />
              </div>

              {/* INFO */}
              <div className="wishlist-card-info">
                <h3>{item.title || item.bookName || "Untitled Book"}</h3>
                <p>by {item.author || "Unknown"}</p>

                {item.category && (
                  <span className="wishlist-category-tag">
                    {item.category} {item.condition ? `• ${item.condition}` : ""}
                  </span>
                )}

                <div className="wishlist-card-bottom">
                  <strong>₹{item.price || 0}</strong>

                  <button
                    type="button"
                    className="remove-wishlist-btn"
                    onClick={(e) => handleRemoveFromWishlist(item.id, e)}
                    disabled={removingId === item.id}
                    title="Remove from Wishlist"
                  >
                    {removingId === item.id ? "..." : "🗑 Remove"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Wishlist;
