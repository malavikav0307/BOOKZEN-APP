import {
  FaHome,
  FaBookOpen,
  FaPlus,
  FaClipboardList,
  FaUser
} from "react-icons/fa";

import "./BottomNav.css";

function BottomNav({ setPage, activePage = "home" }) {
  return (
    <nav className="bottom-navbar">
      <button
        className={activePage === "home" ? "nav-item active" : "nav-item"}
        onClick={() => setPage("home")}
      >
        <FaHome />
        <span>Home</span>
      </button>

      <button
        className={
          activePage === "categories" || activePage === "categoryBooks"
            ? "nav-item active"
            : "nav-item"
        }
        onClick={() => setPage("categories")}
      >
        <FaBookOpen />
        <span>Categories</span>
      </button>

      <button
        className="sell-button"
        onClick={() => {
          setPage("sell");
        }}
      >
        <FaPlus />
        <span>Sell</span>
      </button>

      <button
        className={activePage === "orders" ? "nav-item active" : "nav-item"}
        onClick={() => setPage("orders")}
      >
        <FaClipboardList />
        <span>Orders</span>
      </button>

      <button
        className={activePage === "profile" ? "nav-item active" : "nav-item"}
        onClick={() => setPage("profile")}
      >
        <FaUser />
        <span>Profile</span>
      </button>
    </nav>
  );
}

export default BottomNav;