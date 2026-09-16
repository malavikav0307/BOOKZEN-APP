import { useEffect, useState } from "react";
import "./CategoryBooks.css";

import { db } from "../firebase";
import { collection, onSnapshot } from "firebase/firestore";

function CategoryBooks({
  category,
  setPage,
  setSelectedBook,
  goBack
}) {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);

  // ========================================
  // REAL-TIME BOOKS LISTENER
  // ========================================
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "books"),
      (snapshot) => {
        const bookList = snapshot.docs.map((book) => ({
          ...book.data(),
          id: book.id
        }));

        // In-memory sort by createdAt descending
        bookList.sort((a, b) => {
          const tA = a.createdAt?.toMillis ? a.createdAt.toMillis() : a.createdAt || 0;
          const tB = b.createdAt?.toMillis ? b.createdAt.toMillis() : b.createdAt || 0;
          return tB - tA;
        });

        setBooks(bookList);
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching books:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // ========================================
  // FILTER CATEGORY
  // ========================================
  const filteredBooks = books.filter(
    (book) =>
      book.category?.toLowerCase() ===
      category?.toLowerCase()
  );

  // ========================================
  // OPEN BOOK
  // ========================================
  const openBook = (book) => {
    setSelectedBook(book);
    setPage("bookDetails");
  };

  const handleBack = () => {
    if (typeof goBack === "function") {
      goBack("categories");
    } else {
      setPage("categories");
    }
  };

  return (
    <div className="category-books-page">
      {/* BACK */}
      <button
        type="button"
        className="back-button"
        onClick={handleBack}
        title="Back to Categories"
      >
        ←
      </button>

      {/* TITLE */}
      <h1>{category} Books</h1>

      {/* LOADING */}
      {loading ? (
        <p className="no-books">Loading books...</p>
      ) : filteredBooks.length === 0 ? (
        <p className="no-books">No books available in this category.</p>
      ) : (
        <div className="book-container">
          {filteredBooks.map((book) => (
            <div
              className="book-card"
              key={book.id}
              onClick={() => openBook(book)}
            >
              {/* IMAGE */}
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

              {/* DETAILS */}
              <div className="book-card-content">
                <h3>{book.bookName || book.title}</h3>
                <p>{book.author}</p>
                <p>
                  {book.category} {book.condition ? `• ${book.condition}` : ""}
                </p>
                <h4>₹{book.price}</h4>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default CategoryBooks;