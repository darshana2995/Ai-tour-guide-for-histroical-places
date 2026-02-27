function addPlacesToPlaceSelect(){
  const PLACES = [
    ["Taj Mahal","Agra, Uttar Pradesh"],
    ["Agra Fort","Agra, Uttar Pradesh"],
    ["Fatehpur Sikri","Fatehpur Sikri, Uttar Pradesh"],
    ["Red Fort","Delhi"],
    ["Qutub Minar","Delhi"],
    ["Humayun's Tomb","Delhi"],
    ["India Gate","Delhi"],
    ["Jama Masjid","Delhi"],
    ["Lotus Temple","Delhi"],
    ["Charminar","Hyderabad, Telangana"],
    ["Golconda Fort","Hyderabad, Telangana"],
    ["Meenakshi Amman Temple","Madurai, Tamil Nadu"],
    ["Brihadeshwara Temple","Thanjavur, Tamil Nadu"],
    ["Mahabalipuram (Mamallapuram)","Tamil Nadu"],
    ["Konark Sun Temple","Konark, Odisha"],
    ["Jagannath Temple, Puri","Puri, Odisha"],
    ["Sanchi Stupa","Sanchi, Madhya Pradesh"],
    ["Khajuraho Group of Monuments","Khajuraho, Madhya Pradesh"],
    ["Ellora Caves","Aurangabad, Maharashtra"],
    ["Ajanta Caves","Aurangabad, Maharashtra"],
    ["Elephanta Caves","Mumbai, Maharashtra"],
    ["Gateway of India","Mumbai, Maharashtra"],
    ["Victoria Memorial","Kolkata, West Bengal"],
    ["Mysore Palace","Mysore, Karnataka"],
    ["Hampi (Vijayanagara)","Hampi, Karnataka"],
    ["Gol Gumbaz","Bijapur (Vijayapura), Karnataka"],
    ["Chittorgarh Fort","Chittorgarh, Rajasthan"],
    ["Mehrangarh Fort","Jodhpur, Rajasthan"],
    ["Jaisalmer Fort","Jaisalmer, Rajasthan"],
    ["Amber Fort","Jaipur, Rajasthan"],
    ["Hawa Mahal","Jaipur, Rajasthan"],
    ["Nalanda University Ruins","Nalanda, Bihar"],
    ["Bodh Gaya (Mahabodhi Temple)","Bodh Gaya, Bihar"],
    ["Kumbhalgarh Fort","Kumbhalgarh, Rajasthan"],
    ["Rani ki Vav (Patan)","Patan, Gujarat"],
    ["Somnath Temple","Somnath, Gujarat"],
    ["Basilica of Bom Jesus","Old Goa, Goa"],
    ["Golden Temple (Harmandir Sahib)","Amritsar, Punjab"],
    ["Jallianwala Bagh","Amritsar, Punjab"],
    ["Statue of Unity (memorial)","Kevadia, Gujarat"],
    ["Bhimbetka Rock Shelters","Madhya Pradesh"],
    ["Kailasa Temple (Ellora)","Ellora, Maharashtra"],
    ["Aihole & Pattadakal","Karnataka"],
    ["Ramanathaswamy Temple (Rameshwaram)","Ramanathapuram, Tamil Nadu"]
  ];

  const FALLBACK_IMAGES = [
    "https://images.unsplash.com/photo-1505765050359-0101643d6e9d?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1467269204594-9661b134dd2b?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1533777324565-a040eb52fac2?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=1200&q=80"
  ];
  let fi = 0;
  function nextFallback(){ const u = FALLBACK_IMAGES[fi % FALLBACK_IMAGES.length]; fi++; return u; }

  if(typeof window.PLACE_META !== 'object') window.PLACE_META = window.PLACE_META || {};

  const select = document.getElementById('placeSelect');
  const hotelFilter = document.getElementById('hotelPlaceFilter');

  PLACES.forEach(function(pair){
    const name = pair[0];
    const city = pair[1] || '';

    if(!window.PLACE_META[name]){
      window.PLACE_META[name] = {
        image: nextFallback(),
        info: `${name} — located in ${city}. A notable historical site; check local timings before visiting.`
      };
    }

    if(select){
      const exists = Array.from(select.options).some(o => o.value.trim().toLowerCase() === name.trim().toLowerCase());
      if(!exists){
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        select.appendChild(opt);
      }
    }

    if(hotelFilter){
      const existsH = Array.from(hotelFilter.options).some(o => o.value.trim().toLowerCase() === name.trim().toLowerCase());
      if(!existsH){
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        hotelFilter.appendChild(opt);
      }
    }
  });

  const hotels = window.HOTELS || [];
  if(typeof buildHotelsFromPlaces === 'function' && hotels.length === 0) buildHotelsFromPlaces();

  try{ if(typeof renderAll === 'function') renderAll(); }catch(e){}
  try{ if(document.getElementById('hotelGrid') && typeof renderHotels === 'function') renderHotels(window.HOTELS || []); }catch(e){}
}
window.addEventListener('load', () => {
  addPlacesToPlaceSelect();
  const preload = () => {
    ensureRazorpay().catch(()=>{});
    getRazorpayKey().catch(()=>{});
  };
  if('requestIdleCallback' in window){
    window.requestIdleCallback(preload, { timeout: 2000 });
  }else{
    setTimeout(preload, 500);
  }
});





