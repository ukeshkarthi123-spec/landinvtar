# InvestLand

InvestLand is a fractional land investment platform built with Expo, React Native, and Supabase.

## Tech Stack

- **Mobile App**: Expo SDK 52, React Native, Expo Router.
- **Backend**: Supabase (Auth, Database, Storage, Edge Functions).
- **Styling**: NativeWind (Tailwind CSS for React Native).
- **Admin Portal**: React, Vite, Tailwind CSS.

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npx expo start
   ```

3. Build for Android:
   ```bash
   npx expo run:android
   ```

## Production Build

To generate a release APK:

1. Install global tools:
   ```bash
   npm install -g eas-cli
   ```

2. Configure EAS:
   ```bash
   eas build:configure
   ```

3. Build APK:
   ```bash
   eas build -p android --profile preview
   ```
