# Firebase Deployment Instructions

## Setting up Firebase Storage Rules

The license upload functionality requires proper Firebase Storage security rules. Follow these steps:

### 1. Install Firebase CLI (if not already installed)
```bash
npm install -g firebase-tools
```

### 2. Login to Firebase
```bash
firebase login
```

### 3. Initialize Firebase in your project (if not already done)
```bash
firebase init
```
- Select "Storage: Configure a security rules file for Cloud Storage"
- Use the default `storage.rules` file

### 4. Deploy the Storage Rules
```bash
firebase deploy --only storage
```

### 5. Alternative: Manual Setup via Firebase Console

If you prefer to set up the rules manually:

1. Go to the [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `care-db-project`
3. Navigate to "Storage" in the left sidebar
4. Click on the "Rules" tab
5. Replace the existing rules with the content from `storage.rules`
6. Click "Publish"

## Current Storage Rules

The `storage.rules` file in this project contains:

- Allow authenticated users to upload license files to `/licenses/` folder
- Allow authenticated users to upload files to `/caregivers/{caregiverId}/` folders
- Allow public read access to `/public/` folder
- Maximum file size: 10MB
- Deny all other access

## Fallback Method

If Firebase Storage rules are not configured, the application will automatically fall back to storing license images as base64 data directly in Firestore. This method works without additional configuration but has some limitations:

- Larger data size (base64 encoding increases file size by ~33%)
- Slower loading times for images
- Counts against Firestore document size limits

## Testing Upload Functionality

1. Create a new caregiver with a license image
2. Check the browser console for upload logs
3. If Firebase Storage upload fails, the fallback method should activate automatically
4. The license image should be visible in the caregiver details

## Troubleshooting

### Common Issues:

1. **CORS errors**: Usually resolved by proper Storage rules deployment
2. **Authentication errors**: Ensure user is logged in before uploading
3. **File size errors**: Check that files are under 10MB
4. **Permission errors**: Verify Storage rules are deployed correctly

### Debug Steps:

1. Check browser console for detailed error messages
2. Verify Firebase authentication is working
3. Test with smaller image files first
4. Check Firebase Console > Storage > Rules for current rules
