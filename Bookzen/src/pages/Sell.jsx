
import { useState, useRef, useEffect } from "react";
import "./Sell.css";
import { db, auth } from "../firebase";

import {
  collection,
  addDoc,
  doc,
  getDoc,
  serverTimestamp
} from "firebase/firestore";

const IMAGE_SLOTS = [
  {
    id: "frontCover",
    label: "Front Cover",
    desc: "Clear front cover of the book",
    required: true
  },
  {
    id: "backCover",
    label: "Back Cover",
    desc: "Clear back cover with barcode/blurb",
    required: true
  },
  {
    id: "insidePage1",
    label: "Inside Page 1",
    desc: "First content/title page",
    required: true
  },
  {
    id: "insidePage2",
    label: "Inside Page 2",
    desc: "Index/table of contents or sample text",
    required: true
  },
  {
    id: "insidePage3",
    label: "Inside Page 3",
    desc: "Representative content page",
    required: true
  },
  {
    id: "insidePage4",
    label: "Inside Page 4",
    desc: "Additional sample or condition check page",
    required: true
  }
];

const CATEGORIES = [
  "Academic",
  "Novels",
  "Programming",
  "Competitive Exams",
  "School Books",
  "Kids Books",
  "Comics",
  "Finance & Business",
  "Self-Help",
  "Romance",
  "Mystery & Thriller",
  "Science & Engineering",
  "History & Biography",
  "Medical & Law",
  "Other"
];

