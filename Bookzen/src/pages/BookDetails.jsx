import { useState, useRef, useEffect } from "react";
import "./BookDetails.css";
import { db, auth } from "../firebase";
import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  serverTimestamp
} from "firebase/firestore";

function BookDetails({
  book,
  setPage,
  setSelectedBook,
  currentUser,
  goBack
}) {
  const [currentImage, setCurrentImage] = useState(0);
  const [showFullImage, setShowFullImage] = useState(false);
  const [inWishlist, setInWishlist] = useState(false);
  const [wishlistLoading, setWishlistLoading] = useState(false);

  const touchStartX = useRef(null);
  const touchEndX = useRef(null);

  const activeUser = currentUser || auth.currentUser;

  // =========================================================================
  // BACK NAVIGATION
  // =========================================================================
  const handleBack = () => {
    if (typeof goBack === "function") {
      goBack("home");
    } else if (typeof setPage === "function") {
      setPage("home");
    }
  };

  // =========================================================================
  // CHECK WISHLIST STATUS
  // =========================================================================
  useEffect(() => {
    let isMounted = true;

    const checkWishlist = async () => {
      const user = auth.currentUser || currentUser;
      const userUid = user?.uid;

      if (!userUid || !book?.id) {
        if (isMounted) {
          setInWishlist(false);
        }
        return;
      }

      try {
        const wishDocRef = doc(
          db,
          "users",
          userUid,
          "wishlist",
          book.id
        );

        const snap = await getDoc(wishDocRef);

        if (isMounted) {
          setInWishlist(snap.exists());
        }
      } catch (err) {
        console.warn("Could not check wishlist status:", err);
      }
    };

    checkWishlist();

    return () => {
      isMounted = false;
    };
  }, [currentUser, book?.id]);

  // =========================================================================
  // TOGGLE WISHLIST
  // =========================================================================
  const toggleWishlist = async () => {
    const user = auth.currentUser || currentUser;
    const userUid = user?.uid;

    if (!user || !userUid) {
      alert("Please login to save books to your wishlist.");
      setPage("login");
      return;
    }

    if (!book?.id) return;

    try {
      setWishlistLoading(true);

      const wishDocRef = doc(
        db,
        "users",
        userUid,
        "wishlist",
        book.id
      );

      if (inWishlist) {
        await deleteDoc(wishDocRef);
        setInWishlist(false);
      } else {
        await setDoc(wishDocRef, {
          bookId: book.id,
          userId: userUid,
          userEmail: user.email || "",
          title: book.bookName || book.title || "Book",
          bookName: book.bookName || book.title || "Book",
          author: book.author || "Unknown Author",
          price: book.price || 0,
          category: book.category || "General",
          condition: book.condition || "Good",
          stock:
            typeof book.stock === "number"
              ? book.stock
              : parseInt(book.stock, 10) ||
                parseInt(book.stack, 10) ||
                parseInt(book.quantity, 10) ||
                0,
          frontCover:
            book.frontCover ||
            book.frontImage ||
            book.image ||
            "",
          sellerId:
            book.sellerId ||
            book.sellerUid ||
            "",
          sellerEmail:
            book.sellerEmail ||
            "",
          createdAt: serverTimestamp()
        });

        setInWishlist(true);
      }
    } catch (err) {
      console.error("Error updating wishlist:", err);
      alert(
        "Failed to update wishlist: " +
          (err.message || "Please try again.")
      );
    } finally {
      setWishlistLoading(false);
    }
  };

  // =========================================================================
  // EMPTY / DELETED STATE
  // =========================================================================
  if (!book || book.isDeleted) {
    return (
      <div className="book-details-page empty-state">
        <header className="details-top-nav">
          <button
            type="button"
            className="details-back-btn"
            onClick={handleBack}
            aria-label="Go Back"
          >
            ←
          </button>
          <span className="details-nav-title">Book Details</span>
        </header>

        <div className="not-found-box">
          <span className="not-found-icon">📚</span>
          <h2>This book is no longer available.</h2>
          <p>The requested book listing has been removed or sold by the seller.</p>
          <button className="go-home-btn" onClick={handleBack}>
            ← Back to Marketplace
          </button>
        </div>
      </div>
    );
  }

  // =========================================================================
  // NORMALIZE IMAGES (Front Cover, Back Cover, Inside Pages 1-4)
  // =========================================================================
  const getNormalizedImages = () => {
    const list = [];
    const addedUrls = new Set();

    const addImage = (url, label) => {
      if (url && typeof url === "string" && url.trim() && !addedUrls.has(url.trim())) {
        addedUrls.add(url.trim());
        list.push({ url: url.trim(), label });
      }
    };

    // 1. FRONT COVER
    addImage(book.frontCover || book.frontImage, "Front Cover");

    // 2. BACK COVER
    addImage(book.backCover || book.backImage, "Back Cover");

    // 3. INSIDE PAGE 1
    addImage(book.insidePage1, "Inside Page 1");

    // 4. INSIDE PAGE 2
    addImage(book.insidePage2, "Inside Page 2");

    // 5. INSIDE PAGE 3
    addImage(book.insidePage3, "Inside Page 3");

    // 6. INSIDE PAGE 4
    addImage(book.insidePage4, "Inside Page 4");

    // 7. INSIDE IMAGE (Fallback)
    if (!book.insidePage1 && book.insideImage) {
      addImage(book.insideImage, "Inside Page");
    }

    // 8. IMAGES ARRAY (if any additional images)
    if (Array.isArray(book.images) && book.images.length > 0) {
      book.images.forEach((item, idx) => {
        if (typeof item === "string" && item.trim()) {
          let label = `Image ${idx + 1}`;
          if (idx === 0 && !book.frontCover) label = "Front Cover";
          else if (idx === book.images.length - 1 && !book.backCover) label = "Back Cover";
          else label = `Inside Page ${idx}`;
          addImage(item, label);
        } else if (item && item.url) {
          addImage(item.url, item.label || `Image ${idx + 1}`);
        }
      });
    }

    // 9. GENERIC IMAGE FALLBACK
    if (list.length === 0 && book.image) {
      addImage(book.image, "Book Cover");
    }

    return list;
  };

  const images = getNormalizedImages();
  const safeIndex = images.length > 0 ? Math.min(currentImage, images.length - 1) : 0;
  const activeImage = images[safeIndex] || { url: "", label: "No image" };

  // =========================================================================
  // BOOK INFORMATION FIELDS
  // =========================================================================
  const bookTitle = book.bookName || book.title || "Untitled Book";
  const bookAuthor = book.author || "Unknown Author";
  const bookCategory = book.category || "General";
  const bookCondition = book.condition || "Good";
  const bookPrice = book.price || 0;
  const bookEdition = book.edition || "Standard Edition";
  const bookDelivery = book.delivery || "3-5";

  // =========================================================================
  // STOCK STATUS
  // =========================================================================
  const bookStock =
    typeof book.stock === "number"
      ? Math.max(0, book.stock)
      : parseInt(book.stock, 10) ||
        parseInt(book.stack, 10) ||
        parseInt(book.quantity, 10) ||
        0;

  const isOutOfStock = bookStock <= 0;

  // =========================================================================
  // IMAGE NAVIGATION & SWIPE
  // =========================================================================
  const nextImage = () => {
    if (images.length <= 1) return;
    setCurrentImage((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  };

  const previousImage = () => {
    if (images.length <= 1) return;
    setCurrentImage((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const handleTouchStart = (e) => {
    touchStartX.current = e.targetTouches[0].clientX;
  };

  const handleTouchMove = (e) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current) return;
    const diff = touchStartX.current - touchEndX.current;
    const threshold = 40;
    if (diff > threshold) {
      nextImage();
    } else if (diff < -threshold) {
      previousImage();
    }
    touchStartX.current = null;
    touchEndX.current = null;
  };

  // =========================================================================
  // OWNER CHECK
  // =========================================================================
  const isOwner = Boolean(
    activeUser &&
      ((book.sellerId && activeUser.uid === book.sellerId) ||
        (book.sellerUid && activeUser.uid === book.sellerUid) ||
        (book.sellerEmail &&
          activeUser.email &&
          activeUser.email.toLowerCase() === book.sellerEmail.toLowerCase()))
  );

  // =========================================================================
  // CHAT WITH SELLER
  // =========================================================================
  const chatWithSeller = () => {
    if (isOwner) {
      alert("You cannot chat with yourself for your own book listing.");
      return;
    }

    const bookData = {
      ...book,
      id: book.id,
      bookId: book.id,
      title: bookTitle,
      bookName: bookTitle,
      sellerId: book.sellerId || book.sellerUid || "",
      sellerUid: book.sellerUid || book.sellerId || "",
      sellerEmail: book.sellerEmail || book.seller || "",
      frontCover:
        book.frontCover ||
        book.frontImage ||
        book.image ||
        (images.length > 0 ? images[0].url : "")
    };

    setSelectedBook(bookData);
    setPage("chat");
  };

  // =========================================================================
  // BUY NOW
  // =========================================================================
  const buyNow = () => {
    if (isOwner) {
      alert("You cannot purchase your own book listing.");
      return;
    }

    if (isOutOfStock) {
      alert("Sorry! This book is currently out of stock.");
      return;
    }

    setSelectedBook(book);
    setPage("delivery");
  };

  // Condition pill style
  const getConditionPillClass = (cond) => {
    const c = (cond || "").toLowerCase();
    if (c.includes("like new") || c === "new") return "cond-like-new";
    if (c.includes("very good")) return "cond-very-good";
    if (c.includes("good")) return "cond-good";
    return "cond-acceptable";
  };

  return (
    <div className="book-details-page">
      {/* =====================================================
          TOP HEADER
      ===================================================== */}
      <header className="details-top-nav">
        <button
          type="button"
          className="details-back-btn"
          onClick={handleBack}
          aria-label="Go Back"
        >
          ←
        </button>

        <span className="details-nav-title">Book Details</span>

        <button
          type="button"
          className={`details-wishlist-toggle ${inWishlist ? "active" : ""}`}
          onClick={toggleWishlist}
          disabled={wishlistLoading}
          aria-label={inWishlist ? "Remove from Wishlist" : "Add to Wishlist"}
          title={inWishlist ? "Saved to Wishlist" : "Add to Wishlist"}
        >
          {inWishlist ? "♥" : "♡"}
        </button>
      </header>

      {/* =====================================================
          MAIN PRODUCT LAYOUT CONTAINER
      ===================================================== */}
      <main className="details-main-content">
        <div className="details-layout-grid">
          {/* ===================================================
              PRODUCT IMAGE & GALLERY SECTION
          =================================================== */}
          <section className="product-image-section">
            <div
              className="main-image-card"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              {/* CURRENT IMAGE BADGE */}
              {images.length > 0 && (
                <div className="image-info-pill">
                  <span className="image-pill-label">{activeImage.label}</span>
                  <span className="image-pill-index">
                    {safeIndex + 1} / {images.length}
                  </span>
                </div>
              )}

              {/* NAVIGATION ARROWS (DESKTOP / TABLET) */}
              {images.length > 1 && (
                <button
                  type="button"
                  className="gallery-chevron left"
                  onClick={previousImage}
                  aria-label="Previous Image"
                >
                  ‹
                </button>
              )}

              {/* MAIN DISPLAY IMAGE */}
              {activeImage.url ? (
                <div
                  className="main-image-container"
                  onClick={() => setShowFullImage(true)}
                  title="Click to view full preview"
                >
                  <img
                    className="main-preview-image"
                    src={activeImage.url}
                    alt={`${bookTitle} - ${activeImage.label}`}
                    loading="eager"
                  />
                  <div className="tap-zoom-hint">
                    <span>🔍 Tap to expand</span>
                  </div>
                </div>
              ) : (
                <div className="no-image-display">
                  <span>📚</span>
                  <p>No preview image available</p>
                </div>
              )}

              {images.length > 1 && (
                <button
                  type="button"
                  className="gallery-chevron right"
                  onClick={nextImage}
                  aria-label="Next Image"
                >
                  ›
                </button>
              )}
            </div>

            {/* DOT INDICATORS (FOR QUICK SLIDE COUNT) */}
            {images.length > 1 && (
              <div className="gallery-indicator-dots">
                {images.map((_, idx) => (
                  <button
                    type="button"
                    key={idx}
                    className={`indicator-dot ${safeIndex === idx ? "active" : ""}`}
                    onClick={() => setCurrentImage(idx)}
                    aria-label={`View photo ${idx + 1}`}
                  />
                ))}
              </div>
            )}

            {/* HORIZONTAL THUMBNAIL GALLERY */}
            {images.length > 0 && (
              <div className="thumbnail-gallery-wrapper">
                <span className="thumbnail-gallery-title">Photos ({images.length})</span>
                <div className="thumbnail-horizontal-strip">
                  {images.map((img, idx) => (
                    <div
                      key={idx}
                      className={`thumbnail-box ${safeIndex === idx ? "active" : ""}`}
                      onClick={() => setCurrentImage(idx)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setCurrentImage(idx);
                        }
                      }}
                    >
                      <div className="thumbnail-img-frame">
                        <img src={img.url} alt={img.label} loading="lazy" />
                      </div>
                      <span className="thumbnail-label">{img.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* ===================================================
              PRODUCT INFORMATION SECTION
          =================================================== */}
          <section className="product-info-section">
            <div className="info-main-card">
              {/* TOP ROW: PRICE & CONDITION */}
              <div className="price-status-header">
                <div className="product-price-wrapper">
                  <span className="price-symbol">₹</span>
                  <span className="price-amount">{bookPrice}</span>
                </div>

                <div className={`condition-badge ${getConditionPillClass(bookCondition)}`}>
                  <span className="badge-sparkle">✨</span>
                  <span>{bookCondition}</span>
                </div>
              </div>

              {/* BOOK TITLE */}
              <h1 className="product-title">{bookTitle}</h1>

              {/* AUTHOR */}
              <p className="product-author">
                by <span className="author-highlight">{bookAuthor}</span>
              </p>

              {/* STOCK & AVAILABILITY STATUS */}
              <div
                className={`stock-status-pill ${
                  isOutOfStock
                    ? "status-out-of-stock"
                    : bookStock === 1
                    ? "status-low-stock"
                    : "status-in-stock"
                }`}
              >
                <span className="status-dot" />
                <span className="status-text">
                  {isOutOfStock
                    ? "Out of Stock"
                    : bookStock === 1
                    ? "Only 1 copy available"
                    : `In Stock (${bookStock} copies)`}
                </span>
              </div>

              {/* QUICK SPECS / META GRID */}
              <div className="specs-grid">
                <div className="spec-card">
                  <span className="spec-icon">📚</span>
                  <div className="spec-content">
                    <span className="spec-label">Category</span>
                    <span className="spec-value">{bookCategory}</span>
                  </div>
                </div>

                <div className="spec-card">
                  <span className="spec-icon">📖</span>
                  <div className="spec-content">
                    <span className="spec-label">Edition</span>
                    <span className="spec-value">{bookEdition}</span>
                  </div>
                </div>

                <div className="spec-card highlight">
                  <span className="spec-icon">🚚</span>
                  <div className="spec-content">
                    <span className="spec-label">Delivery</span>
                    <span className="spec-value">{bookDelivery} Days Fast Delivery</span>
                  </div>
                </div>

                <div className="spec-card">
                  <span className="spec-icon">🏷️</span>
                  <div className="spec-content">
                    <span className="spec-label">Condition</span>
                    <span className="spec-value">{bookCondition}</span>
                  </div>
                </div>
              </div>

              {/* DIVIDER */}
              <hr className="info-section-divider" />

              {/* DESCRIPTION */}
              <div className="product-description-block">
                <h3 className="section-subtitle">
                  <span>📝</span> Book Description & Condition
                </h3>

                <div className="description-content-box">
                  {book.description ? (
                    book.description.split("\n").map((para, idx) => (
                      <p key={idx}>{para}</p>
                    ))
                  ) : (
                    <p className="no-desc-text">
                      No additional description provided by the seller for this book listing.
                    </p>
                  )}
                </div>
              </div>

              {/* ADDITIONAL NOTES */}
              {book.otherDetails && (
                <div className="other-notes-block">
                  <h4 className="notes-subtitle">📌 Seller's Special Notes</h4>
                  <p>{book.otherDetails}</p>
                </div>
              )}

              {/* WISHLIST BUTTON IN CARD */}
              <div className="card-wishlist-action">
                <button
                  type="button"
                  className={`card-wishlist-btn ${inWishlist ? "in-wishlist" : ""}`}
                  onClick={toggleWishlist}
                  disabled={wishlistLoading}
                >
                  <span className="wishlist-btn-icon">{inWishlist ? "♥" : "♡"}</span>
                  <span>{inWishlist ? "Saved in Wishlist" : "Add to Wishlist"}</span>
                </button>
              </div>

              {/* ACTION BUTTONS (BUY NOW & CHAT WITH SELLER) */}
              <div className="product-action-footer">
                {isOwner ? (
                  <div className="owner-listing-banner">
                    <span className="owner-banner-icon">🏷️</span>
                    <div>
                      <strong>Your Published Listing</strong>
                      <p>You are the seller of this book listing.</p>
                    </div>
                  </div>
                ) : (
                  <div className="action-buttons-group">
                    {/* PRIMARY ACTION: BUY NOW */}
                    <button
                      type="button"
                      className={`primary-buy-btn ${isOutOfStock ? "disabled" : ""}`}
                      onClick={buyNow}
                      disabled={isOutOfStock}
                    >
                      <span className="btn-icon">⚡</span>
                      <span>{isOutOfStock ? "Out of Stock" : "Buy Now"}</span>
                    </button>

                    {/* SECONDARY ACTION: CHAT WITH SELLER */}
                    <button
                      type="button"
                      className="secondary-chat-btn"
                      onClick={chatWithSeller}
                    >
                      <span className="btn-icon">💬</span>
                      <span>Chat with Seller</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* =====================================================
          FULLSCREEN LIGHTBOX MODAL
      ===================================================== */}
      {showFullImage && activeImage.url && (
        <div className="fullscreen-lightbox" onClick={() => setShowFullImage(false)}>
          <div className="lightbox-header" onClick={(e) => e.stopPropagation()}>
            <span className="lightbox-title">
              {bookTitle} - {activeImage.label} ({safeIndex + 1} of {images.length})
            </span>
            <button
              type="button"
              className="lightbox-close"
              onClick={() => setShowFullImage(false)}
              aria-label="Close Fullscreen"
            >
              ✕
            </button>
          </div>

          <div className="lightbox-body">
            {images.length > 1 && (
              <button
                type="button"
                className="lightbox-arrow left"
                onClick={(e) => {
                  e.stopPropagation();
                  previousImage();
                }}
                aria-label="Previous"
              >
                ‹
              </button>
            )}

            <img
              src={activeImage.url}
              alt={bookTitle}
              className="lightbox-image"
              onClick={(e) => e.stopPropagation()}
            />

            {images.length > 1 && (
              <button
                type="button"
                className="lightbox-arrow right"
                onClick={(e) => {
                  e.stopPropagation();
                  nextImage();
                }}
                aria-label="Next"
              >
                ›
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default BookDetails;