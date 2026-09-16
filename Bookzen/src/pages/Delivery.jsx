
import { useState } from "react";
import "./Delivery.css";

const getSavedDeliveryDetails = () => {
  try {
    const saved = localStorage.getItem("deliveryDetails");
    return saved ? JSON.parse(saved) : {};
  } catch (error) {
    console.error("Failed to load saved delivery details:", error);
    return {};
  }
};

function Delivery({ setPage, selectedBook, goBack }) {
  const savedDetails = getSavedDeliveryDetails();

  const [name, setName] = useState(savedDetails.name || "");
  const [houseNo, setHouseNo] = useState(savedDetails.houseNo || "");
  const [houseName, setHouseName] = useState(savedDetails.houseName || "");
  const [area, setArea] = useState(savedDetails.area || "");
  const [street, setStreet] = useState(savedDetails.street || "");
  const [city, setCity] = useState(savedDetails.city || "");
  const [pincode, setPincode] = useState(savedDetails.pincode || "");
  const [phone, setPhone] = useState(savedDetails.phone || "");
  const [quantity, setQuantity] = useState(1);

  // Get available stock
  const stock =
    parseInt(selectedBook?.stock, 10) ||
    parseInt(selectedBook?.stack, 10) ||
    parseInt(selectedBook?.quantity, 10) ||
    0;

  // Back button
  const handleBack = () => {
    if (typeof goBack === "function") {
      goBack("bookDetails");
    } else {
      setPage("bookDetails");
    }
  };

  // Quantity
  const handleQuantityChange = (e) => {
    const value = e.target.value;

    if (value === "") {
      setQuantity("");
      return;
    }

    const numericValue = parseInt(value, 10);

    if (numericValue < 1) {
      setQuantity(1);
      return;
    }

    setQuantity(numericValue);
  };

  // Continue
  const handleContinue = (e) => {
    e.preventDefault();

    // Delivery details validation
    if (
      !name.trim() ||
      !houseNo.trim() ||
      !houseName.trim() ||
      !area.trim() ||
      !street.trim() ||
      !city.trim() ||
      !pincode.trim() ||
      !phone.trim()
    ) {
      alert("Please fill all delivery details.");
      return;
    }

    // Pincode validation
    if (!/^[0-9]{6}$/.test(pincode)) {
      alert("Please enter a valid 6-digit pincode.");
      return;
    }

    // Phone validation
    if (!/^[0-9]{10}$/.test(phone)) {
      alert("Please enter a valid 10-digit phone number.");
      return;
    }

    const selectedQuantity = parseInt(quantity, 10);

    // Quantity validation
    if (!selectedQuantity || selectedQuantity < 1) {
      alert("Please select at least 1 book.");
      return;
    }

    // Stock validation
    if (stock <= 0) {
      alert("Sorry! This book is out of stock.");
      return;
    }

    if (selectedQuantity > stock) {
      alert(`Only ${stock} copies are available.`);
      return;
    }

    // Save details for next purchase
    const deliveryDetails = {
      name: name.trim(),
      houseNo: houseNo.trim(),
      houseName: houseName.trim(),
      area: area.trim(),
      street: street.trim(),
      city: city.trim(),
      pincode: pincode.trim(),
      phone: phone.trim(),
      quantity: selectedQuantity
    };

    localStorage.setItem(
      "deliveryDetails",
      JSON.stringify(deliveryDetails)
    );

    setPage("payment");
  };

  return (
    <div className="delivery-page">

      {/* Back Button */}
      <button
        type="button"
        className="back-button"
        onClick={handleBack}
        aria-label="Go back"
      >
        ←
      </button>

      {/* Title */}
      <h1>Delivery Details</h1>

      {/* Form */}
      <form onSubmit={handleContinue}>

        <div className="form-group">
          <label htmlFor="name">Name *</label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter your name"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="houseNo">House Number *</label>
          <input
            id="houseNo"
            type="text"
            value={houseNo}
            onChange={(e) => setHouseNo(e.target.value)}
            placeholder="Enter house number"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="houseName">House Name *</label>
          <input
            id="houseName"
            type="text"
            value={houseName}
            onChange={(e) => setHouseName(e.target.value)}
            placeholder="Enter house name"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="area">Area *</label>
          <input
            id="area"
            type="text"
            value={area}
            onChange={(e) => setArea(e.target.value)}
            placeholder="Enter area"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="street">Street *</label>
          <input
            id="street"
            type="text"
            value={street}
            onChange={(e) => setStreet(e.target.value)}
            placeholder="Enter street"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="city">City *</label>
          <input
            id="city"
            type="text"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Enter city"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="pincode">Pincode *</label>
          <input
            id="pincode"
            type="text"
            inputMode="numeric"
            maxLength="6"
            value={pincode}
            onChange={(e) =>
              setPincode(
                e.target.value.replace(/\D/g, "").slice(0, 6)
              )
            }
            placeholder="Enter 6-digit pincode"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="phone">Phone Number *</label>
          <input
            id="phone"
            type="tel"
            inputMode="numeric"
            maxLength="10"
            value={phone}
            onChange={(e) =>
              setPhone(
                e.target.value.replace(/\D/g, "").slice(0, 10)
              )
            }
            placeholder="Enter 10-digit phone number"
            required
          />
        </div>

        {/* Quantity */}
        <div className="quantity-section">
          <label htmlFor="quantity">
            How many books do you want?
          </label>

          <input
            id="quantity"
            type="number"
            min="1"
            max={stock}
            value={quantity}
            onChange={handleQuantityChange}
            required
          />

          <span className="available-stock">
            {stock > 0
              ? `${stock} ${stock === 1 ? "copy" : "copies"} available`
              : "Stock Unavailable"}
          </span>

          {quantity !== "" &&
            parseInt(quantity, 10) > stock &&
            stock > 0 && (
              <small className="quantity-error">
                Only {stock}{" "}
                {stock === 1 ? "copy" : "copies"} are available.
              </small>
            )}
        </div>

        {/* Continue Button */}
        <button
          type="submit"
          className="continue-button"
          disabled={
            stock <= 0 ||
            quantity === "" ||
            parseInt(quantity, 10) > stock
          }
        >
          Continue to Payment
        </button>

      </form>
    </div>
  );
}

export default Delivery;
