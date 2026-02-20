// ============================================
// Tourism App Backend with Firebase Auth & Firestore
// ============================================

const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

// Initialize Firebase Admin SDK
// You'll need to download serviceAccountKey.json from Firebase Console
// Go to Project Settings > Service Accounts > Generate New Private Key
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const auth = admin.auth();

const app = express();
app.use(cors());
app.use(express.json());

// ============================================
// AUTH MIDDLEWARE & ADMIN CONFIG
// ============================================

const ADMIN_UIDS = (process.env.ADMIN_UIDS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '')
  .split(',')
  .map(s => s.trim().toLowerCase())
  .filter(Boolean);

function isAdminUser(decoded) {
  const uidMatch = ADMIN_UIDS.includes(decoded.uid);
  const emailMatch = decoded.email && ADMIN_EMAILS.includes(String(decoded.email).toLowerCase());
  return uidMatch || emailMatch;
}

async function verifyAuth(req, res, next) {
  try {
    const header = req.headers.authorization || req.headers.Authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Missing auth token' });
    const decoded = await auth.verifyIdToken(token);
    decoded.isAdmin = isAdminUser(decoded);
    req.user = decoded;
    next();
  } catch (error) {
    console.error('Auth verify error:', error);
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

// ============================================
// AUTH ROUTES (using Firebase Auth)
// ============================================

// Register - Create user in Firebase Auth
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name, phone } = req.body;
    
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, and name are required' });
    }

    // Create user in Firebase Auth
    const userRecord = await auth.createUser({
      email,
      password,
      displayName: name
    });

    // Save additional user data to Firestore
    await db.collection('users').doc(userRecord.uid).set({
      email,
      name,
      phone: phone || '',
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.status(201).json({
      message: 'User registered successfully',
      uid: userRecord.uid,
      email: userRecord.email,
      name: name
    });
  } catch (error) {
    console.error('Registration error:', error);
    if (error.code === 'auth/email-already-exists') {
      return res.status(400).json({ error: 'Email already registered' });
    }
    res.status(500).json({ error: error.message });
  }
});

