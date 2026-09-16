import { useState, useEffect, useCallback } from "react";

import SplashScreen from "./components/SplashScreen";
import Login from "./components/Login";
import Signup from "./components/Signup";
import Home from "./components/Home";
import BottomNav from "./components/BottomNav";

import Categories from "./pages/Categories";
import CategoryBooks from "./pages/CategoryBooks";
import BookDetails from "./pages/BookDetails";
import Sell from "./pages/Sell";
import Orders from "./pages/Orders";
import Profile from "./pages/Profile";
import Chat from "./pages/Chat";
import Delivery from "./pages/Delivery";
import Payment from "./pages/Payment";
import ConfirmOrder from "./pages/ConfirmOrder";
import Notifications from "./pages/Notifications";
import Wishlist from "./pages/Wishlist";
import Messages from "./pages/Messages";

import { auth } from "./firebase";
import { onAuthStateChanged } from "firebase/auth";

import "./App.css";

function App() {
  const [page, setPageInternal] = useState("splash");
  const [, setHistory] = useState(["home"]);
  const [category, setCategory] = useState("");
  const [selectedBook, setSelectedBook] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);

  // ========================================
  // FIREBASE AUTH STATE LISTENER
  // ========================================
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        setCurrentUser(user);

        if (user?.email) {
          localStorage.setItem("userEmail", user.email);
          if (user.displayName) {
            localStorage.setItem("userName", user.displayName);
          }
        } else {
          localStorage.removeItem("userEmail");
          localStorage.removeItem("userName");
        }
      },
      (error) => {
        console.error("Auth state change error:", error);
        setCurrentUser(null);
      }
    );

    return () => unsubscribe();
  }, []);

  // ========================================
  // NAVIGATION HISTORY STACK
  // ========================================
  const setPage = useCallback((targetPage, options = {}) => {
    setHistory((prev) => {
      if (options.clearHistory) {
        return [targetPage];
      }
      if (options.replace) {
        const next = [...prev];
        next[next.length - 1] = targetPage;
        return next;
      }
      if (prev[prev.length - 1] === targetPage) {
        return prev;
      }
      return [...prev, targetPage];
    });
    setPageInternal(targetPage);
  }, []);

  const goBack = useCallback((fallbackPage = "home") => {
    setHistory((prev) => {
      if (prev.length > 1) {
        const next = [...prev];
        next.pop(); // Remove current page
        const previousPage = next[next.length - 1] || fallbackPage;
        setPageInternal(previousPage);
        return next;
      } else {
        setPageInternal(fallbackPage);
        return [fallbackPage];
      }
    });
  }, []);

  // ========================================
  // SPLASH
  // ========================================
  if (page === "splash") {
    return <SplashScreen setPage={setPage} user={currentUser} />;
  }

  // ========================================
  // LOGIN (DIRECTLY TO HOME)
  // ========================================
  if (page === "login") {
    return (
      <Login
        onLogin={() => setPage("home", { clearHistory: true })}
        onSignup={() => setPage("signup")}
      />
    );
  }

  // ========================================
  // SIGNUP (DIRECTLY TO HOME)
  // ========================================
  if (page === "signup") {
    return (
      <Signup
        onSignupSuccess={() => setPage("home", { clearHistory: true })}
        onBack={() => setPage("login")}
      />
    );
  }

  // ========================================
  // MAIN APP
  // ========================================
  return (
    <>
      {/* HOME */}
      {page === "home" && (
        <Home
          setPage={setPage}
          setCategory={setCategory}
          setSelectedBook={setSelectedBook}
          currentUser={currentUser}
        />
      )}

      {/* CATEGORIES */}
      {page === "categories" && (
        <Categories
          setPage={setPage}
          setCategory={setCategory}
          goBack={goBack}
        />
      )}

      {/* CATEGORY BOOKS */}
      {page === "categoryBooks" && (
        <CategoryBooks
          category={category}
          setPage={setPage}
          setSelectedBook={setSelectedBook}
          goBack={goBack}
        />
      )}

      {/* BOOK DETAILS */}
      {page === "bookDetails" && (
        <BookDetails
          book={selectedBook}
          setPage={setPage}
          setSelectedBook={setSelectedBook}
          currentUser={currentUser}
          goBack={goBack}
        />
      )}

      {/* SELL */}
      {page === "sell" && (
        <Sell setPage={setPage} goBack={goBack} currentUser={currentUser} />
      )}

      {/* DELIVERY */}
      {page === "delivery" && (
        <Delivery
          setPage={setPage}
          selectedBook={selectedBook}
          goBack={goBack}
        />
      )}

      {/* PAYMENT */}
      {page === "payment" && (
        <Payment
          book={selectedBook}
          setPage={setPage}
          goBack={goBack}
        />
      )}

      {/* CONFIRM ORDER */}
      {page === "confirmOrder" && (
        <ConfirmOrder
          book={selectedBook}
          setPage={setPage}
          goBack={goBack}
        />
      )}

      {/* ORDERS */}
      {page === "orders" && (
        <Orders
          setPage={setPage}
          setSelectedBook={setSelectedBook}
          goBack={goBack}
          currentUser={currentUser}
        />
      )}

      {/* NOTIFICATIONS */}
      {page === "notifications" && (
        <Notifications
          setPage={setPage}
          setSelectedBook={setSelectedBook}
          goBack={goBack}
          currentUser={currentUser}
        />
      )}

      {/* MESSAGES INBOX */}
      {page === "messages" && (
        <Messages
          setPage={setPage}
          setSelectedBook={setSelectedBook}
          currentUser={currentUser}
          goBack={goBack}
        />
      )}

      {/* WISHLIST */}
      {page === "wishlist" && (
        <Wishlist
          setPage={setPage}
          setSelectedBook={setSelectedBook}
          currentUser={currentUser}
          goBack={goBack}
        />
      )}

      {/* PROFILE */}
      {page === "profile" && (
        <Profile
          setPage={setPage}
          setSelectedBook={setSelectedBook}
          currentUser={currentUser}
          goBack={goBack}
        />
      )}

      {/* CHAT */}
      {page === "chat" && (
        <Chat
          book={selectedBook}
          setPage={setPage}
          currentUser={currentUser}
          goBack={goBack}
        />
      )}

      {/* BOTTOM NAV */}
      {page !== "chat" &&
        page !== "delivery" &&
        page !== "payment" &&
        page !== "confirmOrder" &&
        page !== "notifications" && (
          <BottomNav setPage={setPage} activePage={page} />
        )}
    </>
  );
}

export default App;