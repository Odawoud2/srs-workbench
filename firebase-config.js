/* SRS Workbench: Firebase settings.
   Leave SRS_FIREBASE_CONFIG as null to run in local mode (no sign-in; edits stay in the browser).
   To switch on sign-in, shared storage, roles and the audit log, paste the web-app configuration from the Firebase console
   (Project settings > General > Your apps > SDK setup and configuration > Config) in place of null, for example:

   window.SRS_FIREBASE_CONFIG = {
     apiKey: "AIza...", authDomain: "srs-workbench.firebaseapp.com", projectId: "srs-workbench",
     storageBucket: "srs-workbench.appspot.com", messagingSenderId: "1234567890", appId: "1:1234567890:web:abcdef"
   };

   These values identify the project and are safe to publish; access is controlled by Authentication and firestore.rules. */
window.SRS_FIREBASE_CONFIG = null;
