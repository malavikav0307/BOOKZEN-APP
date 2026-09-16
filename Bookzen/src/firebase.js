import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyBuFIPUoy9CVbUuDMEhTbyI71YFt6f2DDg",
  authDomain: "bookzen-57a88.firebaseapp.com",
  projectId: "bookzen-57a88",
  storageBucket: "bookzen-57a88.firebasestorage.app",
  messagingSenderId: "479356717858",
  appId: "1:479356717858:web:4494ce8d55e208bf90b37b",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

storage.maxUploadRetryTime = 120000;
storage.maxOperationRetryTime = 120000;