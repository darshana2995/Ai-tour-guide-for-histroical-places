/* ====================== Firebase SDK Imports ====================== */
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, query, where } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-storage.js";

/* ====================== Firebase Configuration ====================== */
const firebaseConfig = {
  apiKey: "AIzaSyBsniEd1fIQGYwjz0B8tVNYJq9JHvR2kmQ",
  authDomain: "tourguide-d4cfc.firebaseapp.com",
  projectId: "tourguide-d4cfc",
  storageBucket: "tourguide-d4cfc.firebasestorage.app",
  messagingSenderId: "337581457722",
  appId: "1:337581457722:web:2f465ffc23d9a752731003",
  measurementId: "G-1B25L79KL9"
};

// Initialize Firebase
const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);
const storage = getStorage(firebaseApp);
const USE_FAKE_PAYMENT = false;

/* ====================== API Helpers ====================== */
const API_BASE = (window.APP_CONFIG && window.APP_CONFIG.API_BASE)
  ? window.APP_CONFIG.API_BASE
  : "http://localhost:3000";
const EXPECTED_FIREBASE_PROJECT_ID = firebaseConfig.projectId;

function decodeJwtPayload(token){
  try{
    const payload = token.split('.')[1];
    if(!payload) return null;
    const b64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(b64));
  }catch(_){
    return null;
  }
}

async function getIdTokenSafe(){
  const u = auth.currentUser || firebaseCurrentUser;
  if(!u) return null;
  const token = await u.getIdToken(true);
  const payload = decodeJwtPayload(token);
  if(payload && payload.aud && payload.aud !== EXPECTED_FIREBASE_PROJECT_ID){
    console.error(`Token project mismatch: expected ${EXPECTED_FIREBASE_PROJECT_ID}, got ${payload.aud}`);
    await signOut(auth);
    throw new Error('Session token belongs to old Firebase project. Please log in again.');
  }
  return token;
}