// Login - Verify Firebase ID token
app.post('/api/auth/login', async (req, res) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({ error: 'ID token is required' });
    }

    // Verify the ID token
    const decodedToken = await auth.verifyIdToken(idToken);
    
    // Get user data from Firestore
    const userDoc = await db.collection('users').doc(decodedToken.uid).get();
    const userData = userDoc.exists ? userDoc.data() : {};

    res.json({
      message: 'Login successful',
      user: {
        uid: decodedToken.uid,
        email: decodedToken.email,
        name: userData.name || decodedToken.name || '',
        phone: userData.phone || ''
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
});

// Get current user (with admin flag)
app.get('/api/auth/me', verifyAuth, async (req, res) => {
  res.json({
    uid: req.user.uid,
    email: req.user.email || '',
    name: req.user.name || '',
    isAdmin: !!req.user.isAdmin
  });
});

// Sync current user's profile (upsert)
app.post('/api/users/sync', verifyAuth, async (req, res) => {
  try {
    const { name, phone, email } = req.body || {};
    const uid = req.user.uid;
    const userRef = db.collection('users').doc(uid);
    const snap = await userRef.get();

    const updateData = {
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    if (typeof email === 'string' && email.trim()) {
      updateData.email = email.trim();
    } else if (!snap.exists && req.user.email) {
      updateData.email = req.user.email;
    }

    if (typeof name === 'string' && name.trim()) {
      updateData.name = name.trim();
    } else if (!snap.exists && req.user.email) {
      updateData.name = req.user.email.split('@')[0];
    }

    if (typeof phone === 'string') {
      updateData.phone = phone;
    }

    if (!snap.exists) {
      updateData.createdAt = admin.firestore.FieldValue.serverTimestamp();
    }

    await userRef.set(updateData, { merge: true });
    res.json({ message: 'User synced successfully', uid });
  } catch (error) {
    console.error('Sync user error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get User Profile
app.get('/api/users/:uid', verifyAuth, async (req, res) => {
  try {
    const { uid } = req.params;
    if (uid !== req.user.uid && !req.user.isAdmin) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const userDoc = await db.collection('users').doc(uid).get();
    
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ uid: userDoc.id, ...userDoc.data() });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update User Profile
app.put('/api/users/:uid', verifyAuth, async (req, res) => {
  try {
    const { uid } = req.params;
    if (uid !== req.user.uid && !req.user.isAdmin) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const { name, phone } = req.body;

    const updateData = {};
    if (name) updateData.name = name;
    if (phone) updateData.phone = phone;
    updateData.updatedAt = admin.firestore.FieldValue.serverTimestamp();

    await db.collection('users').doc(uid).update(updateData);

    res.json({ message: 'Profile updated successfully' });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// BOOKING ROUTES (Hotel Bookings in Firestore)
// ============================================

// Create Hotel Booking
app.post('/api/bookings', verifyAuth, async (req, res) => {
  try {
    const { hotelName, hotelAddress, place, city, type, typeLabel, days, rooms, perDay, total } = req.body;

    if (!hotelName || !place) {
      return res.status(400).json({ error: 'Hotel name and place are required' });
    }

    const bookingRef = await db.collection('bookings').add({
      userId: req.user.uid,
      hotelName,
      hotelAddress: hotelAddress || '',
      place,
      city: city || '',
      type: type || 'normal',
      typeLabel: typeLabel || 'Normal',
      days: days || 1,
      rooms: rooms || 1,
      perDay: perDay || 0,
      total: total || 0,
      paymentStatus: 'pending',
      paymentProvider: 'razorpay',
      paidAt: null,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.status(201).json({
      message: 'Booking created successfully',
      bookingId: bookingRef.id
    });
  } catch (error) {
    console.error('Create booking error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get Current User's Bookings
app.get('/api/bookings', verifyAuth, async (req, res) => {
  try {
    const bookingsSnapshot = await db.collection('bookings')
      .where('userId', '==', req.user.uid)
      .get();

    const bookings = [];
    bookingsSnapshot.forEach(doc => {
      bookings.push({ id: doc.id, ...doc.data() });
    });

    bookings.sort((a,b) => tsToMillis(b.createdAt) - tsToMillis(a.createdAt));
    res.json({ bookings });
  } catch (error) {
    console.error('Get bookings error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get User's Bookings
app.get('/api/bookings/:userId', verifyAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    if (userId !== req.user.uid && !req.user.isAdmin) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    
    const bookingsSnapshot = await db.collection('bookings')
      .where('userId', '==', userId)
      .get();

    const bookings = [];
    bookingsSnapshot.forEach(doc => {
      bookings.push({ id: doc.id, ...doc.data() });
    });

    bookings.sort((a,b) => tsToMillis(b.createdAt) - tsToMillis(a.createdAt));
    res.json({ bookings });
  } catch (error) {
    console.error('Get bookings error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete Booking
app.delete('/api/bookings/:bookingId', verifyAuth, async (req, res) => {
  try {
    const { bookingId } = req.params;
    const bookingDoc = await db.collection('bookings').doc(bookingId).get();
    if (!bookingDoc.exists) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    const bookingData = bookingDoc.data();
    if (bookingData.userId !== req.user.uid && !req.user.isAdmin) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    await db.collection('bookings').doc(bookingId).delete();
    
    res.json({ message: 'Booking deleted successfully' });
  } catch (error) {
    console.error('Delete booking error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// JOURNEY ROUTES (Trips in Firestore)
// ============================================

// Create Journey
app.post('/api/journeys', verifyAuth, async (req, res) => {
  try {
    const { place, arrive, hotel, nights, price, travelMode, notes } = req.body;

    if (!place) {
      return res.status(400).json({ error: 'Place is required' });
    }

    const journeyRef = await db.collection('journeys').add({
      userId: req.user.uid,
      place,
      arrive: arrive || '',
      hotel: hotel || '',
      nights: nights || 1,
      price: price || 0,
      travelMode: travelMode || 'Train',
      notes: notes || '',
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.status(201).json({
      message: 'Journey created successfully',
      journeyId: journeyRef.id
    });
  } catch (error) {
    console.error('Create journey error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Mark booking as paid (Fake payment)
app.post('/api/bookings/:bookingId/mark-paid', verifyAuth, async (req, res) => {
  try {
    const { bookingId } = req.params;
    const bookingDoc = await db.collection('bookings').doc(bookingId).get();
    if (!bookingDoc.exists) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    const bookingData = bookingDoc.data();
    if (bookingData.userId !== req.user.uid && !req.user.isAdmin) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    await db.collection('bookings').doc(bookingId).update({
      paymentStatus: 'paid',
      paymentProvider: 'fake',
      paidAt: admin.firestore.FieldValue.serverTimestamp()
    });
    res.json({ success: true, message: 'Booking marked as paid' });
  } catch (error) {
    console.error('Mark paid error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get Current User's Journeys
app.get('/api/journeys', verifyAuth, async (req, res) => {
  try {
    const journeysSnapshot = await db.collection('journeys')
      .where('userId', '==', req.user.uid)
      .get();

    const journeys = [];
    journeysSnapshot.forEach(doc => {
      journeys.push({ id: doc.id, ...doc.data() });
    });

    journeys.sort((a,b) => tsToMillis(b.createdAt) - tsToMillis(a.createdAt));
    res.json({ journeys });
  } catch (error) {
    console.error('Get journeys error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get User's Journeys (admin or self)
app.get('/api/journeys/:userId', verifyAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    if (userId !== req.user.uid && !req.user.isAdmin) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    
    const journeysSnapshot = await db.collection('journeys')
      .where('userId', '==', userId)
      .get();

    const journeys = [];
    journeysSnapshot.forEach(doc => {
      journeys.push({ id: doc.id, ...doc.data() });
    });

    journeys.sort((a,b) => tsToMillis(b.createdAt) - tsToMillis(a.createdAt));
    res.json({ journeys });
  } catch (error) {
    console.error('Get journeys error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete Journey
app.delete('/api/journeys/:journeyId', verifyAuth, async (req, res) => {
  try {
    const { journeyId } = req.params;
    const journeyDoc = await db.collection('journeys').doc(journeyId).get();
    if (!journeyDoc.exists) {
      return res.status(404).json({ error: 'Journey not found' });
    }
    const journeyData = journeyDoc.data();
    if (journeyData.userId !== req.user.uid && !req.user.isAdmin) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    await db.collection('journeys').doc(journeyId).delete();
    
    res.json({ message: 'Journey deleted successfully' });
  } catch (error) {
    console.error('Delete journey error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// ADMIN ROUTES (Overview)
// ============================================

function tsToISO(ts) {
  if (!ts) return null;
  if (typeof ts.toDate === 'function') return ts.toDate().toISOString();
  return ts;
}

function tsToMillis(ts) {
  if (!ts) return 0;
  if (typeof ts.toDate === 'function') return ts.toDate().getTime();
  if (typeof ts._seconds === 'number') return ts._seconds * 1000;
  const d = new Date(ts);
  return isNaN(d.getTime()) ? 0 : d.getTime();
}

app.get('/api/admin/overview', verifyAuth, requireAdmin, async (req, res) => {
  try {
    const [bookingsSnap, journeysSnap, usersSnap] = await Promise.all([
      db.collection('bookings').orderBy('createdAt', 'desc').limit(200).get(),
      db.collection('journeys').orderBy('createdAt', 'desc').limit(200).get(),
      db.collection('users').orderBy('createdAt', 'desc').limit(500).get()
    ]);

    const bookings = [];
    bookingsSnap.forEach(doc => bookings.push({ id: doc.id, ...doc.data() }));
    const journeys = [];
    journeysSnap.forEach(doc => journeys.push({ id: doc.id, ...doc.data() }));
    const users = [];
    usersSnap.forEach(doc => users.push({ id: doc.id, ...doc.data() }));

    const usersMap = {};
    users.forEach(u => { usersMap[u.id] = u; });

    const bookingsOut = bookings.map(b => ({
      ...b,
      userEmail: usersMap[b.userId]?.email || '',
      createdAt: tsToISO(b.createdAt),
      paidAt: tsToISO(b.paidAt)
    }));

    const journeysOut = journeys.map(j => ({
      ...j,
      userEmail: usersMap[j.userId]?.email || '',
      createdAt: tsToISO(j.createdAt)
    }));

    const bookingCount = {};
    const journeyCount = {};
    const lastBooking = {};
    const lastJourney = {};

    bookings.forEach(b => {
      if(!b.userId) return;
      bookingCount[b.userId] = (bookingCount[b.userId] || 0) + 1;
      if(!lastBooking[b.userId]) lastBooking[b.userId] = b;
    });

    journeys.forEach(j => {
      if(!j.userId) return;
      journeyCount[j.userId] = (journeyCount[j.userId] || 0) + 1;
      if(!lastJourney[j.userId]) lastJourney[j.userId] = j;
    });

    const usersOut = users.map(u => ({
      id: u.id,
      email: u.email || '',
      name: u.name || '',
      phone: u.phone || '',
      createdAt: tsToISO(u.createdAt),
      bookings: bookingCount[u.id] || 0,
      journeys: journeyCount[u.id] || 0,
      lastBookingStatus: lastBooking[u.id]?.paymentStatus || 'none',
      lastBookingTotal: lastBooking[u.id]?.total || 0,
      lastPaidAt: tsToISO(lastBooking[u.id]?.paidAt),
      lastJourneyAt: tsToISO(lastJourney[u.id]?.createdAt)
    }));

    res.json({ bookings: bookingsOut, journeys: journeysOut, users: usersOut });
  } catch (error) {
    console.error('Admin overview error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// TRIP PHOTOS ROUTES (Metadata in Firestore, Images from URL)
// ============================================

// Save Trip Photo (URL, not file)
app.post('/api/photos', verifyAuth, async (req, res) => {
  try {
    const { photoUrl, description } = req.body;

    if (!photoUrl) {
      return res.status(400).json({ error: 'Photo URL is required' });
    }

    const photoRef = await db.collection('tripPhotos').add({
      userId: req.user.uid,
      photoUrl,
      description: description || '',
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.status(201).json({
      message: 'Photo saved successfully',
      photoId: photoRef.id
    });
  } catch (error) {
    console.error('Save photo error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get User's Trip Photos
app.get('/api/photos/:userId', verifyAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    if (userId !== req.user.uid && !req.user.isAdmin) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    
    const photosSnapshot = await db.collection('tripPhotos')
      .where('userId', '==', userId)
      .get();

    const photos = [];
    photosSnapshot.forEach(doc => {
      photos.push({ id: doc.id, ...doc.data() });
    });

    photos.sort((a,b) => tsToMillis(b.createdAt) - tsToMillis(a.createdAt));
    res.json({ photos });
  } catch (error) {
    console.error('Get photos error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete Photo
app.delete('/api/photos/:photoId', verifyAuth, async (req, res) => {
  try {
    const { photoId } = req.params;
    const photoDoc = await db.collection('tripPhotos').doc(photoId).get();
    if (!photoDoc.exists) {
      return res.status(404).json({ error: 'Photo not found' });
    }
    const photoData = photoDoc.data();
    if (photoData.userId !== req.user.uid && !req.user.isAdmin) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    await db.collection('tripPhotos').doc(photoId).delete();
    
    res.json({ message: 'Photo deleted successfully' });
  } catch (error) {
    console.error('Delete photo error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// VISITS ROUTES (Scheduled visits in Firestore)
// ============================================

// Create Visit
app.post('/api/visits', verifyAuth, async (req, res) => {
  try {
    const { place, start, duration } = req.body;

    if (!place || !start) {
      return res.status(400).json({ error: 'Place and start time are required' });
    }

    const visitRef = await db.collection('visits').add({
      userId: req.user.uid,
      place,
      start: new Date(start),
      duration: duration || 60,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.status(201).json({
      message: 'Visit created successfully',
      visitId: visitRef.id
    });
  } catch (error) {
    console.error('Create visit error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get User's Visits
app.get('/api/visits/:userId', verifyAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    if (userId !== req.user.uid && !req.user.isAdmin) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    
    const visitsSnapshot = await db.collection('visits')
      .where('userId', '==', userId)
      .get();

    const visits = [];
    visitsSnapshot.forEach(doc => {
      visits.push({ id: doc.id, ...doc.data() });
    });

    visits.sort((a,b) => tsToMillis(a.start) - tsToMillis(b.start));
    res.json({ visits });
  } catch (error) {
    console.error('Get visits error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// PAYMENT ROUTES (Stripe Integration)
// ============================================

// Initialize Stripe with your secret key
// Get this from Stripe Dashboard > Developers > API keys
// Use test key for development: sk_test_...
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_your_stripe_secret_key');

// ============================================
// PAYMENT ROUTES (Razorpay Integration - Test Mode)
// ============================================

const Razorpay = require('razorpay');
const crypto = require('crypto');

let razorpay = null;
if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
  razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
  });
} else {
  console.warn('Razorpay keys are missing. Payment endpoints will be unavailable.');
}

// Get Razorpay Key ID (public)
app.get('/api/payments/razorpay/key', verifyAuth, (req, res) => {
  if (!process.env.RAZORPAY_KEY_ID) {
    return res.status(500).json({ error: 'Razorpay key not configured' });
  }
  res.json({ keyId: process.env.RAZORPAY_KEY_ID });
});

// Create Razorpay Order
app.post('/api/payments/razorpay/order', verifyAuth, async (req, res) => {
  try {
    const { bookingId } = req.body;
    if (!bookingId) {
      return res.status(400).json({ error: 'bookingId is required' });
    }
    if (!razorpay || !process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      return res.status(500).json({ error: 'Razorpay keys not configured' });
    }

    const bookingDoc = await db.collection('bookings').doc(bookingId).get();
    if (!bookingDoc.exists) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    const bookingData = bookingDoc.data();
    if (bookingData.userId !== req.user.uid && !req.user.isAdmin) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const amount = Number(bookingData.total || 0);
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid booking amount' });
    }

    const amountInPaise = Math.round(amount * 100);
    const order = await razorpay.orders.create({
      amount: amountInPaise,
      currency: 'INR',
      receipt: String(bookingId),
      notes: { bookingId, userId: req.user.uid }
    });

    res.json({ orderId: order.id, amount: order.amount, currency: order.currency });
  } catch (error) {
    console.error('Create Razorpay order error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Verify Razorpay Payment and update booking
app.post('/api/payments/razorpay/verify', verifyAuth, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, bookingId } = req.body;
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !bookingId) {
      return res.status(400).json({ error: 'Missing payment verification fields' });
    }
    if (!razorpay || !process.env.RAZORPAY_KEY_SECRET) {
      return res.status(500).json({ error: 'Razorpay key not configured' });
    }

    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expected = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');

    if (expected !== razorpay_signature) {
      return res.status(400).json({ error: 'Invalid signature' });
    }

    const bookingDoc = await db.collection('bookings').doc(bookingId).get();
    if (!bookingDoc.exists) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    const bookingData = bookingDoc.data();
    if (bookingData.userId !== req.user.uid && !req.user.isAdmin) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await db.collection('bookings').doc(bookingId).update({
      paymentStatus: 'paid',
      paymentProvider: 'razorpay',
      paymentId: razorpay_payment_id,
      orderId: razorpay_order_id,
      paidAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.json({ success: true, message: 'Payment verified and booking updated' });
  } catch (error) {
    console.error('Verify Razorpay payment error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create Payment Intent
app.post('/api/payments/create-intent', verifyAuth, async (req, res) => {
  try {
    const { amount, currency = 'inr', bookingId, userId } = req.body;

    if (!amount || !bookingId || !userId) {
      return res.status(400).json({ error: 'Amount, bookingId, and userId are required' });
    }

    // Amount should be in smallest currency unit (paise for INR)
    const amountInPaise = Math.round(amount * 100);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInPaise,
      currency: currency,
      metadata: {
        bookingId: bookingId,
        userId: userId
      },
      automatic_payment_methods: {
        enabled: true
      }
    });

    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    });
  } catch (error) {
    console.error('Create payment intent error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Confirm Payment and Update Booking Status
app.post('/api/payments/confirm', verifyAuth, async (req, res) => {
  try {
    const { paymentIntentId, bookingId } = req.body;

    if (!paymentIntentId || !bookingId) {
      return res.status(400).json({ error: 'Payment intent ID and booking ID are required' });
    }

    // Verify payment with Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status === 'succeeded') {
      // Update booking status in Firestore
      await db.collection('bookings').doc(bookingId).update({
        paymentStatus: 'paid',
        paymentId: paymentIntentId,
        paidAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Get booking details for email
      const bookingDoc = await db.collection('bookings').doc(bookingId).get();
      const bookingData = bookingDoc.data();

      // Get user details for email
      const userDoc = await db.collection('users').doc(bookingData.userId).get();
      const userData = userDoc.data();

      // Send confirmation email
      if (userData && userData.email) {
        await sendBookingConfirmationEmail(userData.email, bookingData);
      }

      res.json({
        success: true,
        message: 'Payment confirmed and booking updated'
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Payment not completed',
        status: paymentIntent.status
      });
    }
  } catch (error) {
    console.error('Confirm payment error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get Payment Status
app.get('/api/payments/status/:paymentIntentId', verifyAuth, async (req, res) => {
  try {
    const { paymentIntentId } = req.params;

    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    res.json({
      status: paymentIntent.status,
      amount: paymentIntent.amount / 100
    });
  } catch (error) {
    console.error('Get payment status error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// EMAIL NOTIFICATION ROUTES (Nodemailer)
// ============================================

const nodemailer = require('nodemailer');

// Create email transporter
// For production, use SMTP credentials
// For development, you can use Gmail with app password or services like SendGrid, Mailgun
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'your-email@gmail.com',
    pass: process.env.EMAIL_PASS || 'your-app-password'
  }
});

// Send Booking Confirmation Email
async function sendBookingConfirmationEmail(email, bookingData) {
  try {
    const mailOptions = {
      from: process.env.EMAIL_USER || 'AI Tour Guide <noreply@aitourguide.com>',
      to: email,
      subject: '🎉 Booking Confirmed - AI Tour Guide',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .booking-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
            .detail-row:last-child { border-bottom: none; }
            .label { font-weight: bold; color: #555; }
            .value { color: #333; }
            .footer { text-align: center; margin-top: 20px; color: #888; font-size: 12px; }
            .btn { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎉 Booking Confirmed!</h1>
              <p>Thank you for booking with AI Tour Guide</p>
            </div>
            <div class="content">
              <p>Dear Customer,</p>
              <p>Your hotel booking has been successfully confirmed! Here are your booking details:</p>
              
              <div class="booking-details">
                <div class="detail-row">
                  <span class="label">Booking ID:</span>
                  <span class="value">${bookingData.id || 'N/A'}</span>
                </div>
                <div class="detail-row">
                  <span class="label">Hotel Name:</span>
                  <span class="value">${bookingData.hotelName || 'N/A'}</span>
                </div>
                <div class="detail-row">
                  <span class="label">Location:</span>
                  <span class="value">${bookingData.place || 'N/A'}${bookingData.city ? ', ' + bookingData.city : ''}</span>
                </div>
                <div class="detail-row">
                  <span class="label">Room Type:</span>
                  <span class="value">${bookingData.typeLabel || 'Normal'}</span>
                </div>
                <div class="detail-row">
                  <span class="label">Number of Days:</span>
                  <span class="value">${bookingData.days || 1}</span>
                </div>
                <div class="detail-row">
                  <span class="label">Number of Rooms:</span>
                  <span class="value">${bookingData.rooms || 1}</span>
                </div>
                <div class="detail-row">
                  <span class="label">Total Amount Paid:</span>
                  <span class="value" style="color: green; font-weight: bold;">₹${bookingData.total || 0}</span>
                </div>
                <div class="detail-row">
                  <span class="label">Payment Status:</span>
                  <span class="value" style="color: green; font-weight: bold;">✓ Paid</span>
                </div>
              </div>
              
              <p>Please keep this email for your records. You can view your booking details anytime by logging into your AI Tour Guide account.</p>
              
              <p>For any queries, feel free to contact us at support@aitourguide.com</p>
              
              <div class="footer">
                <p>© 2024 AI Tour Guide. All rights reserved.</p>
                <p>This is an automated email. Please do not reply directly to this message.</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log('Booking confirmation email sent to:', email);
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
}

// Endpoint to send booking confirmation email
app.post('/api/email/send-confirmation', async (req, res) => {
  try {
    const { email, bookingId } = req.body;

    if (!email || !bookingId) {
      return res.status(400).json({ error: 'Email and booking ID are required' });
    }

    // Get booking details
    const bookingDoc = await db.collection('bookings').doc(bookingId).get();
    
    if (!bookingDoc.exists) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const bookingData = bookingDoc.data();
    const success = await sendBookingConfirmationEmail(email, { id: bookingId, ...bookingData });

    if (success) {
      res.json({ message: 'Confirmation email sent successfully' });
    } else {
      res.status(500).json({ error: 'Failed to send email' });
    }
  } catch (error) {
    console.error('Send confirmation email error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Send Welcome Email
async function sendWelcomeEmail(email, name) {
  try {
    const mailOptions = {
      from: process.env.EMAIL_USER || 'AI Tour Guide <noreply@aitourguide.com>',
      to: email,
      subject: 'Welcome to AI Tour Guide! 🎉',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .features { list-style: none; padding: 0; }
            .features li { padding: 10px 0; display: flex; align-items: center; }
            .features li::before { content: "✓"; color: green; margin-right: 10px; font-weight: bold; }
            .btn { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Welcome to AI Tour Guide! 🎉</h1>
              <p>Your AI-Powered Travel Companion</p>
            </div>
            <div class="content">
              <p>Dear ${name || 'Traveler'},</p>
              <p>Welcome to AI Tour Guide! We're excited to have you on board.</p>
              
              <h3>What you can do with AI Tour Guide:</h3>
              <ul class="features">
                <li>Plan personalized travel itineraries</li>
                <li>Book hotels with secure payments</li>
                <li>Get AI-powered travel recommendations</li>
                <li>Track your travel budget</li>
                <li>Generate printable PDF itineraries</li>
                <li>Chat with AI for travel tips</li>
              </ul>
              
              <p>Start exploring historical places and create your first journey today!</p>
              
              <div class="footer" style="text-align: center; margin-top: 20px; color: #888; font-size: 12px;">
                <p>© 2024 AI Tour Guide. All rights reserved.</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log('Welcome email sent to:', email);
    return true;
  } catch (error) {
    console.error('Error sending welcome email:', error);
    return false;
  }
}

// Endpoint to send welcome email
app.post('/api/email/welcome', async (req, res) => {
  try {
    const { email, name } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const success = await sendWelcomeEmail(email, name);

    if (success) {
      res.json({ message: 'Welcome email sent successfully' });
    } else {
      res.status(500).json({ error: 'Failed to send email' });
    }
  } catch (error) {
    console.error('Send welcome email error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// START SERVER
// ============================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`API Base URL: http://localhost:${PORT}/api`);
  console.log(`Stripe and Email notifications enabled`);
});
