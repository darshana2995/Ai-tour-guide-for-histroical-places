// ====================== Toast Notification ====================== 
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`; // fixed: use template literal
    toast.textContent = message;
    document.body.appendChild(toast);
    // allow CSS transitions to run
    setTimeout(() => {
        toast.classList.add('show');
    }, 100);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 500);
    }, 3000);
}

// ====================== Dynamic Destination Cards, Forms, Search, Mode, Carousel ======================
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const searchInput = document.getElementById('searchDestination');
    const container = document.getElementById('destinationContainer');
    const modeToggle = document.getElementById('modeToggle');
    const nextBtn = document.getElementById('nextSlide');
    const prevBtn = document.getElementById('prevSlide');
    const carousel = document.getElementById('carouselImage');

    // ====================== Form Validation & LocalStorage ======================
    // Register
    if (registerForm) {
        registerForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = document.getElementById('registerName').value.trim();
            const email = document.getElementById('registerEmail').value.trim();
            const password = document.getElementById('registerPassword').value.trim();

            if (!name || !email || !password) {
                showToast('Please fill in all fields!', 'error');
                return;
            }

            if (password.length < 6) {
                showToast('Password must be at least 6 characters!', 'error');
                return;
            }

            // Save user in localStorage
            let users = JSON.parse(localStorage.getItem('users')) || [];
            if (users.some(u => u.email === email)) {
                showToast('Email already registered!', 'error');
                return;
            }

            users.push({ name, email, password });
            localStorage.setItem('users', JSON.stringify(users));
            showToast('Registration successful!', 'success');
            registerForm.reset();
        });
    }

    // Login
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('loginEmail').value.trim();
            const password = document.getElementById('loginPassword').value.trim();

            let users = JSON.parse(localStorage.getItem('users')) || [];
            const user = users.find(u => u.email === email && u.password === password);
            if (user) {
                localStorage.setItem('currentUser', JSON.stringify(user));
                // fixed: use template literal or quoted string
                showToast(`Welcome back, ${user.name}!`, 'success');
                setTimeout(() => {
                    window.location.href = 'home.html';
                }, 1000);
            } else {
                showToast('Invalid credentials!', 'error');
            }
        });
    }

    // ====================== Destinations data ======================
    const destinations = [
        { name: 'Eiffel Tower', location: 'Paris', rating: 4.8, image: 'images/eiffel.jpg', description: 'Iconic landmark of Paris.' },
        { name: 'Colosseum', location: 'Rome', rating: 4.7, image: 'images/colosseum.jpg', description: 'Ancient Roman amphitheater.' },
        { name: 'Great Wall', location: 'China', rating: 4.9, image: 'images/greatwall.jpg', description: 'Longest wall in the world.' },
    ];

    // ====================== Load destinations =====
    function loadDestinations(list = destinations) {
        if (!container) return;
        container.innerHTML = '';
        list.forEach(dest => {
            const card = document.createElement('div');
            card.className = 'destination-card';
            card.innerHTML = `
                <img src="${dest.image}" alt="${dest.name}">
                <h3>${dest.name}</h3>
                <p>${dest.location}</p>
                <p>⭐ ${dest.rating}</p>
                <button class="view-btn">View More</button>
                <button class="hotels-btn small">View Hotels</button>
            `;
            container.appendChild(card);

            // View more popup
            const btn = card.querySelector('.view-btn');
            btn.addEventListener('click', () => {
                showPopup(dest);
            });

            // View hotels button (if hotels exist)
            const hotelsBtn = card.querySelector('.hotels-btn');
            if (hotelsBtn) {
                hotelsBtn.addEventListener('click', () => {
                    // Attempt to show hotels for this destination
                    if (typeof showHotelsForDestination === 'function') {
                        showHotelsForDestination(dest.name);
                    } else {
                        showToast('Hotel feature unavailable', 'info');
                    }
                });
            }
        });
    }

    function showPopup(dest) {
        const popup = document.createElement('div');
        popup.className = 'popup';
        popup.innerHTML = `
            <div class="popup-content">
                <span class="close-btn">&times;</span>
                <img src="${dest.image}" alt="${dest.name}">
                <h2>${dest.name}</h2>
                <p>${dest.description}</p>
                <p>Location: ${dest.location}</p>
                <p>Rating: ⭐ ${dest.rating}</p>
            </div>
        `;
        document.body.appendChild(popup);

        const content = popup.querySelector('.popup-content');
        popup.querySelector('.close-btn').addEventListener('click', () => popup.remove());

        // close when clicking outside popup-content
        popup.addEventListener('click', (ev) => {
            if (!content.contains(ev.target)) popup.remove();
        });
    }

    // initially load
    loadDestinations();

    // ====================== Search Filter ======================
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            const query = searchInput.value.toLowerCase();
            const filtered = destinations.filter(d =>
                d.name.toLowerCase().includes(query) ||
                d.location.toLowerCase().includes(query)
            );
            loadDestinations(filtered);
        });
    }

    // ====================== Dark / Light Mode ======================
    if (modeToggle) {
        modeToggle.addEventListener('click', () => {
            document.body.classList.toggle('dark-mode');
            if (document.body.classList.contains('dark-mode')) {
                showToast('Dark mode activated!', 'info');
            } else {
                showToast('Light mode activated!', 'info');
            }
        });
    }

    // ====================== Carousel Feature ======================
    let currentIndex = 0;
    function showCarousel() {
        if (!carousel || destinations.length === 0) return;
        carousel.src = destinations[currentIndex].image;
        carousel.alt = destinations[currentIndex].name;
    }

    function nextSlide() {
        if (destinations.length === 0) return;
        currentIndex = (currentIndex + 1) % destinations.length;
        showCarousel();
    }

    function prevSlide() {
        if (destinations.length === 0) return;
        currentIndex = (currentIndex - 1 + destinations.length) % destinations.length;
        showCarousel();
    }

    // attach buttons if present
    if (nextBtn) nextBtn.addEventListener('click', nextSlide);
    if (prevBtn) prevBtn.addEventListener('click', prevSlide);

    // initial carousel show
    showCarousel();

    /* ===========================================================
       HOTEL FEATURES (added non-destructively) — uses localStorage
       - tryLoadHotelsJSON() will attempt to fetch ./hotels.json (optional)
       - buildHotelsFromDestinations() creates 2 hotels per destination
       - renderHotels() / createHotelCard() show hotel UI if corresponding DOM exists
       - openHotelModal() allows booking; bookings saved to localStorage under 'bookings'
       =========================================================== */

    const HOTEL_FALLBACK_IMAGES = [
        "images/hotel1.jpg",
        "images/hotel2.jpg",
        "images/hotel3.jpg",
        "images/hotel4.jpg",
        "images/hotel5.jpg"
    ];

    let HOTELS = []; // array of {id,name,place,city,image,baseRate}
    let HOTELS_LOADED_FROM_JSON = false;

    function slug(s){ return String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,''); }

    // Try to load hotels.json from same directory (optional)
    function tryLoadHotelsJSON(){
        // skip if already loaded
        if(HOTELS_LOADED_FROM_JSON) return;
        fetch('hotels.json', { cache: "no-store" })
            .then(r => {
                if(!r.ok) throw new Error('no json');
                return r.json();
            })
            .then(data => {
                if(Array.isArray(data) && data.length){
                    HOTELS = data.map(h => ({
                        id: h.id || (slug(h.place||'') + '-' + Math.random().toString(36).slice(2,8)),
                        name: h.name || (h.place + ' Hotel'),
                        place: h.place || (h.name || 'Unknown'),
                        city: h.city || '',
                        image: h.image || HOTEL_FALLBACK_IMAGES[Math.floor(Math.random()*HOTEL_FALLBACK_IMAGES.length)],
                        baseRate: Number(h.baseRate || 1200)
                    }));
                    HOTELS_LOADED_FROM_JSON = true;
                    // If hotel UI present, render default view
                    renderHotels(HOTELS, { limitDefault: true });
                } else {
                    // fallback
                    buildHotelsFromDestinations();
                }
            })
            .catch(err=>{
                // fallback
                buildHotelsFromDestinations();
            });
    }

    // Build 2 hotels per destination (non-destructive) using the `destinations` list
    function buildHotelsFromDestinations(){
        HOTELS = [];
        let idx = 0;
        destinations.forEach(dest => {
            const place = dest.name;
            const city = dest.location || '';
            const base = 1500 + (idx % 5) * 250;

            // Hotel A - nicer
            HOTELS.push({
                id: `${slug(place)}-a`,
                name: `${place} Palace Hotel`,
                place,
                city,
                image: HOTEL_FALLBACK_IMAGES[idx % HOTEL_FALLBACK_IMAGES.length],
                baseRate: Math.round(base * 1.8)
            });

            // Hotel B - budget/standard
            HOTELS.push({
                id: `${slug(place)}-b`,
                name: `${place} Stay Inn`,
                place,
                city,
                image: HOTEL_FALLBACK_IMAGES[(idx+1) % HOTEL_FALLBACK_IMAGES.length],
                baseRate: Math.round(base * 1.0)
            });

            idx++;
        });
        // render default set if UI exists
        renderHotels(HOTELS, { limitDefault: true });
    }

    // Render hotels into an element with id 'hotelGrid' (if exists)
    // Behavior:
    //  - If no filter/search, show 10 default suggestions (or fewer if less available)
    //  - If place or search used, show matching hotels
    function renderHotels(list, options = { limitDefault: true }){
        const grid = document.getElementById('hotelGrid');
        const note = document.getElementById('hotelPageNote');
        if(!grid) return; // nothing to render into
        list = Array.isArray(list) ? list : (HOTELS || []);
        // if default limit and no search/place, show only 10
        const placeFilterEl = document.getElementById('hotelPlaceFilter');
        const searchEl = document.getElementById('hotelSearch');
        const placeVal = placeFilterEl ? placeFilterEl.value : '';
        const q = searchEl ? (searchEl.value || '').trim() : '';

        if(options.limitDefault && !placeVal && !q){
            const top = list.slice(0,10);
            grid.innerHTML = '';
            top.forEach(h => grid.appendChild(createHotelCard(h)));
            if(note) note.textContent = `Showing ${top.length} suggestions. Use the place filter or search to view hotels for a specific place.`;
            return;
        }

        // otherwise show provided list
        grid.innerHTML = '';
        if(list.length === 0){
            grid.innerHTML = '<div class="small-muted">No hotels found.</div>';
            if(note) note.textContent = '';
            return;
        }
        list.forEach(h => grid.appendChild(createHotelCard(h)));
        if(note) note.textContent = `Showing ${list.length} hotel(s).`;
    }

    // Create DOM card for a hotel (used by renderHotels)
    function createHotelCard(h){
        const card = document.createElement('div');
        card.className = 'hotel-card';
        card.innerHTML = `
            <img class="hotel-thumb" src="${h.image}" alt="${escapeHtml(h.name)}" style="width:120px;height:84px;object-fit:cover;border-radius:8px;margin-right:10px">
            <div class="hotel-info" style="flex:1">
              <div class="hotel-title" style="font-weight:700;margin-bottom:4px">${escapeHtml(h.name)}</div>
              <div class="hotel-meta" style="color:#6b7280;font-size:13px;margin-bottom:8px">${escapeHtml(h.place)} • ${escapeHtml(h.city)} • from ₹${h.baseRate} / baseline</div>
              <div class="hotel-actions" style="display:flex;gap:8px">
                <button class="primary select-hotel" data-hid="${h.id}">Select</button>
                <button class="btn-ghost details-hotel" data-hid-details="${h.id}">Details</button>
              </div>
            </div>
        `;
        // attach handlers
        setTimeout(()=> {
            const sel = card.querySelector('.select-hotel');
            const det = card.querySelector('.details-hotel');
            if(sel) sel.addEventListener('click', ()=> openHotelModal(h.id));
            if(det) det.addEventListener('click', ()=> showHotelDetails(h.id));
        },0);
        return card;
    }

    // Show detailed modal about hotel
    function showHotelDetails(id){
        const hotel = (HOTELS || []).find(h => h.id === id);
        if(!hotel){
            showToast('Hotel not found', 'error');
            return;
        }
        const html = `
            <div class="modal-overlay" id="hotelDetailsModal" style="position:fixed;inset:0;background:rgba(2,6,23,0.45);display:flex;align-items:center;justify-content:center;z-index:10000">
              <div class="modal" style="width:560px;max-width:95%;background:#fff;border-radius:12px;padding:16px;box-shadow:0 18px 40px rgba(2,6,23,0.25)">
                <div style="display:flex;justify-content:space-between;align-items:center">
                  <div>
                    <h3 style="margin:0">${escapeHtml(hotel.name)}</h3>
                    <div class="small-muted">${escapeHtml(hotel.place)} • ${escapeHtml(hotel.city)}</div>
                  </div>
                  <div><button onclick="document.getElementById('hotelDetailsModal')?.remove()" class="btn-ghost" style="padding:6px 8px;border-radius:8px">Close</button></div>
                </div>
                <div style="display:flex;gap:12px;margin-top:12px">
                  <img src="${hotel.image}" style="width:180px;height:120px;object-fit:cover;border-radius:8px">
                  <div style="flex:1">
                    <div class="small-muted">Description: Hotel near ${escapeHtml(hotel.place)}. Base rate: ₹${hotel.baseRate} (used to calculate room rates).</div>
                    <div style="margin-top:10px">
                      <div style="margin-bottom:6px"><strong>Luxurious</strong> — Spacious room with premium amenities — from ₹${Math.round(hotel.baseRate * 1.9)}</div>
                      <div style="margin-bottom:6px"><strong>Normal</strong> — Standard comfortable room — from ₹${Math.round(hotel.baseRate)}</div>
                      <div style="margin-bottom:6px"><strong>Luggage</strong> — Secure luggage-only service — from ₹${Math.round(hotel.baseRate * 0.35)}</div>
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

    // Open booking modal and allow booking
    function openHotelModal(id){
        const hotel = (HOTELS || []).find(h => h.id === id);
        if(!hotel){
            showToast('Hotel not found', 'error');
            return;
        }
        const modalId = 'hotelBookModal';
        const html = `
            <div class="modal-overlay" id="${modalId}" style="position:fixed;inset:0;background:rgba(2,6,23,0.45);display:flex;align-items:center;justify-content:center;z-index:10000">
              <div class="modal" style="width:560px;max-width:95%;background:#fff;border-radius:12px;padding:16px;box-shadow:0 18px 40px rgba(2,6,23,0.25)">
                <div style="display:flex;justify-content:space-between;align-items:center">
                  <div>
                    <h3 style="margin:0">${escapeHtml(hotel.name)}</h3>
                    <div class="small-muted">${escapeHtml(hotel.place)} • ${escapeHtml(hotel.city)}</div>
                  </div>
                  <div><button onclick="document.getElementById('${modalId}')?.remove()" class="btn-ghost" style="padding:6px 8px;border-radius:8px">Close</button></div>
                </div>

                <div style="margin-top:12px;display:flex;gap:12px">
                  <img src="${hotel.image}" style="width:180px;height:120px;object-fit:cover;border-radius:8px">
                  <div style="flex:1">
                    <div class="small-muted">Choose room type & number of days</div>

                    <div class="room-type" id="roomTypesWrap" style="display:flex;gap:8px;align-items:center;margin-top:8px">
                      <button data-type="lux" data-mult="1.9" class="room-btn">Luxurious — ₹${Math.round(hotel.baseRate * 1.9)}</button>
                      <button data-type="normal" data-mult="1.0" class="room-btn selected">Normal — ₹${Math.round(hotel.baseRate)}</button>
                      <button data-type="luggage" data-mult="0.35" class="room-btn">Luggage — ₹${Math.round(hotel.baseRate * 0.35)}</button>
                    </div>

                    <div style="margin-top:8px;display:flex;gap:8px;align-items:center">
                      <label style="margin:0">Days</label>
                      <input id="bookDays" type="number" min="1" value="1" style="width:80px;padding:6px;border-radius:8px;border:1px solid #e6eef8;margin-left:6px" />
                      <label style="margin-left:12px">Rooms</label>
                      <input id="bookRooms" type="number" min="1" value="1" style="width:80px;padding:6px;border-radius:8px;border:1px solid #e6eef8;margin-left:6px" />
                    </div>

                    <div style="margin-top:10px" class="book-panel">
                      <div>Price per day: <strong id="pricePerDay">₹${Math.round(hotel.baseRate)}</strong></div>
                      <div style="margin-top:6px">Total estimate: <strong id="priceTotal">₹${Math.round(hotel.baseRate)}</strong></div>
                      <div class="small-muted" style="margin-top:6px">Note: This is an estimate. Taxes and fees not included.</div>
                    </div>

                    <div style="margin-top:12px;display:flex;gap:8px;justify-content:flex-end">
                      <button class="btn-ghost" onclick="document.getElementById('${modalId}')?.remove()">Cancel</button>
                      <button class="primary" id="confirmBookBtn">Confirm Booking</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', html);

        const wrap = document.getElementById(modalId).querySelector('#roomTypesWrap');
        function getSelected(){
            const btns = wrap.querySelectorAll('.room-btn');
            let sel = null;
            btns.forEach(b=> { if(b.classList.contains('selected')) sel = b; });
            return sel;
        }
        wrap.querySelectorAll('.room-btn').forEach(btn=>{
            btn.addEventListener('click', ()=> {
                wrap.querySelectorAll('.room-btn').forEach(b=> b.classList.remove('selected'));
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
            document.getElementById('pricePerDay').textContent = `₹${perDay}`;
            document.getElementById('priceTotal').textContent = `₹${total}`;
        }
        recalc();

        document.getElementById('confirmBookBtn').addEventListener('click', ()=>{
            const sel = getSelected();
            const typeKey = sel ? sel.dataset.type : 'normal';
            const typeLabel = sel ? sel.textContent.split('—')[0].trim() : 'Normal';
            const days = Math.max(1, Number(daysInput.value||1));
            const rooms = Math.max(1, Number(roomsInput.value||1));
            const perDay = Math.round(hotel.baseRate * (sel ? Number(sel.dataset.mult) : 1));
            const total = perDay * days * rooms;
            const bookings = JSON.parse(localStorage.getItem('bookings')||'[]');
            const booking = { id: Date.now(), hotelId: hotel.id, hotelName: hotel.name, place: hotel.place, city: hotel.city, type: typeKey, typeLabel, days, rooms, perDay, total };
            bookings.push(booking);
            localStorage.setItem('bookings', JSON.stringify(bookings));
            showToast('Booking confirmed and saved.', 'success');
            // remove modal
            document.getElementById(modalId)?.remove();
        });
    }

    // show hotels for a given destination name (search/filter then render)
    function showHotelsForDestination(placeName){
        // Ensure hotels are available
        if(!HOTELS || HOTELS.length === 0) buildHotelsFromDestinations();
        const filtered = (HOTELS || []).filter(h => (h.place || '').toLowerCase() === (placeName || '').toLowerCase());
        // If hotelGrid exists, render into it; otherwise, open a simple modal listing
        const grid = document.getElementById('hotelGrid');
        if(grid){
            renderHotels(filtered, { limitDefault: false });
            // also navigate UI if there is a hotel page (attempt)
            const hotelPage = document.getElementById('hotelPage');
            if(hotelPage){
                // show hotel page if using SPA pages (user likely has their own)
                Array.from(document.querySelectorAll('.page')).forEach(p => p.classList.remove('active'));
                hotelPage.classList.add('active');
            }
            showToast(`Showing hotels near ${placeName}`, 'info');
            return;
        }
        // Fallback modal
        const listHtml = filtered.length ? filtered.map(h=>`<li>${escapeHtml(h.name)} — ${escapeHtml(h.city)} — from ₹${h.baseRate} <button data-hid="${h.id}" class="book-inline">Book</button></li>`).join('') : '<li>No hotels found for this place.</li>';
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style = "position:fixed;inset:0;background:rgba(2,6,23,0.45);display:flex;align-items:center;justify-content:center;z-index:10000";
        modal.innerHTML = `<div class="modal" style="width:560px;max-width:95%;background:#fff;border-radius:12px;padding:16px;">
            <div style="display:flex;justify-content:space-between;align-items:center">
              <h3 style="margin:0">Hotels near ${escapeHtml(placeName)}</h3>
              <button class="btn-ghost close-inline" style="padding:6px 8px;border-radius:8px">Close</button>
            </div>
            <ul style="margin-top:12px">${listHtml}</ul>
        </div>`;
        document.body.appendChild(modal);
        modal.querySelector('.close-inline').addEventListener('click', ()=> modal.remove());
        modal.querySelectorAll('.book-inline').forEach(b=>{
            b.addEventListener('click', (e)=>{
                const id = e.currentTarget.dataset.hid;
                modal.remove();
                openHotelModal(id);
            });
        });
    }

    // Wire up hotel search button and filter if present in DOM
    const hotelSearchBtn = document.getElementById('hotelSearchBtn');
    if(hotelSearchBtn){
        hotelSearchBtn.addEventListener('click', ()=> {
            // ensure hotels loaded
            if(!HOTELS || HOTELS.length === 0) buildHotelsFromDestinations();
            const q = (document.getElementById('hotelSearch') ? (document.getElementById('hotelSearch').value || '').toLowerCase().trim() : '');
            const place = (document.getElementById('hotelPlaceFilter') ? document.getElementById('hotelPlaceFilter').value : '');
            let filtered = (HOTELS || []).filter(h => {
                const matchQ = !q || (h.name || '').toLowerCase().includes(q) || (h.city || '').toLowerCase().includes(q);
                const matchP = !place || (h.place || '') === place;
                return matchQ && matchP;
            });
            renderHotels(filtered, { limitDefault: false });
        });
    }

    // If a hotel page trigger exists, show default suggestions when clicked
    const navHotelsBtn = document.getElementById('navHotelsBtn');
    if(navHotelsBtn){
        navHotelsBtn.addEventListener('click', ()=>{
            if(!HOTELS || HOTELS.length === 0) tryLoadHotelsJSON();
            // render default (limited) suggestions if hotelGrid exists
            renderHotels(HOTELS, { limitDefault: true });
        });
    }

    // Try to load hotels.json on startup (non-blocking)
    tryLoadHotelsJSON();

    // expose helper to window for integration with other app parts if needed
    window.HOTEL_FEATURES = {
        HOTELS,
        tryLoadHotelsJSON,
        buildHotelsFromDestinations,
        renderHotels,
        showHotelsForDestination,
        openHotelModal
    };

}); // DOMContentLoaded end

/* ---------- helpers ---------- */
function escapeHtml(str){
    if(!str) return '';
    return String(str).replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
}
/* ===== PAYMENT FUNCTIONS ===== */

let upiTime = 10;
let upiInterval;

function openPaymentModal(){
  const modal = document.getElementById("paymentModal");
  if (!modal) {
    alert("Payment modal missing");
    return;
  }
  modal.style.display = "flex";

  upiTime = 10;
  document.getElementById("upiTimer").innerText = upiTime;

  upiInterval = setInterval(() => {
    upiTime--;
    document.getElementById("upiTimer").innerText = upiTime;
    if (upiTime <= 0) {
      clearInterval(upiInterval);
      modal.style.display = "none";
      alert("Payment time expired");
    }
  }, 1000);
}

function closePaymentModal(){
  clearInterval(upiInterval);
  document.getElementById("paymentModal").style.display = "none";
}

function confirmUPIPayment(){
  clearInterval(upiInterval);
  document.getElementById("paymentModal").style.display = "none";
  alert("✅ Payment Successful. Booking Confirmed!");
}