async function apiFetch(path, options = {}){
  const token = await getIdTokenSafe();
  const headers = Object.assign(
    { "Content-Type": "application/json" },
    options.headers || {}
  );
  if(token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers
  });
  const text = await res.text();
  let data = {};
  try{ data = text ? JSON.parse(text) : {}; }catch(e){ data = { raw: text }; }
  if(!res.ok){
    const msg = data.error || data.message || `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data;
}

/* ====================== Firebase Helper Functions ====================== */

// Save user data to Firestore
async function saveUserToFirestore(userId, userData) {
  const current = auth.currentUser || firebaseCurrentUser;
  if (current && current.uid === userId) {
    try {
      await apiFetch('/api/users/sync', {
        method: 'POST',
        body: JSON.stringify({
          email: userData?.email || current.email || '',
          name: userData?.name || '',
          phone: userData?.phone || ''
        })
      });
      return true;
    } catch (apiError) {
      console.error("Error syncing user via API:", apiError);
    }
  }

  try {
    await setDoc(doc(db, "users", userId), {
      ...userData,
      createdAt: new Date().toISOString()
    }, { merge: true });
    console.log("User data saved to Firestore");
    return true;
  } catch (error) {
    console.error("Error saving user data:", error);
    return false;
  }
}

// Get user data from Firestore
async function getUserFromFirestore(userId) {
  const current = auth.currentUser || firebaseCurrentUser;
  if (current && current.uid === userId) {
    try {
      const data = await apiFetch(`/api/users/${userId}`);
      return data || null;
    } catch (apiError) {
      console.error("Error getting user data via API:", apiError);
    }
  }

  try {
    const docSnap = await getDoc(doc(db, "users", userId));
    if (docSnap.exists()) {
      return docSnap.data();
    }
    return null;
  } catch (error) {
    console.error("Error getting user data:", error);
    return null;
  }
}

// Save booking to Firestore
async function saveBookingToFirestore(userId, bookingData) {
  try {
    const bookingRef = doc(collection(db, "bookings"));
    await setDoc(bookingRef, {
      ...bookingData,
      userId: userId,
      createdAt: new Date().toISOString()
    });
    console.log("Booking saved to Firestore");
    return bookingRef.id;
  } catch (error) {
    console.error("Error saving booking:", error);
    return null;
  }
}

// Get user's bookings from Firestore
async function getUserBookingsFromFirestore(userId) {
  try {
    const q = query(collection(db, "bookings"), where("userId", "==", userId));
    const querySnapshot = await getDocs(q);
    const bookings = [];
    querySnapshot.forEach((doc) => {
      bookings.push({ id: doc.id, ...doc.data() });
    });
    return bookings;
  } catch (error) {
    console.error("Error getting bookings:", error);
    return [];
  }
}

// Save journey to Firestore
async function saveJourneyToFirestore(userId, journeyData) {
  try {
    const journeyRef = doc(collection(db, "journeys"));
    await setDoc(journeyRef, {
      ...journeyData,
      userId: userId,
      createdAt: new Date().toISOString()
    });
    console.log("Journey saved to Firestore");
    return journeyRef.id;
  } catch (error) {
    console.error("Error saving journey:", error);
    return null;
  }
}

// Get user's journeys from Firestore
async function getUserJourneysFromFirestore(userId) {
  try {
    const q = query(collection(db, "journeys"), where("userId", "==", userId));
    const querySnapshot = await getDocs(q);
    const journeys = [];
    querySnapshot.forEach((doc) => {
      journeys.push({ id: doc.id, ...doc.data() });
    });
    return journeys;
  } catch (error) {
    console.error("Error getting journeys:", error);
    return [];
  }
}

// Upload trip photo to Firebase Storage
async function uploadTripPhotoToStorage(userId, file) {
  try {
    const storageRef = ref(storage, `tripPhotos/${userId}/${Date.now()}_${file.name}`);
    const snapshot = await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(snapshot.ref);
    console.log("Photo uploaded successfully");
    return downloadURL;
  } catch (error) {
    console.error("Error uploading photo:", error);
    return null;
  }
}

// Save trip photo metadata to Firestore
async function saveTripPhotoToFirestore(userId, photoURL) {
  try {
    const photoRef = doc(collection(db, "tripPhotos"));
    await setDoc(photoRef, {
      userId: userId,
      photoURL: photoURL,
      createdAt: new Date().toISOString()
    });
    console.log("Trip photo saved to Firestore");
    return photoRef.id;
  } catch (error) {
    console.error("Error saving trip photo:", error);
    return null;
  }
}

// Get user's trip photos from Firestore
async function getUserTripPhotosFromFirestore(userId) {
  try {
    const q = query(collection(db, "tripPhotos"), where("userId", "==", userId));
    const querySnapshot = await getDocs(q);
    const photos = [];
    querySnapshot.forEach((doc) => {
      photos.push({ id: doc.id, ...doc.data() });
    });
    return photos;
  } catch (error) {
    console.error("Error getting trip photos:", error);
    return [];
  }
}

/* --------------------------
  App state & helpers
   -------------------------- */
const slides = [
  "https://images.unsplash.com/photo-1505765050359-0101643d6e9d?auto=format&fit=crop&w=1600&q=80", // Taj Mahal
  "https://images.unsplash.com/photo-1467269204594-9661b134dd2b?auto=format&fit=crop&w=1600&q=80", // Qutub Minar
  "https://images.unsplash.com/photo-1524492412937-b28074a5d7da?auto=format&fit=crop&w=1600&q=80", // Red Fort
  "https://images.unsplash.com/photo-1587474260584-136574528ed5?auto=format&fit=crop&w=1600&q=80", // Hampi
  "https://images.unsplash.com/photo-1593696140826-c58b021acf8b?auto=format&fit=crop&w=1600&q=80"  // Jaipur Fort
];

const IMAGE_FALLBACKS = [
  "https://images.unsplash.com/photo-1505765050359-0101643d6e9d?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1467269204594-9661b134dd2b?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1533777324565-a040eb52fac2?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=1200&q=80"
];

let slideIdx = 0;
let slideTimer = null;
let squareIdx = 0;
let squareTimer = null;

/* ---------- small place metadata for images & info (used by PDF & display) ---------- */

const PLACE_META = {

"Taj Mahal": { image:"https://upload.wikimedia.org/wikipedia/commons/d/da/Taj-Mahal.jpg", info:"Agra monument" },
"Agra Fort": { image:"https://upload.wikimedia.org/wikipedia/commons/9/9b/Agra_Fort_India.jpg", info:"Agra fort" },
"Fatehpur Sikri": { image:"https://upload.wikimedia.org/wikipedia/commons/1/1b/Fatehpur_Sikri_Buland_Darwaza.jpg", info:"Historic city" },
"Red Fort": { image:"https://upload.wikimedia.org/wikipedia/commons/0/0c/Red_Fort_in_Delhi_03-2016.jpg", info:"Delhi fort" },
"Qutub Minar": { image:"https://upload.wikimedia.org/wikipedia/commons/e/e8/Qutb_Minar_2011.jpg", info:"Delhi minaret" },
"India Gate": { image:"https://upload.wikimedia.org/wikipedia/commons/d/d1/India_Gate_in_New_Delhi_03-2016.jpg", info:"War memorial" },
"Jama Masjid": { image:"https://upload.wikimedia.org/wikipedia/commons/3/3e/Jama_Masjid_Delhi.jpg", info:"Delhi mosque" },
"Lotus Temple": { image:"https://upload.wikimedia.org/wikipedia/commons/f/fc/Lotus_Delhi.jpg", info:"Delhi temple" },
"Charminar": { image:"https://upload.wikimedia.org/wikipedia/commons/d/d1/Charminar-Pride_of_Hyderabad.jpg", info:"Hyderabad monument" },
"Konark Sun Temple": { image:"https://upload.wikimedia.org/wikipedia/commons/4/47/Konark_Sun_Temple.jpg", info:"Odisha temple" },
"Ajanta Caves": { image:"https://upload.wikimedia.org/wikipedia/commons/7/76/Ajanta_Caves.jpg", info:"Cave site Maharashtra" },
"Ellora Caves": { image:"https://upload.wikimedia.org/wikipedia/commons/3/3e/Kailasa_temple_Ellora.jpg", info:"Ellora caves" },
"Gateway of India": { image:"https://upload.wikimedia.org/wikipedia/commons/4/4d/Gateway_of_India_Mumbai.jpg", info:"Mumbai monument" },
"Mysore Palace": { image:"https://upload.wikimedia.org/wikipedia/commons/a/a4/Mysore_Palace_Front_View.jpg", info:"Karnataka palace" },
"Hawa Mahal": { image:"https://upload.wikimedia.org/wikipedia/commons/9/9b/Hawa_Mahal_2011.jpg", info:"Jaipur palace" }

};

/* ---------- Auth with Firebase ---------- */
let firebaseCurrentUser = null;

// Listen for auth state changes
onAuthStateChanged(auth, async (user) => {
  if (user) {
    firebaseCurrentUser = user;
    // Get user data from Firestore
    const userData = await getUserFromFirestore(user.uid);
    if (userData) {
      window.user = {
        uid: user.uid,
        email: user.email,
        name: userData.name || user.email.split('@')[0],
        phone: userData.phone || ''
      };
      onLogin();
    } else {
      // Create new user in Firestore if not exists
      const saved = await saveUserToFirestore(user.uid, {
        email: user.email,
        name: user.email.split('@')[0],
        phone: ''
      });
      if (!saved) {
        alert('Signed in, but profile sync failed. Please check backend/Firebase setup.');
      }
      window.user = {
        uid: user.uid,
        email: user.email,
        name: user.email.split('@')[0],
        phone: ''
      };
      onLogin();
    }
  } else {
    firebaseCurrentUser = null;
    window.user = null;
  }
});

function register(){
  const name = document.getElementById('regName').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const pass = document.getElementById('regPass').value;
  const country = document.getElementById('regCountry').value;
  const phoneRaw = document.getElementById('regPhone').value.trim();
  const phoneOk = /^[0-9]{10}$/.test(phoneRaw);
  if(!name||!email||!pass||!phoneRaw){ alert('Complete all fields'); return; }
  if(!phoneOk){ alert('Phone must be exactly 10 digits'); return; }
  if(pass.length < 6){ alert('Password must be at least 6 characters'); return; }
  const phone = `${country} ${phoneRaw}`;
  
  // Show loading state
  const btn = document.querySelector('#registerPage .primary');
  const originalText = btn.textContent;
  btn.textContent = 'Registering...';
  btn.disabled = true;
  
  createUserWithEmailAndPassword(auth, email, pass)
    .then(async (userCredential) => {
      const user = userCredential.user;
      // Save user data to Firestore
      const saved = await saveUserToFirestore(user.uid, {
        email: email,
        name: name,
        phone: phone
      });
      if (!saved) {
        alert('Registration done, but profile data sync failed.');
      }
      window.user = { uid: user.uid, email, name, phone };
      alert('Registration successful!');
      onLogin();
    })
    .catch((error) => {
      if (error.code === 'auth/email-already-in-use') {
        alert('Email already registered');
      } else {
        alert('Registration failed: ' + error.message);
      }
    })
    .finally(() => {
      btn.textContent = originalText;
      btn.disabled = false;
    });
}

function login(){
  const email = document.getElementById('loginEmail').value.trim();
  const pass = document.getElementById('loginPass').value;
  if(!email||!pass){ alert('Please enter email and password'); return; }
  
  // Show loading state
  const btn = document.querySelector('#loginPage .primary');
  const originalText = btn.textContent;
  btn.textContent = 'Logging in...';
  btn.disabled = true;
  
  signInWithEmailAndPassword(auth, email, pass)
    .then((userCredential) => {
      // User logged in successfully - onAuthStateChanged will handle the rest
    })
    .catch((error) => {
      if (error.code === 'auth/invalid-email' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        alert('Invalid email or password');
      } else {
        alert('Login failed: ' + error.message);
      }
    })
    .finally(() => {
      btn.textContent = originalText;
      btn.disabled = false;
    });
}

function logout(){
  signOut(auth).then(() => {
    window.user = null;
    firebaseCurrentUser = null;
    window.isAdmin = false;
    document.getElementById('navbar').style.display='none';
    const adminBtn = document.getElementById('navAdminBtn');
    if(adminBtn) adminBtn.style.display = 'none';
    const adminBadge = document.getElementById('adminBadge');
    if(adminBadge) adminBadge.style.display = 'none';
    showPage('loginPage');
  }).catch((error) => {
    console.error('Logout error:', error);
    alert('Logout failed: ' + error.message);
  });
}

/* ---------- Navigation ---------- */
function showPage(id){

    if(id === "achievementPage"){
   renderAchievements();
}

  if(id === "profilePage"){
  renderProfile();
}
  if(id === "adminPage"){
  renderAdminPage();
}
document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  const pg = document.getElementById(id);
  if(!pg) return;
  pg.classList.add('active');
  const navPageMap = {
    homePage: 'navHomeBtn',
    journeyPage: 'navJourneyBtn',
    aiPlannerPage: 'navPlannerBtn',
    hotelPage: 'navHotelsBtn',
    hotelBookingsPage: 'navHotelBookingsBtn',
    profilePage: 'navProfileBtn',
    achievementPage: 'navAchievementsBtn',
    adminPage: 'navAdminBtn'
  };
  document.querySelectorAll('#navbar button').forEach(btn => btn.classList.remove('active-nav'));
  const activeBtnId = navPageMap[id];
  if(activeBtnId){
    const activeBtn = document.getElementById(activeBtnId);
    if(activeBtn) activeBtn.classList.add('active-nav');
  }
  if(id !== 'loginPage' && id !== 'registerPage'){
    document.getElementById('navbar').style.display = 'flex';
  }
  if(id === 'homePage'){ startSlideshow(); startSquareSlideshow(); }
  else { stopSlideshow(); stopSquareSlideshow(); }
  renderAll();
  if(typeof renderHotelBookings === 'function') renderHotelBookings();
}

/* ===== TRIP PHOTO FUNCTIONS ===== */

function uploadTripPhotos(){

  const input = document.getElementById("tripPhotoUpload");
  if(!input || !input.files.length) return;

  let photos = JSON.parse(localStorage.getItem("tripPhotos") || "[]");

  Array.from(input.files).forEach(file=>{
    const reader = new FileReader();

    reader.onload = function(e){
      photos.push(e.target.result);
      localStorage.setItem("tripPhotos", JSON.stringify(photos));
      renderTripPhotos();
    };

    reader.readAsDataURL(file);
  });

}

function renderTripPhotos(){

  const gallery = document.getElementById("tripGallery");
  if(!gallery) return;

  const photos = JSON.parse(localStorage.getItem("tripPhotos") || "[]");

  if(!photos.length){
    gallery.innerHTML = "<div class='small-muted'>No trip photos uploaded yet.</div>";
    return;
  }

  gallery.innerHTML = photos.map(p =>
    `<img src="${p}" style="width:120px;height:120px;object-fit:cover;border-radius:10px">`
  ).join("");

}



/* ===== ACHIEVEMENTS SYSTEM (UPGRADED) ===== */

    function renderAchievements(){

  const el = document.getElementById("achievementList");
  if(!el) return;

  const journeys = getJourney();
  const trips = journeys.length;
  const photos = JSON.parse(localStorage.getItem("tripPhotos") || "[]").length;

  const today = new Date().toISOString().slice(0,10);
  const visited = journeys.filter(j => j.arrive && j.arrive <= today).length;

  let list = [];

  /* EASY */
  if(trips >= 1) list.push({icon:"ðŸ§­", text:"First Trip Planned", cls:"ach-easy"});
  if(photos >= 5) list.push({icon:"ðŸ“¸", text:"5 Photos Uploaded", cls:"ach-easy"});
  if(visited >= 3) list.push({icon:"ðŸ—ºï¸", text:"3 Places Visited", cls:"ach-easy"});

  /* MEDIUM */
  if(trips >= 3) list.push({icon:"ðŸ§³", text:"3 Trips Planned", cls:"ach-medium"});
  if(photos >= 10) list.push({icon:"ðŸ–¼ï¸", text:"10 Photos Uploaded", cls:"ach-medium"});
  if(visited >= 5) list.push({icon:"ðŸ›ï¸", text:"5 Places Visited", cls:"ach-medium"});

  /* HARD */
  if(trips >= 7) list.push({icon:"ðŸš€", text:"7 Trips Planned", cls:"ach-hard"});
  if(photos >= 20) list.push({icon:"ðŸ“·", text:"20 Photos Uploaded", cls:"ach-hard"});
  if(visited >= 10) list.push({icon:"ðŸ°", text:"10 Places Visited", cls:"ach-hard"});

  /* SPECIAL */
  if(trips >= 3 && photos >= 10 && visited >= 5){
    list.push({icon:"ðŸŒŸ", text:"Travel Enthusiast", cls:"ach-special"});
  }

  if(list.length === 0){
    el.innerHTML = "<div class='small-muted'>Start planning trips to unlock achievements!</div>";
    return;
  }

  el.innerHTML = list.map(a => `
    <div class="achievement-card ${a.cls}">
      <div class="ach-icon">${a.icon}</div>
      <div>${a.text}</div>
    </div>
  `).join("");

}



/* ---------- After login setup ---------- */
async function onLogin(){
  document.getElementById('navbar').style.display='flex';
  showPage('homePage');
  await loadAdminStatus();
  await syncUserDataFromDb();
  renderAll();
}

/* ---------- Slideshow (hero) ---------- */
function startSlideshow(){
  const img = document.getElementById('slideImg');
  if(slideTimer) return;
  if(img){ img.src = slides[slideIdx]; }
  slideTimer = setInterval(()=>{
    slideIdx = (slideIdx+1)%slides.length;
    const img = document.getElementById('slideImg');
    if(!img) return;
    img.style.opacity = 0;
    setTimeout(()=>{ img.src = slides[slideIdx]; img.style.opacity=1; }, 400);
  }, 4200);
}
function stopSlideshow(){ clearInterval(slideTimer); slideTimer = null }

/* ---------- Square slideshow (new) ---------- */
function startSquareSlideshow(){
  const img = document.getElementById('squareSlideImg');
  if(!img) return;
  if(squareTimer) return;
  img.src = slides[squareIdx];
  document.getElementById('squareCaption').textContent = captionFor(slides[squareIdx]);
  squareTimer = setInterval(()=>{ nextSquare(); }, 4200);
  const btn = document.getElementById('squarePlayBtn'); if(btn) btn.textContent = 'Pause';
}
function stopSquareSlideshow(){
  clearInterval(squareTimer); squareTimer = null;
  const btn = document.getElementById('squarePlayBtn'); if(btn) btn.textContent = 'Play';
}
function nextSquare(){
  squareIdx = (squareIdx + 1) % slides.length;
  const img = document.getElementById('squareSlideImg'); if(!img) return;
  img.style.opacity = 0;
  setTimeout(()=>{ img.src = slides[squareIdx]; img.style.opacity = 1; document.getElementById('squareCaption').textContent = captionFor(slides[squareIdx]); }, 200);
}
function prevSquare(){
  squareIdx = (squareIdx - 1 + slides.length) % slides.length;
  const img = document.getElementById('squareSlideImg'); if(!img) return;
  img.style.opacity = 0;
  setTimeout(()=>{ img.src = slides[squareIdx]; img.style.opacity = 1; document.getElementById('squareCaption').textContent = captionFor(slides[squareIdx]); }, 200);
}
function toggleSquareSlideshow(){
  if(squareTimer) stopSquareSlideshow(); else startSquareSlideshow();
}
function captionFor(src){
  if(src.includes('1505765050359')) return 'Taj Mahal and nearby heritage';
  if(src.includes('1526778548025')) return 'Historic forts and monuments';
  if(src.includes('1467269204594')) return 'Ancient monuments & ruins';
  return 'Explore historical places with curated itineraries';
}

/* ---------- Dark mode ---------- */
function toggleDarkMode(){ document.body.classList.toggle('dark'); }

/* ---------- Image fallback for broken URLs ---------- */
function applyImageFallbacks(root = document){
  const imgs = root.querySelectorAll('img');
  imgs.forEach(img => {
    if(img.dataset.fallbackBound) return;
    img.dataset.fallbackBound = '1';
    if(!img.loading) img.loading = 'lazy';
    img.decoding = 'async';
    img.referrerPolicy = 'no-referrer';
    img.addEventListener('error', () => {
      if(img.dataset.fallbackTried) return;
      img.dataset.fallbackTried = '1';
      const next = IMAGE_FALLBACKS[Math.floor(Math.random()*IMAGE_FALLBACKS.length)];
      img.src = next;
    }, { once: true });
  });
}

/* ---------- Small fix: renderProfile points to existing elements ---------- */
function renderProfile(){
  const p = window.user || {name:'Guest', email:'', phone:'', photo:''};
  const nameEl = document.getElementById('profileName');
  const emailEl = document.getElementById('profileEmail');
  const phoneEl = document.getElementById('profilePhone');
  const photoEl = document.getElementById('profilePhoto');
  if(nameEl) nameEl.textContent = p.name || p.email || 'User Name';
  if(emailEl) emailEl.textContent = p.email || 'user@example.com';
  if(phoneEl) phoneEl.textContent = p.phone || 'Not set';
  if(photoEl && p.photo) photoEl.src = p.photo;

  renderTripPhotos();



  const tripsEl = document.getElementById('profileTrips');
  if(tripsEl) tripsEl.textContent = `Trips Planned: ${getJourney().length}`;
  const visitedEl = document.getElementById('visitedList');
  const willVisitEl = document.getElementById('willVisitList');
  const journeys = getJourney();
  const today = new Date().toISOString().slice(0,10);
  const visited = journeys.filter(j => j.arrive && j.arrive <= today).map(j=>j.place).slice(0,10);
  const will = journeys.filter(j => j.arrive && j.arrive > today).map(j=>j.place).slice(0,10);
  if(visitedEl) visitedEl.innerHTML = visited.length ? visited.map(v=>`<div>${escapeHtml(v)}</div>`).join('') : '<span class="small-muted">No visited places saved.</span>';
  if(willVisitEl) willVisitEl.innerHTML = will.length ? will.map(v=>`<div>${escapeHtml(v)}</div>`).join('') : '<span class="small-muted">No planned visits yet.</span>';
}


/* ---------- Renders the live dashboard preview on home page if present ---------- */
function renderDashboardPreview(){
  const preview = document.getElementById('dashboardPreviewCard');
  if(!preview) return;
  const user = window.user || {name:'Guest', email:''};
  const dpAvatar = document.getElementById('dpAvatar');
  const dpName = document.getElementById('dpName');
  const dpEmail = document.getElementById('dpEmail');
  const dpTrips = document.getElementById('dpTrips');
  const dpVisited = document.getElementById('dpVisited');
  const dpUpcoming = document.getElementById('dpUpcoming');

  const journeys = getJourney();
  const trips = journeys.length;
  const today = new Date().toISOString().slice(0,10);
  const visited = journeys.filter(j => j.arrive && j.arrive <= today).length;
  const upcoming = journeys.filter(j => j.arrive && j.arrive > today).length;

  const initials = (user.name || user.email || 'U').split(/\s+/).map(s=>s[0]).slice(0,2).join('').toUpperCase();
  if(dpAvatar) dpAvatar.textContent = initials || 'U';
  if(dpName) dpName.textContent = user.name || (user.email || 'Guest');
  if(dpEmail) dpEmail.textContent = user.email || '';
  if(dpTrips) dpTrips.textContent = `Trips: ${trips}`;
  if(dpVisited) dpVisited.textContent = `Visited: ${visited}`;
  if(dpUpcoming) dpUpcoming.textContent = `Upcoming: ${upcoming}`;
}

/* ---------- Chatbot: improved simple assistant (used by both floating and page chat) ---------- */
const placeCity = {
  "Taj Mahal":"Agra",
  "Red Fort":"Delhi",
  "Qutub Minar":"Delhi",
  "Hampi":"Hampi"
};

function recommendTravel(destCity){
  destCity = (destCity||'').trim();
  if(!destCity){
    return "Tell me which place or city you want to travel to (e.g., 'Best travel option to Agra').";
  }
  return `Best travel options to **${destCity}**: **Train** for budget, **Bus** for short trips, **Flight** for fastest. If you share your origin city in the message, I can tailor this more.`;
}

const canned = [
  {q:/how to use (this )?website|how to use (this )?site|use this website/i,
   a:"Go to **Create Journey** to add trips, hotels, dates and notes. Use **Hotels** to book rooms. **AI Planner** helps with budget ideas. **Profile** stores your details. **Chatbot** answers travel questions."},

  {q:/who is owner|who is the owner|owner of (this )?website|who made this website|co founder/i,
   a:"The website owner/co-founder is **Darshana Khane**."},

  {q:/best places.*summer|where go in summer|summer place/i,
   a:"Best summer places: **Manali, Shimla, Ladakh, Kashmir, Ooty**."},

  {q:/best places.*winter|where go in winter|winter place/i,
   a:"Best winter places: **Manali (snow), Kashmir, Auli, Shimla**."},

  {q:/best places.*rainy|monsoon place|rainy season/i,
   a:"Best rainy/monsoon places: **Lonavala, Malshej Ghat, Mahabaleshwar, Coorg**."},

  {q:/how (is )?this website useful|how useful is this website|why use this website/i,
   a:"It helps you **plan trips, manage budget, book hotels, track visits, and generate itineraries** in one place."},

  {q:/is this website helpful|is this website useful/i,
   a:"Yes. It saves time by combining **planning, bookings, budget tracking, and trip notes** in one dashboard."},

  {q:/best place to visit in (january|february|march|april|may|june|july|august|september|october|november|december)/i,
   a:"Tell me the month (e.g., 'Best place to visit in March'), and I'll suggest places from the monthly list."},

  {q:/trek|trekking|trek places/i,
   a:"Popular trekking places include **Manali, Kedarnath trek, Lonavala trails, Himachal routes**."},

  {q:/near mumbai|places near mumbai/i,
   a:"Near Mumbai you can visit **Lonavala, Alibaug, Matheran, Mahabaleshwar, Igatpuri**."},

  {q:/budget for .* days/i,
   a:"For a 2-3 day trip, budget \u20B95000â€“\u20B915000 per person** depending on travel and hotel type."},

  {q:/camping|where camping/i,
   a:"Good camping places: **Rishikesh riverside, Manali camps, Pawna Lake (near Pune)**."},

  {q:/my bookings|previous booking|last booking|my hotel|hotel booking history|booking status/i,
   a:"Let me check your bookings..."},

  {q:/my trips|previous trip|last trip|journey history|past journey/i,
   a:"Let me check your journeys..."}
];

const placeSeasons = {
 "manali":"Best visited Oct to Feb for snow, or Apr to Jun for pleasant weather.",
 "goa":"Best Nov to Feb for beaches and festivals.",
 "kashmir":"Best Mar to Oct for valley views, Dec-Jan for snow.",
 "lonavala":"Best Jun to Sep for waterfalls and greenery."
};

function sendChat(source){
  try{
    const inputEl = (source === 'page') ? document.getElementById('chatInputPage') : document.getElementById('chatInput');
    if(!inputEl) return;
    const text = inputEl.value.trim();
    if(!text) return;
    appendChat(source, 'user', text);
    inputEl.value = '';
    const tl = text.toLowerCase();

    // basic FAQ patterns
    if(/what (is|does) (this|this site|this website)|what are you|what is this site/i.test(text)){
      setTimeout(()=> appendChat(source,'bot', `This is an AI Tour Guide demo website ? it helps you plan journeys to historical places, create itineraries, manage budget and schedule visits. Ask me "Where should I visit today?" or ask "Best travel option to Agra".`), 400);
      return;
    }

    if(/where.*visit.*today|visit.*today|what.*visit.*today/i.test(text)){
      const knownPlaces = Object.keys(placeCity);
      for(const p of knownPlaces){
        if(tl.includes(p.toLowerCase()) || tl.includes(placeCity[p].toLowerCase())){
          setTimeout(()=> appendChat(source,'bot', `If you're thinking about visiting **${p}** in ${placeCity[p]} today: morning visits avoid the crowd. Check opening hours and book tickets where applicable.`), 450);
          return;
        }
      }
      const weekday = new Date().getDay();
      let place;
      if(weekday===0 || weekday===6) place = "Taj Mahal";
      else place = (Math.random()>0.5) ? "Red Fort" : "Qutub Minar";
      setTimeout(()=> appendChat(source,'bot', `Suggestion for today: ${place} (${placeCity[place]}). If you want travel advice, ask "Best travel option to ${place}" and include your origin city in the message.`), 450);
      return;
    }

    const travelMatch = text.match(/best (travel|way|option) (to|for) (.+)/i) || text.match(/(travel|go) to (.+) (best|how)/i) || text.match(/how to (reach|get to) (.+)/i);
    if(travelMatch){
      let destRaw = travelMatch[3] || travelMatch[2] || '';
      destRaw = destRaw.replace(/\?$/,'').trim();
      let destCity = destRaw;
      for(const p of Object.keys(placeCity)){
        if(destRaw.toLowerCase().includes(p.toLowerCase()) || destRaw.toLowerCase().includes(placeCity[p].toLowerCase())){
          destCity = placeCity[p];
          break;
        }
      }
      const rec = recommendTravel(destCity);
      setTimeout(()=> appendChat(source,'bot', rec), 450);
      return;
    }

    const monthMatch = text.match(/best place to visit in (january|february|march|april|may|june|july|august|september|october|november|december)/i);
    if(monthMatch){
      const m = monthMatch[1];
      const month = m.charAt(0).toUpperCase() + m.slice(1).toLowerCase();
      if(typeof window.MONTH_DESTINATIONS === 'object' && window.MONTH_DESTINATIONS[month]){
        const places = window.MONTH_DESTINATIONS[month].map(p => p.name).slice(0,5);
        setTimeout(()=> appendChat(source,'bot', `Best places in **${month}**: ${places.join(", ")}.`), 450);
      } else {
        setTimeout(()=> appendChat(source,'bot', `Tell me the month and I'll suggest places. Example: "Best place to visit in March".`), 450);
      }
      return;
    }

    if(/from .* to .*|how to (reach|get to)/i.test(text) && /km|kilom/i.test(text)){
      let guessedDest = '';
      for(const p of Object.keys(placeCity)){
        if(text.toLowerCase().includes(p.toLowerCase())){
          guessedDest = placeCity[p]; break;
        }
      }
      const rec = recommendTravel(guessedDest || '');
      setTimeout(()=> appendChat(source,'bot', rec), 450);
      return;
    }

    for(const c of canned){
      if(c.q.test(text)){
        if(/my bookings|previous booking|last booking|my hotel|hotel booking history|booking status/i.test(text)){
          const bookings = getBookings();
          if(!bookings.length){
            setTimeout(()=> appendChat(source,'bot', "You have no bookings yet."), 450);
            return;
          }
          const last = bookings.slice().sort((a,b)=>{
            const ad = new Date(a.createdAt || a.paidAt || 0).getTime();
            const bd = new Date(b.createdAt || b.paidAt || 0).getTime();
            return bd - ad;
          })[0] || bookings[0];
          const status = (last.paymentStatus || 'pending').toUpperCase();
          setTimeout(()=> appendChat(source,'bot', `Your latest booking: **${last.hotelName || 'Hotel'}** (${last.place || ''}). Total: \u20B9${last.total || 0}. Status: **${status}**.`), 450);
          return;
        }
        if(/my trips|previous trip|last trip|journey history|past journey/i.test(text)){
          const journeys = getJourney();
          if(!journeys.length){
            setTimeout(()=> appendChat(source,'bot', "You have no journeys yet."), 450);
            return;
          }
          const last = journeys.slice().sort((a,b)=>{
            const ad = new Date(a.createdAt || a.arrive || 0).getTime();
            const bd = new Date(b.createdAt || b.arrive || 0).getTime();
            return bd - ad;
          })[0] || journeys[journeys.length-1];
          setTimeout(()=> appendChat(source,'bot', `Your latest journey: **${last.place || 'Trip'}** on ${last.arrive || 'date not set'}. Hotel: ${last.hotel || 'not set'}.`), 450);
          return;
        }
        setTimeout(()=> appendChat(source,'bot', c.a), 450);
        return;
      }
    }

    for(const place in placeSeasons){
      if(tl.includes(place)){
        setTimeout(()=> appendChat(source,'bot', placeSeasons[place]), 450);
        return;
      }
    }

    setTimeout(()=> appendChat(source,'bot', "Sorry ? I don't know that exactly yet. Try: 'Where should I visit today?', 'Best travel option to Agra', or ask a budget/hotel question. You can include your origin city in the message for a tailored answer."), 450);
  }catch(e){
    console.error('Chatbot error:', e);
    setTimeout(()=> appendChat(source,'bot', "Sorry ? something went wrong. Please try again."), 200);
  }
}
function appendChat(source, who, text){
  const area = (source === 'page') ? document.getElementById('chatAreaPage') : document.getElementById('chatArea');
  if(!area) return;
  const div = document.createElement('div');
  div.className = 'msg ' + (who==='user' ? 'user' : 'bot');
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.innerHTML = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  div.appendChild(bubble);
  area.appendChild(div);
  area.scrollTop = area.scrollHeight;
}

