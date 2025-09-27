# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Structure

This is a minimal Firebase-based React application with:

- **Root level**: Firebase configuration and project-wide scripts
- **client/**: React TypeScript application built with Vite
  - Material-UI for components
  - Jotai for state management (global application state)
  - React Router for navigation
  - Firebase Authentication with Google provider

## Development Commands

### Setup

```bash
npm run install:all        # Install all dependencies (root + client)
```

### Development

```bash
npm run start:emulators     # Start Firebase emulators (run first)
npm run start:client        # Start Vite dev server at http://localhost:5173
```

### Build & Deploy

```bash
npm run build              # Build client for production
cd client && npm run build # Alternative: build client directly
npm run deploy:prod        # Build and deploy to Firebase
```

### Linting

```bash
cd client && npm run lint  # Run ESLint on client code
```

## Architecture Overview

### State Management

- **Jotai atoms** in `client/src/hooks/ApplicationState.ts`:
  - `userAtom`: Current Firebase user
  - `loadingAtom`: Auth initialization loading state
  - `isAuthenticatedAtom`: Computed authentication status

### Firebase Integration

- **Development**: Uses Firebase emulators with demo config
- **Production**: Loads config from Firebase hosting
- **Auth**: Google OAuth with popup flow
- **Services**: Firestore and Storage configured via `firebase.json`

### Key Files

- `client/src/hooks/ApplicationState.ts`: Firebase setup and global state
- `client/src/hooks/UserService.ts`: Authentication service class
- `client/src/App.tsx`: Main application component with auth UI
- `firebase.json`: Firebase project configuration
- `firestore.rules`: Firestore security rules

## Firebase Emulator Ports

- Auth: 9099
- Firestore: 8080
- Storage: 9199
- UI Dashboard: 4000

## Development Notes

- The app automatically connects to emulators in development mode
- Auth state is managed globally through Jotai atoms
- Material-UI components use custom styling with Emotion
- Firebase services are initialized asynchronously and cached