function suggestDestination(){

 const month=document.getElementById("monthSelect").value;
 const result=document.getElementById("destinationResult");

 if(!month){
  result.innerHTML="Please select month";
  return;
 }

 const places=MONTH_DESTINATIONS[month];

 let html = `<h3>Best Places in ${month}</h3>`;
 html += `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:15px">`;

 places.forEach(p=>{
  html += `
  <div style="background:white;border-radius:12px;overflow:hidden;box-shadow:0 6px 18px rgba(0,0,0,0.15)">
    <img src="${p.img}" loading="lazy" style="width:100%;height:160px;object-fit:cover">
    <div style="padding:12px">
      <h4>${p.name}</h4>
    </div>
  </div>
  `;
 });

 html += `</div>`;

 result.innerHTML = html;
}


const MONTH_DESTINATIONS = {

January:[
{name:"Jaipur Amber Fort",img:"https://images.unsplash.com/photo-1599661046289-e31897846e41"},
{name:"Rann of Kutch",img:"https://images.unsplash.com/photo-1589308078055-ebf36d2b0e95"},
{name:"Goa Churches",img:"https://images.unsplash.com/photo-1560179707-f14e90ef3623"},
{name:"Mount Abu Trek",img:"https://images.unsplash.com/photo-1500530855697-b586d89ba3ee"},
{name:"Alleppey Backwaters",img:"https://images.unsplash.com/photo-1602216056096-3b40cc0c9944"}
],

February:[
{name:"Taj Mahal",img:"https://images.unsplash.com/photo-1548013146-72479768bada"},
{name:"Udaipur City Palace",img:"https://images.unsplash.com/photo-1593696954577-ab3d39317b97"},
{name:"Hampi Ruins",img:"https://images.unsplash.com/photo-1605640840605-14ac1855827b"},
{name:"Coorg Trek",img:"https://images.unsplash.com/photo-1501785888041-af3ef285b470"},
{name:"Jodhpur Mehrangarh Fort",img:"https://images.unsplash.com/photo-1588099768531-a72d4a198538"}
],

March:[
{name:"Varanasi Ghats",img:"https://images.unsplash.com/photo-1561361058-c24cecae35ca"},
{name:"Khajuraho Temples",img:"https://images.unsplash.com/photo-1583212292454-1fe6229603b7"},
{name:"Rishikesh Trek",img:"https://images.unsplash.com/photo-1501555088652-021faa106b9b"},
{name:"Sikkim Monasteries",img:"https://images.unsplash.com/photo-1544735716-392fe2489ffa"},
{name:"Kaziranga Park",img:"https://images.unsplash.com/photo-1571406255390-3b1d764e1e32"}
],

April:[
{name:"Ooty Hills",img:"https://images.unsplash.com/photo-1587474260584-136574528ed5"},
{name:"Darjeeling Tea Gardens",img:"https://images.unsplash.com/photo-1597074866923-dc0589150358"},
{name:"Munnar Hills",img:"https://images.unsplash.com/photo-1593693411515-c20261bcad6e"},
{name:"Tawang Monastery",img:"https://images.unsplash.com/photo-1582456891925-a53965520520"}
],

May:[
{name:"Shimla",img:"https://images.unsplash.com/photo-1622308644420-b20142dc993c"},
{name:"Manali",img:"https://images.unsplash.com/photo-1581793745862-99fde7fa73d2"},
{name:"Nainital",img:"https://images.unsplash.com/photo-1627894483216-2138af692e32"},
{name:"Mussoorie Trek",img:"https://images.unsplash.com/photo-1500534314209-a25ddb2bd429"}
],

June:[
{name:"Leh Palace",img:"https://images.unsplash.com/photo-1597047084897-51e81819a499"},
{name:"Ladakh Monasteries",img:"https://images.unsplash.com/photo-1595933548862-3f0c6e7a0e6c"},
{name:"Spiti Valley",img:"https://images.unsplash.com/photo-1605540436563-5bca919ae766"},
{name:"Kashmir Valley",img:"https://images.unsplash.com/photo-1598091383021-15ddea10925d"}
],

July:[
{name:"Mysore Palace",img:"https://images.unsplash.com/photo-1564507592333-c60657eea523"},
{name:"Coorg Hills",img:"https://images.unsplash.com/photo-1501785888041-af3ef285b470"},
{name:"Cherrapunji",img:"https://images.unsplash.com/photo-1549887534-3ec93abae5b1"},
{name:"Valley of Flowers Trek",img:"https://images.unsplash.com/photo-1464822759023-fed622ff2c3b"}
],

August:[
{name:"Red Fort Delhi",img:"https://images.unsplash.com/photo-1587474260584-136574528ed5"},
{name:"Qutub Minar",img:"https://images.unsplash.com/photo-1585130040316-7a43b82bdfd6"},
{name:"Udaipur Lakes",img:"https://images.unsplash.com/photo-1593696954577-ab3d39317b97"},
{name:"Mahabaleshwar Trek",img:"https://images.unsplash.com/photo-1500534314209-a25ddb2bd429"}
],

September:[
{name:"Ajanta Caves",img:"https://images.unsplash.com/photo-1627894483216-2138af692e32"},
{name:"Ellora Caves",img:"https://images.unsplash.com/photo-1627308595229-7830a5c91f9f"},
{name:"Hyderabad Golconda Fort",img:"https://images.unsplash.com/photo-1595846519845-68e298c2edd8"},
{name:"Ziro Valley",img:"https://images.unsplash.com/photo-1501785888041-af3ef285b470"}
],

October:[
{name:"Hampi",img:"https://images.unsplash.com/photo-1605640840605-14ac1855827b"},
{name:"Konark Sun Temple",img:"https://images.unsplash.com/photo-1593693411515-c20261bcad6e"},
{name:"Kullu Valley",img:"https://images.unsplash.com/photo-1597047084897-51e81819a499"},
{name:"Sundarbans",img:"https://images.unsplash.com/photo-1571406255390-3b1d764e1e32"}
],

November:[
{name:"Hyderabad Fort",img:"https://images.unsplash.com/photo-1595846519845-68e298c2edd8"},
{name:"Golden Temple",img:"https://images.unsplash.com/photo-1587735570212-6b5c4f9e26ef"},
{name:"Jaisalmer Fort",img:"https://images.unsplash.com/photo-1593693411515-c20261bcad6e"},
{name:"Pushkar Desert Trek",img:"https://images.unsplash.com/photo-1464822759023-fed622ff2c3b"}
],

December:[
{name:"Goa Beaches",img:"https://images.unsplash.com/photo-1507525428034-b723cf961d3e"},
{name:"Kerala Backwaters",img:"https://images.unsplash.com/photo-1602216056096-3b40cc0c9944"},
{name:"Andaman Islands",img:"https://images.unsplash.com/photo-1507525428034-b723cf961d3e"},
{name:"Auli Snow Trek",img:"https://images.unsplash.com/photo-1483721310020-03333e577078"}
]

};


