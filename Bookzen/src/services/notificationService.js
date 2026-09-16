import { db } from "../firebase";
import { collection, addDoc, getDocs, query, where, serverTimestamp } from "firebase/firestore";

/**
 * ============================================================================
 * BOOKZEN NOTIFICATION SERVICE
 * ============================================================================
 * Handles reliable in-app notifications and provides an extensible
 * architecture for backend SMS / Push integrations (e.g. Firebase Cloud
 * Functions, Twilio, MSG91, Fast2SMS).
 */

/**
 * Helper to prevent duplicate notification creation for the same event
 */
const hasExistingNotification = async (orderId, type, receiverEmail) => {
  if (!orderId || !type) return false;
  try {
    const notifRef = collection(db, "notifications");
    const q = query(
      notifRef,
      where("orderId", "==", orderId),
      where("type", "==", type)
    );
    const snap = await getDocs(q);
    if (receiverEmail) {
      return snap.docs.some(
        (d) => d.data().receiverEmail?.toLowerCase() === receiverEmail.toLowerCase()
      );
    }
    return !snap.empty;
  } catch (err) {
    console.warn("Duplicate check skipped due to error:", err);
    return false;
  }
};

/**
 * A & B. ORDER PLACED NOTIFICATIONS
 * Triggered when a buyer successfully places an order.
 * - Seller receives: "Your book has been ordered"
 * - Buyer receives: "Order placed successfully"
 */
export const notifyOrderPlaced = async ({
  orderId,
  bookId,
  bookName,
  buyerUid,
  buyerEmail,
  sellerUid,
  sellerEmail,
  buyerPhone
}) => {
  const cleanBookName = bookName || "Book";

  // 1. Seller Notification
  if (sellerEmail || sellerUid) {
    try {
      const alreadySent = await hasExistingNotification(orderId, "order_received", sellerEmail);
      if (!alreadySent) {
        await addDoc(collection(db, "notifications"), {
          userId: sellerUid || "",
          receiverUid: sellerUid || "",
          receiverEmail: sellerEmail || "",
          senderUid: buyerUid || "",
          senderEmail: buyerEmail || "",
          type: "order",
          event: "order_received",
          title: "Your book has been ordered",
          message: `Someone has placed an order for your book: ${cleanBookName}.`,
          orderId: orderId || "",
          bookId: bookId || "",
          bookName: cleanBookName,
          sellerId: sellerUid || "",
          buyerId: buyerUid || "",
          isRead: false,
          status: "unread",
          createdAt: serverTimestamp()
        });
      }
    } catch (err) {
      console.warn("Could not create seller order notification:", err);
    }
  }

  // 2. Buyer Notification
  if (buyerEmail || buyerUid) {
    try {
      const alreadySent = await hasExistingNotification(orderId, "order_placed", buyerEmail);
      if (!alreadySent) {
        await addDoc(collection(db, "notifications"), {
          userId: buyerUid || "",
          receiverUid: buyerUid || "",
          receiverEmail: buyerEmail || "",
          senderUid: "system",
          senderEmail: "system@bookzen.com",
          type: "order_placed",
          event: "order_placed",
          title: "Order placed successfully",
          message: `Your order for ${cleanBookName} has been placed successfully.`,
          orderId: orderId || "",
          bookId: bookId || "",
          bookName: cleanBookName,
          sellerId: sellerUid || "",
          buyerId: buyerUid || "",
          isRead: false,
          status: "unread",
          createdAt: serverTimestamp()
        });
      }
    } catch (err) {
      console.warn("Could not create buyer order notification:", err);
    }
  }

  // 3. Backend SMS Trigger hook
  triggerSmsNotification({
    type: "ORDER_PLACED",
    phone: buyerPhone,
    message: `Your BOOKZEN order for ${cleanBookName} has been placed successfully.`
  });
};

/**
 * C & D. BUYER ORDER CANCELLATION NOTIFICATIONS
 * Triggered when a buyer cancels their order.
 * - Buyer receives: "Order cancelled"
 * - Seller receives: "Order cancelled" (The buyer has cancelled...)
 */
