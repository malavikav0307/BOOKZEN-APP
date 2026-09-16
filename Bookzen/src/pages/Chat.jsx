
import { useState, useEffect, useRef } from "react";
import "./Chat.css";
import { db, auth } from "../firebase";
import {
  collection,
  doc,
  setDoc,
  addDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  increment
} from "firebase/firestore";
import { notifyNewChatMessage } from "../services/notificationService";

function Chat({ book, setPage, currentUser, goBack }) {
  const activeUser = currentUser || auth.currentUser;

  const userEmail =
    activeUser?.email ||
    localStorage.getItem("userEmail") ||
    "";

  const userUid =
    activeUser?.uid ||
    auth.currentUser?.uid ||
    "";

  const userName =
    localStorage.getItem("userName") ||
    activeUser?.displayName ||
    (userEmail ? userEmail.split("@")[0] : "User");

  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [deletingMessageId, setDeletingMessageId] = useState(null);

  // =========================================================
  // SELLER DETAILS
  // =========================================================

  const sellerUidFromBook =
    book?.sellerId ||
    book?.sellerUid ||
    "";

  const sellerEmailFromBook =
    book?.sellerEmail ||
    book?.seller ||
    "";

  const isUserSeller = Boolean(
    (userUid &&
      sellerUidFromBook &&
      userUid === sellerUidFromBook) ||
    (userEmail &&
      sellerEmailFromBook &&
      userEmail.toLowerCase() ===
        sellerEmailFromBook.toLowerCase())
  );

  // =========================================================
  // BUYER DETAILS
  // =========================================================

  const effectiveBuyerUid = isUserSeller
    ? (
        book?.buyerUid ||
        book?.buyerId ||
        book?.userId ||
        ""
      )
    : userUid;

  const effectiveBuyerEmail = isUserSeller
    ? (
        book?.buyerEmail ||
        book?.userEmail ||
        ""
      )
    : userEmail;

  const effectiveBuyerName = isUserSeller
    ? (
        book?.buyerName ||
        book?.name ||
        (
          effectiveBuyerEmail
            ? effectiveBuyerEmail.split("@")[0]
            : "Buyer"
        )
      )
    : userName;

  // =========================================================
  // SELLER DETAILS
  // =========================================================

  const effectiveSellerUid =
    sellerUidFromBook ||
    (isUserSeller ? userUid : "");

  const effectiveSellerEmail =
    sellerEmailFromBook ||
    (isUserSeller ? userEmail : "");

  const [sellerDisplayName, setSellerDisplayName] =
    useState(
      book?.sellerName ||
        (
          effectiveSellerEmail
            ? effectiveSellerEmail.split("@")[0]
            : "Seller"
        )
    );

  // =========================================================
  // IMAGE ATTACHMENT STATE
  // =========================================================

  const [selectedImage, setSelectedImage] =
    useState(null);

  const [imagePreview, setImagePreview] =
    useState("");

  const [fullscreenImageUrl, setFullscreenImageUrl] =
    useState(null);

  const messagesEndRef = useRef(null);
  const imageInputRef = useRef(null);

  // =========================================================
  // BACK
  // =========================================================

  const handleBack = () => {
    if (typeof goBack === "function") {
      goBack("bookDetails");
    } else if (typeof setPage === "function") {
      setPage("bookDetails");
    }
  };

  // =========================================================
  // CONVERSATION ID
  // =========================================================

  const buyerId =
    effectiveBuyerUid ||
    (
      effectiveBuyerEmail
        ? effectiveBuyerEmail.replace(
            /[^a-zA-Z0-9]/g,
            "_"
          )
        : "buyer"
    );

  const sellerId =
    effectiveSellerUid ||
    (
      effectiveSellerEmail
        ? effectiveSellerEmail.replace(
            /[^a-zA-Z0-9]/g,
            "_"
          )
        : "seller"
    );

  const sortedIds = [buyerId, sellerId].sort();

  const conversationId = book?.id
    ? `${book.id}_${sortedIds[0]}_${sortedIds[1]}`
    : "";

  const chatId = conversationId;

  // =========================================================
  // SELF CHAT PREVENTION
  // =========================================================

  const isOwner = Boolean(
    isUserSeller &&
    (!effectiveBuyerUid ||
      effectiveBuyerUid === userUid) &&
    (!effectiveBuyerEmail ||
      effectiveBuyerEmail.toLowerCase() ===
        userEmail.toLowerCase())
  );

  // =========================================================
  // RESOLVE SELLER NAME
  // =========================================================

  useEffect(() => {
    let isMounted = true;

    const resolveSeller = async () => {
      if (!book) return;

      if (book.sellerName && isMounted) {
        setSellerDisplayName(book.sellerName);
        return;
      }

      if (
        effectiveSellerUid &&
        auth.currentUser
      ) {
        try {
          const uSnap = await getDoc(
            doc(
              db,
              "users",
              effectiveSellerUid
            )
          );

          if (
            uSnap.exists() &&
            isMounted
          ) {
            const uData = uSnap.data();

            const foundName =
              uData.name ||
              uData.displayName;

            if (foundName) {
              setSellerDisplayName(foundName);
            }
          }
        } catch (e) {
          console.warn(
            "Could not fetch seller profile:",
            e
          );
        }
      }
    };

    resolveSeller();

    return () => {
      isMounted = false;
    };
  }, [book, effectiveSellerUid]);

  // =========================================================
  // PARTICIPANTS
  // =========================================================

  const participantUids = Array.from(
    new Set(
      [
        effectiveBuyerUid,
        effectiveSellerUid,
        buyerId,
        sellerId
      ].filter(Boolean)
    )
  );

  const participantEmails = Array.from(
    new Set(
      [
        effectiveBuyerEmail,
        effectiveSellerEmail,
        effectiveBuyerEmail.toLowerCase(),
        effectiveSellerEmail.toLowerCase()
      ].filter(Boolean)
    )
  );

  // =========================================================
  // CLEANUP IMAGE PREVIEW
  // =========================================================

  useEffect(() => {
    return () => {
      if (
        imagePreview &&
        imagePreview.startsWith("blob:")
      ) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  // =========================================================
  // INITIALIZE CONVERSATION + LISTEN
  // =========================================================

  useEffect(() => {
    if (
      !activeUser ||
      !book?.id ||
      !conversationId ||
      isOwner ||
      !auth.currentUser
    ) {
      return;
    }

    let isMounted = true;
    let unsubscribe = () => {};

    const setupConversationAndListener =
      async () => {
        try {
          const convRef = doc(
            db,
            "conversations",
            conversationId
          );

          const unreadResetPayload =
            isUserSeller
              ? { sellerUnreadCount: 0 }
              : { buyerUnreadCount: 0 };

          await setDoc(
            convRef,
            {
              id: conversationId,
              conversationId,
              chatId,

              bookId: book.id,

              bookName:
                book.bookName ||
                book.title ||
                "Book",

              bookTitle:
                book.bookName ||
                book.title ||
                "Book",

              bookImage:
                book.frontCover ||
                book.frontImage ||
                book.image ||
                "",

              bookPrice:
                book.price || 0,

              buyerId,
              buyerUid: effectiveBuyerUid,
              buyerEmail: effectiveBuyerEmail,
              buyerName: effectiveBuyerName,

              sellerId,
              sellerUid: effectiveSellerUid,
              sellerEmail: effectiveSellerEmail,
              sellerName: sellerDisplayName,

              participantUids,
              participantEmails,
              participants: participantUids,

              ...unreadResetPayload,

              updatedAt: serverTimestamp()
            },
            { merge: true }
          );

          if (!isMounted) return;

          const messagesRef = collection(
            db,
            "conversations",
            conversationId,
            "messages"
          );

          const q = query(
            messagesRef,
            orderBy("createdAt", "asc")
          );

          unsubscribe = onSnapshot(
            q,
            (snapshot) => {
              if (!isMounted) return;

              const msgs =
                snapshot.docs.map((d) => ({
                  id: d.id,
                  ...d.data()
                }));

              setMessages(msgs);

              if (
                document.visibilityState ===
                "visible"
              ) {
                updateDoc(
                  convRef,
                  unreadResetPayload
                ).catch(() => {});
              }
            },
            (err) => {
              console.error(
                "Chat messages listener error:",
                err
              );
            }
          );
        } catch (err) {
          console.warn(
            "Conversation init notice:",
            err
          );
        }
      };

    setupConversationAndListener();

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [
    conversationId,
    activeUser,
    book?.id,
    isOwner,
    isUserSeller
  ]);

  // =========================================================
  // SCROLL TO BOTTOM
  // =========================================================

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth"
    });
  }, [messages, imagePreview]);

  // =========================================================
  // DELETE MESSAGE
  // ONLY SENDER CAN DELETE
  // =========================================================

  const deleteMessage = async (messageId) => {
    if (
      !messageId ||
      !conversationId ||
      deletingMessageId
    ) {
      return;
    }

    const targetMessage =
      messages.find(
        (msg) => msg.id === messageId
      );

    if (!targetMessage) {
      return;
    }

    const isMine =
      (
        userUid &&
        targetMessage.senderId &&
        targetMessage.senderId === userUid
      ) ||
      (
        userEmail &&
        targetMessage.senderEmail &&
        targetMessage.senderEmail.toLowerCase() ===
          userEmail.toLowerCase()
      );

    // Extra frontend protection
    if (!isMine) {
      alert(
        "You can delete only your own messages."
      );
      return;
    }

    const confirmed = window.confirm(
      "Delete this message?"
    );

    if (!confirmed) return;

    setDeletingMessageId(messageId);

    try {
      const messageRef = doc(
        db,
        "conversations",
        conversationId,
        "messages",
        messageId
      );

      await deleteDoc(messageRef);
    } catch (err) {
      console.error(
        "Error deleting message:",
        err
      );

      alert(
        "Failed to delete message. Please try again."
      );
    } finally {
      setDeletingMessageId(null);
    }
  };

  // =========================================================
  // COMPRESS IMAGE TO BASE64
  // NO FIREBASE STORAGE
  // =========================================================

  const compressImageToBase64 = (file) => {
    return new Promise(
      (resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (event) => {
          const img = new Image();

          img.onload = () => {
            const maxSize = 500;

            let width = img.width;
            let height = img.height;

            if (
              width > height &&
              width > maxSize
            ) {
              height = Math.round(
                (height * maxSize) /
                  width
              );

              width = maxSize;
            } else if (
              height > maxSize
            ) {
              width = Math.round(
                (width * maxSize) /
                  height
              );

              height = maxSize;
            }

            const canvas =
              document.createElement(
                "canvas"
              );

            canvas.width = width;
            canvas.height = height;

            const ctx =
              canvas.getContext("2d");

            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = "high";

            ctx.drawImage(
              img,
              0,
              0,
              width,
              height
            );

            const base64 =
              canvas.toDataURL(
                "image/jpeg",
                0.5
              );

            if (
              base64.length >
              900000
            ) {
              const smallerBase64 =
                canvas.toDataURL(
                  "image/jpeg",
                  0.4
                );

              resolve(
                smallerBase64
              );
            } else {
              resolve(base64);
            }
          };

          img.onerror = () => {
            reject(
              new Error(
                "Unable to process image."
              )
            );
          };

          img.src =
            event.target.result;
        };

        reader.onerror = () => {
          reject(
            new Error(
              "Unable to read image."
            )
          );
        };

        reader.readAsDataURL(file);
      }
    );
  };

  // =========================================================
  // IMAGE SELECT
  // =========================================================

  const handleImageSelect = (e) => {
    const file =
      e.target.files?.[0];

    if (!file) return;

    const validTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/jpg"
    ];

    if (
      !validTypes.includes(
        file.type.toLowerCase()
      )
    ) {
      alert(
        "Please select a JPG, PNG, or WEBP image."
      );

      e.target.value = "";
      return;
    }

    if (
      file.size >
      10 * 1024 * 1024
    ) {
      alert(
        "Maximum image size is 10MB."
      );

      e.target.value = "";
      return;
    }

    if (
      imagePreview &&
      imagePreview.startsWith("blob:")
    ) {
      URL.revokeObjectURL(
        imagePreview
      );
    }

    setSelectedImage(file);

    setImagePreview(
      URL.createObjectURL(file)
    );
  };

  // =========================================================
  // CANCEL IMAGE
  // =========================================================

  const handleCancelAttachment = () => {
    if (
      imagePreview &&
      imagePreview.startsWith("blob:")
    ) {
      URL.revokeObjectURL(
        imagePreview
      );
    }

    setSelectedImage(null);
    setImagePreview("");

    if (imageInputRef.current) {
      imageInputRef.current.value = "";
    }
  };

  // =========================================================
  // SEND MESSAGE
  // TEXT + IMAGE
  // =========================================================

  const sendMessage = async () => {
    if (
      (!message.trim() &&
        !selectedImage) ||
      sending ||
      !book?.id ||
      !conversationId
    ) {
      return;
    }

    if (
      !activeUser ||
      !auth.currentUser
    ) {
      alert(
        "Please login to send messages."
      );

      setPage("login");
      return;
    }

    const textToSend =
      message.trim();

    const imageToSend =
      selectedImage;

    setMessage("");
    handleCancelAttachment();
    setSending(true);

    try {
      let imageBase64 = "";

      if (imageToSend) {
        imageBase64 =
          await compressImageToBase64(
            imageToSend
          );
      }

      const summaryText =
        textToSend ||
        (
          imageBase64
            ? "📷 Photo"
            : ""
        );

      const msgType =
        imageBase64
          ? (
              textToSend
                ? "image_text"
                : "image"
            )
          : "text";

      // =====================================================
      // RECEIVER
      // =====================================================

      const receiverUid =
        isUserSeller
          ? effectiveBuyerUid
          : effectiveSellerUid;

      const receiverEmail =
        isUserSeller
          ? effectiveBuyerEmail
          : effectiveSellerEmail;

      // =====================================================
      // ADD MESSAGE
      // =====================================================

      const messagesRef =
        collection(
          db,
          "conversations",
          conversationId,
          "messages"
        );

      await addDoc(
        messagesRef,
        {
          conversationId,

          senderId: userUid,
          senderEmail: userEmail,

          receiverId: receiverUid,
          receiverEmail: receiverEmail,

          bookId: book.id,

          bookName:
            book.bookName ||
            book.title ||
            "Book",

          text: textToSend,

          message: textToSend,

          imageBase64:
            imageBase64 || "",

          imageUrl:
            imageBase64 || "",

          type: msgType,

          read: false,

          createdAt:
            serverTimestamp()
        }
      );

      // =====================================================
      // UPDATE CONVERSATION
      // =====================================================

      const convRef = doc(
        db,
        "conversations",
        conversationId
      );

      const unreadIncrement =
        isUserSeller
          ? {
              buyerUnreadCount:
                increment(1)
            }
          : {
              sellerUnreadCount:
                increment(1)
            };

      await setDoc(
        convRef,
        {
          id: conversationId,
          conversationId,
          chatId,

          bookId: book.id,

          bookName:
            book.bookName ||
            book.title ||
            "Book",

          bookTitle:
            book.bookName ||
            book.title ||
            "Book",

          bookImage:
            book.frontCover ||
            book.frontImage ||
            book.image ||
            "",

          bookPrice:
            book.price || 0,

          buyerId,
          buyerUid:
            effectiveBuyerUid,

          buyerEmail:
            effectiveBuyerEmail,

          buyerName:
            effectiveBuyerName,

          sellerId,
          sellerUid:
            effectiveSellerUid,

          sellerEmail:
            effectiveSellerEmail,

          sellerName:
            sellerDisplayName,

          participantUids,
          participantEmails,
          participants:
            participantUids,

          lastMessage:
            summaryText,

          lastMessageAt:
            serverTimestamp(),

          lastMessageSenderId:
            userUid,

          ...unreadIncrement,

          updatedAt:
            serverTimestamp()
        },
        { merge: true }
      );

      // =====================================================
      // NOTIFICATION
      // =====================================================

      notifyNewChatMessage({
        conversationId,
        bookId: book.id,

        bookName:
          book.bookName ||
          book.title ||
          "Book",

        senderUid: userUid,
        senderEmail: userEmail,
        senderName: userName,

        receiverUid,
        receiverEmail,

        messagePreview:
          summaryText,

        bookImage:
          book.frontCover ||
          book.frontImage ||
          book.image ||
          ""
      }).catch(
        (notifErr) => {
          console.warn(
            "Notification dispatch notice:",
            notifErr
          );
        }
      );

    } catch (err) {
      console.error(
        "Error sending message:",
        err
      );

      alert(
        "Failed to send message: " +
          (
            err.message ||
            "Please check connection."
          )
      );
    } finally {
      setSending(false);
    }
  };

  // =========================================================
  // FORMAT TIME
  // =========================================================

  const formatMessageTime = (
    timestamp
  ) => {
    if (!timestamp) {
      return "Just now";
    }

    const date =
      timestamp.toMillis
        ? new Date(
            timestamp.toMillis()
          )
        : new Date(timestamp);

    return date.toLocaleTimeString(
      [],
      {
        hour: "2-digit",
        minute: "2-digit"
      }
    );
  };

  // =========================================================
  // NO BOOK
  // =========================================================

  if (!book) {
    return (
      <div className="chat-page">
        <div className="chat-header">
          <button
            type="button"
            className="chat-back"
            onClick={handleBack}
            title="Back"
          >
            ←
          </button>

          <div className="seller-info">
            <h3>Chat</h3>
          </div>
        </div>

        <div
          className="empty-chat"
          style={{
            padding: "40px 20px",
            textAlign: "center"
          }}
        >
          <span
            style={{
              fontSize: "36px",
              display: "block",
              marginBottom: "10px"
            }}
          >
            📚
          </span>

          <h3>
            Listing Unavailable
          </h3>

          <p>
            This book listing is no longer
            available.
          </p>

          <button
            type="button"
            className="chat-back-btn"
            style={{
              marginTop: "16px",
              padding: "10px 20px",
              background: "#fd6569",
              color: "white",
              border: "none",
              borderRadius: "12px",
              cursor: "pointer",
              fontWeight: "600"
            }}
            onClick={handleBack}
          >
            ← Return
          </button>
        </div>
      </div>
    );
  }

  // =========================================================
  // OWNER VIEW
  // =========================================================

  if (isOwner) {
    return (
      <div className="chat-page">
        <div className="chat-header">
          <button
            type="button"
            className="chat-back"
            onClick={handleBack}
            title="Back"
          >
            ←
          </button>

          <div className="seller-info">
            <h3>
              Your Book Listing
            </h3>
          </div>
        </div>

        <div
          className="empty-chat"
          style={{
            padding: "40px 20px",
            textAlign: "center"
          }}
        >
          <span
            style={{
              fontSize: "36px",
              display: "block",
              marginBottom: "10px"
            }}
          >
            ℹ️
          </span>

          <h3>Owner View</h3>

          <p>
            You are the seller of "
            {book.bookName ||
              book.title}
            ". You cannot chat with yourself.
          </p>

          <button
            type="button"
            style={{
              marginTop: "16px",
              padding: "10px 20px",
              background: "#fd6569",
              color: "white",
              border: "none",
              borderRadius: "12px",
              cursor: "pointer",
              fontWeight: "600"
            }}
            onClick={handleBack}
          >
            ← Go Back to Book Details
          </button>
        </div>
      </div>
    );
  }

  // =========================================================
  // MAIN CHAT UI
  // =========================================================

  return (
    <div className="chat-page">

      {/* HEADER */}
      <div className="chat-header">

        <button
          type="button"
          className="chat-back"
          onClick={handleBack}
          title="Back"
        >
          ←
        </button>

        <div className="seller-avatar">
          👤
        </div>

        <div className="seller-info">

          <h3>
            {
              isUserSeller
                ? `Buyer: ${
                    effectiveBuyerName ||
                    effectiveBuyerEmail ||
                    "Buyer"
                  }`
                : `Seller: ${
                    sellerDisplayName ||
                    "Seller"
                  }`
            }
          </h3>

          <p>
            {book.bookName ||
              book.title ||
              "Book Listing"}
          </p>

        </div>
      </div>

      {/* BOOK CONTEXT CARD */}
      <div className="chat-book">

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
          <h4>
            {book.bookName ||
              book.title ||
              "Book"}
          </h4>

          <p>
            ₹{book.price || "0"}
          </p>
        </div>

      </div>

      {/* MESSAGES */}
      <div className="chat-messages">

        {messages.length === 0 ? (
          <div className="empty-chat">

            <div className="empty-icon">
              💬
            </div>

            <h3>
              Start Conversation
            </h3>

            <p>
              Send a message or payment
              screenshot about this book!
            </p>

          </div>
        ) : (
          messages.map((msg) => {

            const isMine =
              (
                userUid &&
                msg.senderId &&
                msg.senderId ===
                  userUid
              ) ||
              (
                userEmail &&
                msg.senderEmail &&
                msg.senderEmail
                  .toLowerCase() ===
                  userEmail.toLowerCase()
              );

            return (
              <div
                key={msg.id}
                className={`message ${
                  isMine
                    ? "user-message"
                    : "seller-message"
                }`}
                style={{
                  position: "relative"
                }}
              >

                {/* DELETE BUTTON
                    ONLY FOR MY MESSAGES */}
                {isMine && (
                  <button
                    type="button"
                    onClick={() =>
                      deleteMessage(msg.id)
                    }
                    disabled={
                      deletingMessageId ===
                      msg.id
                    }
                    title="Delete message"
                    style={{
                      position: "absolute",
                      top: "4px",
                      right: "4px",
                      border: "none",
                      background:
                        "transparent",
                      cursor:
                        deletingMessageId ===
                        msg.id
                          ? "wait"
                          : "pointer",
                      fontSize: "13px",
                      padding: "3px 5px",
                      opacity:
                        deletingMessageId ===
                        msg.id
                          ? 0.5
                          : 0.75,
                      zIndex: 2
                    }}
                  >
                    {deletingMessageId ===
                    msg.id
                      ? "..."
                      : "🗑️"}
                  </button>
                )}

                {/* IMAGE */}
                {(msg.imageBase64 ||
                  msg.imageUrl) && (
                  <div className="chat-bubble-image-wrap">
                    <img
                      src={
                        msg.imageBase64 ||
                        msg.imageUrl
                      }
                      alt="Photo"
                      className="chat-bubble-img"
                      onClick={() =>
                        setFullscreenImageUrl(
                          msg.imageBase64 ||
                            msg.imageUrl
                        )
                      }
                      onError={(e) => {
                        console.error(
                          "Chat image failed to load:",
                          e
                        );
                        e.currentTarget.style.display =
                          "none";
                      }}
                    />
                  </div>
                )}

                {/* TEXT */}
                {msg.text && (
                  <div className="chat-bubble-text">
                    {msg.text}
                  </div>
                )}

                <small>
                  {formatMessageTime(
                    msg.createdAt
                  )}
                </small>

              </div>
            );
          })
        )}

        <div ref={messagesEndRef} />

      </div>

      {/* IMAGE PREVIEW */}
      {imagePreview && (
        <div className="chat-attachment-preview">

          <div className="preview-thumb-wrap">

            <img
              src={imagePreview}
              alt="Screenshot preview"
            />

            <button
              type="button"
              className="cancel-thumb-btn"
              onClick={
                handleCancelAttachment
              }
              title="Cancel Image"
            >
              ✕
            </button>

          </div>

          <span className="preview-label">
            Photo / Payment Screenshot
            ready to send
          </span>

        </div>
      )}

      {/* HIDDEN FILE INPUT */}
      <input
        type="file"
        ref={imageInputRef}
        accept="image/jpeg,image/png,image/webp,image/jpg"
        style={{
          display: "none"
        }}
        onChange={
          handleImageSelect
        }
      />

      {/* INPUT BAR */}
      <div className="chat-input">

        <button
          type="button"
          className="chat-attach-btn"
          onClick={() =>
            imageInputRef.current?.click()
          }
          title="Attach Payment Screenshot or Photo"
          disabled={sending}
        >
          📷
        </button>

        <input
          type="text"
          placeholder={
            selectedImage
              ? "Add note (optional)..."
              : "Type message..."
          }
          value={message}
          onChange={(e) =>
            setMessage(e.target.value)
          }
          onKeyDown={(e) => {

            if (
              e.key === "Enter" &&
              !e.shiftKey
            ) {
              e.preventDefault();
              sendMessage();
            }

          }}
          disabled={sending}
        />

        <button
          type="button"
          className="chat-send-btn"
          onClick={sendMessage}
          disabled={
            (
              !message.trim() &&
              !selectedImage
            ) ||
            sending
          }
          title="Send"
        >
          {sending ? "..." : "➤"}
        </button>

      </div>

      {/* FULLSCREEN IMAGE */}
      {fullscreenImageUrl && (
        <div
          className="chat-fullscreen-overlay"
          onClick={() =>
            setFullscreenImageUrl(null)
          }
        >

          <button
            type="button"
            className="close-fullscreen-btn"
            onClick={() =>
              setFullscreenImageUrl(null)
            }
          >
            ✕
          </button>

          <img
            src={fullscreenImageUrl}
            alt="Fullscreen attachment"
            className="fullscreen-chat-img"
            onClick={(e) =>
              e.stopPropagation()
            }
          />

        </div>
      )}

    </div>
  );
}

export default Chat;