function suggestDestination(){
 const month=document.getElementById("monthSelect").value;
 const result=document.getElementById("destinationResult");

 if(!month){
  result.innerHTML="Select month first";
  return;
 }

 const places=MONTH_DESTINATIONS[month];
 const pick=places[Math.floor(Math.random()*places.length)];

 result.innerHTML="<h3>"+pick+"</h3>";
}

function generateAIPlan(){

  const month = document.getElementById("aiMonth").value;
  const budget = Number(document.getElementById("aiBudget").value);
  const days = Number(document.getElementById("aiDays").value);
  const resultDiv = document.getElementById("aiResult");

  if(!month || !budget || !days){
    resultDiv.innerHTML = "<b style='color:red'>Please fill all fields</b>";
    return;
  }

  // ---------- PLACE + TRAVEL AI ----------
  let places = [];
  let travelMode = "Train";

  if(month === "December" || month === "January"){
    places = ["Taj Mahal", "Jaipur", "Varanasi", "Rann of Kutch"];
    travelMode = "Train";
  }
  else if(month === "March" || month === "February"){
    places = ["Hampi", "Mysore", "Madurai", "Goa Churches"];
    travelMode = "Bus";
  }
  else if(month === "June" || month === "July"){
    places = ["Ladakh", "Spiti Valley", "Manali", "Shimla"];
    travelMode = "Flight";
  }
  else{
    places = ["Delhi", "Agra", "Khajuraho", "Sanchi"];
    travelMode = "Train";
  }

  // ---------- COST CALCULATION AI ----------

  let travelCost = 0;
  let hotelPerNight = 0;
  let foodPerDay = 0;

  // Travel cost based on mode
  if(travelMode === "Train") travelCost = 1200;
  if(travelMode === "Bus") travelCost = 1800;
  if(travelMode === "Flight") travelCost = 6000;
  // Travel type removed from planner UI; keep baseline estimates.
  const typeMultiplier = 1;

  // Hotel AI based on budget category
  if(budget >= 60000){
    hotelPerNight = 3500;
    foodPerDay = 900;
  }
  else if(budget >= 40000){
    hotelPerNight = 2200;
    foodPerDay = 700;
  }
  else{
    hotelPerNight = 1400;
    foodPerDay = 500;
  }

  // Total Calculations
  let hotelTotal = hotelPerNight * days;
  let foodTotal = foodPerDay * days;
  hotelTotal = Math.round(hotelTotal * typeMultiplier);
  foodTotal = Math.round(foodTotal * typeMultiplier);
  let totalExpense = Math.round((travelCost * typeMultiplier) + hotelTotal + foodTotal);
  let remaining = budget - totalExpense;

  // ---------- OUTPUT ----------
  resultDiv.innerHTML = `
    <h3>?? AI Trip Cost Analysis</h3>

    <p><b>?? Best Places:</b> ${places.join(", ")}</p>
    <p><b>?? Suggested Travel Mode:</b> ${travelMode}</p>

    <hr>

    <h4>?? Cost Breakdown</h4>
    <p>?? Travel Cost: ?${travelCost}</p>
    <p>?? Hotel Cost (${days} nights): ?${hotelTotal}</p>
    <p>??? Food Cost (${days} days): ?${foodTotal}</p>

    <hr>

    <h4>?? Total Trip Expense: ?${totalExpense}</h4>
    <h4 style="color:${remaining>=0?'green':'red'}">
      ?? Remaining Budget: ?${remaining}
    </h4>

    <p class="small-muted">
      AI estimated using seasonal travel trends + average India travel cost dataset.
    </p>
  `;
}

