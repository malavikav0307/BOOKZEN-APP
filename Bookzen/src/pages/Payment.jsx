import { useState, useEffect } from "react";
import "./Payment.css";
import { db } from "../firebase";
import { doc, getDoc } from "firebase/firestore";

function Payment({ book, setPage, goBack }) {
  const price = book?.price || 0;
  const bookTitle = book?.bookName || book?.title || "Book";

  const initialQr =
    book?.sellerQrUrl ||
    book?.sellerUpiQrUrl ||
    book?.sellerQrCode ||
    "";

  const [sellerQrUrl, setSellerQrUrl] = useState(initialQr);
  const [loadingQr, setLoadingQr] = useState(!initialQr);
  const [sellerUpiId, setSellerUpiId] = useState(book?.sellerUpiId || "");
  const [sellerDisplayName, setSellerDisplayName] = useState(book?.sellerName || "Verified Seller");
  const [imageError, setImageError] = useState(false);

  // Fetch and resolve the seller's actual QR code
  useEffect(() => {
    let isMounted = true;

    const resolveSellerQr = async () => {
      // 1. Direct book QR property
      if (book?.sellerQrUrl || book?.sellerUpiQrUrl) {
        if (isMounted) {
          setSellerQrUrl(book.sellerQrUrl || book.sellerUpiQrUrl);
          setLoadingQr(false);
        }
        return;
      }

      const sellerUid = book?.sellerId || book?.sellerUid;

      try {
        if (isMounted) setLoadingQr(true);

        // 2. Query book document in Firestore
        if (book?.id) {
          const bookDocRef = doc(db, "books", book.id);
          const bookSnap = await getDoc(bookDocRef);
          if (bookSnap.exists() && isMounted) {
            const bData = bookSnap.data();
            const qr = bData.sellerQrUrl || bData.sellerUpiQrUrl || bData.sellerQrCode || "";
            if (qr && typeof qr === "string" && qr.trim()) {
              setSellerQrUrl(qr);
              if (bData.sellerName) setSellerDisplayName(bData.sellerName);
              if (bData.sellerUpiId) setSellerUpiId(bData.sellerUpiId);
              setLoadingQr(false);
              return;
            }
          }
        }

        // 3. Fallback: Query seller user profile document
        if (sellerUid) {
          const userDocRef = doc(db, "users", sellerUid);
          const userSnap = await getDoc(userDocRef);
          if (userSnap.exists() && isMounted) {
            const uData = userSnap.data();
            const qr = uData.sellerQrUrl || uData.sellerUpiQrUrl || uData.qrUrl || uData.upiQrUrl || uData.qrCode || "";
            if (qr && typeof qr === "string" && qr.trim()) {
              setSellerQrUrl(qr);
              if (uData.name || uData.displayName) setSellerDisplayName(uData.name || uData.displayName);
              if (uData.upiId) setSellerUpiId(uData.upiId);
              setLoadingQr(false);
              return;
            }
          }
        }

        // No QR found for this seller
        if (isMounted) {
          setSellerQrUrl("");
          setLoadingQr(false);
        }
      } catch (err) {
        console.warn("Could not fetch seller QR:", err);
        if (isMounted) {
          setSellerQrUrl("");
          setLoadingQr(false);
        }
      }
    };

    resolveSellerQr();

    return () => {
      isMounted = false;
    };
  }, [book]);

  const sellerHasQR = Boolean(
    !loadingQr &&
    sellerQrUrl &&
    typeof sellerQrUrl === "string" &&
    sellerQrUrl.trim().length > 0 &&
    !imageError
  );

  const [paymentMethod, setPaymentMethod] = useState("cod");
  const [upiConfirmed, setUpiConfirmed] = useState(false);

  // If seller has no QR, ensure payment method cannot be set to QR
  useEffect(() => {
    if (!sellerHasQR && paymentMethod !== "cod") {
      setPaymentMethod("cod");
      setUpiConfirmed(false);
    }
  }, [sellerHasQR, paymentMethod]);

  const handleBack = () => {
    if (typeof goBack === "function") {
      goBack("delivery");
    } else {
      setPage("delivery");
    }
  };

  const handleContinue = () => {
    if (!paymentMethod) {
      alert("Please select a payment method.");
      return;
    }

    if (paymentMethod === "qr" || paymentMethod === "upi") {
      if (!sellerHasQR) {
        alert(
          "Seller payment QR is not available for this book. Only Cash on Delivery is available."
        );
        setPaymentMethod("cod");
        return;
      }
      if (!upiConfirmed) {
        alert(
          `Please scan the seller's QR code, complete the payment of ₹${price}, and tick the confirmation checkbox to continue.`
        );
        return;
      }
      localStorage.setItem("paymentMethod", "QR");
      localStorage.setItem("paymentStatus", "USER_CONFIRMED");
    } else {
      localStorage.setItem("paymentMethod", "COD");
      localStorage.setItem("paymentStatus", "COD");
    }

    setPage("confirmOrder");
  };

  return (
    <div className="payment-page">
      <button
        type="button"
        className="back-button"
        onClick={handleBack}
        title="Back to Delivery"
      >
        ←
      </button>

      <h1>Payment Method</h1>
      <p className="payment-subtitle">
        Choose how you would like to pay for your book
      </p>

      {/* Book Summary Card */}
      {book && (
        <div className="payment-book-summary">
          <img
            src={book.frontCover || book.frontImage || book.image || ""}
            alt={bookTitle}
            className="payment-book-img"
          />
          <div className="payment-book-details">
            <h3>{bookTitle}</h3>
            <p className="payment-author">
              by {book.author || "Unknown Author"}
            </p>
            <div className="payment-seller-tag">
              Seller: <strong>{sellerDisplayName}</strong>
            </div>
            <span className="payment-amount">
              Amount to Pay: ₹{price}
            </span>
          </div>
        </div>
      )}

      {/* Payment Options */}
      <div className="payment-options">
        {/* Cash on Delivery - Always Available */}
        <label
          className={`payment-option-card ${
            paymentMethod === "cod" ? "selected" : ""
          }`}
        >
          <div className="option-radio-row">
            <input
              type="radio"
              name="payment"
              value="cod"
              checked={paymentMethod === "cod"}
              onChange={(e) => setPaymentMethod(e.target.value)}
            />
            <div className="option-title-wrap">
              <span className="option-icon">💵</span>
              <div>
                <strong>Cash on Delivery (COD)</strong>
                <p>Pay cash when the book is delivered at your doorstep</p>
              </div>
            </div>
          </div>
        </label>

        {/* QR Payment / UPI Scan & Pay - ONLY IF SELLER HAS QR */}
        {sellerHasQR && (
          <label
            className={`payment-option-card ${
              paymentMethod === "qr" || paymentMethod === "upi" ? "selected" : ""
            }`}
          >
            <div className="option-radio-row">
              <input
                type="radio"
                name="payment"
                value="qr"
                checked={paymentMethod === "qr" || paymentMethod === "upi"}
                onChange={(e) => setPaymentMethod(e.target.value)}
              />
              <div className="option-title-wrap">
                <span className="option-icon">📱</span>
                <div>
                  <strong>QR Payment (Scan & Pay)</strong>
                  <p>
                    Scan seller's verified QR code with Google Pay / PhonePe / Paytm / BHIM
                  </p>
                </div>
              </div>
            </div>

            {/* Seller QR Box appears when QR is chosen */}
            {(paymentMethod === "qr" || paymentMethod === "upi") && (
              <div
                className="seller-qr-display-box"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="qr-badge-row">
                  <span className="scan-pay-badge">⚡ Scan & Pay</span>
                  <span className="seller-badge">Seller Payment QR</span>
                </div>

                {/* Verified Seller & Price Context */}
                <div className="qr-meta-box">
                  <div className="qr-meta-item">
                    <span className="meta-label">Book:</span>
                    <strong className="meta-value">{bookTitle}</strong>
                  </div>
                  <div className="qr-meta-item">
                    <span className="meta-label">Seller:</span>
                    <span className="meta-value">{sellerDisplayName}</span>
                  </div>
                  <div className="qr-meta-item amount-item">
                    <span className="meta-label">Amount to Pay:</span>
                    <strong className="meta-value-price">₹{price}</strong>
                  </div>
                </div>

                <div className="qr-image-container">
                  {!imageError ? (
                    <img
                      src={sellerQrUrl}
                      alt={`Payment QR for ${sellerDisplayName}`}
                      className="seller-qr-img"
                      onError={() => setImageError(true)}
                    />
                  ) : (
                    <div className="qr-image-error">
                      <span className="error-icon">⚠️</span>
                      <strong>Unable to load payment QR image</strong>
                      <p>
                        Please check your internet connection or use Cash on Delivery.
                      </p>
                    </div>
                  )}
                </div>

                <div className="qr-payment-instructions">
                  <p className="qr-amount-callout">
                    Scan & Pay exactly: <span>₹{price}</span>
                  </p>
                  {sellerUpiId && (
                    <p className="upi-id-label">
                      Seller UPI ID: <code>{sellerUpiId}</code>
                    </p>
                  )}
                  <p className="qr-hint">
                    Use Google Pay, PhonePe, Paytm, BHIM or any UPI scanner app on your phone.
                  </p>
                </div>

                <label className="upi-confirm-checkbox">
                  <input
                    type="checkbox"
                    checked={upiConfirmed}
                    onChange={(e) => setUpiConfirmed(e.target.checked)}
                  />
                  <span>
                    I have scanned this QR and completed payment of ₹{price}
                  </span>
                </label>
              </div>
            )}
          </label>
        )}
      </div>

      <button
        type="button"
        className="continue-button"
        onClick={handleContinue}
      >
        {paymentMethod === "qr" || paymentMethod === "upi"
          ? "Payment Completed / Confirm Order →"
          : "Proceed to Confirm Order →"}
      </button>
    </div>
  );
}

export default Payment;