/* Provide a function to open Chat Page (used by home hero button) */
function showChatPage(){
  showPage('chatPage');
  // add a starter greeting if empty
  const area = document.getElementById('chatAreaPage');
  if(area && area.children.length === 0){
    setTimeout(()=> appendChat('page','bot', "Hello! I'm your AI travel assistant. Ask me about places, travel options, hotels, budgets or 'Where should I visit today?'. Include your origin city in the message for tailored suggestions."), 300);
  }
}

/* Floating chat toggle (kept as fallback) */
function toggleChatbot(){
  const b = document.getElementById('chatbotBox');
  b.style.display = (b.style.display==='block')? 'none' : 'block';
}

/* ---------- Journey storage & UI ---------- */
function getJourney(){ return JSON.parse(localStorage.getItem('atg_journey')||'[]'); }
function saveJourney(arr){ localStorage.setItem('atg_journey', JSON.stringify(arr)); }

async function syncUserDataFromDb(){
  if(!auth.currentUser) return;
  try{
    const [journeysRes, bookingsRes] = await Promise.all([
      apiFetch('/api/journeys'),
      apiFetch('/api/bookings')
    ]);
    if(Array.isArray(journeysRes.journeys)) saveJourney(journeysRes.journeys);
    if(Array.isArray(bookingsRes.bookings)) localStorage.setItem('atg_bookings', JSON.stringify(bookingsRes.bookings));
  }catch(e){
    console.error('Sync error:', e);
  }
}

async function loadAdminStatus(){
  if(!auth.currentUser && !firebaseCurrentUser){
    setTimeout(loadAdminStatus, 600);
    return;
  }
  try{
    const me = await apiFetch('/api/auth/me');
    window.isAdmin = !!me.isAdmin;
    const adminBtn = document.getElementById('navAdminBtn');
    if(adminBtn) adminBtn.style.display = window.isAdmin ? 'inline-flex' : 'none';
    const adminBadge = document.getElementById('adminBadge');
    if(adminBadge) adminBadge.style.display = window.isAdmin ? 'inline-flex' : 'none';
  }catch(e){
    console.error('Admin status error:', e);
  }
}

async function addToJourney(){
  const place = document.getElementById('placeSelect').value;
  const arrive = document.getElementById('arrive').value;
  const hotel = document.getElementById('hotelName').value.trim();
  const nights = Number(document.getElementById('nights').value || 1);
  const price = Number(document.getElementById('hotelPrice').value || 0);
  const travelMode = document.getElementById('travelMode').value;
  const travelType = document.getElementById('travelType').value;
  const notes = document.getElementById('journeyNotes').value.trim();
  if(!hotel){ alert('Enter a hotel name'); return; }
  const arr = getJourney();
  const item = {id:`local-${Date.now()}`, place, arrive, hotel, nights, price, travelMode, travelType, notes};
  arr.push(item);
  saveJourney(arr);
  renderJourney();
  updateBudgetFromData();
  renderProfile(); // update dashboard lists
  renderDashboardPreview(); // update preview (if present)
  alert('Added to journey');
  try{
    await apiFetch('/api/journeys', {
      method: 'POST',
      body: JSON.stringify({ place, arrive, hotel, nights, price, travelMode, travelType, notes })
    });
    await syncUserDataFromDb();
    renderAll();
  }catch(e){
    console.error('Journey save error:', e);
  }
}

function renderJourney(){
  const list = getJourney();
  const container = document.getElementById('journeyList');
  if(!container) return;
  container.innerHTML = '';
  if(list.length===0){ container.innerHTML = '<div class="small-muted">No items yet.</div>'; return; }
  list.forEach(it=>{
    const d = document.createElement('div');
    d.className = 'card';
    const metaHtml = `<div class="journey-meta"><span class="small-pill">${it.travelMode||'â€”'}</span><span class="small-pill">${translateTravelType(it.travelType||'Solo')}</span><div style="flex:1"></div><div class="small-muted">Arrive: ${it.arrive || '-'} | Nights: ${it.nights} | \u20B9${it.price}</div></div>`;
    const notesHtml = it.notes ? `<div style="margin-top:8px"><strong>Notes:</strong> <span class="small-muted">${escapeHtml(it.notes)}</span></div>` : '';
    const pm = PLACE_META[it.place];
    const imgHtml = pm ? `<div style="display:flex;gap:10px;margin-top:8px"><img src="${pm.image}" alt="${it.place}" style="width:120px;height:80px;border-radius:8px;object-fit:cover"><div style="flex:1"><strong>${it.place}</strong><div class="small-muted">${pm.info}</div></div></div>` : `<strong>${it.place}</strong>`;
    const idSafe = String(it.id).replace(/'/g, "\\'");
    d.innerHTML = `${imgHtml}${metaHtml}<div style="margin-top:8px"><strong>Hotel:</strong> ${it.hotel}</div>${notesHtml}
      <div style="margin-top:8px"><button onclick="removeJourney('${idSafe}')">Remove</button></div>`;
    container.appendChild(d);
  });
  applyImageFallbacks(container);
}

async function removeJourney(id){
  const arr = getJourney().filter(x=>String(x.id)!==String(id));
  saveJourney(arr); renderJourney(); updateBudgetFromData(); renderProfile(); renderDashboardPreview();
  if(String(id).startsWith('local-')) return;
  try{
    await apiFetch(`/api/journeys/${id}`, { method: 'DELETE' });
    await syncUserDataFromDb();
    renderAll();
  }catch(e){
    console.error('Remove journey error:', e);
  }
}

async function clearJourney(){
  if(!confirm('Clear all journey items?')) return;
  const items = getJourney();
  saveJourney([]); renderJourney(); updateBudgetFromData(); renderProfile(); renderDashboardPreview();
  try{
    await Promise.all(items.filter(i=>!String(i.id).startsWith('local-')).map(i =>
      apiFetch(`/api/journeys/${i.id}`, { method: 'DELETE' })
    ));
    await syncUserDataFromDb();
    renderAll();
  }catch(e){
    console.error('Clear journey error:', e);
  }
}

function loadSample(){
  const sample = [
    {id:1,place:'Taj Mahal',arrive:'2026-01-15',hotel:'Hotel Tajview',nights:2,price:6000,travelMode:'Train',travelType:'Family',notes:'Request early check-in if possible.'},
    {id:2,place:'Agra Fort',arrive:'2026-01-17',hotel:'Fort Stay',nights:1,price:2200,travelMode:'Car',travelType:'Friends',notes:'Guide recommended for the fort.'}
  ];
  saveJourney(sample); renderJourney(); updateBudgetFromData(); renderProfile(); renderDashboardPreview();
}




/* ===== FAKE PAYMENT SYSTEM ===== */

let razorpayLoadPromise = null;
let razorpayKeyCache = null;

async function ensureRazorpay(){
  if(window.Razorpay) return true;
  if(razorpayLoadPromise) return razorpayLoadPromise;
  razorpayLoadPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve(true);
    s.onerror = () => reject(new Error('Razorpay failed to load'));
    document.head.appendChild(s);
  });
  return razorpayLoadPromise;
}