function surpriseWeekendPlan(){
  const resultDiv = document.getElementById("aiResult");
  const budget = 10000;
  const days = 3;
  const monthSelect = document.getElementById("aiMonth");
  const currentMonth = new Date().toLocaleString('en-US', { month: 'long' });
  if(monthSelect){
    const hasCurrentOption = Array.from(monthSelect.options).some(opt => opt.value === currentMonth);
    if(hasCurrentOption){
      monthSelect.value = currentMonth;
    }
  }
  const month = (monthSelect && monthSelect.value) ? monthSelect.value : currentMonth;
  const monthly = Array.isArray(MONTH_DESTINATIONS[month]) ? MONTH_DESTINATIONS[month].map(p => p.name) : [];
  const fallbackHistorical = [
    "Taj Mahal",
    "Red Fort Delhi",
    "Qutub Minar",
    "Hampi",
    "Konark Sun Temple",
    "Ajanta Caves",
    "Ellora Caves",
    "Khajuraho Temples",
    "Jaisalmer Fort",
    "Golden Temple"
  ];

  const unique = [];
  const seen = new Set();
  [...monthly, ...fallbackHistorical].forEach(name => {
    if(!name || seen.has(name)) return;
    seen.add(name);
    unique.push(name);
  });

  while(unique.length < 5){
    unique.push(`Historical Spot ${unique.length + 1}`);
  }
  const places = unique.slice(0, 5);

  // Fixed breakdown to exactly match 10,000 budget for 3 days.
  const travelCost = 3000;
  const hotelCost = 3600;      // 2 nights
  const foodCost = 1800;       // 3 days
  const ticketsCost = 1000;
  const localCost = 600;
  const total = travelCost + hotelCost + foodCost + ticketsCost + localCost;
  const remaining = budget - total;
  const perPlaceSightseeing = Math.floor((ticketsCost + localCost) / places.length);

  resultDiv.innerHTML = `
    <h3>Surprise Historical Plan (Instant)</h3>
    <p><b>Month:</b> ${month}</p>
    <p><b>Duration:</b> ${days} days</p>
    <p><b>Places (5):</b> ${places.join(", ")}</p>
    <p><b>Travel:</b> Train/Bus (budget mode)</p>
    <p><b>Stay:</b> Budget hotel/guest house</p>

    <div class="itinerary-day">
      <b>Day 1</b>
      <ul>
        <li>Morning: Visit ${places[0]}</li>
        <li>Afternoon: Explore ${places[1]}</li>
        <li>Evening: Local food + rest</li>
      </ul>
    </div>
    <div class="itinerary-day">
      <b>Day 2</b>
      <ul>
        <li>Morning: Visit ${places[2]}</li>
        <li>Afternoon: Explore ${places[3]}</li>
        <li>Evening: Cultural walk</li>
      </ul>
    </div>
    <div class="itinerary-day">
      <b>Day 3</b>
      <ul>
        <li>Morning: Visit ${places[4]}</li>
        <li>Afternoon: Shopping/food trail</li>
        <li>Evening: Return trip</li>
      </ul>
    </div>

    <h4 style="margin-top:10px">?? Budget (Max ?10,000)</h4>
    <p>Travel: ?${travelCost}</p>
    <p>Hotel (2 nights): ?${hotelCost}</p>
    <p>Food (3 days): ?${foodCost}</p>
    <p>Entry tickets: ?${ticketsCost}</p>
    <p>Local transport: ?${localCost}</p>
    <p>Per-place sightseeing allocation (5 places): ?${perPlaceSightseeing} each</p>
    <h4>Total: ?${total}</h4>
    <h4 style="color:${remaining>=0?'green':'red'}">Remaining: ?${remaining}</h4>
  `;
}
/* ===== FORCE TOURIST IMAGES (FIX BLANK IMAGES) ===== */



