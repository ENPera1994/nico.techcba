
// ══════════════════════════════════════════════
//  CONFIGURACIÓN DE FIREBASE
// ══════════════════════════════════════════════
// Estos datos NO son secretos: identifican el proyecto, no dan acceso
// a nada por sí solos. La seguridad real la dan las reglas de Firestore
// (ver firestore.rules) y el login de Firebase Authentication.
 
const firebaseConfig = {
  apiKey: "AIzaSyBqhnpSwUX1VaBfoQIrj19UqwoukQ2izSE",
  authDomain: "nicotech-cba.firebaseapp.com",
  projectId: "nicotech-cba",
  storageBucket: "nicotech-cba.firebasestorage.app",
  messagingSenderId: "676748746167",
  appId: "1:676748746167:web:c684df035fbb2d637d9c32"
};
 
// Email fijo que usa el panel admin para autenticarse contra Firebase.
// Vos solo tipeás la contraseña en el panel; este email queda oculto.
// Creá este usuario en Firebase Console → Authentication → Users,
// con este mismo email y la contraseña "NicoTech!" (o la que prefieras).
const ADMIN_EMAIL = "admin@nicotechcba.app";
 
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
 
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);
const auth = getAuth(firebaseApp);
 
export { db, auth, ADMIN_EMAIL };