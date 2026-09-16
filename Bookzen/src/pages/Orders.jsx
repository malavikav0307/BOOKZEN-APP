import { useEffect, useState, useCallback } from "react";
import "./Orders.css";

import { db, auth } from "../firebase";
import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  doc,
  deleteDoc,
  updateDoc,
  serverTimestamp
} from "firebase/firestore";

import {
  notifyBuyerOrderCancellation,
  notifySellerOrderCancellation
} from "../services/notificationService";

function Orders({ setPage, setSelectedBook, currentUser, goBack }) {
  const [activeTab, setActiveTab] = useState("purchases");
  const [purchases, setPurchases] = useState([]);
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [cancellingOrderId, setCancellingOrderId] = useState(null);
  const [loadingBookPage, setLoadingBookPage] = useState(false);
  const [cleaningTestOrders, setCleaningTestOrders] = useState(false);

  const activeUser = currentUser || auth.currentUser;

  const userEmail =
    activeUser?.email ||
    localStorage.getItem("userEmail") ||
    "";

  const userUid = activeUser?.uid || "";

  // =========================================================
  // CLEAN TEST ORDERS
  // =========================================================
  const cleanTestOrdersForTestAccount = async () => {
    const targetEmail = "malavikav0307@gmail.com";

    if (userEmail.toLowerCase() !== targetEmail) return;

    try {
      const ordersRef = collection(db, "orders");

      const testQueries = [
        query(ordersRef, where("userEmail", "==", targetEmail)),
        query(ordersRef, where("buyerEmail", "==", targetEmail)),
        query(ordersRef, where("sellerEmail", "==", targetEmail))
      ];

      if (userUid) {
        testQueries.push(
          query(ordersRef, where("buyerUid", "==", userUid))
        );

        testQueries.push(
          query(ordersRef, where("sellerUid", "==", userUid))
        );

        testQueries.push(
          query(ordersRef, where("sellerId", "==", userUid))
        );
      }

      const snaps = await Promise.all(
        testQueries.map((q) => getDocs(q))
      );

      const docsToDelete = new Set();

      snaps.forEach((snap) => {
        snap.docs.forEach((d) => {
          const data = d.data();

          const isTarget =
            data.buyerEmail?.toLowerCase() === targetEmail ||
            data.userEmail?.toLowerCase() === targetEmail ||
            data.sellerEmail?.toLowerCase() === targetEmail ||
            (
              userUid &&
              (
                data.buyerUid === userUid ||
                data.sellerUid === userUid ||
                data.sellerId === userUid
              )
            );

          if (isTarget) {
            docsToDelete.add(d.id);
          }
        });
      });

      for (const docId of docsToDelete) {
        try {
          await deleteDoc(doc(db, "orders", docId));
        } catch (delErr) {
          console.warn(
            "Could not delete test order:",
            docId,
            delErr
          );
        }
      }

      localStorage.setItem(
        "cleaned_test_orders_malavika_v1",
        "true"
      );
    } catch (err) {
      console.error(
        "Error cleaning test orders:",
        err
      );
    }
  };

  const handleManualCleanTestOrders = async () => {
    const confirmClean = window.confirm(
      "Clean all test orders for malavikav0307@gmail.com?\n\n" +
      "This will only delete order records associated with your test email/account and will preserve all other users' orders."
    );

    if (!confirmClean) return;

    try {
      setCleaningTestOrders(true);

      await cleanTestOrdersForTestAccount();
      await loadOrders();

      alert(
        "✅ Test order records for malavikav0307@gmail.com have been cleaned."
      );
    } catch (err) {
      console.error("Clean error:", err);

      alert(
        "Failed to clean test orders: " +
        (err.message || "Please try again.")
      );
    } finally {
      setCleaningTestOrders(false);
    }
  };

  // =========================================================
  // LOAD ORDERS
  // =========================================================
  const loadOrders = useCallback(async () => {
    if (!userEmail && !userUid) {
      setPurchases([]);
      setSales([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const ordersRef = collection(db, "orders");

      // =====================================================
      // PURCHASES
      // =====================================================
      const purchaseQueries = [
        query(
          ordersRef,
          where("userEmail", "==", userEmail)
        )
      ];

      if (userUid) {
        purchaseQueries.push(
          query(
            ordersRef,
            where("buyerUid", "==", userUid)
          )
        );
      }

      const purchaseSnaps = await Promise.all(
        purchaseQueries.map((q) => getDocs(q))
      );

      const purchaseMap = new Map();

      purchaseSnaps.forEach((snap) => {
        snap.docs.forEach((d) => {
          purchaseMap.set(d.id, {
            ...d.data(),
            id: d.id
          });
        });
      });

      const purchaseList = Array.from(
        purchaseMap.values()
      );

      purchaseList.sort((a, b) => {
        const tA = a.createdAt?.toMillis
          ? a.createdAt.toMillis()
          : a.createdAt || 0;

        const tB = b.createdAt?.toMillis
          ? b.createdAt.toMillis()
          : b.createdAt || 0;

        return tB - tA;
      });

      setPurchases(purchaseList);

      // =====================================================
      // SALES
      // =====================================================
      const saleQueries = [
        query(
          ordersRef,
          where("sellerEmail", "==", userEmail)
        )
      ];

      if (userUid) {
        saleQueries.push(
          query(
            ordersRef,
            where("sellerId", "==", userUid)
          )
        );

        saleQueries.push(
          query(
            ordersRef,
            where("sellerUid", "==", userUid)
          )
        );
      }

      const saleSnaps = await Promise.all(
        saleQueries.map((q) => getDocs(q))
      );

      const saleMap = new Map();

      saleSnaps.forEach((snap) => {
        snap.docs.forEach((d) => {
          saleMap.set(d.id, {
            ...d.data(),
            id: d.id
          });
        });
      });

      const saleList = Array.from(
        saleMap.values()
      );

      saleList.sort((a, b) => {
        const tA = a.createdAt?.toMillis
          ? a.createdAt.toMillis()
          : a.createdAt || 0;

        const tB = b.createdAt?.toMillis
          ? b.createdAt.toMillis()
          : b.createdAt || 0;

        return tB - tA;
      });

      setSales(saleList);

    } catch (error) {
      console.error(
        "Error loading orders:",
        error
      );
    } finally {
      setLoading(false);
    }
  }, [userEmail, userUid]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  // =========================================================
  // BACK
  // =========================================================
  const handleBack = () => {
    if (typeof goBack === "function") {
      goBack("home");
    } else {
      setPage("home");
    }
  };

  // =========================================================
  // SHOW BOOK PAGE
  // =========================================================
  const handleShowBookPage = async (order) => {
    const bookId = order?.bookId;

    if (!bookId) {
      alert("This book is no longer available.");
      return;
    }

    try {
      setLoadingBookPage(true);

      const bookDocRef = doc(
        db,
        "books",
        bookId
      );

      const snap = await getDoc(bookDocRef);

      if (snap.exists()) {
        const bookData = {
          ...snap.data(),
          id: snap.id
        };

        if (typeof setSelectedBook === "function") {
          setSelectedBook(bookData);
        }

        setPage("bookDetails");
      } else {
        alert("This book is no longer available.");
      }

    } catch (err) {
      console.warn(
        "Could not retrieve book:",
        err
      );

      // Fallback using saved order data
      if (typeof setSelectedBook === "function") {
        setSelectedBook({
          id: bookId,
          title:
            order.bookName ||
            order.title ||
            "Book",
          bookName:
            order.bookName ||
            order.title ||
            "Book",
          author:
            order.author ||
            "Unknown",
          price:
            order.unitPrice ||
            order.price ||
            0,
          frontCover:
            order.frontCover ||
            order.frontImage ||
            "",
          sellerEmail:
            order.sellerEmail ||
            "",
          sellerUid:
            order.sellerUid ||
            "",
          sellerId:
            order.sellerId ||
            order.sellerUid ||
            "",
          stock: 0
        });
      }

      setPage("bookDetails");

    } finally {
      setLoadingBookPage(false);
    }
  };

  // =========================================================
  // CHAT
  // =========================================================
  const handleChatFromOrder = (order, e) => {
    if (e) {
      e.stopPropagation();
    }

    const bookData = {
      id:
        order.bookId ||
        order.id,

      title:
        order.bookName ||
        order.title ||
        "Book",

      bookName:
        order.bookName ||
        order.title ||
        "Book",

      author:
        order.author ||
        "Unknown",

      price:
        order.unitPrice ||
        order.price ||
        0,

      frontCover:
        order.frontCover ||
        order.frontImage ||
        order.image ||
        "",

      sellerEmail:
        order.sellerEmail ||
        "",

      sellerUid:
        order.sellerUid ||
        order.sellerId ||
        "",

      sellerId:
        order.sellerId ||
        order.sellerUid ||
        "",

      sellerName:
        order.sellerName ||
        "",

      buyerEmail:
        order.buyerEmail ||
        order.userEmail ||
        "",

      buyerUid:
        order.buyerUid ||
        "",

      buyerName:
        order.name ||
        order.buyerName ||
        ""
    };

    if (typeof setSelectedBook === "function") {
      setSelectedBook(bookData);
    }

    setPage("chat");
  };

  // =========================================================
  // BUYER CANCEL
  // =========================================================
  const handleBuyerCancelOrder = async (
    order,
    e
  ) => {
    if (e) {
      e.stopPropagation();
    }

    const confirmCancel = window.confirm(
      `Are you sure you want to cancel your order for "${order.bookName || order.title}"?`
    );

    if (!confirmCancel) return;

    try {
      setCancellingOrderId(order.id);

      // Update order
      const orderDocRef = doc(
        db,
        "orders",
        order.id
      );

      await updateDoc(orderDocRef, {
        orderStatus: "CANCELLED",
        updatedAt: serverTimestamp()
      });

      // Notify buyer + seller
      await notifyBuyerOrderCancellation({
        orderId: order.id,
        bookId: order.bookId || "",
        bookName:
          order.bookName ||
          order.title ||
          "Book",

        buyerUid:
          order.buyerUid ||
          userUid,

        buyerEmail:
          order.buyerEmail ||
          order.userEmail ||
          userEmail,

        sellerUid:
          order.sellerUid ||
          order.sellerId ||
          "",

        sellerEmail:
          order.sellerEmail ||
          ""
      });

      // Update purchases
      setPurchases((prev) =>
        prev.map((item) =>
          item.id === order.id
            ? {
                ...item,
                orderStatus: "CANCELLED"
              }
            : item
        )
      );

      // Update sales
      setSales((prev) =>
        prev.map((item) =>
          item.id === order.id
            ? {
                ...item,
                orderStatus: "CANCELLED"
              }
            : item
        )
      );

      if (
        selectedOrder &&
        selectedOrder.id === order.id
      ) {
        setSelectedOrder((prev) => ({
          ...prev,
          orderStatus: "CANCELLED"
        }));
      }

      alert(
        "Your order has been cancelled successfully."
      );

    } catch (err) {
      console.error(
        "Error cancelling order:",
        err
      );

      alert(
        "Failed to cancel order: " +
        (err.message ||
          "Please try again.")
      );

    } finally {
      setCancellingOrderId(null);
    }
  };

  // =========================================================
  // SELLER CANCEL
  // =========================================================
  const handleSellerCancelOrder = async (
    order,
    e
  ) => {
    if (e) {
      e.stopPropagation();
    }

    const confirmCancel = window.confirm(
      `Are you sure you want to cancel the order for "${order.bookName || order.title}"?`
    );

    if (!confirmCancel) return;

    try {
      setCancellingOrderId(order.id);

      const orderDocRef = doc(
        db,
        "orders",
        order.id
      );

      await updateDoc(orderDocRef, {
        orderStatus: "CANCELLED",
        updatedAt: serverTimestamp()
      });

      await notifySellerOrderCancellation({
        orderId: order.id,
        bookId: order.bookId || "",
        bookName:
          order.bookName ||
          order.title ||
          "Book",

        buyerUid:
          order.buyerUid ||
          "",

        buyerEmail:
          order.buyerEmail ||
          order.userEmail ||
          "",

        sellerUid:
          userUid ||
          order.sellerUid ||
          "",

        sellerEmail:
          userEmail ||
          order.sellerEmail ||
          ""
      });

      setSales((prev) =>
        prev.map((item) =>
          item.id === order.id
            ? {
                ...item,
                orderStatus: "CANCELLED"
              }
            : item
        )
      );

      setPurchases((prev) =>
        prev.map((item) =>
          item.id === order.id
            ? {
                ...item,
                orderStatus: "CANCELLED"
              }
            : item
        )
      );

      if (
        selectedOrder &&
        selectedOrder.id === order.id
      ) {
        setSelectedOrder((prev) => ({
          ...prev,
          orderStatus: "CANCELLED"
        }));
      }

      alert(
        "Order has been cancelled successfully. Buyer has been notified."
      );

    } catch (err) {
      console.error(
        "Error cancelling order:",
        err
      );

      alert(
        "Failed to cancel order: " +
        (err.message ||
          "Please try again.")
      );

    } finally {
      setCancellingOrderId(null);
    }
  };

  // =========================================================
  // HELPERS
  // =========================================================
  const currentList =
    activeTab === "purchases"
      ? purchases
      : sales;

  const formatDate = (timestamp) => {
    if (!timestamp) {
      return "Recent";
    }

    if (timestamp.toMillis) {
      return new Date(
        timestamp.toMillis()
      ).toLocaleDateString([], {
        day: "numeric",
        month: "short",
        year: "numeric"
      });
    }

    if (typeof timestamp === "number") {
      return new Date(
        timestamp
      ).toLocaleDateString([], {
        day: "numeric",
        month: "short",
        year: "numeric"
      });
    }

    return "Recent";
  };

  const getQuantity = (order) => {
    const quantity =
      parseInt(order?.quantity, 10);

    return quantity > 0 ? quantity : 1;
  };

  const getUnitPrice = (order) => {
    return Number(
      order?.unitPrice ??
      order?.price ??
      0
    );
  };

  const getTotalPrice = (order) => {
    const savedTotal = Number(
      order?.totalPrice
    );

    if (
      Number.isFinite(savedTotal) &&
      savedTotal >= 0
    ) {
      return savedTotal;
    }

    return (
      getUnitPrice(order) *
      getQuantity(order)
    );
  };

  // =========================================================
  // UI
  // =========================================================
  return (
    <div className="orders-page">

      {/* BACK BUTTON */}
      <button
        type="button"
        className="back-button"
        onClick={handleBack}
        title="Go Back"
      >
        ←
      </button>

      <h1>Order Management</h1>

      {/* TEST CLEANUP */}
      {userEmail.toLowerCase() ===
        "malavikav0307@gmail.com" && (
        <div className="test-cleanup-container">
          <button
            type="button"
            className="clean-test-btn"
            onClick={
              handleManualCleanTestOrders
            }
            disabled={cleaningTestOrders}
          >
            {cleaningTestOrders
              ? "Cleaning Test Records..."
              : "🧹 Clean Test Records (malavikav0307@gmail.com)"}
          </button>
        </div>
      )}

      {/* TABS */}
      <div className="orders-tabs-container">

        <button
          type="button"
          className={`orders-tab-btn ${
            activeTab === "purchases"
              ? "active"
              : ""
          }`}
          onClick={() =>
            setActiveTab("purchases")
          }
        >
          🛍️ My Purchases (
          {purchases.length})
        </button>

        <button
          type="button"
          className={`orders-tab-btn ${
            activeTab === "sales"
              ? "active"
              : ""
          }`}
          onClick={() =>
            setActiveTab("sales")
          }
        >
          📦 Received Sales (
          {sales.length})
        </button>

      </div>

      {/* LOADING */}
      {loading && (
        <p className="orders-message">
          Loading orders...
        </p>
      )}

      {/* NO ORDERS */}
      {!loading &&
        currentList.length === 0 && (
          <div className="orders-message">

            <span
              style={{
                fontSize: "28px",
                display: "block",
                marginBottom: "8px"
              }}
            >
              {activeTab === "purchases"
                ? "🛍️"
                : "📦"}
            </span>

            <p>
              {activeTab === "purchases"
                ? "You haven't placed any book orders yet."
                : "You haven't received any orders for your listed books yet."}
            </p>

          </div>
        )}

      {/* ORDER CARDS */}
      {!loading &&
        currentList.length > 0 && (
          <div className="orders-list">

            {currentList.map((order) => {
              const isCancelled =
                (
                  order.orderStatus ||
                  ""
                ).toUpperCase() ===
                "CANCELLED";

              const quantity =
                getQuantity(order);

              const unitPrice =
                getUnitPrice(order);

              const totalPrice =
                getTotalPrice(order);

              return (
                <div
                  className={`order-card ${
                    isCancelled
                      ? "order-cancelled-card"
                      : ""
                  }`}
                  key={order.id}
                  onClick={() =>
                    setSelectedOrder(order)
                  }
                >

                  {/* BOOK */}
                  <div className="order-book">

                    <img
                      src={
                        order.frontCover ||
                        order.frontImage ||
                        order.image ||
                        ""
                      }
                      alt={
                        order.bookName ||
                        "Book"
                      }
                    />

                    <div className="order-book-info">

                      <h2>
                        {order.bookName ||
                          order.title}
                      </h2>

                      <p>
                        by{" "}
                        {order.author ||
                          "Unknown Author"}
                      </p>

                      {/* BUYER INFO FOR SELLER */}
                      {activeTab ===
                        "sales" && (
                        <p className="order-buyer-tag">
                          Buyer:{" "}
                          <strong>
                            {order.name ||
                              order.buyerEmail ||
                              order.userEmail}
                          </strong>
                        </p>
                      )}

                      {/* PRICE */}
                      <strong>
                        ₹{totalPrice}
                      </strong>

                      {/* QUANTITY */}
                      <p className="order-quantity">
                        Qty: {quantity}{" "}
                        {quantity === 1
                          ? "book"
                          : "books"}
                      </p>

                      {/* UNIT PRICE */}
                      {quantity > 1 && (
                        <p className="order-unit-price">
                          ₹{unitPrice} per book
                        </p>
                      )}

                    </div>
                  </div>

                  {/* RIGHT */}
                  <div className="order-card-right">

                    <div
                      className={`order-status ${
                        isCancelled
                          ? "cancelled"
                          : "confirmed"
                      }`}
                    >
                      {isCancelled
                        ? "✕ Cancelled"
                        : `✓ ${
                            order.orderStatus ||
                            "Confirmed"
                          }`}
                    </div>

                    <span className="order-date-tag">
                      {formatDate(
                        order.createdAt
                      )}
                    </span>

                    <p className="view-details">
                      Details →
                    </p>

                  </div>
                </div>
              );
            })}

          </div>
        )}

      {/* =====================================================
          FULL DETAILS POPUP
      ===================================================== */}
      {selectedOrder && (
        <div
          className="order-details-overlay"
          onClick={() =>
            setSelectedOrder(null)
          }
        >

          <div
            className="order-details-popup"
            onClick={(e) =>
              e.stopPropagation()
            }
          >

            {/* CLOSE */}
            <button
              className="close-order-details"
              onClick={() =>
                setSelectedOrder(null)
              }
              title="Close"
            >
              ×
            </button>

            <h2>
              {activeTab === "sales"
                ? "Sales Order Details"
                : "Purchase Details"}
            </h2>

            {/* BOOK */}
            <div className="details-book">

              <img
                src={
                  selectedOrder.frontCover ||
                  selectedOrder.frontImage ||
                  selectedOrder.image ||
                  ""
                }
                alt={
                  selectedOrder.bookName ||
                  "Book"
                }
              />

              <div>

                <h3>
                  {selectedOrder.bookName ||
                    selectedOrder.title}
                </h3>

                <p>
                  by{" "}
                  {selectedOrder.author ||
                    "Unknown"}
                </p>

                <strong>
                  ₹{getTotalPrice(selectedOrder)}
                </strong>

                <p className="order-unit-price">
                  ₹{getUnitPrice(selectedOrder)}{" "}
                  per book
                </p>

              </div>
            </div>

            {/* QUANTITY */}
            <div className="details-row">
              <b>Order Quantity</b>

              <span>
                {getQuantity(selectedOrder)}{" "}
                {getQuantity(
                  selectedOrder
                ) === 1
                  ? "book"
                  : "books"}
              </span>
            </div>

            {/* TOTAL */}
            <div className="details-row">
              <b>Total Amount</b>

              <span className="order-total-highlight">
                ₹{getTotalPrice(selectedOrder)}
              </span>
            </div>

            {/* STATUS */}
            <div className="details-row">

              <b>Order Status</b>

              <span
                style={{
                  fontWeight: "bold",
                  color:
                    (
                      selectedOrder.orderStatus ||
                      ""
                    ).toUpperCase() ===
                    "CANCELLED"
                      ? "#d32f2f"
                      : "#2e7d32"
                }}
              >
                {
                  (
                    selectedOrder.orderStatus ||
                    ""
                  ).toUpperCase() ===
                  "CANCELLED"
                    ? "✕ Cancelled"
                    : `✓ ${
                        selectedOrder.orderStatus ||
                        "Confirmed"
                      }`
                }
              </span>

            </div>

            {/* PAYMENT METHOD */}
            <div className="details-row">

              <b>Payment Method</b>

              <span>
                {selectedOrder.paymentMethod ===
                  "QR" ||
                selectedOrder.paymentMethod ===
                  "UPI_QR" ||
                selectedOrder.paymentMethod ===
                  "GPay/UPI"
                  ? "📱 QR Payment / UPI"
                  : "💵 Cash on Delivery (COD)"}
              </span>

            </div>

            {/* PAYMENT STATUS */}
            <div className="details-row">

              <b>Payment Status</b>

              <span>
                {selectedOrder.paymentStatus ===
                "USER_CONFIRMED"
                  ? "✓ Paid via UPI (User Confirmed)"
                  : selectedOrder.paymentStatus ===
                    "COD"
                  ? "Cash on Delivery"
                  : selectedOrder.paymentStatus ||
                    "Pending"}
              </span>

            </div>

            {/* BUYER / SELLER */}
            <div className="details-row">

              <b>
                {activeTab === "sales"
                  ? "Buyer"
                  : "Seller"}
              </b>

              <span>
                {activeTab === "sales"
                  ? selectedOrder.name ||
                    selectedOrder.buyerName ||
                    selectedOrder.buyerEmail ||
                    selectedOrder.userEmail ||
                    "Buyer"
                  : selectedOrder.sellerName ||
                    "Verified Seller"}
              </span>

            </div>

            {/* ORDER DATE */}
            <div className="details-row">

              <b>Order Date</b>

              <span>
                {formatDate(
                  selectedOrder.createdAt
                )}
              </span>

            </div>

            {/* DELIVERY ADDRESS */}
            <div className="details-address">

              <h3>
                Delivery Information
              </h3>

              <p>
                <strong>
                  {selectedOrder.name ||
                    "Customer"}
                </strong>
              </p>

              <p>
                {selectedOrder.houseNo}

                {selectedOrder.houseNo &&
                selectedOrder.houseName
                  ? ", "
                  : ""}

                {selectedOrder.houseName}
              </p>

              <p>
                {selectedOrder.area}

                {selectedOrder.area &&
                selectedOrder.street
                  ? ", "
                  : ""}

                {selectedOrder.street}
              </p>

              <p>
                {selectedOrder.city}

                {selectedOrder.city &&
                selectedOrder.pincode
                  ? " - "
                  : ""}

                {selectedOrder.pincode}
              </p>

              <p>
                📞{" "}
                <strong>
                  {selectedOrder.phone ||
                    "Not provided"}
                </strong>
              </p>

            </div>

            {/* ACTION BUTTONS */}
            <div
              className="order-book-action-row"
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "8px"
              }}
            >

              {/* SHOW BOOK */}
              <button
                type="button"
                className="show-book-page-btn"
                onClick={() =>
                  handleShowBookPage(
                    selectedOrder
                  )
                }
                disabled={
                  loadingBookPage
                }
              >
                {loadingBookPage
                  ? "Loading Book Details..."
                  : "📖 Show Book Page"}
              </button>

              {/* CHAT */}
              <button
                type="button"
                className="show-book-page-btn"
                style={{
                  background: "#4CAF50",
                  color: "#fff",
                  borderColor: "#4CAF50"
                }}
                onClick={(e) =>
                  handleChatFromOrder(
                    selectedOrder,
                    e
                  )
                }
              >
                {activeTab === "sales"
                  ? "💬 Chat with Buyer"
                  : "💬 Chat with Seller"}
              </button>

            </div>

            {/* BUYER CANCEL */}
            {activeTab === "purchases" &&
              (
                selectedOrder.orderStatus ||
                ""
              ).toUpperCase() !==
                "CANCELLED" && (

                <div className="order-actions-box">

                  <button
                    type="button"
                    className="order-cancel-btn"
                    onClick={(e) =>
                      handleBuyerCancelOrder(
                        selectedOrder,
                        e
                      )
                    }
                    disabled={
                      cancellingOrderId ===
                      selectedOrder.id
                    }
                  >
                    {cancellingOrderId ===
                    selectedOrder.id
                      ? "Cancelling Order..."
                      : "✕ Cancel My Order"}
                  </button>

                  <p className="order-cancel-hint">
                    You can cancel before dispatch.
                    The seller will be notified.
                  </p>

                </div>
              )}

            {/* SELLER CANCEL */}
            {activeTab === "sales" &&
              (
                selectedOrder.orderStatus ||
                ""
              ).toUpperCase() !==
                "CANCELLED" && (

                <div className="order-actions-box">

                  <button
                    type="button"
                    className="order-cancel-btn"
                    onClick={(e) =>
                      handleSellerCancelOrder(
                        selectedOrder,
                        e
                      )
                    }
                    disabled={
                      cancellingOrderId ===
                      selectedOrder.id
                    }
                  >
                    {cancellingOrderId ===
                    selectedOrder.id
                      ? "Cancelling Order..."
                      : "✕ Cancel Order as Seller"}
                  </button>

                  <p className="order-cancel-hint">
                    Cancelling will notify the buyer
                    immediately.
                  </p>

                </div>
              )}

          </div>
        </div>
      )}
    </div>
  );
}

export default Orders;