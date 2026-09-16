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
  // BACK
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
        console.warn(
          "Could not check wishlist status:",
          err
        );
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
      alert(
        "Please login to save books to your wishlist."
      );
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

          title:
            book.bookName ||
            book.title ||
            "Book",

          bookName:
            book.bookName ||
            book.title ||
            "Book",

          author:
            book.author ||
            "Unknown Author",

          price:
            book.price || 0,

          category:
            book.category ||
            "General",

          condition:
            book.condition ||
            "Good",

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
      console.error(
        "Error updating wishlist:",
        err
      );

      alert(
        "Failed to update wishlist: " +
          (err.message ||
            "Please try again.")
      );
    } finally {
      setWishlistLoading(false);
    }
  };

  // =========================================================================
  // NO BOOK
  // =========================================================================
  if (!book || book.isDeleted) {
    return (
      <div className="book-details-page empty-state">

        <button
          type="button"
          className="back-button"
          onClick={handleBack}
          title="Go Back"
        >
          ←
        </button>

        <div className="not-found-box">

          <span className="not-found-icon">
            📚
          </span>

          <h2>
            This book is no longer available.
          </h2>

          <p>
            The requested book listing has been
            removed or sold by the seller.
          </p>

          <button
            className="go-home-btn"
            onClick={handleBack}
          >
            ← Go Back
          </button>

        </div>
      </div>
    );
  }

  // =========================================================================
  // NORMALIZE IMAGES
  // =========================================================================
  const getNormalizedImages = () => {
    const list = [];

    // -----------------------------------------------------
    // CASE 1: images array
    // -----------------------------------------------------
    if (
      Array.isArray(book.images) &&
      book.images.length > 0
    ) {
      book.images.forEach((item, idx) => {

        if (
          typeof item === "string" &&
          item.trim()
        ) {
          let label = `Image ${idx + 1}`;

          if (idx === 0) {
            label = "Front Cover";
          } else if (
            idx === book.images.length - 1
          ) {
            label = "Back Cover";
          } else {
            label = `Inside Page ${idx}`;
          }

          list.push({
            url: item,
            label
          });

        } else if (
          item &&
          item.url
        ) {
          list.push({
            url: item.url,
            label:
              item.label ||
              `Image ${idx + 1}`
          });
        }
      });
    }

    // -----------------------------------------------------
    // CASE 2: Named image fields
    // -----------------------------------------------------
    if (list.length === 0) {

      if (
        book.frontCover ||
        book.frontImage
      ) {
        list.push({
          url:
            book.frontCover ||
            book.frontImage,
          label: "Front Cover"
        });
      }

      if (book.insidePage1) {
        list.push({
          url: book.insidePage1,
          label: "Inside Page 1"
        });
      }

      if (book.insidePage2) {
        list.push({
          url: book.insidePage2,
          label: "Inside Page 2"
        });
      }

      if (book.insidePage3) {
        list.push({
          url: book.insidePage3,
          label: "Inside Page 3"
        });
      }

      if (book.insidePage4) {
        list.push({
          url: book.insidePage4,
          label: "Inside Page 4"
        });
      }

      if (
        book.insideImage &&
        !book.insidePage1
      ) {
        list.push({
          url: book.insideImage,
          label: "Inside Page"
        });
      }

      if (
        book.backCover ||
        book.backImage
      ) {
        list.push({
          url:
            book.backCover ||
            book.backImage,
          label: "Back Cover"
        });
      }
    }

    // -----------------------------------------------------
    // CASE 3: Generic image
    // -----------------------------------------------------
    if (
      list.length === 0 &&
      book.image
    ) {
      list.push({
        url: book.image,
        label: "Book Cover"
      });
    }

    return list.filter(
      (item) => !!item.url
    );
  };

  const images = getNormalizedImages();

  const safeIndex =
    images.length > 0
      ? Math.min(
          currentImage,
          images.length - 1
        )
      : 0;

  const activeImage =
    images[safeIndex] || {
      url: "",
      label: "No image"
    };

  // =========================================================================
  // BOOK INFORMATION
  // =========================================================================
  const bookTitle =
    book.bookName ||
    book.title ||
    "Untitled Book";

  const bookAuthor =
    book.author ||
    "Unknown Author";

  const bookCategory =
    book.category ||
    "General";

  const bookCondition =
    book.condition ||
    "Good";

  const bookPrice =
    book.price || 0;

  const bookEdition =
    book.edition ||
    "Standard Edition";

  const bookDelivery =
    book.delivery ||
    "3-5";

  // =========================================================================
  // STOCK
  // =========================================================================
  const bookStock =
    typeof book.stock === "number"
      ? Math.max(0, book.stock)
      : parseInt(book.stock, 10) ||
        parseInt(book.stack, 10) ||
        parseInt(book.quantity, 10) ||
        0;

  const isOutOfStock =
    bookStock <= 0;

  // =========================================================================
  // IMAGE NAVIGATION
  // =========================================================================
  const nextImage = () => {
    if (images.length <= 1) return;

    setCurrentImage((prev) =>
      prev === images.length - 1
        ? 0
        : prev + 1
    );
  };

  const previousImage = () => {
    if (images.length <= 1) return;

    setCurrentImage((prev) =>
      prev === 0
        ? images.length - 1
        : prev - 1
    );
  };

  // =========================================================================
  // MOBILE SWIPE
  // =========================================================================
  const handleTouchStart = (e) => {
    touchStartX.current =
      e.targetTouches[0].clientX;
  };

  const handleTouchMove = (e) => {
    touchEndX.current =
      e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (
      !touchStartX.current ||
      !touchEndX.current
    ) {
      return;
    }

    const diff =
      touchStartX.current -
      touchEndX.current;

    const threshold = 40;

    if (diff > threshold) {
      nextImage();
    } else if (
      diff < -threshold
    ) {
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
      (
        (
          book.sellerId &&
          activeUser.uid ===
            book.sellerId
        ) ||
        (
          book.sellerUid &&
          activeUser.uid ===
            book.sellerUid
        ) ||
        (
          book.sellerEmail &&
          activeUser.email &&
          activeUser.email.toLowerCase() ===
            book.sellerEmail.toLowerCase()
        )
      )
  );

  // =========================================================================
  // CHAT WITH SELLER
  // =========================================================================
  const chatWithSeller = () => {

    if (isOwner) {
      alert(
        "You cannot chat with yourself for your own book listing."
      );
      return;
    }

    const bookData = {
      ...book,

      id: book.id,

      bookId: book.id,

      title: bookTitle,

      bookName: bookTitle,

      sellerId:
        book.sellerId ||
        book.sellerUid ||
        "",

      sellerUid:
        book.sellerUid ||
        book.sellerId ||
        "",

      sellerEmail:
        book.sellerEmail ||
        book.seller ||
        "",

      frontCover:
        book.frontCover ||
        book.frontImage ||
        book.image ||
        (
          images.length > 0
            ? images[0].url
            : ""
        )
    };

    setSelectedBook(bookData);

    setPage("chat");
  };

  // =========================================================================
  // BUY NOW
  // =========================================================================
  const buyNow = () => {

    if (isOwner) {
      alert(
        "You cannot purchase your own book listing."
      );
      return;
    }

    if (isOutOfStock) {
      alert(
        "Sorry! This book is out of stock."
      );
      return;
    }

    setSelectedBook(book);

    setPage("delivery");
  };

  // =========================================================================
  // CONDITION CLASS
  // =========================================================================
  const getConditionClass = (cond) => {

    const c =
      (cond || "").toLowerCase();

    if (
      c.includes("like new")
    ) {
      return "cond-like-new";
    }

    if (
      c.includes("very good")
    ) {
      return "cond-very-good";
    }

    if (
      c.includes("good")
    ) {
      return "cond-good";
    }

    return "cond-acceptable";
  };

  // =========================================================================
  // RETURN UI
  // =========================================================================
  return (
    <div className="book-details-page">

      {/* =====================================================
          TOP HEADER
      ===================================================== */}
      <div className="details-top-bar">

        <button
          type="button"
          className="back-button"
          onClick={handleBack}
          title="Go Back"
        >
          ←
        </button>

        <div className="details-header-title">
          <span>
            Book Details
          </span>
        </div>

        <div className="header-right-actions">

          <button
            type="button"
            className={`wishlist-toggle-icon ${
              inWishlist
                ? "active"
                : ""
            }`}
            onClick={toggleWishlist}
            disabled={wishlistLoading}
            title={
              inWishlist
                ? "Remove from Wishlist"
                : "Add to Wishlist"
            }
          >
            {inWishlist
              ? "♥"
              : "♡"}
          </button>

        </div>
      </div>

      {/* =====================================================
          MAIN GRID
      ===================================================== */}
      <div className="details-layout-grid">

        {/* ===================================================
            GALLERY
        =================================================== */}
        <div className="gallery-column">

          <div
            className="main-gallery-card"
            onTouchStart={
              handleTouchStart
            }
            onTouchMove={
              handleTouchMove
            }
            onTouchEnd={
              handleTouchEnd
            }
          >

            {/* IMAGE BADGE */}
            {images.length > 0 && (
              <div className="image-badge-pill">

                <span className="badge-label">
                  {activeImage.label}
                </span>

                <span className="badge-count">
                  {safeIndex + 1} /{" "}
                  {images.length}
                </span>

              </div>
            )}

            {/* LEFT */}
            {images.length > 1 && (
              <button
                type="button"
                className="gallery-nav-arrow left"
                onClick={
                  previousImage
                }
                aria-label="Previous Image"
              >
                ‹
              </button>
            )}

            {/* MAIN IMAGE */}
            {activeImage.url ? (
              <div
                className="main-image-wrapper"
                onClick={() =>
                  setShowFullImage(true)
                }
              >

                <img
                  className="main-display-image"
                  src={
                    activeImage.url
                  }
                  alt={`${bookTitle} - ${activeImage.label}`}
                  loading="eager"
                />

                <div className="zoom-hint">
                  <span>
                    🔍 Tap to zoom
                  </span>
                </div>

              </div>
            ) : (
              <div className="no-image-placeholder">
                <span>
                  📚 No preview available
                </span>
              </div>
            )}

            {/* RIGHT */}
            {images.length > 1 && (
              <button
                type="button"
                className="gallery-nav-arrow right"
                onClick={nextImage}
                aria-label="Next Image"
              >
                ›
              </button>
            )}

          </div>

          {/* DOTS */}
          {images.length > 1 && (
            <div className="gallery-dots-row">

              {images.map(
                (_, index) => (
                  <button
                    type="button"
                    key={index}
                    className={`dot-indicator ${
                      safeIndex === index
                        ? "active"
                        : ""
                    }`}
                    onClick={() =>
                      setCurrentImage(
                        index
                      )
                    }
                    aria-label={`Go to slide ${
                      index + 1
                    }`}
                  />
                )
              )}

            </div>
          )}

          {/* THUMBNAILS */}
          {images.length > 1 && (
            <div className="thumbnails-strip">

              {images.map(
                (img, index) => (
                  <div
                    key={index}
                    className={`thumbnail-card ${
                      safeIndex === index
                        ? "active-thumb"
                        : ""
                    }`}
                    onClick={() =>
                      setCurrentImage(
                        index
                      )
                    }
                  >

                    <img
                      src={img.url}
                      alt={img.label}
                    />

                    <span className="thumb-caption">
                      {img.label}
                    </span>

                  </div>
                )
              )}

            </div>
          )}

        </div>

        {/* ===================================================
            BOOK INFORMATION
        =================================================== */}
        <div className="info-column">

          <div className="details-content-card">

            {/* PRICE + CONDITION */}
            <div className="price-condition-row">

              <div className="price-display">

                <span className="currency">
                  ₹
                </span>

                <span className="amount">
                  {bookPrice}
                </span>

              </div>

              <div
                className={`condition-tag ${getConditionClass(
                  bookCondition
                )}`}
              >

                <span className="cond-icon">
                  ✨
                </span>

                <span>
                  {bookCondition}
                </span>

              </div>

            </div>

            {/* TITLE */}
            <h1 className="book-main-title">
              {bookTitle}
            </h1>

            {/* AUTHOR */}
            <p className="book-author-text">
              By{" "}
              <span className="author-name">
                {bookAuthor}
              </span>
            </p>

            {/* =================================================
                STOCK DISPLAY
            ================================================= */}
            <div
              className={`book-stock-display ${
                isOutOfStock
                  ? "out-of-stock"
                  : bookStock === 1
                  ? "low-stock"
                  : ""
              }`}
            >

              <span className="stock-icon">
                📦
              </span>

              <span className="stock-text">

                {isOutOfStock
                  ? "Out of Stock"
                  : bookStock === 1
                  ? "Only 1 copy available"
                  : `${bookStock} copies available`}

              </span>

            </div>

            {/* META CHIPS */}
            <div className="book-meta-chips">

              <div className="meta-chip">

                <span className="chip-icon">
                  📚
                </span>

                <span>
                  {bookCategory}
                </span>

              </div>

              <div className="meta-chip">

                <span className="chip-icon">
                  📖
                </span>

                <span>
                  {bookEdition}
                </span>

              </div>

              <div className="meta-chip delivery-chip">

                <span className="chip-icon">
                  🚚
                </span>

                <span>
                  {bookDelivery} Days Delivery
                </span>

              </div>

            </div>

            <hr className="details-divider" />

            {/* DESCRIPTION */}
            <div className="description-section">

              <h3>
                📝 Book Description & Condition
              </h3>

              <div className="description-text">

                {book.description ? (
                  book.description
                    .split("\n")
                    .map(
                      (para, idx) => (
                        <p key={idx}>
                          {para}
                        </p>
                      )
                    )
                ) : (
                  <p>
                    No additional description
                    provided by seller.
                  </p>
                )}

              </div>

            </div>

            {/* ADDITIONAL DETAILS */}
            {book.otherDetails && (
              <div className="other-details-section">

                <h4>
                  📌 Additional Notes
                </h4>

                <p>
                  {book.otherDetails}
                </p>

              </div>
            )}

            {/* =================================================
                WISHLIST
            ================================================= */}
            <div className="details-wishlist-action">

              <button
                type="button"
                className={`wishlist-btn-main ${
                  inWishlist
                    ? "in-wishlist"
                    : ""
                }`}
                onClick={toggleWishlist}
                disabled={wishlistLoading}
              >

                <span>
                  {inWishlist
                    ? "♥ Remove from Wishlist"
                    : "♡ Add to Wishlist"}
                </span>

              </button>

            </div>

            {/* =================================================
                ACTION BUTTONS
            ================================================= */}
            <div className="details-action-buttons">

              {isOwner ? (

                <div className="owner-listing-banner">

                  <span className="owner-badge-icon">
                    🏷️
                  </span>

                  <div>

                    <strong>
                      Your Published Listing
                    </strong>

                    <p>
                      You are the seller of this
                      book.
                    </p>

                  </div>

                </div>

              ) : (

                <>

                  {/* BUY NOW */}
                  <button
                    type="button"
                    className={`buy-now-cta ${
                      isOutOfStock
                        ? "disabled"
                        : ""
                    }`}
                    onClick={buyNow}
                    disabled={
                      isOutOfStock
                    }
                  >

                    <span className="btn-icon">
                      🛒
                    </span>

                    <span>
                      {isOutOfStock
                        ? "Out of Stock"
                        : "Buy Now"}
                    </span>

                  </button>

                  {/* CHAT */}
                  <button
                    type="button"
                    className="chat-seller-cta"
                    onClick={
                      chatWithSeller
                    }
                  >

                    <span className="btn-icon">
                      💬
                    </span>

                    <span>
                      Chat with Seller
                    </span>

                  </button>

                </>

              )}

            </div>

          </div>

        </div>

      </div>

      {/* =====================================================
          FULLSCREEN LIGHTBOX
      ===================================================== */}
      {showFullImage &&
        activeImage.url && (

          <div
            className="fullscreen-lightbox"
            onClick={() =>
              setShowFullImage(false)
            }
          >

            <div
              className="lightbox-header"
              onClick={(e) =>
                e.stopPropagation()
              }
            >

              <span className="lightbox-title">

                {bookTitle} -{" "}
                {activeImage.label}{" "}
                (
                {safeIndex + 1}/
                {images.length}
                )

              </span>

              <button
                type="button"
                className="lightbox-close"
                onClick={() =>
                  setShowFullImage(false)
                }
                aria-label="Close Fullscreen"
              >
                ✕
              </button>

            </div>

            <div className="lightbox-body">

              {/* LEFT */}
              {images.length > 1 && (
                <button
                  type="button"
                  className="lightbox-arrow left"
                  onClick={(e) => {
                    e.stopPropagation();
                    previousImage();
                  }}
                >
                  ‹
                </button>
              )}

              {/* IMAGE */}
              <img
                src={
                  activeImage.url
                }
                alt={bookTitle}
                className="lightbox-image"
                onClick={(e) =>
                  e.stopPropagation()
                }
              />

              {/* RIGHT */}
              {images.length > 1 && (
                <button
                  type="button"
                  className="lightbox-arrow right"
                  onClick={(e) => {
                    e.stopPropagation();
                    nextImage();
                  }}
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