export const notifyBuyerOrderCancellation = async ({
  orderId,
  bookId,
  bookName,
  buyerUid,
  buyerEmail,
  sellerUid,
  sellerEmail
}) => {
  const cleanBookName = bookName || "Book";

  // 1. Buyer Notification
  if (buyerEmail || buyerUid) {
    try {
      const alreadySent = await hasExistingNotification(orderId, "buyer_cancelled_self", buyerEmail);
      if (!alreadySent) {
        await addDoc(collection(db, "notifications"), {
          userId: buyerUid || "",
          receiverUid: buyerUid || "",
          receiverEmail: buyerEmail || "",
          senderUid: buyerUid || "",
          senderEmail: buyerEmail || "",
          type: "order_cancelled",
          event: "buyer_cancelled_self",
          title: "Order cancelled",
          message: `Your order for ${cleanBookName} has been cancelled.`,
          orderId: orderId || "",
          bookId: bookId || "",
          bookName: cleanBookName,
          sellerId: sellerUid || "",
          buyerId: buyerUid || "",
          isRead: false,
          status: "unread",
          createdAt: serverTimestamp()
        });
      }
    } catch (err) {
      console.warn("Could not create buyer cancellation notification:", err);
    }
  }

  // 2. Seller Notification
  if (sellerEmail || sellerUid) {
    try {
      const alreadySent = await hasExistingNotification(orderId, "buyer_cancelled_seller", sellerEmail);
      if (!alreadySent) {
        await addDoc(collection(db, "notifications"), {
          userId: sellerUid || "",
          receiverUid: sellerUid || "",
          receiverEmail: sellerEmail || "",
          senderUid: buyerUid || "",
          senderEmail: buyerEmail || "",
          type: "order_cancelled",
          event: "buyer_cancelled_seller",
          title: "Order cancelled",
          message: `The buyer has cancelled the order for ${cleanBookName}.`,
          orderId: orderId || "",
          bookId: bookId || "",
          bookName: cleanBookName,
          sellerId: sellerUid || "",
          buyerId: buyerUid || "",
          isRead: false,
          status: "unread",
          createdAt: serverTimestamp()
        });
      }
    } catch (err) {
      console.warn("Could not create seller cancellation notification:", err);
    }
  }

  // 3. Backend SMS Trigger hook
  triggerSmsNotification({
    type: "ORDER_CANCELLED_BY_BUYER",
    message: `BOOKZEN: Order for ${cleanBookName} was cancelled.`
  });
};

/**
 * E. SELLER ORDER CANCELLATION NOTIFICATIONS
 * Triggered when a seller cancels an order.
 * - Buyer receives: "Order cancelled by seller"
 */
export const notifySellerOrderCancellation = async ({
  orderId,
  bookId,
  bookName,
  buyerUid,
  buyerEmail,
  sellerUid,
  sellerEmail
}) => {
  const cleanBookName = bookName || "Book";

  if (buyerEmail || buyerUid) {
    try {
      const alreadySent = await hasExistingNotification(orderId, "seller_cancelled_buyer", buyerEmail);
      if (!alreadySent) {
        await addDoc(collection(db, "notifications"), {
          userId: buyerUid || "",
          receiverUid: buyerUid || "",
          receiverEmail: buyerEmail || "",
          senderUid: sellerUid || "",
          senderEmail: sellerEmail || "",
          type: "order_cancelled",
          event: "seller_cancelled_buyer",
          title: "Order cancelled by seller",
          message: `The seller has cancelled your order for ${cleanBookName}.`,
          orderId: orderId || "",
          bookId: bookId || "",
          bookName: cleanBookName,
          sellerId: sellerUid || "",
          buyerId: buyerUid || "",
          isRead: false,
          status: "unread",
          createdAt: serverTimestamp()
        });
      }
    } catch (err) {
      console.warn("Could not create seller-cancellation notification for buyer:", err);
    }
  }

  // SMS Trigger hook
  triggerSmsNotification({
    type: "ORDER_CANCELLED_BY_SELLER",
    message: `BOOKZEN: The seller cancelled your order for ${cleanBookName}.`
  });
};

/**
 * F. NEW CHAT MESSAGE NOTIFICATION
 * Triggered when a buyer or seller sends a message in a conversation.
 * - Receiver gets: "New message about <BookName>"
 */
export const notifyNewChatMessage = async ({
  conversationId,
  bookId,
  bookName,
  senderUid,
  senderEmail,
  senderName,
  receiverUid,
  receiverEmail,
  messagePreview,
  bookImage
}) => {
  if (!receiverEmail && !receiverUid) return;
  const cleanBookName = bookName || "Book";
  const displayName = senderName || (senderEmail ? senderEmail.split("@")[0] : "Someone");

  try {
    await addDoc(collection(db, "notifications"), {
      userId: receiverUid || "",
      receiverUid: receiverUid || "",
      receiverEmail: receiverEmail || "",
      senderUid: senderUid || "",
      senderEmail: senderEmail || "",
      senderName: displayName,
      type: "message",
      event: "new_chat_message",
      title: `New message about ${cleanBookName}`,
      message: `${displayName}: ${messagePreview || "Sent a message"}`,
      conversationId: conversationId || "",
      bookId: bookId || "",
      bookName: cleanBookName,
      bookImage: bookImage || "",
      isRead: false,
      status: "unread",
      createdAt: serverTimestamp()
    });
  } catch (err) {
    console.warn("Could not create chat message notification:", err);
  }
};

/**
 * ============================================================================
 * SMS / BACKEND MESSAGING ARCHITECTURE
 * ============================================================================
 * Note: Real SMS sending requires a backend service (Firebase Cloud Functions /
 * Express server) with provider credentials (Twilio, MSG91, Fast2SMS) to
 * protect API secret keys.
 *
 * This function provides the clean frontend bridge to dispatch SMS requests
 * to a backend endpoint when configured, without leaking private API secrets.
 */
export const triggerSmsNotification = async ({ type, phone, message }) => {
  // If backend endpoint is configured via environment variable, dispatch:
  const backendSmsEndpoint = import.meta.env.VITE_SMS_SERVICE_URL;
  if (!backendSmsEndpoint || !phone) {
    // SMS provider backend not yet deployed; in-app notifications handle updates safely.
    return;
  }

  try {
    await fetch(backendSmsEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, phone, message })
    });
  } catch (smsErr) {
    console.warn("SMS dispatch request error:", smsErr);
  }
};
