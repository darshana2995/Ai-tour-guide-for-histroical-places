# Tourism App Backend

## Setup Instructions

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn

### Step 1: Install Dependencies
```
bash
cd BACKEND
npm install
```

### Step 2: Configure Firebase Service Account
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project (tourismapp-a1af5)
3. Go to Project Settings > Service Accounts
4. Click "Generate New Private Key"
5. Download the JSON file
6. Rename it to `serviceAccountKey.json` and place it in the BACKEND folder

### Step 3: Start the Server
```
bash
npm start
```

The server will run on http://localhost:3000

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login with Firebase ID token

### User Profile
- `GET /api/users/:uid` - Get user profile
- `PUT /api/users/:uid` - Update user profile

### Bookings
- `POST /api/bookings` - Create hotel booking
- `GET /api/bookings/:userId` - Get user's bookings
- `DELETE /api/bookings/:bookingId` - Delete booking

### Journeys
- `POST /api/journeys` - Create journey
- `GET /api/journeys/:userId` - Get user's journeys
- `DELETE /api/journeys/:journeyId` - Delete journey

### Trip Photos (URL-based, not Firebase Storage)
- `POST /api/photos` - Save trip photo URL
- `GET /api/photos/:userId` - Get user's trip photos
- `DELETE /api/photos/:photoId` - Delete photo

### Visits
- `POST /api/visits` - Create scheduled visit
- `GET /api/visits/:userId` - Get user's visits

## Important Notes

1. **Images are stored as URLs** - The frontend uses URLs (like Unsplash) for images, not Firebase Storage. This is by design for better performance.

2. **Firebase Auth** - The frontend uses Firebase Client SDK for authentication. The backend verifies tokens using Firebase Admin SDK.

3. **CORS** - The backend is configured to accept CORS requests from any origin. Update the CORS configuration in `server.js` for production use.
