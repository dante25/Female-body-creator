# Female Body Creator

2D / 3D kreator ženskog tijela sa slajderima za kompletnu anatomiju – Android aplikacija.

## Mogućnosti
- **2D character sheet**: sprijeda, profil i otpozadi (kao referentni list), vodilice u visinama glave i orijentiri (grudi, struk, bokovi, međunožje).
- **3D model**: proceduralni maneken izgrađen iz istog modela, rotacija/zum prstima, pogledi sprijeda / profil / otpozadi / ¾, boja kože, prikaz mreže.
- **30 slajdera** u 5 grupa: Opće (visina, punoća, mišićavost), Glava i vrat, Trup (ramena, grudni koš, grudi, struk, stomak, bokovi, zadnjica…), Ruke, Noge.
- Mjere u cm (obim grudi, ispod grudi, struka, bokova, širina ramena, unutrašnja dužina noge).
- Predlošci (vitka, atletska, pješčani sat, kruška, punija, manekenka), nasumično, reset.
- Spremanje slike (PNG) u galeriju: `Slike/BodyCreator`.
- Radi potpuno offline; stanje se pamti.

## Preuzimanje APK-a
Svaki push pokreće GitHub Actions workflow **Build APK** koji objavi `BodyCreator.apk`
na stranici **Releases** (i kao artifact workflowa).

## Struktura
- `web/` – aplikacija (HTML/JS, three.js). Može se pokrenuti i u browseru:
  `cd web && python3 -m http.server` pa otvoriti `http://localhost:8000`.
  - `js/model.js` – parametarski model tijela (zajednički za 2D i 3D)
  - `js/sheet2d.js` – 2D list (SVG)
  - `js/view3d.js` – 3D prikaz (three.js)
  - `js/main.js` – UI
- `app/` – Android omotač (WebView + WebViewAssetLoader), `web/` se pakuje u assets.

## Lokalni build
Potreban Android SDK (JDK 17+): `./gradlew assembleRelease` → `app/build/outputs/apk/release/app-release.apk`.