function Sell({ setPage, currentUser, goBack }) {
  // =========================================================
  // 6 BOOK IMAGES
  // =========================================================
  const [images, setImages] = useState({
    frontCover: null,
    backCover: null,
    insidePage1: null,
    insidePage2: null,
    insidePage3: null,
    insidePage4: null
  });

  // =========================================================
  // IMAGE PREVIEWS
  // =========================================================
  const [previews, setPreviews] = useState({
    frontCover: "",
    backCover: "",
    insidePage1: "",
    insidePage2: "",
    insidePage3: "",
    insidePage4: ""
  });

  // =========================================================
  // BOOK INFORMATION
  // =========================================================
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [category, setCategory] = useState("");
  const [price, setPrice] = useState("");
  const [stack, setStack] = useState("1");
  const [condition, setCondition] = useState("");
  const [edition, setEdition] = useState("");
  const [description, setDescription] = useState("");
  const [delivery, setDelivery] = useState("2-3 days");
  const [otherDetails, setOtherDetails] = useState("");

  // =========================================================
  // UI STATE
  // =========================================================
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [dragOverSlot, setDragOverSlot] = useState(null);

  // =========================================================
  // FILE INPUT REFS
  // =========================================================
  const fileInputRefs = useRef({});

  // =========================================================
  // SELLER PAYMENT QR
  // =========================================================
  const [qrImage, setQrImage] = useState(null);
  const [qrPreview, setQrPreview] = useState("");
  const qrInputRef = useRef(null);

  // =========================================================
  // CLEANUP PREVIEW URLS
  // =========================================================
  useEffect(() => {
    return () => {
      Object.values(previews).forEach((url) => {
        if (url && url.startsWith("blob:")) {
          URL.revokeObjectURL(url);
        }
      });

      if (qrPreview && qrPreview.startsWith("blob:")) {
        URL.revokeObjectURL(qrPreview);
      }
    };
  }, [previews, qrPreview]);

  // =========================================================
  // IMAGE VALIDATION
  // =========================================================
  const validateImage = (file, name) => {
    if (!file) return false;

    const validTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp"
    ];

    if (!validTypes.includes(file.type.toLowerCase())) {
      const msg = `${name}: Please upload JPG, PNG, or WEBP image.`;

      setErrorMessage(msg);
      alert(msg);

      return false;
    }

    const maxSize = 10 * 1024 * 1024;

    if (file.size > maxSize) {
      const msg = `${name}: Maximum image size is 10MB.`;

      setErrorMessage(msg);
      alert(msg);

      return false;
    }

    return true;
  };

  // =========================================================
  // SELECT BOOK IMAGE
  // =========================================================
  const handleImageSelect = (slotId, file) => {
    if (!file) return;

    const slot = IMAGE_SLOTS.find(
      (item) => item.id === slotId
    );

    if (!validateImage(file, slot?.label || "Image")) {
      return;
    }

    setErrorMessage("");

    if (
      previews[slotId] &&
      previews[slotId].startsWith("blob:")
    ) {
      URL.revokeObjectURL(previews[slotId]);
    }

    const previewUrl = URL.createObjectURL(file);

    setImages((prev) => ({
      ...prev,
      [slotId]: file
    }));

    setPreviews((prev) => ({
      ...prev,
      [slotId]: previewUrl
    }));
  };

  // =========================================================
  // REMOVE BOOK IMAGE
  // =========================================================
  const handleRemoveImage = (slotId, e) => {
    if (e) e.stopPropagation();

    if (
      previews[slotId] &&
      previews[slotId].startsWith("blob:")
    ) {
      URL.revokeObjectURL(previews[slotId]);
    }

    setImages((prev) => ({
      ...prev,
      [slotId]: null
    }));

    setPreviews((prev) => ({
      ...prev,
      [slotId]: ""
    }));

    if (fileInputRefs.current[slotId]) {
      fileInputRefs.current[slotId].value = "";
    }
  };

  // =========================================================
  // QR SELECT
  // =========================================================
  const handleQrSelect = (file) => {
    if (!file) return;

    if (!validateImage(file, "Payment QR")) {
      return;
    }

    setErrorMessage("");

    if (
      qrPreview &&
      qrPreview.startsWith("blob:")
    ) {
      URL.revokeObjectURL(qrPreview);
    }

    setQrImage(file);
    setQrPreview(URL.createObjectURL(file));
  };

  // =========================================================
  // REMOVE QR
  // =========================================================
  const handleRemoveQr = (e) => {
    if (e) e.stopPropagation();

    if (
      qrPreview &&
      qrPreview.startsWith("blob:")
    ) {
      URL.revokeObjectURL(qrPreview);
    }

    setQrImage(null);
    setQrPreview("");

    if (qrInputRef.current) {
      qrInputRef.current.value = "";
    }
  };

  // =========================================================
  // DRAG & DROP
  // =========================================================
  const handleDragOver = (e, slotId) => {
    e.preventDefault();
    setDragOverSlot(slotId);
  };

  const handleDragLeave = (e, slotId) => {
    e.preventDefault();

    if (dragOverSlot === slotId) {
      setDragOverSlot(null);
    }
  };

  const handleDrop = (e, slotId) => {
    e.preventDefault();
    setDragOverSlot(null);

    if (
      e.dataTransfer.files &&
      e.dataTransfer.files[0]
    ) {
      handleImageSelect(
        slotId,
        e.dataTransfer.files[0]
      );
    }
  };

  // =========================================================
  // CLOUDINARY UPLOAD
  // =========================================================
  const uploadToCloudinary = async (file) => {
    if (!file) {
      throw new Error("No image file selected.");
    }

    const formData = new FormData();

    formData.append("file", file);
    formData.append(
      "upload_preset",
      "bookzen-upload"
    );

    const response = await fetch(
      "https://api.cloudinary.com/v1_1/rrbspp8e/image/upload",
      {
        method: "POST",
        body: formData
      }
    );

    const data = await response.json();

    if (!response.ok || !data.secure_url) {
      console.error(
        "Cloudinary upload error:",
        data
      );

      throw new Error(
        data?.error?.message ||
        "Failed to upload image to Cloudinary."
      );
    }

    return data.secure_url;
  };

  // =========================================================
  // SUBMIT
  // =========================================================
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (uploading) {
      return;
    }

    setErrorMessage("");

    // =======================================================
    // 1. CHECK ALL 6 IMAGES
    // =======================================================
    for (const slot of IMAGE_SLOTS) {
      const file = images[slot.id];

      if (
        !file ||
        !(file instanceof Blob || file instanceof File)
      ) {
        const msg = `Please upload ${slot.label}. All 6 book photos are required.`;

        setErrorMessage(msg);
        alert(msg);

        const element = document.getElementById(
          `upload-${slot.id}`
        );

        if (element) {
          element.scrollIntoView({
            behavior: "smooth",
            block: "center"
          });
        }

        return;
      }
    }

    // =======================================================
    // 2. BASIC DETAILS VALIDATION
    // =======================================================
    if (!title.trim()) {
      setErrorMessage(
        "Please enter the Book Title."
      );
      return;
    }

    if (!author.trim()) {
      setErrorMessage(
        "Please enter the Author Name."
      );
      return;
    }

    if (!category) {
      setErrorMessage(
        "Please select a Category."
      );
      return;
    }

    const numericPrice = parseFloat(price);

    if (
      isNaN(numericPrice) ||
      numericPrice <= 0
    ) {
      setErrorMessage(
        "Please enter a valid positive price."
      );
      return;
    }

    // =======================================================
    // STACK VALIDATION
    // =======================================================
    const numericStack = parseInt(stack, 10);

    if (
      isNaN(numericStack) ||
      numericStack < 1
    ) {
      setErrorMessage(
        "Please enter a valid stack quantity (minimum 1)."
      );
      return;
    }

    if (!condition) {
      setErrorMessage(
        "Please select the Book Condition."
      );
      return;
    }

    if (!edition.trim()) {
      setErrorMessage(
        "Please enter the Edition / Publication Year."
      );
      return;
    }

    if (!description.trim()) {
      setErrorMessage(
        "Please enter the Book Description."
      );
      return;
    }

    // =======================================================
    // 3. CHECK LOGIN
    // =======================================================
    const activeUser =
      auth.currentUser || currentUser;

    if (!activeUser || !activeUser.uid) {
      const msg =
        "Please login before publishing a book.";

      setErrorMessage(msg);
      alert(msg);

      setPage("login");

      return;
    }

    const sellerEmail =
      activeUser.email ||
      localStorage.getItem("userEmail") ||
      "";

    const sellerUid = activeUser.uid;

    // =======================================================
    // GET SELLER NAME
    // =======================================================
    let sellerName =
      localStorage.getItem("userName") ||
      activeUser.displayName ||
      "";

    try {
      const userSnapshot = await getDoc(
        doc(db, "users", sellerUid)
      );

      if (userSnapshot.exists()) {
        const userData =
          userSnapshot.data();

        sellerName =
          userData.name ||
          userData.displayName ||
          sellerName;
      }
    } catch (error) {
      console.warn(
        "Could not fetch seller name:",
        error
      );
    }

    if (!sellerName) {
      sellerName = "Seller";
    }

    // =======================================================
    // START PUBLISH
    // =======================================================
    try {
      setUploading(true);
      setErrorMessage("");

      const uploadedUrls = {};
      const uploadedImageArray = [];

      // =====================================================
      // 4. UPLOAD 6 IMAGES TO CLOUDINARY
      // =====================================================
      for (
        let i = 0;
        i < IMAGE_SLOTS.length;
        i++
      ) {
        const slot = IMAGE_SLOTS[i];
        const file = images[slot.id];

        if (
          !file ||
          !(file instanceof Blob || file instanceof File)
        ) {
          throw new Error(
            `Missing image for ${slot.label}.`
          );
        }

        setUploadProgress(
          `Uploading image ${i + 1} of 6\n${slot.label}`
        );

        console.log(
          `Uploading ${slot.label} to Cloudinary...`
        );

        const downloadUrl =
          await uploadToCloudinary(file);

        if (
          !downloadUrl ||
          typeof downloadUrl !== "string"
        ) {
          throw new Error(
            `Failed to get Cloudinary URL for ${slot.label}.`
          );
        }

        uploadedUrls[slot.id] =
          downloadUrl;

        uploadedImageArray.push({
          id: slot.id,
          label: slot.label,
          url: downloadUrl
        });

        console.log(
          `${slot.label} uploaded successfully`
        );
      }

      // =====================================================
      // CHECK ALL IMAGES
      // =====================================================
      if (
        uploadedImageArray.length !== 6 ||
        Object.keys(uploadedUrls).length !== 6
      ) {
        throw new Error(
          "All 6 images must be uploaded successfully."
        );
      }

      // =====================================================
      // 5. UPLOAD QR TO CLOUDINARY
      // =====================================================
      let uploadedQrUrl = "";

      if (
        qrImage &&
        (qrImage instanceof Blob ||
          qrImage instanceof File)
      ) {
        setUploadProgress(
          "Uploading seller payment QR..."
        );

        try {
          uploadedQrUrl =
            await uploadToCloudinary(qrImage);

          console.log(
            "Seller QR uploaded successfully"
          );
        } catch (qrError) {
          console.warn(
            "QR upload failed:",
            qrError
          );

          // QR is optional
          uploadedQrUrl = "";
        }
      }

      // =====================================================
      // 6. SAVE BOOK TO FIRESTORE
      // =====================================================
      setUploadProgress(
        "Saving book details to marketplace..."
      );

      const bookData = {
        sellerId: sellerUid,
        sellerUid: sellerUid,

        sellerEmail: sellerEmail,
        sellerName: sellerName,

        sellerQrUrl:
          uploadedQrUrl || "",

        sellerUpiQrUrl:
          uploadedQrUrl || "",

        title: title.trim(),
        bookName: title.trim(),

        author: author.trim(),

        category,

        price: numericPrice,

        // =================================================
        // STACK / STOCK / QUANTITY
        // =================================================
        stack: numericStack,
        stock: numericStack,
        quantity: numericStack,

        condition,

        edition: edition.trim(),

        description:
          description.trim(),

        delivery,

        otherDetails:
          otherDetails.trim(),

        // =================================================
        // IMAGE URLS
        // =================================================
        frontCover:
          uploadedUrls.frontCover,

        frontImage:
          uploadedUrls.frontCover,

        backCover:
          uploadedUrls.backCover,

        backImage:
          uploadedUrls.backCover,

        insidePage1:
          uploadedUrls.insidePage1,

        insidePage2:
          uploadedUrls.insidePage2,

        insidePage3:
          uploadedUrls.insidePage3,

        insidePage4:
          uploadedUrls.insidePage4,

        insideImage:
          uploadedUrls.insidePage1,

        // =================================================
        // IMAGE ARRAY
        // =================================================
        images:
          uploadedImageArray,

        createdAt:
          serverTimestamp()
      };

      // =====================================================
      // ADD TO FIRESTORE
      // =====================================================
      const docRef = await addDoc(
        collection(db, "books"),
        bookData
      );

      // =====================================================
      // SAVE TO LOCAL STORAGE
      // =====================================================
      try {
        const existingBooks =
          JSON.parse(
            localStorage.getItem("books") ||
            "[]"
          );

        const localBook = {
          ...bookData,

          id: docRef.id,

          createdAt: Date.now()
        };

        const updatedBooks = [
          localBook,
          ...existingBooks.filter(
            (book) =>
              book.id !== docRef.id
          )
        ];

        localStorage.setItem(
          "books",
          JSON.stringify(updatedBooks)
        );
      } catch (localError) {
        console.warn(
          "LocalStorage warning:",
          localError
        );
      }

      // =====================================================
      // SUCCESS
      // =====================================================
      setUploadProgress(
        "Book published successfully!"
      );

      alert(
        "🎉 Your book has been successfully listed on BOOKZEN!"
      );

      setPage("home");

    } catch (error) {
      console.error(
        "Error creating book listing:",
        error
      );

      const message =
        error?.message ||
        "Failed to list the book.";

      setErrorMessage(message);

      alert(message);

    } finally {
      setUploading(false);
      setUploadProgress("");
    }
  };

  const uploadedCount =
    Object.values(images).filter(Boolean).length;

  // =========================================================
  // UI
  // =========================================================
  return (
    <form
      className="sell-page"
      onSubmit={handleSubmit}
    >

      {/* ===================================================
          HEADER
      =================================================== */}
      <div className="sell-header">

        <button
          type="button"
          className="back-button"
          onClick={() =>
            typeof goBack === "function"
              ? goBack("home")
              : setPage("home")
          }
          disabled={uploading}
          title="Back"
        >
          ←
        </button>

        <div className="sell-header-text">
          <h1>Sell Your Book</h1>
        </div>

      </div>

      {/* ===================================================
          ERROR
      =================================================== */}
      {errorMessage && (
        <div className="sell-error-banner">

          <span className="error-icon">
            ⚠️
          </span>

          <span>
            {errorMessage}
          </span>

        </div>
      )}

      {/* ===================================================
          BOOK PHOTOS
      =================================================== */}
      <section className="form-card images-section">

        <div className="section-header">

          <div>
            <h2>
              📸 Book Photos (6 Required)
            </h2>
          </div>

          <div
            className={`photos-count-badge ${uploadedCount === 6
                ? "complete"
                : ""
              }`}
          >
            {uploadedCount} / 6 Photos
          </div>

        </div>

        <div className="upload-grid-6">

          {IMAGE_SLOTS.map(
            (slot, index) => {

              const hasImage =
                !!images[slot.id];

              const previewUrl =
                previews[slot.id];

              const isDragging =
                dragOverSlot === slot.id;

              return (
                <div
                  key={slot.id}
                  id={`upload-${slot.id}`}
                  className={`upload-slot-card ${hasImage
                      ? "has-preview"
                      : ""
                    } ${isDragging
                      ? "dragging"
                      : ""
                    }`}
                  onDragOver={(e) =>
                    handleDragOver(
                      e,
                      slot.id
                    )
                  }
                  onDragLeave={(e) =>
                    handleDragLeave(
                      e,
                      slot.id
                    )
                  }
                  onDrop={(e) =>
                    handleDrop(
                      e,
                      slot.id
                    )
                  }
                  onClick={() => {

                    if (
                      !hasImage &&
                      fileInputRefs.current[
                      slot.id
                      ]
                    ) {
                      fileInputRefs.current[
                        slot.id
                      ].click();
                    }

                  }}
                >

                  {/* SLOT HEADER */}
                  <div className="slot-header">

                    <span className="slot-number">
                      {index + 1}
                    </span>

                    <span className="slot-label">
                      {slot.label}
                    </span>

                    {hasImage && (
                      <span className="status-badge check">
                        ✓ Ready
                      </span>
                    )}

                  </div>

                  {/* FILE INPUT */}
                  <input
                    type="file"
                    ref={(el) =>
                    (fileInputRefs.current[
                      slot.id
                    ] = el)
                    }
                    accept="image/jpeg,image/png,image/webp,image/jpg"
                    style={{
                      display: "none"
                    }}
                    onChange={(e) => {

                      if (
                        e.target.files &&
                        e.target.files[0]
                      ) {
                        handleImageSelect(
                          slot.id,
                          e.target.files[0]
                        );
                      }

                    }}
                  />

                  {/* PREVIEW */}
                  {hasImage ? (

                    <div className="preview-container">

                      <img
                        src={previewUrl}
                        alt={slot.label}
                        className="slot-preview-img"
                      />

                      <div className="preview-overlay">

                        <button
                          type="button"
                          className="overlay-btn replace-btn"
                          onClick={(e) => {

                            e.stopPropagation();

                            fileInputRefs.current[
                              slot.id
                            ]?.click();

                          }}
                        >
                          🔄 Replace
                        </button>

                        <button
                          type="button"
                          className="overlay-btn remove-btn"
                          onClick={(e) =>
                            handleRemoveImage(
                              slot.id,
                              e
                            )
                          }
                        >
                          🗑 Remove
                        </button>

                      </div>

                    </div>

                  ) : (

                    <div className="upload-placeholder">

                      <div className="upload-icon-circle">
                        📷
                      </div>

                      <span className="upload-prompt">
                        Click or drag image
                      </span>

                      <span className="upload-desc">
                        {slot.desc}
                      </span>

                      <span className="upload-formats">
                        JPG, PNG, WEBP
                      </span>

                    </div>

                  )}

                </div>
              );
            }
          )}

        </div>

      </section>

      {/* ===================================================
          BASIC BOOK DETAILS
      =================================================== */}
      <section className="form-card">

        <h2>
          📖 Basic Book Details
        </h2>

        <div className="form-grid">

          {/* TITLE */}
          <div className="form-group full-width">

            <label htmlFor="bookTitle">
              Book Title{" "}
              <span className="req">
                *
              </span>
            </label>

            <input
              id="bookTitle"
              type="text"
              placeholder="e.g. Concept of Physics Vol 1"
              value={title}
              onChange={(e) =>
                setTitle(e.target.value)
              }
              required
            />

          </div>

          {/* AUTHOR */}
          <div className="form-group">

            <label htmlFor="authorName">
              Author Name{" "}
              <span className="req">
                *
              </span>
            </label>

            <input
              id="authorName"
              type="text"
              placeholder="e.g. H.C. Verma"
              value={author}
              onChange={(e) =>
                setAuthor(e.target.value)
              }
              required
            />

          </div>

          {/* CATEGORY */}
          <div className="form-group">

            <label htmlFor="category">
              Category{" "}
              <span className="req">
                *
              </span>
            </label>

            <select
              id="category"
              value={category}
              onChange={(e) =>
                setCategory(e.target.value)
              }
              required
            >

              <option value="">
                -- Select Category --
              </option>

              {CATEGORIES.map(
                (cat) => (
                  <option
                    key={cat}
                    value={cat}
                  >
                    {cat}
                  </option>
                )
              )}

            </select>

          </div>

          {/* PRICE */}
          <div className="form-group">

            <label htmlFor="price">
              Selling Price (₹){" "}
              <span className="req">
                *
              </span>
            </label>

            <div className="price-input-wrapper">

              <span className="currency-symbol">
                ₹
              </span>

              <input
                id="price"
                type="number"
                placeholder="250"
                min="1"
                step="1"
                value={price}
                onChange={(e) =>
                  setPrice(e.target.value)
                }
                required
              />

            </div>

          </div>

          {/* STACK / QUANTITY */}
          <div className="form-group">

            <label htmlFor="stack">
              Available Stack{" "}
              <span className="req">
                *
              </span>
            </label>

            <input
              id="stack"
              type="number"
              placeholder="e.g. 5"
              min="1"
              step="1"
              value={stack}
              onChange={(e) =>
                setStack(e.target.value)
              }
              required
            />

          </div>

          {/* EDITION */}
          <div className="form-group">

            <label htmlFor="edition">
              Edition / Publication Year{" "}
              <span className="req">
                *
              </span>
            </label>

            <input
              id="edition"
              type="text"
              placeholder="e.g. 4th Edition (2022)"
              value={edition}
              onChange={(e) =>
                setEdition(e.target.value)
              }
              required
            />

          </div>

          {/* CONDITION */}
          <div className="form-group">

            <label htmlFor="condition">
              Condition{" "}
              <span className="req">
                *
              </span>
            </label>

            <select
              id="condition"
              value={condition}
              onChange={(e) =>
                setCondition(e.target.value)
              }
              required
            >

              <option value="">
                -- Select Condition --
              </option>

              <option value="Old">
                Old
              </option>

              <option value="New">
                New
              </option>

            </select>

          </div>

          {/* DISPATCH */}
          <div className="form-group">

            <label htmlFor="delivery">
              Dispatch{" "}
              <span className="req">
                *
              </span>
            </label>

            <select
              id="delivery"
              value={delivery}
              onChange={(e) =>
                setDelivery(e.target.value)
              }
              required
            >

              <option value="2-3 days">
                2-3 days
              </option>

              <option value="4-5 days">
                4-5 days
              </option>

              <option value="6-7 days">
                6-7 days
              </option>

              <option value="8-10 days">
                8-10 days
              </option>

            </select>

          </div>

          {/* DESCRIPTION */}
          <div className="form-group full-width">

            <label htmlFor="description">
              Book Description{" "}
              <span className="req">
                *
              </span>
            </label>

            <textarea
              id="description"
              rows="4"
              placeholder="Describe the content, highlighting, notes, or any damage..."
              value={description}
              onChange={(e) =>
                setDescription(
                  e.target.value
                )
              }
              required
            />

          </div>

          {/* OTHER DETAILS */}
          <div className="form-group full-width">

            <label htmlFor="otherDetails">
              Additional Notes (Optional)
            </label>

            <input
              id="otherDetails"
              type="text"
              placeholder="e.g. Comes with free workbook / solutions guide"
              value={otherDetails}
              onChange={(e) =>
                setOtherDetails(
                  e.target.value
                )
              }
            />

          </div>

        </div>

      </section>

      {/* ===================================================
          SELLER PAYMENT QR
      =================================================== */}
      <section className="form-card qr-upload-section">

        <div className="section-header">

          <div>

            <h2>
              📱 Seller Payment QR Code (Optional)
            </h2>

            <p
              className="section-subtitle"
              style={{
                fontSize: "13px",
                color: "#666",
                margin: "4px 0 0 0"
              }}
            >
              Upload your UPI QR (GPay /
              PhonePe / Paytm) so buyers
              can scan & pay for this book.
            </p>

          </div>

        </div>

        <div
          className="qr-upload-box-wrapper"
          style={{
            marginTop: "14px"
          }}
        >

          <input
            type="file"
            ref={qrInputRef}
            accept="image/jpeg,image/png,image/webp,image/jpg"
            style={{
              display: "none"
            }}
            onChange={(e) => {

              if (
                e.target.files &&
                e.target.files[0]
              ) {
                handleQrSelect(
                  e.target.files[0]
                );
              }

            }}
          />

          {qrImage ? (

            <div
              className="qr-preview-box"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "16px",
                padding: "12px",
                background: "#f9f9f9",
                borderRadius: "12px",
                border: "1px solid #eee"
              }}
            >

              <img
                src={qrPreview}
                alt="Seller QR"
                style={{
                  width: "90px",
                  height: "90px",
                  objectFit: "cover",
                  borderRadius: "8px",
                  border: "1px solid #ddd"
                }}
              />

              <div>

                <span
                  style={{
                    display: "block",
                    fontWeight: "600",
                    fontSize: "14px",
                    color: "#2e7d32",
                    marginBottom: "6px"
                  }}
                >
                  ✓ Payment QR Ready
                </span>

                <div
                  style={{
                    display: "flex",
                    gap: "8px"
                  }}
                >

                  <button
                    type="button"
                    style={{
                      padding: "6px 12px",
                      fontSize: "12px",
                      background: "#f0f0f0",
                      border: "1px solid #ccc",
                      borderRadius: "6px",
                      cursor: "pointer"
                    }}
                    onClick={() =>
                      qrInputRef.current?.click()
                    }
                  >
                    🔄 Replace
                  </button>

                  <button
                    type="button"
                    style={{
                      padding: "6px 12px",
                      fontSize: "12px",
                      background: "#ffebee",
                      color: "#d32f2f",
                      border: "1px solid #ffcdd2",
                      borderRadius: "6px",
                      cursor: "pointer"
                    }}
                    onClick={
                      handleRemoveQr
                    }
                  >
                    🗑 Remove
                  </button>

                </div>

              </div>

            </div>

          ) : (

            <div
              className="qr-upload-placeholder"
              style={{
                padding: "20px",
                textAlign: "center",
                border: "2px dashed #ddd",
                borderRadius: "12px",
                cursor: "pointer",
                background: "#fafafa"
              }}
              onClick={() =>
                qrInputRef.current?.click()
              }
            >

              <span
                style={{
                  fontSize: "28px",
                  display: "block",
                  marginBottom: "6px"
                }}
              >
                📷
              </span>

              <strong
                style={{
                  display: "block",
                  fontSize: "14px",
                  color: "#333"
                }}
              >
                Tap to upload Payment QR
                for this book
              </strong>

              <small
                style={{
                  color: "#888",
                  fontSize: "12px"
                }}
              >
                Accepts JPG, PNG, WEBP
                (Max 10MB)
              </small>

            </div>

          )}

        </div>

      </section>

      {/* ===================================================
          PUBLISH
      =================================================== */}
      <div className="sell-submit-section">

        {uploading &&
          uploadProgress && (

            <div className="upload-progress-banner">

              <span className="spinner-icon">
                ⏳
              </span>

              <span
                style={{
                  whiteSpace: "pre-line"
                }}
              >
                {uploadProgress}
              </span>

            </div>

          )}

        <button
          type="submit"
          className="publish-btn"
          disabled={uploading}
        >
          {uploading
            ? "Publishing Book..."
            : "🚀 Publish Book Listing"}
        </button>

      </div>

    </form>
  );
}

export default Sell;
