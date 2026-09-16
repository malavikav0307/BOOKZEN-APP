import { useEffect, useState } from "react";
import "./Profile.css";

import { db, auth, storage } from "../firebase";
import { signOut } from "firebase/auth";
import {
  collection,
  query,
  where,
  getDocs,
  deleteDoc,
  doc
} from "firebase/firestore";
import {
  ref,
  deleteObject
} from "firebase/storage";

function Profile({ setPage, setSelectedBook, currentUser, goBack }) {
  const activeUser = currentUser || auth.currentUser;

  const userEmail =
    activeUser?.email ||
    localStorage.getItem("userEmail") ||
    "User";

  const userUid = activeUser?.uid || "";

  const [myBooks, setMyBooks] = useState([]);
  const [wishlistCount, setWishlistCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [deletingBookId, setDeletingBookId] = useState(null);

  // ========================================
  // LOGOUT
  // ========================================
  const handleLogout = async () => {
    const confirmLogout = window.confirm(
      "Are you sure you want to logout?"
    );

    if (!confirmLogout) return;

    try {
      await signOut(auth);

      localStorage.removeItem("userEmail");
      localStorage.removeItem("userName");

      setPage("login", { clearHistory: true });
    } catch (error) {
      console.error("Logout Error:", error);
      alert("Failed to logout. Please try again.");
    }
  };

  // ========================================
  // FETCH USER WISHLIST COUNT & MY BOOKS
  // ========================================
  useEffect(() => {
    let isMounted = true;

    const fetchWishlistAndBooks = async () => {
      const user = auth.currentUser || currentUser;

      if (!user || !user.uid || !auth.currentUser) {
        if (isMounted) {
          setLoading(false);
        }
        return;
      }

      try {
        if (isMounted) {
          setLoading(true);
        }

        // ========================================
        // 1. FETCH WISHLIST COUNT
        // ========================================
        try {
          const wishRef = collection(
            db,
            "users",
            user.uid,
            "wishlist"
          );

          const wishSnap = await getDocs(wishRef);

          if (isMounted) {
            setWishlistCount(wishSnap.size);
          }
        } catch (wishErr) {
          console.warn(
            "Could not load wishlist count:",
            wishErr
          );
        }

        // ========================================
        // 2. FETCH MY SELL BOOKS
        // ========================================
        const booksRef = collection(db, "books");
        const queryList = [];

        // UID based search
        if (user.uid) {
          queryList.push(
            query(
              booksRef,
              where("sellerId", "==", user.uid)
            )
          );

          queryList.push(
            query(
              booksRef,
              where("sellerUid", "==", user.uid)
            )
          );
        }

        // Email based search
        if (user.email) {
          queryList.push(
            query(
              booksRef,
              where("sellerEmail", "==", user.email)
            )
          );

          const lowerEmail = user.email.toLowerCase();

          if (lowerEmail !== user.email) {
            queryList.push(
              query(
                booksRef,
                where("sellerEmail", "==", lowerEmail)
              )
            );
          }
        }

        const snapshots = await Promise.all(
          queryList.map((q) => getDocs(q))
        );

        const bookMap = new Map();

        snapshots.forEach((snap) => {
          snap.docs.forEach((d) => {
            bookMap.set(d.id, {
              ...d.data(),
              id: d.id
            });
          });
        });

        const booksData = Array.from(bookMap.values());

        // Sort newest first
        booksData.sort((a, b) => {
          const tA = a.createdAt?.toMillis
            ? a.createdAt.toMillis()
            : a.createdAt || 0;

          const tB = b.createdAt?.toMillis
            ? b.createdAt.toMillis()
            : b.createdAt || 0;

          return tB - tA;
        });

        if (isMounted) {
          setMyBooks(booksData);
        }
      } catch (error) {
        console.error(
          "Error loading profile books:",
          error
        );
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchWishlistAndBooks();

    return () => {
      isMounted = false;
    };
  }, [userEmail, userUid, currentUser]);

  // ========================================
  // DELETE MY BOOK - OWNER ONLY
  // ========================================
  const deleteBook = async (bookId) => {
    const user = auth.currentUser;

    if (!user || !user.uid) {
      alert("Please login again.");
      setPage("login");
      return;
    }

    const bookToDelete = myBooks.find(
      (b) => b.id === bookId
    );

    if (bookToDelete) {
      const isOwner =
        bookToDelete.sellerId === user.uid ||
        bookToDelete.sellerUid === user.uid ||
        (
          bookToDelete.sellerEmail &&
          user.email &&
          bookToDelete.sellerEmail.toLowerCase() ===
            user.email.toLowerCase()
        );

      if (!isOwner) {
        alert("You can only delete your own books.");
        return;
      }
    }

    const confirmDelete = window.confirm(
      "Are you sure you want to delete this book listing? It will be removed from BOOKZEN immediately."
    );

    if (!confirmDelete) return;

    try {
      setDeletingBookId(bookId);

      // Delete Firestore book
      await deleteDoc(
        doc(db, "books", bookId)
      );

      // Delete Storage images
      if (bookToDelete) {
        const imageUrls = [
          bookToDelete.frontCover,
          bookToDelete.insidePage1,
          bookToDelete.insidePage2,
          bookToDelete.insidePage3,
          bookToDelete.insidePage4,
          bookToDelete.backCover
        ].filter(Boolean);

        for (const imgUrl of imageUrls) {
          if (
            typeof imgUrl === "string" &&
            imgUrl.includes(
              "firebasestorage.googleapis.com"
            )
          ) {
            try {
              const imageRef = ref(
                storage,
                imgUrl
              );

              await deleteObject(imageRef);
            } catch (storageErr) {
              console.warn(
                "Storage image cleanup skipped:",
                storageErr
              );
            }
          }
        }
      }

      // Remove from UI immediately
      setMyBooks((prevBooks) =>
        prevBooks.filter(
          (book) => book.id !== bookId
        )
      );

      // Remove old localStorage copy if exists
      try {
        const local = JSON.parse(
          localStorage.getItem("books") || "[]"
        );

        localStorage.setItem(
          "books",
          JSON.stringify(
            local.filter(
              (b) => b.id !== bookId
            )
          )
        );
      } catch (e) {
        console.warn(e);
      }

      alert("Book deleted successfully.");
    } catch (error) {
      console.error(
        "Error deleting book:",
        error
      );

      alert(
        "Unable to delete this book: " +
          (error.message ||
            "Please check your connection.")
      );
    } finally {
      setDeletingBookId(null);
    }
  };

  // ========================================
  // OPEN BOOK DETAILS
  // ========================================
  const openBookDetails = (book) => {
    setSelectedBook(book);
    setPage("bookDetails");
  };

  // ========================================
  // BACK
  // ========================================
  const handleBack = () => {
    if (typeof goBack === "function") {
      goBack("home");
    } else {
      setPage("home");
    }
  };

  // ========================================
  // UI
  // ========================================
  return (
    <div className="profile-page">

      {/* BACK BUTTON */}
      <button
        type="button"
        className="back-button"
        onClick={handleBack}
        title="Back"
      >
        ←
      </button>

      {/* TITLE */}
      <h1>Profile</h1>

      {/* USER PROFILE CARD */}
      <div className="profile-card">
        <div className="profile-icon">
          👤
        </div>

        <div className="profile-user-details">
          <div className="profile-detail-item">
            <span className="profile-detail-label">
              Email
            </span>

            <span className="profile-user-email">
              {userEmail}
            </span>
          </div>
        </div>
      </div>

      {/* ========================================
          WISHLIST
      ======================================== */}
      <div className="profile-section">
        <div className="section-title">
          <h2>💖 My Wishlist</h2>

          <span>
            {wishlistCount}
          </span>
        </div>

        <button
          type="button"
          className="profile-option"
          onClick={() =>
            setPage("wishlist")
          }
        >
          View Saved Wishlist Books (
          {wishlistCount}
          ) →
        </button>
      </div>

      {/* ========================================
          MY SELL BOOKS
      ======================================== */}
      <div className="profile-section">
        <div className="section-title">
          <h2>📚 My Sell Books</h2>

          <span>
            {myBooks.length}
          </span>
        </div>

        {loading ? (
          <p className="no-books">
            Loading your books...
          </p>
        ) : myBooks.length === 0 ? (
          <p className="no-books">
            You haven't listed any books for sale yet.
          </p>
        ) : (
          <div className="my-books-list">
            {myBooks.map((book) => (
              <div
                className="my-book-card"
                key={book.id}
              >

                {/* BOOK IMAGE */}
                <img
                  src={
                    book.frontCover ||
                    book.frontImage ||
                    book.image ||
                    ""
                  }
                  alt={
                    book.bookName ||
                    book.title ||
                    "Book"
                  }
                  onClick={() =>
                    openBookDetails(book)
                  }
                  style={{
                    cursor: "pointer"
                  }}
                />

                {/* BOOK DETAILS */}
                <div className="my-book-info">

                  <h3
                    onClick={() =>
                      openBookDetails(book)
                    }
                    style={{
                      cursor: "pointer"
                    }}
                  >
                    {book.bookName ||
                      book.title}
                  </h3>

                  <p>
                    by {book.author}{" "}
                    {book.condition
                      ? `• ${book.condition}`
                      : ""}
                  </p>

                  <strong>
                    ₹{book.price}
                  </strong>

                  {/* BUTTONS */}
                  <div className="my-book-buttons">

                    <button
                      type="button"
                      className="view-book-button"
                      onClick={() =>
                        openBookDetails(book)
                      }
                    >
                      👁️ View Book
                    </button>

                    <button
                      type="button"
                      className="delete-book-button"
                      onClick={() =>
                        deleteBook(book.id)
                      }
                      disabled={
                        deletingBookId === book.id
                      }
                    >
                      {deletingBookId ===
                      book.id
                        ? "Deleting..."
                        : "🗑 Delete"}
                    </button>

                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ========================================
          ORDER MANAGEMENT
      ======================================== */}
      <div className="profile-section">
        <div className="section-title">
          <h2>📦 Order Management</h2>
        </div>

        <button
          type="button"
          className="profile-option"
          onClick={() =>
            setPage("orders")
          }
        >
          View My Orders & Received Sales →
        </button>
      </div>

      {/* ========================================
          LOGOUT
      ======================================== */}
      <div className="profile-section">
        <button
          type="button"
          className="logout-button"
          onClick={handleLogout}
        >
          🚪 Logout
        </button>
      </div>

    </div>
  );
}

export default Profile;