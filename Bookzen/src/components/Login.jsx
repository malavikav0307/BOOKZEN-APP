import { useState } from "react";
import "./Login.css";

import { auth, db } from "../firebase";

import {
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithCredential,
  signInWithPopup,
} from "firebase/auth";

import {
  doc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";

import { FirebaseAuthentication } from "@capacitor-firebase/authentication";
import { Capacitor } from "@capacitor/core";

function Login({ onLogin, onSignup }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // =========================================
  // INITIALIZE / SYNC USER PROFILE
  // =========================================
  const initUserProfile = async (user) => {
    if (!user?.uid) return;

    try {
      const userRef = doc(db, "users", user.uid);

      await setDoc(
        userRef,
        {
          uid: user.uid,
          email: user.email || "",
          displayName: user.displayName || "",
          photoURL: user.photoURL || "",
          updatedAt: serverTimestamp(),
        },
        {
          merge: true,
        }
      );
    } catch (error) {
      console.warn(
        "Could not sync user profile in Firestore:",
        error
      );
    }
  };

  // =========================================
  // EMAIL & PASSWORD LOGIN
  // =========================================
  const handleLogin = async (e) => {
    e.preventDefault();

    if (loading) return;

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !password.trim()) {
      alert("Please enter Email and Password");
      return;
    }

    setLoading(true);

    try {
      const userCredential =
        await signInWithEmailAndPassword(
          auth,
          cleanEmail,
          password
        );

      const user = userCredential.user;

      if (user?.email) {
        localStorage.setItem(
          "userEmail",
          user.email
        );
      }

      await initUserProfile(user);

      alert("Login Successful");

      if (onLogin) {
        onLogin();
      }
    } catch (error) {
      console.error(
        "Login Error:",
        error.code,
        error.message
      );

      if (
        error.code === "auth/invalid-credential" ||
        error.code === "auth/wrong-password" ||
        error.code === "auth/user-not-found"
      ) {
        alert("Incorrect Email or Password");
      } else if (error.code === "auth/invalid-email") {
        alert("Invalid Email Format");
      } else if (
        error.code === "auth/too-many-requests"
      ) {
        alert(
          "Too many login attempts. Please try again later."
        );
      } else if (
        error.code === "auth/network-request-failed"
      ) {
        alert(
          "Network error. Please check your internet connection."
        );
      } else {
        alert(error.message || "Login failed");
      }
    } finally {
      setLoading(false);
    }
  };

  // =========================================
  // GOOGLE LOGIN
  // =========================================
  const handleGoogleLogin = async () => {
    if (loading) return;

    setLoading(true);

    try {
      let user;

      // =====================================
      // ANDROID / NATIVE APP
      // =====================================
      if (Capacitor.isNativePlatform()) {
        const result =
          await FirebaseAuthentication.signInWithGoogle({
            skipNativeAuth: true,
          });

        const credential = result?.credential;

        if (!credential) {
          throw new Error(
            "Google authentication credential was not returned."
          );
        }

        const googleCredential =
          GoogleAuthProvider.credential(
            credential.idToken,
            credential.accessToken
          );

        const userCredential =
          await signInWithCredential(
            auth,
            googleCredential
          );

        user = userCredential.user;
      }

      // =====================================
      // WEB
      // =====================================
      else {
        const provider = new GoogleAuthProvider();

        provider.setCustomParameters({
          prompt: "select_account",
        });

        const result = await signInWithPopup(
          auth,
          provider
        );

        user = result.user;
      }

      // =====================================
      // SAVE USER
      // =====================================
      if (user?.email) {
        localStorage.setItem(
          "userEmail",
          user.email
        );
      }

      await initUserProfile(user);

      alert("Google Login Successful");

      if (onLogin) {
        onLogin();
      }
    } catch (error) {
      console.error(
        "Google Login Error:",
        error
      );

      if (
        error?.code ===
        "auth/popup-closed-by-user"
      ) {
        alert("Google Login cancelled");
      } else if (
        error?.code ===
        "auth/popup-blocked"
      ) {
        alert(
          "Popup was blocked. Please allow popups for this site."
        );
      } else if (
        error?.code ===
        "auth/cancelled-popup-request"
      ) {
        alert(
          "Google Login request cancelled."
        );
      } else if (
        error?.code ===
        "auth/network-request-failed"
      ) {
        alert(
          "Network error. Please check your internet connection."
        );
      } else if (
        error?.code ===
        "auth/account-exists-with-different-credential"
      ) {
        alert(
          "An account already exists with a different login method."
        );
      } else {
        alert(
          error?.message ||
          "Google Login failed"
        );
      }
    } finally {
      setLoading(false);
    }
  };

  // =========================================
  // UI
  // =========================================
  return (
    <div className="login-page">

      <h1>BOOKZEN 📚</h1>

      <p className="tagline">
        Buy & Sell Books
      </p>

      {/* EMAIL LOGIN */}
      <form onSubmit={handleLogin}>

        <input
          type="email"
          placeholder="Email Address"
          value={email}
          onChange={(e) =>
            setEmail(e.target.value)
          }
          autoComplete="email"
          disabled={loading}
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) =>
            setPassword(e.target.value)
          }
          autoComplete="current-password"
          disabled={loading}
        />

        <button
          type="submit"
          className="login-btn"
          disabled={loading}
        >
          {loading
            ? "Please wait..."
            : "Login"}
        </button>

      </form>

      {/* SIGN UP */}
      <button
        type="button"
        className="signup-btn"
        onClick={onSignup}
        disabled={loading}
      >
        Create New Account
      </button>

      {/* OR */}
      <div className="or">
        OR
      </div>

      {/* GOOGLE LOGIN */}
      <button
        type="button"
        className="google-btn"
        onClick={handleGoogleLogin}
        disabled={loading}
      >
        {loading
          ? "Please wait..."
          : "Continue with Google"}
      </button>

    </div>
  );
}

export default Login;