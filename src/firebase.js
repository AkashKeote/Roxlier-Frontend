// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCmCHgoyy7-FIA_04GcswB1KrgoOlDrgkI",
  authDomain: "roxlier.firebaseapp.com",
  projectId: "roxlier",
  storageBucket: "roxlier.firebasestorage.app",
  messagingSenderId: "474339884336",
  appId: "1:474339884336:web:b03dd036e12af11a881cf5"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;
