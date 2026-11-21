# Flutter patient app
Generate native runner files with `flutter create --platforms=android,ios,web .` from this directory, then `flutter pub get`.

Android emulator: `flutter run --dart-define=API_BASE_URL=http://10.0.2.2:4000`

Chrome: `flutter run -d chrome --dart-define=API_BASE_URL=http://localhost:4000`

On Android, local development over HTTP may require `android:usesCleartextTraffic="true"` on the `<application>` tag of `android/app/src/main/AndroidManifest.xml`. Use HTTPS for production.

The API's appointment slots are UTC for deterministic demo behavior; adapt timezone handling for real clinics.
