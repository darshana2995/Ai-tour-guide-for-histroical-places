# Firebase Integration & Chatbot Update Plan

## Tasks:
1. [x] Add Firebase SDK imports (Auth, Firestore, Storage) to index.html
2. [x] Replace localStorage-based authentication with Firebase Auth
3. [x] Replace localStorage data storage with Firestore (bookings, trips, profile)
4. [x] Create Backend API with Firebase Admin SDK (Node.js/Express)
5. [x] Update chatbot with specific questions from TODO.txt:
   - HOW TO USE THIS WEBSITE
   - WHO IS OWNER OF THE WEBSITE  
   - WHICH PLACES ARE BEST TO VISIT IN SUMMER, WINTER, RAINY
   - HOW THIS WEBSITE IS USEFUL
   - IS THIS WEBSITE HELPFUL
   - Best Place to visit in months
6. [x] Images render from URL (not Firebase Storage) - Already implemented
7. [x] **Added Stripe Payment Integration** - Real payment processing
8. [x] **Added Email Notifications** - Booking confirmations & welcome emails
9. [ ] Test the implementation

## New Features Added:
### Stripe Payment Integration:
- POST /api/payments/create-intent - Create Stripe payment intent
- POST /api/payments/confirm - Confirm payment and update booking
- GET /api/payments/status/:paymentIntentId - Get payment status

### Email Notifications:
- POST /api/email/send-confirmation - Send booking confirmation email
- POST /api/email/welcome - Send welcome email

## Backend Setup Required:
1. Download serviceAccountKey.json from Firebase Console > Project Settings > Service Accounts
2. Create .env file with Stripe and Email credentials (see .env.example)
3. Run `npm install` in BACKEND folder
4. Run `npm start` to start the backend server on port 3000

## API Endpoints:
- POST /api/auth/register - Register new user
- POST /api/auth/login - Login with ID token
- GET /api/users/:uid - Get user profile
- PUT /api/users/:uid - Update user profile
- POST /api/bookings - Create hotel booking
- GET /api/bookings/:userId - Get user's bookings
- DELETE /api/bookings/:bookingId - Delete booking
- POST /api/journeys - Create journey
- GET /api/journeys/:userId - Get user's journeys
- DELETE /api/journeys/:journeyId - Delete journey
- POST /api/photos - Save trip photo (URL)
- GET /api/photos/:userId - Get user's trip photos
- DELETE /api/photos/:photoId - Delete photo
- POST /api/visits - Create scheduled visit
- GET /api/visits/:userId - Get user's visits

## Firebase Configuration:
- apiKey: AIzaSyBsniEd1fIQGYwjz0B8tVNYJq9JHvR2kmQ
- authDomain: tourguide-d4cfc.firebaseapp.com
- projectId: tourguide-d4cfc
- storageBucket: tourguide-d4cfc.firebasestorage.app
- messagingSenderId: 337581457722
- appId: 1:337581457722:web:2f465ffc23d9a752731003
- measurementId: G-1B25L79KL9