async function getRazorpayKey(){
  if(razorpayKeyCache && razorpayKeyCache.keyId) return razorpayKeyCache;
  razorpayKeyCache = await apiFetch('/api/payments/razorpay/key');
  return razorpayKeyCache;
}

async function createBookingAndPay(payload){
  try{
    const bookingRes = await apiFetch('/api/bookings', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    const bookingId = bookingRes.bookingId;
    window.currentBookingId = bookingId;
    const bookings = getBookings();
    bookings.unshift({ id: bookingId, ...payload, paymentStatus: 'pending' });
    localStorage.setItem('atg_bookings', JSON.stringify(bookings));
    renderHotelBookings();
    if(USE_FAKE_PAYMENT){
      window.selectedBooking = payload;
      openFakePayment();
    } else {
      await startRazorpayCheckout(bookingId, payload);
    }
  }catch(e){
    console.error('Booking creation error:', e);
    alert('Booking failed: ' + e.message);
  }
}

async function startRazorpayCheckout(bookingId, payload){
  await ensureRazorpay();
  const [keyData, order] = await Promise.all([
    getRazorpayKey(),
    apiFetch('/api/payments/razorpay/order', {
      method: 'POST',
      body: JSON.stringify({ bookingId })
    })
  ]);

  const options = {
    key: keyData.keyId,
    amount: order.amount,
    currency: order.currency || 'INR',
    name: 'AI Tour Guide',
    description: `Hotel Booking - ${payload.hotelName}`,
    order_id: order.orderId,
    handler: async function (response){
      try{
        await apiFetch('/api/payments/razorpay/verify', {
          method: 'POST',
          body: JSON.stringify({
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
            bookingId
          })
        });
        alert('Payment successful!');
        await syncUserDataFromDb();
        renderAll();
      }catch(e){
        console.error('Payment verify error:', e);
        alert('Payment verification failed: ' + e.message);
      }
    },
    theme: { color: '#0f766e' }
  };
  const rzp = new Razorpay(options);
  rzp.on('payment.failed', function () {
    alert('Payment failed or cancelled.');
  });
  rzp.open();
}

function openFakePayment(){
  const box = document.getElementById("fakePaymentBox");
  if(box) box.style.display="flex";
}

function closeFakePayment(){
  const box = document.getElementById("fakePaymentBox");
  if(box) box.style.display="none";
}

function completeFakePayment(){
  closeFakePayment();

  const b = window.selectedBooking || {
    hotelName: "Hotel Demo",
    place: "Demo Place",
    city: "Demo Address, India",
    type: "normal",
    typeLabel: "Selected Room",
    days: 1,
    rooms: 1,
    perDay: 0,
    total: Number(window.selectedTotal || 0)
  };

  const bookingId = window.currentBookingId;
  if(bookingId){
    apiFetch(`/api/bookings/${bookingId}/mark-paid`, { method:'POST' })
      .then(async ()=>{
        await syncUserDataFromDb();
        renderAll();
      })
      .catch(e=>console.error('Mark paid error:', e));
  }

  if(typeof downloadReceiptPDF === 'function'){
    downloadReceiptPDF({ hotel: b.hotelName, place: b.place, type: b.typeLabel, days: b.days, total: b.total });
  }

  alert("Payment Successful!");
}



function openReceipt(data){
  const box = document.getElementById("receiptBox");
  const content = document.getElementById("receiptContent");

  content.innerHTML = `
    <p><b>Hotel:</b> ${data.hotel}</p>
    <p><b>Place:</b> ${data.place}</p>
    <p><b>Room Type:</b> ${data.type}</p>
    <p><b>Days:</b> ${data.days}</p>
    <p><b>Total Paid:</b> \u20B9${data.total}</p>
    <p><b>Date:</b> ${new Date().toLocaleString()}</p>
  `;

  box.style.display = "flex";
}

function closeReceipt(){
  document.getElementById("receiptBox").style.display="none";
}





/* ---------- Budget ---------- */
function setBudget(){
  const v = Number(document.getElementById('totalBudget').value || 0);
  if(v <= 0){ alert('Enter a valid budget > 0'); return; }
  localStorage.setItem('atg_budget_total', v);
  renderBudget();
  alert('Budget set');
}

function renderBudget(){
  const total = Number(localStorage.getItem('atg_budget_total')||0);
  const journey = getJourney();
  const expenses = journey.reduce((s,x)=>s + (Number(x.price)||0), 0);
  const totalNights = journey.reduce((s,x)=>s + (Number(x.nights)||0),0);
  const itineraryObj = getItinerary();
  const itineraryDays = (Object.keys(itineraryObj).length) ? Math.max(...Object.keys(itineraryObj).map(Number)) : 0;
  let tripDays = totalNights || itineraryDays || Math.max(1, Math.ceil(journey.length || 1));
  tripDays = Math.max(1, tripDays);
  const estimateOtherPerDay = 1500;
  const estimateOther = tripDays * estimateOtherPerDay;
  const remaining = total ? (total - expenses) : null;
  const perDayAvailable = (remaining !== null) ? Math.floor(remaining / tripDays) : null;
  const remainingAfterOther = (remaining !== null) ? (remaining - estimateOther) : null;
  const statusEl = document.getElementById('budgetStatus');
  const adviceEl = document.getElementById('budgetAdvice');
  if(!statusEl || !adviceEl) return;
  if(!total){
    statusEl.textContent = 'Remaining: - (set a total budget above)';
    adviceEl.innerHTML = `<div>Please set your total trip budget to receive tailored advice.</div>`;
    return;
  }
  statusEl.textContent = `Remaining after hotel expenses: \u20B9${remaining} (spent on hotels: \u20B9${expenses}) â€” Trip days: ${tripDays}`;
  const alloc = {
    food: Math.round((perDayAvailable || 0) * 0.30),
    transport: Math.round((perDayAvailable || 0) * 0.25),
    attractions: Math.round((perDayAvailable || 0) * 0.20),
    misc: Math.round((perDayAvailable || 0) * 0.25)
  };
  let advice = `<div><strong>Estimated other expenses (baseline):</strong> \u20B9${estimateOther} (\u20B9${estimateOtherPerDay}/day Ã— ${tripDays} days)</div>`;
  advice += `<div style="margin-top:6px"><strong>Approx. daily available for "other" (food/transport/attractions):</strong> \u20B9${perDayAvailable} / day</div>`;
  advice += `<div style="margin-top:8px"><strong>Suggested allocation per day:</strong><div class="small-muted">Food: \u20B9${alloc.food} â€¢ Transport: \u20B9${alloc.transport} â€¢ Attractions: \u20B9${alloc.attractions} â€¢ Misc: \u20B9${alloc.misc}</div></div>`;
  if(remainingAfterOther < 0){
    advice += `<div style="margin-top:8px;color:#991b1b"><strong>Warning:</strong> your budget is insufficient by \u20B9${Math.abs(remainingAfterOther)} to cover the baseline daily expenses. Suggestions:</div>`;
    advice += `<ul style="margin-top:6px">
      <li>Reduce hotel costs â€” choose cheaper hotels or fewer nights (save ~\u20B92000â€“\u20B95000 depending on hotel).</li>
      <li>Cut daily spends: reduce dining or skip paid attractions to save \u20B9${Math.abs(remainingAfterOther)}.</li>
      <li>Increase total budget if possible.</li>
      <li>Book shared transport or economy options.</li>
    </ul>`;
  } else {
    advice += `<div style="margin-top:8px;color:#065f46"><strong>Good:</strong> you have an estimated surplus of \u20B9${remainingAfterOther} after baseline daily costs. Consider allocating extra to souvenirs or a nicer hotel one night.</div>`;
  }
  const hotelSharePct = total ? Math.round((expenses/total)*100) : 0;
  advice += `<div style="margin-top:8px" class="small-muted">Hotel costs are ~${hotelSharePct}% of your total budget.</div>`;
  adviceEl.innerHTML = advice;
}

function updateBudgetFromData(){ renderBudget(); }

/* ---------- Time manager (visits) ---------- */
function addVisit(){
  const place = document.getElementById('visitPlace').value.trim() || 'Place';
  const dt = document.getElementById('visitDT').value;
  const dur = Number(document.getElementById('visitDur').value || 60);
  if(!dt){ alert('Choose date & time'); return; }
  const visits = JSON.parse(localStorage.getItem('atg_visits')||'[]');
  const start = new Date(dt);
  const end = new Date(start.getTime() + dur*60000);
  const overlap = visits.some(v=>{
    const s = new Date(v.start); const e = new Date(s.getTime() + v.duration*60000);
    return (start < e && end > s);
  });
  if(overlap && !confirm('This visit overlaps existing one. Add anyway?')) return;
  visits.push({id:Date.now(),place,start: start.toISOString(),duration:dur});
  localStorage.setItem('atg_visits', JSON.stringify(visits));
  renderVisits();
  renderProfile();
  renderDashboardPreview();
}

function renderVisits(){
  const visits = JSON.parse(localStorage.getItem('atg_visits')||'[]');
  const el = document.getElementById('visitList');
  if(!el) return;
  if(!visits.length){ el.textContent = 'No visits yet.'; return; }
  visits.sort((a,b)=> new Date(a.start)-new Date(b.start));
  el.innerHTML = visits.map(v => {
    const sd = new Date(v.start);
    return `<div style="margin-bottom:8px"><strong>${v.place}</strong> â€” ${sd.toLocaleString()} for ${v.duration} mins</div>`;
  }).join('');
}

/* ---------- Daily Itinerary (new) ---------- */
function getItinerary(){ return JSON.parse(localStorage.getItem('atg_itinerary')||'{}'); }
function saveItinerary(obj){ localStorage.setItem('atg_itinerary', JSON.stringify(obj)); }

function addItinerary(){
  const day = Number(document.getElementById('itDay').value || 1);
  const act = document.getElementById('itActivity').value.trim();
  if(!act){ alert('Enter an activity'); return; }
  const obj = getItinerary();
  if(!obj[day]) obj[day] = [];
  obj[day].push({id:Date.now(), activity: act});
  saveItinerary(obj);
  document.getElementById('itActivity').value = '';
  renderItinerary();
  renderProfile();
  renderDashboardPreview();
}

function renderItinerary(){
  const obj = getItinerary();
  const container = document.getElementById('itineraryContainer');
  container.innerHTML = '';
  if(Object.keys(obj).length===0){ container.innerHTML = '<div class="small-muted">No itinerary days yet.</div>'; return; }
  Object.keys(obj).sort((a,b)=>a-b).forEach(day=>{
    const activities = obj[day];
    const div = document.createElement('div');
    div.className = 'itinerary-day';
    div.innerHTML = `<strong>Day ${day}</strong><div style="margin-top:8px">${activities.map(a=>`<div style="display:flex;justify-content:space-between;margin-bottom:6px"><div>${escapeHtml(a.activity)}</div><div><button onclick="removeIt(${day},${a.id})" class="mini">Remove</button></div></div>`).join('')}</div>`;
    container.appendChild(div);
  });
}

function removeIt(day,id){
  const obj = getItinerary();
  if(!obj[day]) return;
  obj[day] = obj[day].filter(a=>a.id !== id);
  if(obj[day].length===0) delete obj[day];
  saveItinerary(obj);
  renderItinerary();
  renderProfile();
  renderDashboardPreview();
}

function exportItinerary(){
  const data = JSON.stringify(getItinerary(), null, 2);
  const blob = new Blob([data], {type:'application/json'}); const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'itinerary.json'; a.click(); URL.revokeObjectURL(url);
}
function clearItinerary(){ if(confirm('Clear itinerary?')){ saveItinerary({}); renderItinerary(); renderProfile(); renderDashboardPreview(); } }

/* ---------- Export (JSON) ---------- */
function exportJourney(){
  const data = JSON.stringify(getJourney(), null, 2);
  const blob = new Blob([data], {type:'application/json'}); const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'journey.json'; a.click(); URL.revokeObjectURL(url);
}

/* Export user profile/data */
function exportUserData(){
  const user = window.user || {name:'Guest',email:''};
  const payload = {
    user,
    journey: getJourney(),
    bookings: getBookings(),
    itinerary: getItinerary(),
    visits: JSON.parse(localStorage.getItem('atg_visits')||'[]')
  };
  const data = JSON.stringify(payload, null, 2);
  const blob = new Blob([data], {type:'application/json'}); const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'ai-tourguide-profile.json'; a.click(); URL.revokeObjectURL(url);
}

/* ---------- Bookings helpers ---------- */
function getBookings(){ return JSON.parse(localStorage.getItem('atg_bookings')||'[]'); }
function clearBookings(){ if(confirm('Clear all bookings?')){ localStorage.removeItem('atg_bookings'); renderAll(); } }

function openBookingsPage(){
  showPage("hotelBookingsPage");
  syncUserDataFromDb().then(()=> renderHotelBookings());
}



function renderHotelBookings(){
  const list = document.getElementById("hotelBookingsList");
  const bookings = getBookings();

  if(!bookings.length){
    list.innerHTML = "No bookings yet.";
    return;
  }

  list.innerHTML = bookings.map(b => `
    <div style="background:#fff;padding:15px;margin-bottom:10px;border-radius:10px">
      <h3>${b.hotelName}</h3>
      <div>ðŸ“ ${b.hotelAddress || "Demo Address, India"}</div>
      <div>ðŸ—“ï¸ Days: ${b.days}</div>
      <div>Total: \u20B9${b.total}</div>
      <div style="color:${(b.paymentStatus||'pending')==='paid'?'green':'#b45309'};font-weight:bold">
        ${(b.paymentStatus||'pending')==='paid'?'âœ… Payment Done':'â³ Payment Pending'}
      </div>
      ${b.paidAt ? `<div>ðŸ•’ Paid At: ${formatDate(b.paidAt)}</div>` : ''}
    </div>
  `).join("");
}

function formatDate(value){
  if(!value) return '-';
  const d = (typeof value === 'string') ? new Date(value) : (value.toDate ? value.toDate() : new Date(value));
  if(isNaN(d.getTime())) return '-';
  return d.toLocaleString();
}

async function renderAdminPage(){
  const meta = document.getElementById('adminMeta');
  const usersEl = document.getElementById('adminUsers');
  const detailsEl = document.getElementById('adminUserDetails');
  const bookingsEl = document.getElementById('adminBookings');
  const journeysEl = document.getElementById('adminJourneys');
  if(!usersEl || !bookingsEl || !journeysEl) return;
  if(!window.isAdmin){
    if(meta) meta.textContent = 'Admin access required.';
    usersEl.innerHTML = '';
    if(detailsEl) detailsEl.innerHTML = '';
    bookingsEl.innerHTML = '';
    journeysEl.innerHTML = '';
    return;
  }
  if(meta) meta.textContent = 'Loading...';
  try{
    const data = await apiFetch('/api/admin/overview');
    const bookings = data.bookings || [];
    const journeys = data.journeys || [];
    const users = data.users || [];
    window.adminData = { users, bookings, journeys };
    if(meta) meta.textContent = `Updated ${new Date().toLocaleString()} â€¢ ${users.length} users â€¢ ${bookings.length} bookings â€¢ ${journeys.length} journeys`;

    if(!users.length){
      usersEl.innerHTML = '<div class="small-muted">No users found.</div>';
    } else {
      usersEl.innerHTML = `
        <table class="admin-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Bookings</th>
              <th>Journeys</th>
              <th>Last Booking</th>
              <th>Last Paid</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            ${users.map(u => `
              <tr data-uid="${escapeHtml(u.id)}">
                <td>${escapeHtml(u.name || '-')}</td>
                <td>${escapeHtml(u.email || '-')}</td>
                <td>${escapeHtml(u.phone || '-')}</td>
                <td>${u.bookings || 0}</td>
                <td>${u.journeys || 0}</td>
                <td>
                  <span class="admin-badge ${u.lastBookingStatus==='paid'?'admin-paid':(u.lastBookingStatus==='pending'?'admin-pending':'')}">
                    ${u.lastBookingStatus || 'none'}
                  </span>
                  ${u.lastBookingTotal ? ` â€¢ \u20B9${u.lastBookingTotal}` : ''}
                </td>
                <td>${formatDate(u.lastPaidAt)}</td>
                <td>${formatDate(u.createdAt)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }

    if(detailsEl) detailsEl.innerHTML = 'Select a user to view full booking and journey history.';

    if(!bookings.length){
      bookingsEl.innerHTML = '<div class="small-muted">No bookings found.</div>';
    } else {
      bookingsEl.innerHTML = `
        <table class="admin-table">
          <thead>
            <tr>
              <th>Hotel</th>
              <th>Place</th>
              <th>User</th>
              <th>Total</th>
              <th>Status</th>
              <th>Paid At</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            ${bookings.map(b => `
              <tr>
                <td>${escapeHtml(b.hotelName||'')}</td>
                <td>${escapeHtml(b.place||'')}</td>
                <td>${escapeHtml(b.userEmail||b.userId||'')}</td>
                <td>\u20B9${b.total||0}</td>
                <td>
                  <span class="admin-badge ${(b.paymentStatus||'pending')==='paid'?'admin-paid':'admin-pending'}">
                    ${(b.paymentStatus||'pending')==='paid'?'Paid':'Pending'}
                  </span>
                </td>
                <td>${formatDate(b.paidAt)}</td>
                <td>${formatDate(b.createdAt)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }

    if(!journeys.length){
      journeysEl.innerHTML = '<div class="small-muted">No journeys found.</div>';
    } else {
      journeysEl.innerHTML = `
        <table class="admin-table">
          <thead>
            <tr>
              <th>Place</th>
              <th>User</th>
              <th>Arrive</th>
              <th>Hotel</th>
              <th>Nights</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            ${journeys.map(j => `
              <tr>
                <td>${escapeHtml(j.place||'')}</td>
                <td>${escapeHtml(j.userEmail||j.userId||'')}</td>
                <td>${escapeHtml(j.arrive||'-')}</td>
                <td>${escapeHtml(j.hotel||'-')}</td>
                <td>${j.nights||1}</td>
                <td>${formatDate(j.createdAt)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }

    if(usersEl){
      usersEl.querySelectorAll('tr[data-uid]').forEach(row => {
        row.addEventListener('click', () => {
          usersEl.querySelectorAll('tr[data-uid]').forEach(r => r.classList.remove('admin-row-active'));
          row.classList.add('admin-row-active');
          renderAdminUserDetails(row.getAttribute('data-uid'));
        });
      });
    }
  }catch(e){
    console.error('Admin render error:', e);
    if(meta) meta.textContent = 'Failed to load admin data.';
    bookingsEl.innerHTML = '<div class="small-muted">Error loading bookings.</div>';
    journeysEl.innerHTML = '<div class="small-muted">Error loading journeys.</div>';
  }
}

function renderAdminUserDetails(uid){
  const detailsEl = document.getElementById('adminUserDetails');
  if(!detailsEl || !window.adminData) return;
  const { users, bookings, journeys } = window.adminData;
  const user = (users || []).find(u => String(u.id) === String(uid));
  if(!user){
    detailsEl.innerHTML = '<div class="small-muted">User not found.</div>';
    return;
  }
  const userBookings = (bookings || []).filter(b => String(b.userId) === String(uid));
  const userJourneys = (journeys || []).filter(j => String(j.userId) === String(uid));

  const bookingsHtml = userBookings.length ? `
    <table class="admin-table">
      <thead>
        <tr>
          <th>Hotel</th>
          <th>Place</th>
          <th>Total</th>
          <th>Status</th>
          <th>Paid At</th>
          <th>Created</th>
        </tr>
      </thead>
      <tbody>
        ${userBookings.map(b => `
          <tr>
            <td>${escapeHtml(b.hotelName||'')}</td>
            <td>${escapeHtml(b.place||'')}</td>
            <td>\u20B9${b.total||0}</td>
            <td>
              <span class="admin-badge ${(b.paymentStatus||'pending')==='paid'?'admin-paid':'admin-pending'}">
                ${(b.paymentStatus||'pending')==='paid'?'Paid':'Pending'}
              </span>
            </td>
            <td>${formatDate(b.paidAt)}</td>
            <td>${formatDate(b.createdAt)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  ` : `<div class="small-muted">No bookings for this user.</div>`;

  const journeysHtml = userJourneys.length ? `
    <table class="admin-table">
      <thead>
        <tr>
          <th>Place</th>
          <th>Arrive</th>
          <th>Hotel</th>
          <th>Nights</th>
          <th>Created</th>
        </tr>
      </thead>
      <tbody>
        ${userJourneys.map(j => `
          <tr>
            <td>${escapeHtml(j.place||'')}</td>
            <td>${escapeHtml(j.arrive||'-')}</td>
            <td>${escapeHtml(j.hotel||'-')}</td>
            <td>${j.nights||1}</td>
            <td>${formatDate(j.createdAt)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  ` : `<div class="small-muted">No journeys for this user.</div>`;

  detailsEl.innerHTML = `
    <div><strong>${escapeHtml(user.name || '-')}</strong> â€¢ ${escapeHtml(user.email || '-')} â€¢ ${escapeHtml(user.phone || '-')}</div>
    <div style="margin-top:8px">
      <div><strong>Booking History</strong></div>
      ${bookingsHtml}
    </div>
    <div style="margin-top:12px">
      <div><strong>Journey History</strong></div>
      ${journeysHtml}
    </div>
  `;
}

/* ---------- Generate PDF (includes bookings) ---------- */
function generatePDF(){
  const journey = getJourney();
  if(!journey.length){ alert('No saved journey items to generate PDF.'); return; }
  const visits = JSON.parse(localStorage.getItem('atg_visits')||'[]');
  const itinerary = getItinerary();
  const bookings = getBookings();
  let html = `<!doctype html><html><head><meta charset="utf-8"><title>Trip Itinerary</title>
    <style>

      body{font-family:Arial,Helvetica,sans-serif;color:#0b1320;margin:20px}
      .header{display:flex;align-items:center;gap:12px}
      .banner{height:120px;width:120px;object-fit:cover;border-radius:8px}
      h1{margin:0 0 6px 0}
      .section{margin-top:14px}
      .place{display:flex;gap:12px;margin-bottom:12px}
      .place img{width:140px;height:90px;object-fit:cover;border-radius:6px}
      .meta{font-size:13px;color:#374151}
      .notes{font-size:13px;color:#374151;background:#f8fafc;padding:8px;border-radius:6px;border:1px solid #eef6ff}
      .small{font-size:12px;color:#6b7280}
      table{border-collapse:collapse;width:100%}
      th,td{border:1px solid #e6eef8;padding:8px;text-align:left}
      @media print{ body{margin:10mm} .no-print{display:none} }
    </style>
    </head><body>
    <div class="header">
      <img class="banner" src="${PLACE_META[journey[0].place] ? PLACE_META[journey[0].place].image : ''}" alt="banner">
      <div>
        <h1>Trip Itinerary</h1>
        <div class="small">Generated: ${new Date().toLocaleString()}</div>
      </div>
    </div>
    <div class="section"><strong>Traveler:</strong> ${escapeHtml((window.user && window.user.name) || 'Guest')} â€” <span class="small">${escapeHtml((window.user && window.user.email) || '')}</span></div>
  `;

  // Bookings summary
  html += `<div class="section"><h2>Bookings</h2>`;
  if(!bookings.length) html += `<div class="small-muted">No bookings made.</div>`;
  else {
    html += `<table><thead><tr><th>Hotel</th><th>Place</th><th>Type</th><th>Days</th><th>Rooms</th><th>Per day</th><th>Total</th></tr></thead><tbody>`;
    bookings.forEach(b => {
      html += `<tr><td>${escapeHtml(b.hotelName)}</td><td>${escapeHtml(b.place)}</td><td>${escapeHtml(b.typeLabel)}</td><td>${b.days}</td><td>${b.rooms}</td><td>\u20B9${b.perDay}</td><td>\u20B9${b.total}</td></tr>`;
    });
    html += `</tbody></table>`;
  }
  html += `</div>`;

  // planned visits / journey
  html += `<div class="section"><h2>Planned Visits</h2>`;
  journey.forEach(it=>{
    const pm = PLACE_META[it.place] || {};
    html += `<div class="place"><img src="${pm.image || ''}" loading="lazy">
alt="${escapeHtml(it.place)}"><div><strong>${escapeHtml(it.place)}</strong><div class="meta">Arrive: ${it.arrive || '-'} | Travel: ${escapeHtml(it.travelMode||'â€”')} | Type: ${escapeHtml(translateTravelType(it.travelType||'Solo'))} | Hotel: ${escapeHtml(it.hotel)} | Nights: ${it.nights} | \u20B9${it.price}</div><div style="margin-top:6px">${escapeHtml(pm.info || '')}</div>
      ${it.notes ? `<div style="margin-top:8px" class="notes"><strong>Notes:</strong> ${escapeHtml(it.notes)}</div>` : ''}
    </div></div>`;
  });
  html += `</div>`;

  // visits
  html += `<div class="section"><h2>Scheduled Visits</h2>`;
  if(visits.length===0) html += `<div class="small-muted">No scheduled visits.</div>`;
  else {
    visits.sort((a,b)=>new Date(a.start)-new Date(b.start));
    visits.forEach(v=>{
      const sd = new Date(v.start);
      html += `<div style="margin-bottom:8px"><strong>${escapeHtml(v.place)}</strong> â€” ${sd.toLocaleString()} for ${v.duration} mins</div>`;
    });
  }
  html += `</div>`;

  // daily itinerary
  html += `<div class="section"><h2>Daily Itinerary</h2>`;
  if(Object.keys(itinerary).length===0) html += `<div class="small-muted">No daily itinerary added.</div>`;
  else {
    Object.keys(itinerary).sort((a,b)=>a-b).forEach(day=>{
      html += `<div style="margin-top:8px"><strong>Day ${day}</strong><ul>`;
      itinerary[day].forEach(act=>{
        html += `<li>${escapeHtml(act.activity)}</li>`;
      });
      html += `</ul></div>`;
    });
  }
  html += `</div>`;

  html += `<div class="section small muted">This itinerary was generated by AI Tour Guide demo. Verify local opening times and ticket requirements before travel.</div>`;

  html += `<div style="margin-top:18px" class="no-print"><button onclick="window.print()" style="padding:10px 14px;border-radius:8px;background:#111;color:#fff;border:none;cursor:pointer">Print / Save as PDF</button> <button onclick="window.close()" style="padding:10px 14px;border-radius:8px;border:1px solid #e6eef8;background:#fff;cursor:pointer">Close</button></div>`;

  html += `</body></html>`;

  const w = window.open('', '_blank', 'toolbar=0,location=0,menubar=0');
  if(!w){ alert('Popup blocked. Allow popups for this site to generate PDF.'); return; }
  w.document.open();
  w.document.write(html);
  w.document.close();
  setTimeout(()=>{ try{ w.focus(); }catch(e){} }, 250);
}

/* ---------- Multi-language ---------- */
const I18N = {
  en: {
    title: 'AI Tour Guide - Demo',
    nav_home: 'Home',
    nav_create_journey: 'Create Journey',
    nav_ai_planner: 'AI Planner',
    nav_hotels: 'Hotels',
    nav_hotel_bookings: 'Hotel Bookings',
    nav_profile: 'Profile',
    nav_achievements: 'Achievements',
    nav_admin: 'Admin',
    nav_logout: 'Logout',
    nav_multilang: 'Multi-language',
    login_title: 'Welcome back',
    login_subtitle: 'Login to your AI Tour Guide account',
    login_btn: 'Login',
    register_btn: 'Register',
    register_title: 'Create account',
    back_btn: 'Back',
    journey_title: 'Create Your Journey',
    choose_place: 'Choose place',
    arrival_date: 'Arrival date',
    travel_mode: 'Travel mode',
    travel_type: 'Travel type',
    hotel_name: 'Hotel name',
    nights: 'Number of nights',
    est_price: 'Estimated hotel price (total)',
    notes_optional: 'Notes (optional)',
    add_journey: 'Add to Journey',
    export_json: 'Export JSON',
    generate_pdf: 'Generate PDF',
    journey_plan: 'Your Journey Plan',
    load_sample: 'Load sample',
    clear: 'Clear',
    ai_title: 'AI Trip Planner',
    select_month: 'Select Month',
    budget: 'Budget',
    days: 'Days',
    generate_ai_plan: 'Generate AI Plan',
    travel_solo: 'Solo',
    travel_family: 'Family',
    travel_friends: 'Friends',
    month_january: 'January',
    month_february: 'February',
    month_march: 'March',
    month_april: 'April',
    month_may: 'May',
    month_june: 'June',
    month_july: 'July',
    month_august: 'August',
    month_september: 'September',
    month_october: 'October',
    month_november: 'November',
    month_december: 'December',
    ph_hotel_name: 'Hotel / Guesthouse',
    ph_hotel_price: 'e.g., 4500',
    ph_notes: 'Any notes for this journey item (e.g., room preferences, contact info)'
  },
  hi: {
    title: '??? ??? ???? - ????',
    nav_home: '???',
    nav_create_journey: '?????? ?????',
    nav_ai_planner: '??? ??????',
    nav_hotels: '????',
    nav_hotel_bookings: '???? ??????',
    nav_profile: '????????',
    nav_achievements: '??????????',
    nav_admin: '?????',
    nav_logout: '??????',
    nav_multilang: '???????',
    login_title: '????? ?? ?????? ??',
    login_subtitle: '???? ??? ??? ???? ???? ??? ????? ????',
    login_btn: '?????',
    register_btn: '???????',
    register_title: '???? ?????',
    back_btn: '????',
    journey_title: '???? ?????? ?????',
    choose_place: '????? ?????',
    arrival_date: '???? ????',
    travel_mode: '?????? ?? ??????',
    travel_type: '?????? ??????',
    hotel_name: '???? ???',
    nights: '????? ?? ??????',
    est_price: '???????? ???? ???? (???)',
    notes_optional: '????? (????????)',
    add_journey: '?????? ??? ??????',
    export_json: 'JSON ??????? ????',
    generate_pdf: 'PDF ?????',
    journey_plan: '???? ?????? ?????',
    load_sample: '????? ??? ????',
    clear: '??? ????',
    ai_title: '??? ????? ??????',
    select_month: '????? ?????',
    budget: '???',
    days: '???',
    generate_ai_plan: '??? ????? ?????',
    travel_solo: '???',
    travel_family: '??????',
    travel_friends: '?????',
    month_january: '?????',
    month_february: '?????',
    month_march: '?????',
    month_april: '??????',
    month_may: '??',
    month_june: '???',
    month_july: '?????',
    month_august: '?????',
    month_september: '??????',
    month_october: '???????',
    month_november: '?????',
    month_december: '??????',
    ph_hotel_name: '???? / ?????????',
    ph_hotel_price: '????, 4500',
    ph_notes: '?? ?????? ???? ?? ??? ????? (????, ??? ????, ?????? ???????)'
  },
  mr: {
    title: '??? ??? ???? - ????',
    nav_home: '??????????',
    nav_create_journey: '?????? ???? ???',
    nav_ai_planner: '??? ??????',
    nav_hotels: '???????',
    nav_hotel_bookings: '????? ??????',
    nav_profile: '????????',
    nav_achievements: '??',
    nav_admin: '??????',
    nav_logout: '??????',
    nav_multilang: '????????',
    login_title: '?????? ?????? ???',
    login_subtitle: '??????? ??? ??? ???? ??????? ????? ???',
    login_btn: '?????',
    register_btn: '??????',
    register_title: '???? ???? ???',
    back_btn: '????',
    journey_title: '????? ?????? ???? ???',
    choose_place: '????? ?????',
    arrival_date: '???? ??????',
    travel_mode: '?????? ?????',
    travel_type: '?????? ??????',
    hotel_name: '????? ???',
    nights: '????????? ??????',
    est_price: '?????? ????? ????? (????)',
    notes_optional: '????? (??????)',
    add_journey: '???????? ????',
    export_json: 'JSON ??????? ???',
    generate_pdf: 'PDF ???? ???',
    journey_plan: '????? ?????? ?????',
    load_sample: '????? ??? ???',
    clear: '??????',
    ai_title: '??? ????? ??????',
    select_month: '????? ?????',
    budget: '????',
    days: '????',
    generate_ai_plan: '??? ????? ???? ???',
    travel_solo: '????',
    travel_family: '??????',
    travel_friends: '?????',
    month_january: '????????',
    month_february: '??????????',
    month_march: '?????',
    month_april: '??????',
    month_may: '??',
    month_june: '???',
    month_july: '????',
    month_august: '?????',
    month_september: '????????',
    month_october: '???????',
    month_november: '?????????',
    month_december: '???????',
    ph_hotel_name: '????? / ?????????',
    ph_hotel_price: '???., 4500',
    ph_notes: '?? ??????????? ????? (???., ??? ?????, ?????? ??????)'
  },
  gu: {
    title: '??? ??? ???? - ????',
    nav_home: '???',
    nav_create_journey: '?????? ?????',
    nav_ai_planner: '??? ??????',
    nav_hotels: '???????',
    nav_hotel_bookings: '????? ????????',
    nav_profile: '????????',
    nav_achievements: '???????',
    nav_admin: '?????',
    nav_logout: '??????',
    nav_multilang: '???????',
    login_title: '??? ?????? ??',
    login_subtitle: '????? ??? ??? ???? ??????? ????? ???',
    login_btn: '?????',
    register_btn: '???????',
    register_title: '????? ?????',
    back_btn: '????',
    journey_title: '????? ?????? ?????',
    choose_place: '???? ???? ???',
    arrival_date: '???? ?????',
    travel_mode: '?????? ???',
    travel_type: '?????? ??????',
    hotel_name: '????? ???',
    nights: '?????? ??????',
    est_price: '??????? ????? ????? (???)',
    notes_optional: '????? (????????)',
    add_journey: '????????? ?????',
    export_json: 'JSON ????????? ???',
    generate_pdf: 'PDF ?????',
    journey_plan: '????? ?????? ?????',
    load_sample: '????? ??? ???',
    clear: '??? ???',
    ai_title: '??? ????? ??????',
    select_month: '????? ???? ???',
    budget: '????',
    days: '????',
    generate_ai_plan: '??? ????? ?????',
    travel_solo: '????',
    travel_family: '??????',
    travel_friends: '??????',
    month_january: '?????????',
    month_february: '?????????',
    month_march: '?????',
    month_april: '??????',
    month_may: '??',
    month_june: '???',
    month_july: '?????',
    month_august: '?????',
    month_september: '?????????',
    month_october: '???????',
    month_november: '???????',
    month_december: '????????',
    ph_hotel_name: '????? / ?????????',
    ph_hotel_price: '??? ??, 4500',
    ph_notes: '? ?????? ???? ???? ????? (??? ??, ??? ??????, ?????? ??????)'
  },
  ta: {
    title: '?? ???? ?????? - ????',
    nav_home: '???????',
    nav_create_journey: '??????? ?????????',
    nav_ai_planner: '?? ?????????',
    nav_hotels: '??????????',
    nav_hotel_bookings: '??????? ????????????',
    nav_profile: '?????????',
    nav_achievements: '????????',
    nav_admin: '???????',
    nav_logout: '????????',
    nav_multilang: '???????',
    login_title: '???????? ????????????',
    login_subtitle: '?????? ?? ???? ?????? ???????? ????????',
    login_btn: '???????',
    register_btn: '????? ????',
    register_title: '?????? ?????????',
    back_btn: '????????',
    journey_title: '?????? ??????? ??????????????',
    choose_place: '?????? ???????????',
    arrival_date: '????? ????',
    travel_mode: '??? ????',
    travel_type: '??? ???',
    hotel_name: '??????? ?????',
    nights: '???? ?????????',
    est_price: '?????????????? ??????? ????? (???????)',
    notes_optional: '??????????? (?????????)',
    add_journey: '????????? ????',
    export_json: 'JSON ????????',
    generate_pdf: 'PDF ?????????',
    journey_plan: '?????? ??? ???????',
    load_sample: '?????? ?????',
    clear: '???',
    ai_title: '?? ??? ?????????',
    select_month: '??????? ???????????',
    budget: '???????',
    days: '???????',
    generate_ai_plan: '?? ??????? ?????????',
    travel_solo: '??????',
    travel_family: '?????????',
    travel_friends: '?????????',
    month_january: '?????',
    month_february: '????????',
    month_march: '??????',
    month_april: '??????',
    month_may: '??',
    month_june: '????',
    month_july: '????',
    month_august: '??????',
    month_september: '??????????',
    month_october: '????????',
    month_november: '???????',
    month_december: '????????',
    ph_hotel_name: '??????? / ?????? ?????',
    ph_hotel_price: '?.??., 4500',
    ph_notes: '???? ???????????? ??????????? (?.??., ??? ?????????, ??????? ?????)'
  },
  bn: {
    title: '??? ????? ???? - ????',
    nav_home: '???',
    nav_create_journey: '????? ???? ????',
    nav_ai_planner: '??? ?????????',
    nav_hotels: '?????',
    nav_hotel_bookings: '????? ?????',
    nav_profile: '????????',
    nav_achievements: '?????',
    nav_admin: '????????',
    nav_logout: '?????',
    nav_multilang: '???????',
    login_title: '???? ???????',
    login_subtitle: '????? ??? ????? ???? ??????????? ???? ????',
    login_btn: '????',
    register_btn: '?????????',
    register_title: '?????????? ???? ????',
    back_btn: '???? ???',
    journey_title: '????? ????? ???? ????',
    choose_place: '????? ???????? ????',
    arrival_date: '?????? ?????',
    travel_mode: '????? ??????',
    travel_type: '??????? ???',
    hotel_name: '??????? ???',
    nights: '????? ??????',
    est_price: '???????? ????? ??? (???)',
    notes_optional: '??? (??????)',
    add_journey: '?????? ??? ????',
    export_json: 'JSON ?????????',
    generate_pdf: 'PDF ???? ????',
    journey_plan: '????? ????? ?????????',
    load_sample: '????? ???',
    clear: '?????',
    ai_title: '??? ????? ?????????',
    select_month: '??? ???????? ????',
    budget: '?????',
    days: '???',
    generate_ai_plan: '??? ????????? ???? ????',
    travel_solo: '????',
    travel_family: '??????',
    travel_friends: '???????',
    month_january: '?????????',
    month_february: '???????????',
    month_march: '?????',
    month_april: '??????',
    month_may: '??',
    month_june: '???',
    month_july: '?????',
    month_august: '?????',
    month_september: '??????????',
    month_october: '???????',
    month_november: '???????',
    month_december: '????????',
    ph_hotel_name: '????? / ?????????',
    ph_hotel_price: '????, 4500',
    ph_notes: '?? ??????? ???? ??? (????, ??? ?????, ????????? ????)'
  },
  fr: {
    title: 'Guide Tour IA - DÃ©mo',
    nav_home: 'Accueil',
    nav_create_journey: 'CrÃ©er un voyage',
    nav_ai_planner: 'Planificateur IA',
    nav_hotels: 'HÃ´tels',
    nav_hotel_bookings: 'RÃ©servations hÃ´tel',
    nav_profile: 'Profil',
    nav_achievements: 'RÃ©alisations',
    nav_admin: 'Admin',
    nav_logout: 'DÃ©connexion',
    nav_multilang: 'Multi-langue',
    login_title: 'Bon retour',
    login_subtitle: 'Connectez-vous Ã  votre compte AI Tour Guide',
    login_btn: 'Connexion',
    register_btn: "S'inscrire",
    register_title: 'CrÃ©er un compte',
    back_btn: 'Retour',
    journey_title: 'CrÃ©ez votre voyage',
    choose_place: 'Choisir un lieu',
    arrival_date: "Date d'arrivÃ©e",
    travel_mode: 'Mode de voyage',
    travel_type: 'Type de voyage',
    hotel_name: "Nom de l'hÃ´tel",
    nights: 'Nombre de nuits',
    est_price: 'Prix estimÃ© de lâ€™hÃ´tel (total)',
    notes_optional: 'Notes (optionnel)',
    add_journey: 'Ajouter au voyage',
    export_json: 'Exporter JSON',
    generate_pdf: 'GÃ©nÃ©rer PDF',
    journey_plan: 'Votre plan de voyage',
    load_sample: 'Charger un exemple',
    clear: 'Effacer',
    ai_title: 'Planificateur de voyage IA',
    select_month: 'Choisir le mois',
    budget: 'Budget',
    days: 'Jours',
    generate_ai_plan: 'GÃ©nÃ©rer le plan IA',
    travel_solo: 'Solo',
    travel_family: 'Famille',
    travel_friends: 'Amis',
    month_january: 'Janvier',
    month_february: 'FÃ©vrier',
    month_march: 'Mars',
    month_april: 'Avril',
    month_may: 'Mai',
    month_june: 'Juin',
    month_july: 'Juillet',
    month_august: 'AoÃ»t',
    month_september: 'Septembre',
    month_october: 'Octobre',
    month_november: 'Novembre',
    month_december: 'DÃ©cembre',
    ph_hotel_name: 'HÃ´tel / Maison dâ€™hÃ´tes',
    ph_hotel_price: 'ex., 4500',
    ph_notes: 'Notes pour cet Ã©lÃ©ment du voyage (ex. prÃ©fÃ©rences de chambre, contact)'
  },
  es: {
    title: 'GuÃ­a TurÃ­stica IA - Demo',
    nav_home: 'Inicio',
    nav_create_journey: 'Crear viaje',
    nav_ai_planner: 'Planificador IA',
    nav_hotels: 'Hoteles',
    nav_hotel_bookings: 'Reservas de hotel',
    nav_profile: 'Perfil',
    nav_achievements: 'Logros',
    nav_admin: 'Admin',
    nav_logout: 'Cerrar sesiÃ³n',
    nav_multilang: 'Multi-idioma',
    login_title: 'Bienvenido de nuevo',
    login_subtitle: 'Inicia sesiÃ³n en tu cuenta de AI Tour Guide',
    login_btn: 'Iniciar sesiÃ³n',
    register_btn: 'Registrarse',
    register_title: 'Crear cuenta',
    back_btn: 'AtrÃ¡s',
    journey_title: 'Crea tu viaje',
    choose_place: 'Elige lugar',
    arrival_date: 'Fecha de llegada',
    travel_mode: 'Modo de viaje',
    travel_type: 'Tipo de viaje',
    hotel_name: 'Nombre del hotel',
    nights: 'NÃºmero de noches',
    est_price: 'Precio estimado del hotel (total)',
    notes_optional: 'Notas (opcional)',
    add_journey: 'Agregar al viaje',
    export_json: 'Exportar JSON',
    generate_pdf: 'Generar PDF',
    journey_plan: 'Tu plan de viaje',
    load_sample: 'Cargar ejemplo',
    clear: 'Limpiar',
    ai_title: 'Planificador de viaje IA',
    select_month: 'Selecciona mes',
    budget: 'Presupuesto',
    days: 'DÃ­as',
    generate_ai_plan: 'Generar plan IA',
    travel_solo: 'Solo',
    travel_family: 'Familia',
    travel_friends: 'Amigos',
    month_january: 'Enero',
    month_february: 'Febrero',
    month_march: 'Marzo',
    month_april: 'Abril',
    month_may: 'Mayo',
    month_june: 'Junio',
    month_july: 'Julio',
    month_august: 'Agosto',
    month_september: 'Septiembre',
    month_october: 'Octubre',
    month_november: 'Noviembre',
    month_december: 'Diciembre',
    ph_hotel_name: 'Hotel / Casa de huÃ©spedes',
    ph_hotel_price: 'p. ej., 4500',
    ph_notes: 'Notas para este viaje (p. ej., preferencias de habitaciÃ³n, contacto)'
  }
};

function isCorruptedTranslation(value){
  if(typeof value !== 'string') return true;
  const compact = value.trim();
  if(!compact) return true;
  return /^[?\s.,:;'"()\-]+$/.test(compact);
}

function normalizeTranslations(){
  const fallback = I18N.en || {};
  ['hi', 'mr', 'gu', 'ta', 'bn'].forEach(lang => {
    const dict = I18N[lang];
    if(!dict) return;
    Object.keys(fallback).forEach(key => {
      if(isCorruptedTranslation(dict[key])){
        dict[key] = fallback[key];
      }
    });
  });
}

normalizeTranslations();

const MONTH_KEYS = {
  January: 'month_january',
  February: 'month_february',
  March: 'month_march',
  April: 'month_april',
  May: 'month_may',
  June: 'month_june',
  July: 'month_july',
  August: 'month_august',
  September: 'month_september',
  October: 'month_october',
  November: 'month_november',
  December: 'month_december'
};

function getCurrentMonthName(){
  return new Date().toLocaleString('en-US', { month: 'long' });
}

function syncAiMonthToCurrentMonth(){
  const select = document.getElementById('aiMonth');
  const currentMonth = getCurrentMonthName();
  if(!select) return currentMonth;
  const hasCurrentOption = Array.from(select.options).some(opt => opt.value === currentMonth);
  if(hasCurrentOption){
    select.value = currentMonth;
  }
  return select.value || currentMonth;
}

function t(key){
  const lang = window.currentLang || 'en';
  return (I18N[lang] && I18N[lang][key]) || I18N.en[key] || key;
}

function translateTravelType(v){
  if(v === 'Family') return t('travel_family');
  if(v === 'Friends') return t('travel_friends');
  return t('travel_solo');
}

function setText(id, key){
  const el = document.getElementById(id);
  if(el) el.textContent = t(key);
}

function setPlaceholder(id, key){
  const el = document.getElementById(id);
  if(el) el.placeholder = t(key);
}

function setSelectOptionByValue(selectId, value, key){
  const select = document.getElementById(selectId);
  if(!select) return;
  const opt = select.querySelector(`option[value="${value}"]`);
  if(opt) opt.textContent = t(key);
}

function applyLanguage(lang){
  window.currentLang = I18N[lang] ? lang : 'en';
  localStorage.setItem('atg_lang', window.currentLang);
  document.documentElement.lang = window.currentLang;
  document.title = t('title');

  setText('navHomeBtn', 'nav_home');
  setText('navJourneyBtn', 'nav_create_journey');
  setText('navPlannerBtn', 'nav_ai_planner');
  setText('navHotelsBtn', 'nav_hotels');
  setText('navHotelBookingsBtn', 'nav_hotel_bookings');
  setText('navProfileBtn', 'nav_profile');
  setText('navAchievementsBtn', 'nav_achievements');
  setText('navAdminBtn', 'nav_admin');
  setText('navLogoutBtn', 'nav_logout');
  setText('langToggleBtn', 'nav_multilang');

  setText('loginTitle', 'login_title');
  setText('loginSubtitle', 'login_subtitle');
  setText('loginBtn', 'login_btn');
  setText('gotoRegisterBtn', 'register_btn');
  setText('registerTitle', 'register_title');
  setText('registerBtn', 'register_btn');
  setText('registerBackBtn', 'back_btn');

  setText('journeyTitle', 'journey_title');
  setText('labelChoosePlace', 'choose_place');
  setText('labelArrivalDate', 'arrival_date');
  setText('labelTravelMode', 'travel_mode');
  setText('labelTravelType', 'travel_type');
  setText('labelHotelName', 'hotel_name');
  setText('labelNights', 'nights');
  setText('labelPrice', 'est_price');
  setText('labelNotes', 'notes_optional');
  setText('addJourneyBtn', 'add_journey');
  setText('exportJourneyBtn', 'export_json');
  setText('generatePdfBtn', 'generate_pdf');
  setText('journeyPlanTitle', 'journey_plan');
  setText('loadSampleBtn', 'load_sample');
  setText('clearJourneyBtn', 'clear');

  setText('aiPlannerTitle', 'ai_title');
  setText('aiMonthLabel', 'select_month');
  setText('aiBudgetLabel', 'budget');
  setText('aiDaysLabel', 'days');
  setText('aiGenerateBtn', 'generate_ai_plan');

  setPlaceholder('hotelName', 'ph_hotel_name');
  setPlaceholder('hotelPrice', 'ph_hotel_price');
  setPlaceholder('journeyNotes', 'ph_notes');

  setSelectOptionByValue('travelType', 'Solo', 'travel_solo');
  setSelectOptionByValue('travelType', 'Family', 'travel_family');
  setSelectOptionByValue('travelType', 'Friends', 'travel_friends');

  const monthSelect = document.getElementById('aiMonth');
  if(monthSelect){
    Array.from(monthSelect.options).forEach(opt=>{
      const key = MONTH_KEYS[opt.value];
      if(key) opt.textContent = t(key);
    });
  }

  const langSelect = document.getElementById('langSelect');
  if(langSelect) langSelect.value = window.currentLang;

  renderJourney();
}

function onLanguageChange(lang){
  applyLanguage(lang);
}

function toggleLanguageMenu(){
  const select = document.getElementById('langSelect');
  if(!select) return;
  select.style.display = (select.style.display === 'none' || !select.style.display) ? 'inline-block' : 'none';
}

function initLanguage(){
  const saved = localStorage.getItem('atg_lang') || 'en';
  applyLanguage(saved);
}

/* ---------- Render everything on page show ---------- */
function renderAll(){
  renderJourney(); renderVisits(); renderBudget(); renderProfile();
  renderItinerary();
  renderDashboardPreview();
  populateHotelFilter();
  applyImageFallbacks();
}

/* ---------- helper: update on load ---------- */
window.addEventListener('load', ()=>{
  if(window.user){ onLogin(); } else { showPage('landingPage'); }
  syncAiMonthToCurrentMonth();
  initLanguage();
  renderAll();
  startSlideshow();
  startSquareSlideshow();
  tryLoadHotelsJSON();
});

/* ---------- helpers ---------- */
function escapeHtml(str){
  if(!str) return '';
  return String(str).replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
}

/* ======= HOTEL FEATURES ======= */

/* ---------- Add styles for hotel page + UI polish ---------- */
(function injectStyles(){
  const css = `
  /* Hotel page styles */
  #hotelPage { display:none; }
  #hotelPage.active { display:block; }
  .hotel-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(260px,1fr)); gap:12px; margin-top:12px }
  .hotel-card { background:var(--card); border-radius:12px; padding:12px; box-shadow: var(--shadow); display:flex; gap:10px; align-items:flex-start }
  .hotel-thumb { width:120px;height:84px;object-fit:cover;border-radius:8px; flex-shrink:0 }
  .hotel-info { flex:1 }
  .hotel-title { font-weight:700; margin-bottom:4px }
  .hotel-meta { color:var(--muted); font-size:13px; margin-bottom:8px }
  .hotel-actions { display:flex; gap:8px; }
  .room-type { display:flex; gap:8px; align-items:center; margin-top:8px; }
  .room-type button { padding:6px 8px; border-radius:8px; border:1px solid rgba(11,19,32,0.06); background:transparent; cursor:pointer; }
  .room-type button.selected { border-color:var(--accent); background:rgba(59,130,246,0.08); }
  .book-panel { padding:12px; border-radius:10px; border:1px solid #eef6ff; background:#fcfeff; margin-top:12px }
  .modal-overlay { position:fixed; inset:0;background:rgba(2,6,23,0.45); display:flex; align-items:center; justify-content:center; z-index:10000 }
  .modal { width:560px; max-width:95%; background:var(--card); border-radius:12px; padding:16px; box-shadow:0 18px 40px rgba(2,6,23,0.25); }
  .hotel-filter { display:flex; gap:8px; margin-top:10px; align-items:center }
  .atg-badge { display:inline-block;padding:6px 10px;border-radius:999px;background:#eef6ff;color:var(--accent); font-weight:600; }
  `;
  const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s);
})();

/* ---------- Create the hotel page HTML (injected) ---------- */
(function injectHotelPage(){
  if(document.getElementById('hotelPage')) return; // already injected
  const html = `
    <div id="hotelPage" class="page">
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div>
            <h2 style="margin:0">Hotel Suggestions â€” Historical Places (India)</h2>
            <div class="small-muted" style="margin-top:6px">Select a place and click Search to view hotels (default: show 10 popular suggestions).</div>
          </div>
          <div>
            <button class="btn-ghost" onclick="showPage('homePage')">Back</button>
          </div>
        </div>

        <div class="hotel-filter">
          <select id="hotelPlaceFilter" style="min-width:220px">
            <option value="">-- Select place to view hotels --</option>
          </select>
          <input id="hotelSearch" placeholder="Search hotels or city" style="flex:1;padding:8px;border-radius:8px;border:1px solid #e6eef8" />
          <button class="primary" id="hotelSearchBtn">Search</button>
        </div>

        <div id="hotelGrid" class="hotel-grid"></div>
        <div id="hotelPageNote" class="small-muted" style="margin-top:10px">Showing 10 suggestions by default. Use the filter to view hotels for a specific place.</div>
      </div>
    </div>
  `;
  const profile = document.getElementById('profilePage');
  if(profile){ profile.insertAdjacentHTML('beforebegin', html); }
  else { document.querySelector('.wrap').insertAdjacentHTML('beforeend', html); }
})();

/* ---------- Room types ---------- */
const ROOM_TYPES = [
  {key:'lux', label:'Luxurious', mult:1.9, desc:'Spacious room with premium amenities'},
  {key:'normal', label:'Normal', mult:1.0, desc:'Standard comfortable room'},
  {key:'luggage', label:'Luggage-keeping', mult:0.35, desc:'Secure luggage-only service, no stay'}
];

/* ---------- Fallback images for hotels ---------- */
const HOTEL_FALLBACK_IMAGES = [
  "https://images.unsplash.com/photo-1533777324565-a040eb52fac2?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1560347876-aeef00ee58a1?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1551892589-865f69869472?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1505691723518-36a2b60b8a40?auto=format&fit=crop&w=1200&q=80"
];

/* ---------- Utility: slug ---------- */
function slug(s){ return String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,''); }

/* ---------- HOTELS array (will be loaded from hotels.json when available) ---------- */
let HOTELS = [];
let HOTELS_LOADED_FROM_JSON = false;

/* ---------- Try to fetch hotels.json from same server (non-blocking) ---------- */
function tryLoadHotelsJSON(){
  fetch('hotels.json', {cache: "no-store"}).then(r=>{
    if(!r.ok) throw new Error('no json');
    return r.json();
  }).then(data=>{
    if(Array.isArray(data) && data.length){
      HOTELS = data.map(h => {
        return {
          id: h.id || (slug(h.place||'') + '-' + Math.random().toString(36).slice(2,8)),
          name: h.name || (h.place + ' Hotel'),
          place: h.place || (h.name || 'Unknown'),
          city: h.city || '',
          image: h.image || HOTEL_FALLBACK_IMAGES[Math.floor(Math.random()*HOTEL_FALLBACK_IMAGES.length)],
          baseRate: Number(h.baseRate || h.baseRate === 0 ? h.baseRate : (1200 + Math.floor(Math.random()*300)))
        };
      });
      HOTELS_LOADED_FROM_JSON = true;
      populateHotelFilter();
      const grid = document.getElementById('hotelGrid');
      if(grid && document.getElementById('hotelPage') && document.getElementById('hotelPage').classList.contains('active')){
        renderHotels(HOTELS);
      }
    } else {
      buildHotelsFromPlaces();
    }
  }).catch(err=>{
    buildHotelsFromPlaces();
  });
}

/* ---------- Build hotels from PLACE_META if hotels.json not present ---------- */
function buildHotelsFromPlaces(){
  const places = Object.keys(window.PLACE_META || {});
  HOTELS = [];
  let idx = 0;
  places.forEach(place => {
    const pm = window.PLACE_META[place] || {};
    const cityMatch = (pm.info || '').match(/located in ([^,\.]+)/i);
    const city = cityMatch ? cityMatch[1].trim() : (pm.info || '').split(',')[0] || 'Unknown';

    const base = 1200 + (idx % 12) * 250;
    const img1 = HOTEL_FALLBACK_IMAGES[idx % HOTEL_FALLBACK_IMAGES.length];
    const img2 = HOTEL_FALLBACK_IMAGES[(idx+1) % HOTEL_FALLBACK_IMAGES.length];

    // create two hotels per place
    HOTELS.push({
      id: `${slug(place)}-01`,
      name: `${place} Grand Hotel`,
      place,
      city: city,
      image: pm.image || img1,
      baseRate: Math.round(base * 1.8)
    });
    HOTELS.push({
      id: `${slug(place)}-02`,
      name: `${place} Heritage Inn`,
      place,
      city: city,
      image: pm.image || img2,
      baseRate: Math.round(base * 1.0)
    });

    idx++;
  });

  populateHotelFilter();
}

/* ---------- Populate filter select (initial) ---------- */
function populateHotelFilter(){
  const sel = document.getElementById('hotelPlaceFilter');
  if(!sel) return;
  if(HOTELS.length === 0) buildHotelsFromPlaces();
  const places = Array.from(new Set(HOTELS.map(h=>h.place)));
  sel.innerHTML = `<option value="">-- Select place to view hotels --</option>`;
  places.forEach(p=> {
    sel.insertAdjacentHTML('beforeend', `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`);
  });
}

/* ---------- Render hotels ---------- */
function renderHotels(list, options = {limitDefault: true, showNote:true}){
  if(!Array.isArray(list)) list = HOTELS || [];
  const grid = document.getElementById('hotelGrid');
  const note = document.getElementById('hotelPageNote');
  if(!grid) return;
  if(options.limitDefault && (!document.getElementById('hotelPlaceFilter').value && !(document.getElementById('hotelSearch').value||'').trim())){
    const top10 = list.slice(0,10);
    grid.innerHTML = '';
    top10.forEach(h => grid.appendChild(createHotelCard(h)));
    if(note) note.textContent = `Showing ${top10.length} suggestions. Use the place filter or search to view hotels for a specific place.`;
    return;
  }
  grid.innerHTML = '';
  if(list.length === 0){
    grid.innerHTML = '<div class="small-muted">No hotels found.</div>';
    if(note) note.textContent = '';
    return;
  }
  list.forEach(h => grid.appendChild(createHotelCard(h)));
  if(note) note.textContent = `Showing ${list.length} hotel(s).`;
  applyImageFallbacks(grid);
}

/* helper: create DOM card for a hotel */
function createHotelCard(h){
  const card = document.createElement('div');
  card.className = 'hotel-card';
  card.innerHTML = `
    <img class="hotel-thumb" src="${h.image}" alt="${escapeHtml(h.name)}">
    <div class="hotel-info">
      <div class="hotel-title">${escapeHtml(h.name)}</div>
      <div class="hotel-meta">${escapeHtml(h.place)} â€¢ ${escapeHtml(h.city)} â€¢ from \u20B9${h.baseRate} / baseline</div>
      <div class="hotel-actions">
        <button class="primary" data-hid="${h.id}">Select</button>
        <button class="btn-ghost" data-hid-details="${h.id}">Details</button>
      </div>
      <div style="margin-top:8px" class="small-muted">Room types: <span class="atg-badge">Luxurious</span> <span class="atg-badge">Normal</span> <span class="atg-badge">Luggage</span></div>
    </div>
  `;
  setTimeout(()=> {
    const selBtn = card.querySelector('button[data-hid]');
    if(selBtn) selBtn.addEventListener('click', ()=> openHotelModal(h.id));
    const detBtn = card.querySelector('button[data-hid-details]');
    if(detBtn) detBtn.addEventListener('click', ()=> showHotelDetails(h.id));
  },0);
  return card;
}

/* ---------- Search handler (wired to Search button) ---------- */
document.addEventListener('click', function(evt){
  if(evt.target && evt.target.id === 'hotelSearchBtn'){
    const q = (document.getElementById('hotelSearch').value||'').toLowerCase().trim();
    const place = document.getElementById('hotelPlaceFilter').value;
    let filtered = (HOTELS || []).filter(h=>{
      const matchQ = !q || h.name.toLowerCase().includes(q) || h.city.toLowerCase().includes(q);
      const matchP = !place || h.place === place;
      return matchQ && matchP;
    });
    renderHotels(filtered, {limitDefault:false});
  }
});

/* Also render default limited set when navigating to hotelPage via nav button */
(function integrateNavHotels(){
  const navBtn = document.getElementById('navHotelsBtn');
  if(navBtn) navBtn.addEventListener('click', ()=> {
    showPage('hotelPage');
    if(HOTELS.length===0) buildHotelsFromPlaces();
    renderHotels(HOTELS, {limitDefault:true});
  });
})();

/* ---------- Hotel modal / booking flow (uses HOTELS) ---------- */
function showHotelDetails(id){
  const hotel = (HOTELS||[]).find(h=>h.id===id);
  if(!hotel) return alert('No details found');
  const html = `
    <div class="modal-overlay" id="hotelDetailsModal">
      <div class="modal">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div>
            <h3 style="margin:0">${escapeHtml(hotel.name)}</h3>
            <div class="small-muted">${escapeHtml(hotel.place)} â€¢ ${escapeHtml(hotel.city)}</div>
          </div>
          <div><button onclick="closeModal('hotelDetailsModal')" class="btn-ghost">Close</button></div>
        </div>
        <div style="display:flex;gap:12px;margin-top:12px">
          <img src="${hotel.image}" style="width:180px;height:120px;object-fit:cover;border-radius:8px">
          <div style="flex:1">
            <div class="small-muted">Description: Hotel near ${escapeHtml(hotel.place)}. Base rate: \u20B9${hotel.baseRate} (used to calculate room rates).</div>
            <div style="margin-top:10px">
              ${ROOM_TYPES.map(rt => `<div style="margin-bottom:6px"><strong>${rt.label}</strong> â€” ${rt.desc} â€” from \u20B9${Math.round(hotel.baseRate * rt.mult)}</div>`).join('')}
            </div>
          </div>
        </div>
        <div style="margin-top:12px; text-align:right">
          <button class="primary" onclick="openHotelModal('${hotel.id}')">Book this hotel</button>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', html);
}

function openHotelModal(id){
  const hotel = (HOTELS||[]).find(h=>h.id===id);
  if(!hotel) return alert('Hotel not found');
  const modalId = 'hotelBookModal';
  const html = `
    <div class="modal-overlay" id="${modalId}">
      <div class="modal">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div>
            <h3 style="margin:0">${escapeHtml(hotel.name)}</h3>
            <div class="small-muted">${escapeHtml(hotel.place)} â€¢ ${escapeHtml(hotel.city)}</div>
          </div>
          <div><button onclick="closeModal('${modalId}')" class="btn-ghost">Close</button></div>
        </div>

        <div style="margin-top:12px;display:flex;gap:12px">
          <img src="${hotel.image}" style="width:180px;height:120px;object-fit:cover;border-radius:8px">
          <div style="flex:1">
            <div class="small-muted">Choose room type & number of days</div>

            <div class="room-type" id="roomTypesWrap">
              ${ROOM_TYPES.map(rt => `<button data-type="${rt.key}" data-label="${escapeHtml(rt.label)}" data-mult="${rt.mult}" class="${rt.key==='normal' ? 'selected' : ''}">${escapeHtml(rt.label)} â€” \u20B9${Math.round(hotel.baseRate * rt.mult)} / baseline</button>`).join('')}
            </div>

            <div style="margin-top:8px;display:flex;gap:8px;align-items:center">
              <label style="margin:0">Days</label>
              <input id="bookDays" type="number" min="1" value="1" style="width:80px;padding:6px;border-radius:8px;border:1px solid #e6eef8;margin-left:6px" />
              <label style="margin-left:12px">Rooms</label>
              <input id="bookRooms" type="number" min="1" value="1" style="width:80px;padding:6px;border-radius:8px;border:1px solid #e6eef8;margin-left:6px" />
            </div>

            <div style="margin-top:10px" class="book-panel">
              <div>Price per day: <strong id="pricePerDay">\u20B9${Math.round(hotel.baseRate)}</strong></div>
              <div style="margin-top:6px">Total estimate: <strong id="priceTotal">\u20B9${Math.round(hotel.baseRate)}</strong></div>
              <div class="small-muted" style="margin-top:6px">Note: This is an estimate. Taxes and fees not included.</div>
            </div>

            <div style="margin-top:12px;display:flex;gap:8px;justify-content:flex-end">
              <button class="btn-ghost" onclick="closeModal('${modalId}')">Cancel</button>
              <button class="primary" id="proceedPayBtn">Proceed To Payment</button>

              
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', html);

  const wrap = document.getElementById(modalId).querySelector('#roomTypesWrap');
  function getSelected(){
    const btns = wrap.querySelectorAll('button[data-type]');
    let sel = null;
    btns.forEach(b=> { if(b.classList.contains('selected')) sel = b; });
    return sel;
  }
  wrap.querySelectorAll('button[data-type]').forEach(btn=>{
    btn.addEventListener('click', ()=> {
      wrap.querySelectorAll('button').forEach(b=> b.classList.remove('selected'));
      btn.classList.add('selected');
      recalc();
    });
  });
  const daysInput = document.getElementById('bookDays');
  const roomsInput = document.getElementById('bookRooms');
  daysInput.addEventListener('input', recalc);
  roomsInput.addEventListener('input', recalc);

  function recalc(){
    const sel = getSelected();
    const mult = sel ? Number(sel.dataset.mult) : 1;
    const perDay = Math.round(hotel.baseRate * mult);
    const days = Math.max(1, Number(daysInput.value||1));
    const rooms = Math.max(1, Number(roomsInput.value||1));
    const total = perDay * days * rooms;
    document.getElementById('pricePerDay').textContent = `\u20B9${perDay}`;
    document.getElementById('priceTotal').textContent = `\u20B9${total}`;
  }
  recalc();

  const payBtn = document.getElementById(modalId).querySelector('#proceedPayBtn');
  if(payBtn) payBtn.addEventListener('click', async ()=>{
    if(payBtn.dataset.loading === '1') return;
    const sel = getSelected();
    const typeKey = sel ? sel.dataset.type : 'normal';
    const typeLabel = sel ? (sel.dataset.label || sel.textContent.trim()) : 'Normal';
    const days = Math.max(1, Number(daysInput.value||1));
    const rooms = Math.max(1, Number(roomsInput.value||1));
    const perDay = Math.round(hotel.baseRate * (sel ? Number(sel.dataset.mult) : 1));
    const total = perDay * days * rooms;
    const payload = {
      hotelName: hotel.name,
      hotelAddress: hotel.city,
      place: hotel.place,
      city: hotel.city,
      type: typeKey,
      typeLabel,
      days,
      rooms,
      perDay,
      total
    };
    const originalText = payBtn.textContent;
    payBtn.dataset.loading = '1';
    payBtn.disabled = true;
    payBtn.textContent = 'Opening payment...';
    try{
      await createBookingAndPay(payload);
      closeModal(modalId);
    }finally{
      payBtn.dataset.loading = '0';
      payBtn.disabled = false;
      payBtn.textContent = originalText;
    }
  });
}

/* ---------- close modal util ---------- */
function closeModal(id){
  const el = document.getElementById(id);
  if(el) el.remove();
  const det = document.getElementById('hotelDetailsModal');
  if(det && id!=='hotelDetailsModal') det.remove();
}

/* ---------- Expose module functions for inline handlers + other scripts ---------- */
window.PLACE_META = PLACE_META;
try{
  Object.defineProperty(window, 'HOTELS', {
    get(){ return HOTELS; },
    set(v){ HOTELS = v; }
  });
}catch(e){}

Object.assign(window, {
  login,
  register,
  logout,
  showPage,
  showChatPage,
  sendChat,
  addToJourney,
  addItinerary,
  addVisit,
  removeJourney,
  removeIt,
  clearJourney,
  clearItinerary,
  exportJourney,
  exportItinerary,
  generatePDF,
  loadSample,
  nextSquare,
  prevSquare,
  toggleSquareSlideshow,
  toggleDarkMode,
  openBookingsPage,
  openHotelModal,
  openFakePayment,
  closeFakePayment,
  completeFakePayment,
  uploadTripPhotos,
  closeModal,
  closeReceipt,
  buildHotelsFromPlaces,
  renderAll,
  renderHotels,
  getBookings,
  renderHotelBookings,
  renderProfile,
  ensureRazorpay,
  getRazorpayKey,
  applyImageFallbacks,
  onLanguageChange,
  toggleLanguageMenu,
  applyLanguage
});

/* ======= END HOTEL FEATURES ======= */

