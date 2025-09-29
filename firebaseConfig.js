import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCXQ4q3E_GaMmpqnAyFy_qHZKoB9wZhKW8",
  authDomain: "olinxra-app-1a027.firebaseapp.com",
  projectId: "olinxra-app-1a027",
  storageBucket: "olinxra-app-1a027.firebasestorage.app",
  messagingSenderId: "517113888972",
  appId: "1:517113888972:web:4e7b7eb8d5984f9b3dc269"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

export { auth };