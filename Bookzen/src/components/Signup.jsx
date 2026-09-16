import { useState } from "react";
import { auth, db } from "../firebase";
import "./Signup.css";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

function Signup({ onSignupSuccess, onBack }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleSignup = async () => {
    if (!name.trim() || !email || !password || !confirmPassword) {
      alert("Please fill all fields");
      return;
    }

    if (password !== confirmPassword) {
      alert("Passwords do not match");
      return;
    }

    if (password.length < 6) {
      alert("Password must be at least 6 characters");
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email.trim().toLowerCase(),
        password
      );

      const user = userCredential.user;
      const cleanName = name.trim();

      if (user?.email) {
        localStorage.setItem("userEmail", user.email);
        localStorage.setItem("userName", cleanName);
      }

      // Update Firebase Auth displayName
      try {
        await updateProfile(user, {
          displayName: cleanName
        });
      } catch (profileErr) {
        console.warn("Could not update Auth displayName:", profileErr);
      }

      // Initialize Firestore profile doc: users/{uid}
      try {
        await setDoc(
          doc(db, "users", user.uid),
          {
            uid: user.uid,
            name: cleanName,
            displayName: cleanName,
            email: user.email || "",
            photoURL: "",
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          },
          { merge: true }
        );
      } catch (err) {
        console.warn("Could not create user profile doc:", err);
      }

      alert("Account Created Successfully");
      onSignupSuccess();

    } catch (error) {
      console.error("Signup Error:", error.code);

      switch (error.code) {
        case "auth/email-already-in-use":
          alert("This email is already registered");
          break;
        case "auth/invalid-email":
          alert("Invalid Email");
          break;
        case "auth/weak-password":
          alert("Weak Password");
          break;
        case "auth/network-request-failed":
          alert("Network error. Please check your internet connection.");
          break;
        default:
          alert(error.message || "Signup failed");
      }
    }
  };

  return (
    <div className="signup-page">
      <h1>Create Account</h1>
      <p className="signup-tagline">Join BOOKZEN 📚</p>

      <div className="signup-form">
        <input
          type="text"
          placeholder="Full Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
        />

        <input
          type="email"
          placeholder="Email Address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
        />

        <input
          type="password"
          placeholder="Confirm Password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          autoComplete="new-password"
        />

        <button
          type="button"
          className="create-account-btn"
          onClick={handleSignup}
        >
          Create Account
        </button>

        <button
          type="button"
          className="back-login-btn"
          onClick={onBack}
        >
          Back to Login
        </button>
      </div>
    </div>
  );
}

export default Signup;