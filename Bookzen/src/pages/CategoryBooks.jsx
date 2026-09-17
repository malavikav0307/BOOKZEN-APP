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
      {/* HEADER */}
      <header className="category-books-header">
        <button
          type="button"
          className="back-button"
          onClick={handleBack}
          title="Back to Categories"
          aria-label="Back"
        >
          ←
        </button>

        <h1>{category} Books</h1>
      </header>

      {/* CONTENT */}
      <main className="category-books-content">
        {/* LOADING */}
        {loading ? (
          <p className="no-books">Loading books...</p>
        ) : filteredBooks.length === 0 ? (
          <p className="no-books">No books available in this category yet.</p>
        ) : (
          <div className="book-container">
            {filteredBooks.map((book) => {
              const coverImage =
                book.frontCover ||
                book.frontImage ||
                book.image ||
                (Array.isArray(book.images) && book.images[0]?.url
                  ? book.images[0].url
                  : Array.isArray(book.images) && typeof book.images[0] === "string"
                  ? book.images[0]
                  : "");

              const title = book.bookName || book.title || "Untitled Book";
              const author = book.author || "Unknown Author";

              return (
                <div
                  className="book-card"
                  key={book.id}
                  onClick={() => openBook(book)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      openBook(book);
                    }
                  }}
                >
                  {/* BOOK IMAGE CONTAINER */}
                  <div className="book-card-image">
                    {coverImage ? (
                      <img src={coverImage} alt={title} loading="lazy" />
                    ) : (
                      <div className="book-card-no-img">
                        <span>📚</span>
                      </div>
                    )}

                    {/* CONDITION BADGE OVERLAY */}
                    {book.condition && (
                      <span
                        className={`card-condition-pill cond-${(book.condition || "")
                          .toLowerCase()
                          .replace(/\s+/g, "-")}`}
                      >
                        {book.condition}
                      </span>
                    )}
                  </div>

                  {/* BOOK DETAILS CONTENT */}
                  <div className="book-card-content">
                    <h3 className="book-card-title" title={title}>
                      {title}
                    </h3>

                    <p className="book-card-author">by {author}</p>

                    <div className="book-card-meta-row">
                      {book.category && (
                        <span className="book-card-category-tag">
                          {book.category}
                        </span>
                      )}
                      {book.edition && (
                        <span className="book-card-edition-tag">
                          {book.edition}
                        </span>
                      )}
                    </div>

                    <div className="book-card-footer">
                      <div className="book-card-price">
                        <span className="currency-symbol">₹</span>
                        <span className="price-num">{book.price || 0}</span>
                      </div>
                      <span className="book-card-view-btn">View</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

export default CategoryBooks;