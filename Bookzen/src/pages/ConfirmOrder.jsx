import { useState } from "react";
import "./ConfirmOrder.css";

import { db, auth } from "../firebase";
import {
  collection,
  doc,
  getDoc,
  serverTimestamp,
  runTransaction
} from "firebase/firestore";

import { notifyOrderPlaced } from "../services/notificationService";

function ConfirmOrder({ book, setPage, goBack }) {
  const [showSuccess, setShowSuccess] = useState(false);
  const [orderData, setOrderData] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleBack = () => {
    if (typeof goBack === "function") {
      goBack("payment");
    } else {
      setPage("payment");
    }
  };

  // ========================================
  // CONFIRM ORDER
  // ========================================
  const confirmOrder = async () => {
    if (loading) return;

    try {
      setLoading(true);

      // ========================================
      // 1. USER
      // ========================================
      const user = auth.currentUser;

      const userEmail =
        user?.email ||
        localStorage.getItem("userEmail") ||
        "";

      if (!userEmail) {
        alert("Please login first to place an order.");
        setPage("login");
        return;
      }

      // ========================================
      // 2. DELIVERY DETAILS
      // ========================================
      const savedDelivery =
        localStorage.getItem("deliveryDetails");

      if (!savedDelivery) {
        alert(
          "Delivery details not found. Please re-enter your delivery address."
        );
        setPage("delivery");
        return;
      }

      const deliveryDetails = JSON.parse(savedDelivery);

      // ========================================
      // 3. QUANTITY
      // ========================================
      const selectedQuantity =
        parseInt(deliveryDetails?.quantity, 10) || 1;

      if (selectedQuantity < 1) {
        alert("Please select at least 1 book.");
        setPage("delivery");
        return;
      }

      // ========================================
      // 4. SELLER
      // ========================================
      const sellerEmail =
        book?.sellerEmail ||
        book?.seller ||
        "";

      if (!sellerEmail) {
        alert(
          "Seller information not found. Please try again."
        );
        return;
      }

      const sellerUid =
        book?.sellerId ||
        book?.sellerUid ||
        "";

      // ========================================
      // 5. SELLER NAME
      // ========================================
      let sellerName =
        book?.sellerName || "";

      if (!sellerName && sellerUid) {
        try {
          const sellerSnap = await getDoc(
            doc(db, "users", sellerUid)
          );

          if (sellerSnap.exists()) {
            const sellerData = sellerSnap.data();

            sellerName =
              sellerData.name ||
              sellerData.displayName ||
              "";
          }
        } catch (error) {
          console.warn(
            "Could not fetch seller name:",
            error
          );
        }
      }

      if (!sellerName) {
        sellerName = "Verified Seller";
      }

      // ========================================
      // 6. BOOK DETAILS
      // ========================================
      const bookTitle =
        book?.bookName ||
        book?.title ||
        "Untitled Book";

      const bookId =
        book?.id || "";

      if (!bookId) {
        alert("Book ID not found. Please try again.");
        return;
      }

      // ========================================
      // 7. SELLER QR
      // ========================================
      const sellerQrUrl =
        book?.sellerUpiQrUrl ||
        book?.sellerQrUrl ||
        book?.sellerQrCode ||
        "";

      const sellerHasValidQr =
        typeof sellerQrUrl === "string" &&
        sellerQrUrl.trim().length > 0;

      // ========================================
      // 8. PAYMENT
      // ========================================
      const rawPaymentMethod =
        localStorage.getItem("paymentMethod") ||
        "COD";

      let finalPaymentMethod = "COD";
      let finalPaymentStatus = "COD";

      if (
        rawPaymentMethod === "QR" ||
        rawPaymentMethod === "UPI_QR" ||
        rawPaymentMethod === "GPay/UPI" ||
        rawPaymentMethod === "upi"
      ) {
        if (sellerHasValidQr) {
          finalPaymentMethod = "QR";
          finalPaymentStatus = "USER_CONFIRMED";
        }
      }

      // ========================================
      // 9. PRICE
      // ========================================
      const unitPrice =
        Number(book?.price) || 0;

      const totalPrice =
        unitPrice * selectedQuantity;

      // ========================================
      // 10. BOOK REF
      // ========================================
      const bookRef =
        doc(db, "books", bookId);

      // ========================================
      // 11. TRANSACTION
      // ========================================
      const orderRef = await runTransaction(
        db,
        async (transaction) => {

          // ------------------------------------
          // GET LATEST BOOK
          // ------------------------------------
          const bookSnap =
            await transaction.get(bookRef);

          if (!bookSnap.exists()) {
            throw new Error(
              "Book not found."
            );
          }

          const latestBook =
            bookSnap.data();

          // ------------------------------------
          // CURRENT STOCK
          // ------------------------------------
          let currentStock = 0;

          if (
            typeof latestBook.stock === "number"
          ) {
            currentStock =
              latestBook.stock;
          } else if (
            latestBook.stock !== undefined &&
            latestBook.stock !== null
          ) {
            currentStock =
              parseInt(
                latestBook.stock,
                10
              ) || 0;
          } else if (
            typeof latestBook.stack === "number"
          ) {
            currentStock =
              latestBook.stack;
          } else {
            currentStock =
              parseInt(
                latestBook.stack,
                10
              ) || 0;
          }

          // ------------------------------------
          // OUT OF STOCK
          // ------------------------------------
          if (currentStock <= 0) {
            throw new Error(
              "This book is out of stock."
            );
          }

          // ------------------------------------
          // QUANTITY CHECK
          // ------------------------------------
          if (
            selectedQuantity >
            currentStock
          ) {
            throw new Error(
              `Only ${currentStock} ${
                currentStock === 1
                  ? "copy"
                  : "copies"
              } are available.`
            );
          }

          // ------------------------------------
          // NEW STOCK
          // ------------------------------------
          const newStock =
            currentStock -
            selectedQuantity;

          // ------------------------------------
          // ORDER REF
          // ------------------------------------
          const newOrderRef =
            doc(collection(db, "orders"));

          // ------------------------------------
          // UPDATE STOCK
          // ------------------------------------
          transaction.update(
            bookRef,
            {
              stock: newStock,
              stack: newStock,
              quantity: newStock,
              updatedAt:
                serverTimestamp()
            }
          );

          // ------------------------------------
          // ORDER DATA
          // ------------------------------------
          const order = {
            buyerUid:
              user?.uid || "",

            buyerEmail:
              userEmail,

            buyerName:
              deliveryDetails?.name ||
              user?.displayName ||
              "Customer",

            userEmail:
              userEmail,

            sellerId:
              sellerUid,

            sellerUid:
              sellerUid,

            sellerEmail:
              sellerEmail,

            sellerName:
              sellerName,

            bookId:
              bookId,

            bookName:
              bookTitle,

            title:
              bookTitle,

            author:
              book?.author ||
              "Unknown Author",

            price:
              unitPrice,

            unitPrice:
              unitPrice,

            quantity:
              selectedQuantity,

            totalPrice:
              totalPrice,

            frontCover:
              book?.frontCover ||
              book?.frontImage ||
              book?.image ||
              "",

            frontImage:
              book?.frontCover ||
              book?.frontImage ||
              book?.image ||
              "",

            sellerQrUrl:
              sellerQrUrl,

            sellerUpiQrUrl:
              sellerQrUrl,

            paymentMethod:
              finalPaymentMethod,

            paymentStatus:
              finalPaymentStatus,

            orderStatus:
              "CONFIRMED",

            deliveryDetails:
              deliveryDetails,

            name:
              deliveryDetails?.name ||
              "",

            houseNo:
              deliveryDetails?.houseNo ||
              "",

            houseName:
              deliveryDetails?.houseName ||
              "",

            area:
              deliveryDetails?.area ||
              "",

            street:
              deliveryDetails?.street ||
              "",

            city:
              deliveryDetails?.city ||
              "",

            pincode:
              deliveryDetails?.pincode ||
              "",

            phone:
              deliveryDetails?.phone ||
              "",

            createdAt:
              serverTimestamp(),

            updatedAt:
              serverTimestamp()
          };

          // ------------------------------------
          // SAVE ORDER
          // ------------------------------------
          transaction.set(
            newOrderRef,
            order
          );

          return {
            ref: newOrderRef,
            order
          };
        }
      );

      // ========================================
      // 12. NOTIFICATION
      // ========================================
      try {
        await notifyOrderPlaced({
          orderId:
            orderRef.ref.id,

          bookId:
            bookId,

          bookName:
            bookTitle,

          buyerUid:
            user?.uid || "",

          buyerEmail:
            userEmail,

          sellerUid:
            sellerUid,

          sellerEmail:
            sellerEmail,

          buyerPhone:
            deliveryDetails?.phone || ""
        });
      } catch (notificationError) {
        // Notification failure should NOT
        // make successful order look failed.
        console.warn(
          "Order notification failed:",
          notificationError
        );
      }

      // ========================================
      // 13. SUCCESS
      // ========================================
      setOrderData({
        ...orderRef.order,
        id: orderRef.ref.id,
        createdAt: Date.now()
      });

      setShowSuccess(true);

    } catch (error) {
      console.error(
        "Order Creation Error:",
        error
      );

      if (
        error.message ===
        "This book is out of stock."
      ) {
        alert(
          "Sorry! This book is now Out of Stock."
        );
      } else if (
        error.message?.includes(
          "Only"
        ) &&
        error.message?.includes(
          "available"
        )
      ) {
        alert(error.message);
      } else {
        alert(
          "Failed to place order: " +
          (
            error.message ||
            "Please try again."
          )
        );
      }

    } finally {
      setLoading(false);
    }
  };

  // ========================================
  // NO BOOK
  // ========================================
  if (!book) {
    return (
      <div className="confirm-order-page">

        <button
          className="back-button"
          onClick={() =>
            setPage("home")
          }
        >
          ←
        </button>

        <div
          style={{
            textAlign: "center",
            padding: "40px 20px"
          }}
        >
          <p>
            Book details not found.
          </p>

          <button
            className="confirm-order-button"
            onClick={() =>
              setPage("home")
            }
          >
            Go to Home
          </button>
        </div>

      </div>
    );
  }

  // ========================================
  // SUCCESS VIEW
  // ========================================
  if (
    showSuccess &&
    orderData
  ) {
    return (
      <div className="confirm-order-page">

        <div className="success-overlay">

          <div className="success-popup">

            <div className="success-icon">
              ✓
            </div>

            <h2>
              Order Successfully Placed!
            </h2>

            <div className="success-book">

              <img
                src={
                  orderData.frontCover ||
                  orderData.frontImage
                }
                alt={
                  orderData.bookName
                }
              />

              <div>

                <h3>
                  {orderData.bookName}
                </h3>

                <p>
                  by {orderData.author}
                </p>

                <p>
                  Quantity:{" "}
                  {orderData.quantity}
                </p>

                <strong
                  style={{
                    color: "#fd6569"
                  }}
                >
                  ₹{orderData.totalPrice}
                </strong>

              </div>

            </div>

            <div className="success-address">

              <h3>
                Delivery Address
              </h3>

              <p>
                <strong>
                  {orderData.name}
                </strong>
              </p>

              <p>
                {orderData.houseNo}
                {orderData.houseNo &&
                orderData.houseName
                  ? ", "
                  : ""}
                {orderData.houseName}
              </p>

              <p>
                {orderData.area}
                {orderData.area &&
                orderData.street
                  ? ", "
                  : ""}
                {orderData.street}
              </p>

              <p>
                {orderData.city}
                {orderData.city &&
                orderData.pincode
                  ? " - "
                  : ""}
                {orderData.pincode}
              </p>

              <p>
                📞 {orderData.phone}
              </p>

            </div>

            <div
              style={{
                marginTop: "10px",
                fontSize: "13px",
                color: "#666"
              }}
            >
              Payment:{" "}

              <strong>
                {orderData.paymentMethod === "QR"
                  ? "QR Payment"
                  : "Cash on Delivery"}
              </strong>
            </div>

            <button
              className="success-ok-button"
              onClick={() => {

                localStorage.removeItem(
                  "deliveryDetails"
                );

                localStorage.removeItem(
                  "paymentMethod"
                );

                localStorage.removeItem(
                  "paymentStatus"
                );

                setPage("orders");
              }}
            >
              View My Orders
            </button>

          </div>

        </div>

      </div>
    );
  }

  // ========================================
  // DELIVERY DATA
  // ========================================
  const deliveryDetails =
    JSON.parse(
      localStorage.getItem(
        "deliveryDetails"
      ) || "{}"
    );

  const paymentMethod =
    localStorage.getItem(
      "paymentMethod"
    ) || "COD";

  const isQrPayment =
    paymentMethod === "QR" ||
    paymentMethod === "UPI_QR" ||
    paymentMethod === "GPay/UPI";

  // ========================================
  // CURRENT STOCK
  // ========================================
  const displayStock =
    typeof book.stock === "number"
      ? book.stock
      : parseInt(
          book.stock,
          10
        ) ||
        parseInt(
          book.stack,
          10
        ) ||
        parseInt(
          book.quantity,
          10
        ) ||
        0;

  // ========================================
  // MAIN UI
  // ========================================
  return (
    <div className="confirm-order-page">

      <button
        type="button"
        className="back-button"
        onClick={handleBack}
        title="Back to Payment"
      >
        ←
      </button>

      <h1>
        Confirm Order
      </h1>

      {/* BOOK */}
      <div className="confirm-book-card">

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
        />

        <div>

          <h2>
            {book.bookName ||
              book.title ||
              "Book"}
          </h2>

          <p>
            by{" "}
            {book.author ||
              "Unknown"}
          </p>

          <h3>
            ₹{book.price || 0}
          </h3>

          <p>
            Quantity:{" "}
            {deliveryDetails.quantity || 1}
          </p>

        </div>

      </div>

      {/* STOCK */}
      <div className="confirm-section">

        <h3>
          📦 Stock Availability
        </h3>

        <p>
          {displayStock <= 0
            ? "Out of Stock"
            : displayStock === 1
            ? "Only 1 copy available"
            : `${displayStock} copies available`}
        </p>

      </div>

      {/* PAYMENT */}
      <div className="confirm-section">

        <h3>
          Payment Method
        </h3>

        <p>
          {isQrPayment
            ? "📱 QR Payment (Scan & Pay - Payment Completed by Buyer)"
            : "💵 Cash on Delivery (COD)"}
        </p>

      </div>

      {/* DELIVERY */}
      <div className="confirm-section">

        <h3>
          Delivery Address
        </h3>

        <p>
          <strong>
            {deliveryDetails.name || ""}
          </strong>
        </p>

        <p>
          {deliveryDetails.houseNo || ""}
          {deliveryDetails.houseNo &&
          deliveryDetails.houseName
            ? ", "
            : ""}
          {deliveryDetails.houseName || ""}
        </p>

        <p>
          {deliveryDetails.area || ""}
          {deliveryDetails.area &&
          deliveryDetails.street
            ? ", "
            : ""}
          {deliveryDetails.street || ""}
        </p>

        <p>
          {deliveryDetails.city || ""}
          {deliveryDetails.city &&
          deliveryDetails.pincode
            ? " - "
            : ""}
          {deliveryDetails.pincode || ""}
        </p>

        <p>
          📞{" "}
          {deliveryDetails.phone || ""}
        </p>

      </div>

      {/* TOTAL */}
      <div className="confirm-section">

        <h3>
          💰 Order Total
        </h3>

        <p>
          ₹
          {(
            Number(book.price || 0) *
            Number(
              deliveryDetails.quantity || 1
            )
          ).toFixed(2)}
        </p>

      </div>

      {/* CONFIRM */}
      <button
        className="confirm-order-button"
        onClick={confirmOrder}
        disabled={loading}
      >
        {loading
          ? "Placing Order..."
          : "Confirm & Place Order"}
      </button>

    </div>
  );
}

export default ConfirmOrder;