function editProfile(){

  let newName = prompt("Enter Name", window.user.name || "");
  let newPhone = prompt("Enter Phone", window.user.phone || "");

  if(newName) window.user.name = newName;
  if(newPhone) window.user.phone = newPhone;

  localStorage.setItem("atg_session", JSON.stringify(window.user));

  renderProfile();
}

function uploadPhoto(){

  let file = document.getElementById("photoUpload").files[0];

  if(!file) return;

  let reader = new FileReader();

  reader.onload = function(e){

    window.user.photo = e.target.result;

    localStorage.setItem("atg_session", JSON.stringify(window.user));

    renderProfile();

  }

  reader.readAsDataURL(file);

}





function downloadReceiptPDF(data){
  const receiptHTML = `
    <html>
    <head>
      <title>Payment Receipt</title>
      <style>
        body{font-family:Arial;padding:20px}
        h2{color:#3b82f6}
        .box{border:1px solid #ddd;padding:15px;border-radius:10px}
      </style>
    </head>
    <body>
      <h2>Hotel Booking Receipt</h2>
      <div class="box">
        <p><b>Hotel:</b> ${data.hotel || "-"}</p>
        <p><b>Place:</b> ${data.place || "-"}</p>
        <p><b>Room Type:</b> ${data.type || "-"}</p>
        <p><b>Days:</b> ${data.days || "-"}</p>
        <p><b>Total Paid:</b> ?${data.total || "0"}</p>
        <p><b>Date:</b> ${new Date().toLocaleString()}</p>
      </div>
      <div style="margin-top:16px">
        <button onclick="window.print()">Print / Save as PDF</button>
      </div>
    </body>
    </html>
  `;
  const w = window.open('', '_blank');
  if(!w){ alert('Popup blocked. Please allow popups to view the receipt.'); return; }
  w.document.open();
  w.document.write(receiptHTML);
  w.document.close();
}





